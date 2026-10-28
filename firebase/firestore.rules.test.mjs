import { readFile } from 'node:fs/promises';
import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, query, where, limit, orderBy, setDoc,
  updateDoc, deleteDoc, writeBatch, serverTimestamp, Timestamp, setLogLevel } from 'firebase/firestore';

const projectId = 'demo-sol-submissions';
const rulesPath = process.env.FIRESTORE_RULES_PATH || new URL('./firestore.rules', import.meta.url);
// Rejected writes are asserted explicitly below; keep expected SDK denials out of TAP output.
setLogLevel('silent');
let env;
before(async () => {
  env = await initializeTestEnvironment({projectId, firestore: {
    host: '127.0.0.1', port: 8087, rules: await readFile(rulesPath, 'utf8')
  }});
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => { await env?.cleanup(); });

const visitor = (uid = 'alice') => env.authenticatedContext(uid, {
  firebase: {sign_in_provider: 'anonymous'}
}).firestore();
const anonymous = () => env.unauthenticatedContext().firestore();
const entryCollection = kind => kind === 'private' ? 'privateMessages' : 'guestbook';
const newEntry = (db, kind) => doc(collection(db, entryCollection(kind)));
const data = (uid, kind, changes = {}) => ({
  senderId: uid, body: 'A message from a visitor.', createdAt: serverTimestamp(),
  ...(kind === 'guestbook' ? {status: 'pending'} : {}), ...changes
});
function batchSubmission(db, uid, kind, changes = {}, options = {}) {
  const entry = options.entry ?? newEntry(db, kind);
  const batch = writeBatch(db);
  batch.set(entry, data(uid, kind, changes));
  batch.set(doc(db, 'submissionLimits', options.limitUid ?? uid), {
    lastSentAt: serverTimestamp(), entryId: entry.id, kind, ...options.limitChanges
  });
  return {entry, commit: () => batch.commit()};
}
async function seed(path, value) {
  await env.withSecurityRulesDisabled(async c => setDoc(doc(c.firestore(), path), value));
}
const seedEntry = (kind, id, changes = {}) => seed(`${entryCollection(kind)}/${id}`, {
  senderId: 'alice', body: 'Seeded entry', createdAt: Timestamp.fromMillis(Date.now()),
  ...(kind === 'guestbook' ? {status: 'pending'} : {}), ...changes
});
const seedLimit = (uid, millisecondsAgo, changes = {}) => seed(`submissionLimits/${uid}`, {
  lastSentAt: Timestamp.fromMillis(Date.now() - millisecondsAgo),
  entryId: 'AAAAAAAAAAAAAAAAAAAA', kind: 'private', ...changes
});

test('authenticated visitor creates a private message and its matching limiter atomically', async () => {
  const db = visitor();
  const submission = batchSubmission(db, 'alice', 'private', {displayName: 'Alice'});
  await assertSucceeds(submission.commit());
  const limiter = await assertSucceeds(getDoc(doc(db, 'submissionLimits', 'alice')));
  assert.equal(limiter.data().entryId, submission.entry.id);
});

test('authenticated visitor creates a pending guestbook entry without a name', async () => {
  await assertSucceeds(batchSubmission(visitor(), 'alice', 'guestbook').commit());
});

test('unauthenticated submissions to both collections fail', async () => {
  for (const kind of ['private', 'guestbook']) {
    await assertFails(batchSubmission(anonymous(), 'alice', kind).commit());
  }
});

test('private messages cannot be read or listed by anyone, including their sender', async () => {
  await seedEntry('private', 'AAAAAAAAAAAAAAAAAAAA');
  for (const db of [anonymous(), visitor(), visitor('bob')]) {
    await assertFails(getDoc(doc(db, 'privateMessages', 'AAAAAAAAAAAAAAAAAAAA')));
    await assertFails(getDocs(query(collection(db, 'privateMessages'), limit(1))));
  }
});

test('only published guestbook entries can be fetched by document ID', async () => {
  await seedEntry('guestbook', 'AAAAAAAAAAAAAAAAAAAA', {status: 'published'});
  await seedEntry('guestbook', 'BBBBBBBBBBBBBBBBBBBB');
  for (const db of [anonymous(), visitor(), visitor('bob')]) {
    await assertSucceeds(getDoc(doc(db, 'guestbook', 'AAAAAAAAAAAAAAAAAAAA')));
    await assertFails(getDoc(doc(db, 'guestbook', 'BBBBBBBBBBBBBBBBBBBB')));
  }
});

test('public list requires published filter and an explicit limit no greater than 50', async () => {
  await seedEntry('guestbook', 'AAAAAAAAAAAAAAAAAAAA', {status: 'published'});
  await seedEntry('guestbook', 'BBBBBBBBBBBBBBBBBBBB');
  const db = anonymous();
  const entries = collection(db, 'guestbook');
  const published = where('status', '==', 'published');
  const result = await assertSucceeds(getDocs(query(entries, published, orderBy('createdAt', 'desc'), limit(50))));
  assert.equal(result.size, 1);
  await assertFails(getDocs(query(entries, limit(50))));
  await assertFails(getDocs(query(entries, published)));
  await assertFails(getDocs(query(entries, published, limit(51))));
  await assertFails(getDocs(query(entries, where('status', '==', 'pending'), limit(1))));
});

test('an entry without a corresponding atomic limiter write is rejected', async () => {
  const db = visitor();
  for (const kind of ['private', 'guestbook']) {
    await assertFails(setDoc(newEntry(db, kind), data('alice', kind)));
  }
});

test('limiter cannot be written alone, point to an existing entry, or point to a missing entry', async () => {
  const db = visitor();
  await seedEntry('private', 'AAAAAAAAAAAAAAAAAAAA');
  for (const entryId of ['AAAAAAAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBBBBBBB']) {
    await assertFails(setDoc(doc(db, 'submissionLimits', 'alice'), {
      lastSentAt: serverTimestamp(), entryId, kind: 'private'
    }));
  }
});

test('one limiter cannot authorize multiple entries in a single batch', async () => {
  const db = visitor();
  const first = newEntry(db, 'private');
  const second = newEntry(db, 'private');
  const batch = writeBatch(db);
  batch.set(first, data('alice', 'private'));
  batch.set(second, data('alice', 'private'));
  batch.set(doc(db, 'submissionLimits', 'alice'), {lastSentAt: serverTimestamp(), entryId: first.id, kind: 'private'});
  await assertFails(batch.commit());
});

test('one limiter cannot authorize a private and public entry sharing an ID', async () => {
  const db = visitor();
  const batch = writeBatch(db);
  const id = 'AAAAAAAAAAAAAAAAAAAA';
  batch.set(doc(db, 'privateMessages', id), data('alice', 'private'));
  batch.set(doc(db, 'guestbook', id), data('alice', 'guestbook'));
  batch.set(doc(db, 'submissionLimits', 'alice'), {lastSentAt: serverTimestamp(), entryId: id, kind: 'private'});
  await assertFails(batch.commit());
});

test('the same UID is rate limited across private and guestbook submissions', async () => {
  const db = visitor();
  await assertSucceeds(batchSubmission(db, 'alice', 'private').commit());
  await assertFails(batchSubmission(db, 'alice', 'guestbook').commit());
  await assertFails(batchSubmission(db, 'alice', 'private').commit());
});

test('submission succeeds after a limiter older than 60 seconds and fails before then', async () => {
  const db = visitor();
  await seedLimit('alice', 55000);
  await assertFails(batchSubmission(db, 'alice', 'guestbook').commit());
  await seedLimit('alice', 61000);
  await assertSucceeds(batchSubmission(db, 'alice', 'guestbook').commit());
});

test('different visitor UIDs have independent cooldowns', async () => {
  await assertSucceeds(batchSubmission(visitor(), 'alice', 'private').commit());
  await assertSucceeds(batchSubmission(visitor('bob'), 'bob', 'guestbook').commit());
});

test('limiter is readable only by its owner and can never be listed or deleted', async () => {
  await seedLimit('alice', 61000);
  await assertSucceeds(getDoc(doc(visitor(), 'submissionLimits', 'alice')));
  await assertFails(getDoc(doc(visitor('bob'), 'submissionLimits', 'alice')));
  await assertFails(getDoc(doc(anonymous(), 'submissionLimits', 'alice')));
  await assertFails(getDocs(collection(visitor(), 'submissionLimits')));
  await assertFails(deleteDoc(doc(visitor(), 'submissionLimits', 'alice')));
});

test('forged sender IDs and another user limiter are rejected', async () => {
  await assertFails(batchSubmission(visitor(), 'alice', 'private', {senderId: 'bob'}).commit());
  await assertFails(batchSubmission(visitor(), 'alice', 'private', {}, {limitUid: 'bob'}).commit());
});

for (const kind of ['private', 'guestbook']) {
  const max = kind === 'private' ? 2000 : 500;
  test(`${kind}: body boundaries, optional display name, and multiline content are accepted`, async () => {
    for (const [i, body] of ['x', 'x'.repeat(max), 'Hello\nfrom\na visitor'].entries()) {
      const uid = `valid-${kind}-${i}`;
      await assertSucceeds(batchSubmission(visitor(uid), uid, kind, {body, displayName: 'N'.repeat(60)}).commit());
    }
  });
  test(`${kind}: malformed, empty, whitespace, oversized, and extra data are rejected`, async () => {
    const invalid = [
      {body: ''}, {body: ' \n\t '}, {body: 'x'.repeat(max + 1)}, {body: 12}, {body: null},
      {displayName: 'x'.repeat(61)}, {displayName: 12}, {displayName: null},
      {admin: true}, {createdAt: Timestamp.fromMillis(1)}, {senderId: 12},
      ...(kind === 'private' ? [{status: 'pending'}] : [{status: 'published'}, {status: 'approved'}, {status: 12}])
    ];
    for (const [i, changes] of invalid.entries()) {
      const uid = `invalid-${kind}-${i}`;
      await assertFails(batchSubmission(visitor(uid), uid, kind, changes).commit());
    }
  });
  test(`${kind}: required fields cannot be omitted`, async () => {
    const db = visitor();
    for (const key of ['body', 'senderId', 'createdAt', ...(kind === 'guestbook' ? ['status'] : [])]) {
      const entry = newEntry(db, kind);
      const entryData = data('alice', kind);
      delete entryData[key];
      const batch = writeBatch(db);
      batch.set(entry, entryData);
      batch.set(doc(db, 'submissionLimits', 'alice'), {lastSentAt: serverTimestamp(), entryId: entry.id, kind});
      await assertFails(batch.commit());
    }
  });
  test(`${kind}: client edits, deletion, and overwrite of an existing entry are rejected`, async () => {
    const db = visitor();
    const id = 'AAAAAAAAAAAAAAAAAAAA';
    await seedEntry(kind, id);
    await assertFails(updateDoc(doc(db, entryCollection(kind), id), {body: 'Changed'}));
    await assertFails(deleteDoc(doc(db, entryCollection(kind), id)));
    await assertFails(batchSubmission(db, 'alice', kind, {}, {entry: doc(db, entryCollection(kind), id)}).commit());
  });
}

test('invalid document IDs and malformed limiter fields are rejected', async () => {
  const db = visitor();
  for (const id of ['short', 'A'.repeat(19) + '-', 'A'.repeat(21)]) {
    await assertFails(batchSubmission(db, 'alice', 'private', {}, {entry: doc(db, 'privateMessages', id)}).commit());
  }
  for (const limitChanges of [
    {lastSentAt: Timestamp.fromMillis(1)}, {entryId: 'BBBBBBBBBBBBBBBBBBBB'},
    {kind: 'guestbook'}, {kind: 'unknown'}, {extra: true}
  ]) {
    await assertFails(batchSubmission(db, 'alice', 'private', {}, {limitChanges}).commit());
  }
});

test('unmatched collections and subcollections are denied', async () => {
  for (const path of ['other/AAAAAAAAAAAAAAAAAAAA', 'guestbook/AAAAAAAAAAAAAAAAAAAA/notes/BBBBBBBBBBBBBBBBBBBB']) {
    await assertFails(setDoc(doc(visitor(), path), {body: 'Unexpected'}));
    await assertFails(getDoc(doc(anonymous(), path)));
  }
});
