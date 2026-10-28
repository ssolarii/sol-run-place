import { readFile } from 'node:fs/promises';
import { before, beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { getApps, deleteApp } from 'firebase/app';
import { terminate } from 'firebase/firestore/lite';
import { createSubmissionsClient } from './submissions-client.mjs';

const projectId = 'demo-sol-submissions';
let env;
const databases = [];
before(async () => {
  env = await initializeTestEnvironment({ projectId, firestore: {
    host: '127.0.0.1', port: 8087,
    rules: await readFile(new URL('./firestore.rules', import.meta.url), 'utf8')
  }});
});
beforeEach(async () => { await env.clearFirestore(); });
after(async () => {
  await Promise.all(databases.map(db => terminate(db)));
  await env.cleanup();
  await Promise.all(getApps().map(app => deleteApp(app)));
});
function client(name, uid) {
  return createSubmissionsClient({
    config: {projectId, apiKey: 'demo-key', appId: `demo-${name}`}, appName: name,
    configureFirestore(db, sdk) {
      databases.push(db);
      sdk.connectFirestoreEmulator(db, '127.0.0.1', 8087, uid ? {
        mockUserToken: {sub: uid, user_id: uid, firebase: {sign_in_provider: 'anonymous', identities: {}}}
      } : undefined);
    },
    resolveVisitor: async () => {
      if (!uid) throw new Error('Public listing must not authenticate');
      return {uid};
    }
  });
}

test('client real Lite batch satisfies deployed contract and stores normalized fields atomically', async () => {
  for (const kind of ['private', 'guestbook']) {
    const uid = `lite-client-${kind}`;
    const service = client(uid, uid);
    const result = await service.submit(kind, {body: '  Emulator client message.\n', displayName: '  Setup check  '});
    assert.equal(result.status, kind === 'private' ? 'sent' : 'pending');
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      const entry = (await getDoc(doc(db, kind === 'private' ? 'privateMessages' : 'guestbook', result.id))).data();
      assert.equal(entry.body, 'Emulator client message.');
      assert.equal(entry.displayName, 'Setup check');
      assert.equal(entry.senderId, uid);
      if (kind === 'guestbook') assert.equal(entry.status, 'pending');
      const limiter = (await getDoc(doc(db, 'submissionLimits', uid))).data();
      assert.equal(limiter.entryId, result.id);
      assert.equal(limiter.kind, kind);
      assert.equal(limiter.lastSentAt.toMillis(), entry.createdAt.toMillis());
    });
  }
});

test('real Lite public query returns latest published content, excluding pending and internal UID', async () => {
  await env.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const [id, status, milliseconds, body] of [
      ['AAAAAAAAAAAAAAAAAAAA', 'published', 1000, 'Older published'],
      ['BBBBBBBBBBBBBBBBBBBB', 'published', 2000, '<b>Latest literal text</b>'],
      ['CCCCCCCCCCCCCCCCCCCC', 'pending', 3000, 'Hidden pending']
    ]) {
      await setDoc(doc(db, 'guestbook', id), {status, createdAt: Timestamp.fromMillis(milliseconds), body, senderId: 'internal-uid'});
    }
  });
  const rows = await client('lite-public-read').listPublished({limit: 1});
  assert.deepEqual(rows, [{id: 'BBBBBBBBBBBBBBBBBBBB', body: '<b>Latest literal text</b>', displayName: '', createdAt: 2000}]);
});
