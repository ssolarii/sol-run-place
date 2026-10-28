import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSubmissionsClient, createFirebaseRuntime } from './submissions-client.mjs';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function fixture(overrides = {}) {
  const calls = [];
  const runtime = {
    ensureVisitor: async () => { calls.push('auth'); return { uid: 'visitor' }; },
    readLimiter: async () => { calls.push('limiter'); return null; },
    commit: async (kind, uid, fields) => { calls.push(['commit', kind, uid, fields]); return 'ABCDEFGHIJKLMNOPQRST'; },
    listPublished: async count => { calls.push(['list', count]); return []; },
    ...overrides
  };
  let time = 100000;
  let online = true;
  const client = createSubmissionsClient({
    loadRuntime: async () => { calls.push('load'); return runtime; },
    now: () => time,
    online: () => online
  });
  return { client, calls, runtime, setTime: value => { time = value; }, setOnline: value => { online = value; } };
}

test('submission trims text, awaits atomic commit, and never reads back private data', async () => {
  const completion = deferred();
  const f = fixture({ commit: async (kind, uid, fields) => {
    f.calls.push(['commit', kind, uid, fields]);
    await completion.promise;
    return 'ABCDEFGHIJKLMNOPQRST';
  }});
  let finished = false;
  const pending = f.client.submit('private', {body: '  A private note. \n', displayName: '  A name  '})
    .then(value => { finished = true; return value; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(finished, false);
  assert.deepEqual(f.calls, ['load', 'auth', 'limiter', ['commit', 'private', 'visitor', {body: 'A private note.', displayName: 'A name'}]]);
  completion.resolve();
  assert.deepEqual(await pending, {id: 'ABCDEFGHIJKLMNOPQRST', kind: 'private', status: 'sent'});
  assert.equal(f.client.getCooldown().remainingSeconds, 60);
});

test('construction is idle and public listing does not authenticate visitors', async () => {
  const f = fixture();
  assert.deepEqual(f.calls, []);
  assert.deepEqual(await f.client.listPublished(), []);
  assert.deepEqual(f.calls, ['load', ['list', 50]]);
});

test('invalid kinds, body types/lengths and names fail before SDK or Auth loading', async () => {
  const f = fixture();
  const invalid = [
    ['other', {body: 'x'}], ['private', {body: ' \n '}], ['private', {body: 9}],
    ['private', {body: 'x'.repeat(2001)}], ['guestbook', {body: 'x'.repeat(501)}],
    ['guestbook', {body: 'x', displayName: 'n'.repeat(61)}], ['private', {body: 'x', displayName: null}]
  ];
  for (const [kind, fields] of invalid) {
    await assert.rejects(f.client.submit(kind, fields), error => error.code === 'invalid-input' && !error.retryable);
  }
  assert.deepEqual(f.calls, []);
});

test('valid boundaries are accepted and blank names are omitted', async () => {
  for (const [kind, size] of [['private', 2000], ['guestbook', 500]]) {
    const f = fixture();
    await f.client.submit(kind, {body: 'x'.repeat(size), displayName: '  '});
    assert.deepEqual(f.calls[3][3], {body: 'x'.repeat(size)});
  }
});

test('concurrent cross-form clicks cannot create two commits', async () => {
  const auth = deferred();
  const f = fixture({ ensureVisitor: () => auth.promise });
  const pending = f.client.submit('private', {body: 'One message'});
  await assert.rejects(f.client.submit('guestbook', {body: 'Second message'}), error => error.code === 'busy');
  auth.resolve({uid: 'visitor'});
  await pending;
  assert.equal(f.calls.filter(item => Array.isArray(item) && item[0] === 'commit').length, 1);
});

test('successful submission applies shared cooldown and permits explicit send after it expires', async () => {
  const f = fixture();
  await f.client.submit('private', {body: 'First'});
  await assert.rejects(f.client.submit('guestbook', {body: 'Second'}), error =>
    error.code === 'cooldown' && error.retryAfterSeconds === 60);
  f.setTime(160001);
  assert.equal((await f.client.submit('guestbook', {body: 'Second'})).status, 'pending');
});

test('restored identity server limiter prevents sending before commit', async () => {
  const f = fixture({readLimiter: async () => ({lastSentAt: 90000})});
  await assert.rejects(f.client.submit('private', {body: 'Hello'}), error =>
    error.code === 'cooldown' && error.retryAfterSeconds === 50);
  assert.equal(f.calls.some(item => Array.isArray(item) && item[0] === 'commit'), false);
});

test('offline submission fails before Auth and has a retryable error', async () => {
  const f = fixture();
  f.setOnline(false);
  await assert.rejects(f.client.submit('private', {body: 'Hello'}), error =>
    error.code === 'offline' && error.retryable && !error.uncertain);
  assert.deepEqual(f.calls, []);
});

test('failed Auth is safe to retry explicitly and never starts a commit', async () => {
  let attempts = 0;
  const f = fixture({ensureVisitor: async () => {
    if (++attempts === 1) throw {code: 'auth/network-request-failed'};
    return {uid: 'visitor'};
  }});
  await assert.rejects(f.client.submit('private', {body: 'Hello'}), error => error.retryable && !error.uncertain);
  await f.client.submit('private', {body: 'Hello'});
  assert.equal(attempts, 2);
});

test('ambiguous commit failure never reports success or retries automatically', async () => {
  let commits = 0;
  const f = fixture({commit: async () => { commits++; throw {code: 'unavailable'}; }});
  await assert.rejects(f.client.submit('private', {body: 'Hello'}), error =>
    error.code === 'delivery-unconfirmed' && !error.retryable && error.uncertain);
  assert.equal(commits, 1);
  assert.equal(f.client.getCooldown().remainingSeconds, 60);
});

test('server permission-denied after a competing tab send refreshes the shared cooldown', async () => {
  let reads = 0;
  const f = fixture({
    readLimiter: async () => ++reads === 1 ? null : {lastSentAt: 98000},
    commit: async () => { throw {code: 'permission-denied'}; }
  });
  await assert.rejects(f.client.submit('guestbook', {body: 'Hello'}), error =>
    error.code === 'cooldown' && error.retryAfterSeconds === 58 && !error.uncertain);
});

test('permanent permission failure has a safe error without SDK details or input', async () => {
  const f = fixture({commit: async () => { throw {code: 'permission-denied', message: 'sensitive debug'}; }});
  await assert.rejects(f.client.submit('private', {body: 'private text'}), error =>
    error.code === 'not-accepted' && !error.retryable && !String(error).includes('private text') && !String(error).includes('sensitive debug'));
});

test('public query limit is restricted and failed reads never return cached results', async () => {
  const f = fixture({listPublished: async () => { throw {code: 'unavailable'}; }});
  for (const count of [0, 51, 1.5]) {
    await assert.rejects(f.client.listPublished({limit: count}), error => error.code === 'invalid-input');
  }
  assert.deepEqual(f.calls, []);
  await assert.rejects(f.client.listPublished(), error => error.code === 'unavailable' && error.retryable);
});

test('real runtime waits for restored Auth state and reuses the anonymous session', async () => {
  const ready = deferred();
  const calls = [];
  const auth = {currentUser: null, authStateReady: () => { calls.push('restore'); return ready.promise; }};
  const runtime = await createFirebaseRuntime({
    config: {projectId: 'demo-sol-client-restore', apiKey: 'demo-key', appId: 'demo-app'},
    appName: 'client-restore-unit-test',
    loadAuth: async () => ({
      initializeAuth: () => auth,
      signInAnonymously: async () => { calls.push('sign-in'); return {user: {uid: 'new', isAnonymous: true}}; }
    })
  });
  assert.deepEqual(calls, []);
  const pending = runtime.ensureVisitor();
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(calls, ['restore']);
  auth.currentUser = {uid: 'restored', isAnonymous: true};
  ready.resolve();
  assert.deepEqual(await pending, {uid: 'restored'});
  assert.deepEqual(calls, ['restore']);
});

test('real runtime signs in only after restoration confirms no previous session', async () => {
  const calls = [];
  const runtime = await createFirebaseRuntime({
    config: {projectId: 'demo-sol-client-new', apiKey: 'demo-key', appId: 'demo-app'},
    appName: 'client-new-unit-test',
    loadAuth: async () => ({
      initializeAuth: () => ({currentUser: null, authStateReady: async () => { calls.push('restore'); }}),
      signInAnonymously: async () => { calls.push('sign-in'); return {user: {uid: 'new', isAnonymous: true}}; }
    })
  });
  assert.deepEqual(calls, []);
  assert.deepEqual(await runtime.ensureVisitor(), {uid: 'new'});
  assert.deepEqual(calls, ['restore', 'sign-in']);
  await runtime.ensureVisitor();
  assert.deepEqual(calls, ['restore', 'sign-in']);
});
