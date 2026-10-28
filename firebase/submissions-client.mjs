const COOLDOWN_MS = 60000;

export class SubmissionError extends Error {
  constructor(code, message, { retryable = false, uncertain = false, retryAfterSeconds = 0, field } = {}) {
    super(message);
    this.name = 'SubmissionError';
    Object.assign(this, { code, retryable, uncertain, retryAfterSeconds });
    if (field) this.field = field;
  }
}

function invalid(field) {
  return new SubmissionError('invalid-input', 'Check the message and name lengths.', { field });
}

function normalize(kind, input) {
  if (kind !== 'private' && kind !== 'guestbook') throw invalid('kind');
  if (!input || typeof input.body !== 'string') throw invalid('body');
  const body = input.body.trim();
  const maximum = kind === 'private' ? 2000 : 500;
  if (!body || body.length > maximum) throw invalid('body');
  if (input.displayName !== undefined && typeof input.displayName !== 'string') throw invalid('displayName');
  const displayName = (input.displayName ?? '').trim();
  if (displayName.length > 60) throw invalid('displayName');
  return { body, ...(displayName ? { displayName } : {}) };
}

export function mapSubmissionError(error, { commitStarted = false } = {}) {
  if (error instanceof SubmissionError) return error;
  const code = typeof error?.code === 'string' ? error.code : 'unknown';
  if (commitStarted && !['permission-denied', 'invalid-argument', 'unauthenticated', 'not-found', 'already-exists', 'failed-precondition', 'resource-exhausted'].includes(code)) {
    return new SubmissionError('delivery-unconfirmed',
      'Delivery could not be confirmed. Please wait before deciding whether to send again.',
      { uncertain: true });
  }
  if (code === 'permission-denied') return new SubmissionError('not-accepted', 'The message could not be accepted. Please try again later.');
  if (['auth/network-request-failed', 'unavailable', 'deadline-exceeded', 'cancelled', 'unknown'].includes(code)) {
    return new SubmissionError('unavailable', 'Unable to connect. Check your connection and try again.', { retryable: true });
  }
  if (code === 'auth/too-many-requests' || code === 'resource-exhausted') {
    return new SubmissionError('temporarily-unavailable', 'Messages are temporarily unavailable. Please try again later.', { retryable: true });
  }
  if (code.startsWith('auth/')) return new SubmissionError('sign-in-unavailable', 'Visitor sign-in is unavailable. Please try again later.');
  return new SubmissionError('unavailable', 'Messages are unavailable right now. Please try again later.');
}

// Firebase imports and config loading happen only when a public read or send is
// explicitly requested. Auth is a separate import, initialized only on send.
export async function createFirebaseRuntime({
  config,
  configUrl = './firebase/web-app-config.json',
  appName = 'sol-visitor-submissions',
  configureFirestore,
  resolveVisitor,
  loadAuth = () => import('firebase/auth')
} = {}) {
  if (!config) {
    const response = await fetch(configUrl, { cache: 'no-store', credentials: 'omit' });
    if (!response.ok) throw new SubmissionError('configuration-unavailable', 'Messages are unavailable right now.', { retryable: true });
    config = await response.json();
  }
  const [appSdk, sdk] = await Promise.all([import('firebase/app'), import('firebase/firestore/lite')]);
  const app = appSdk.initializeApp(config, appName);
  const db = sdk.getFirestore(app);
  if (configureFirestore) configureFirestore(db, sdk);
  let visitorPromise;

  async function ensureVisitor() {
    if (resolveVisitor) return resolveVisitor();
    if (!visitorPromise) {
      visitorPromise = (async () => {
        const authSdk = await loadAuth();
        const auth = authSdk.initializeAuth(app, {
          persistence: [authSdk.indexedDBLocalPersistence, authSdk.browserLocalPersistence, authSdk.inMemoryPersistence]
        });
        await auth.authStateReady();
        const user = auth.currentUser ?? (await authSdk.signInAnonymously(auth)).user;
        if (!user.isAnonymous) throw new SubmissionError('unsupported-session', 'Visitor sign-in is unavailable.');
        return { uid: user.uid };
      })().catch(error => { visitorPromise = null; throw error; });
    }
    return visitorPromise;
  }

  return {
    ensureVisitor,
    async readLimiter(uid) {
      const snapshot = await sdk.getDoc(sdk.doc(db, 'submissionLimits', uid));
      return snapshot.exists() ? { lastSentAt: snapshot.data().lastSentAt.toMillis() } : null;
    },
    async commit(kind, uid, fields) {
      const entry = sdk.doc(sdk.collection(db, kind === 'private' ? 'privateMessages' : 'guestbook'));
      const batch = sdk.writeBatch(db);
      batch.set(entry, {
        ...fields, senderId: uid, createdAt: sdk.serverTimestamp(),
        ...(kind === 'guestbook' ? { status: 'pending' } : {})
      });
      batch.set(sdk.doc(db, 'submissionLimits', uid), {
        lastSentAt: sdk.serverTimestamp(), entryId: entry.id, kind
      });
      await batch.commit();
      return entry.id;
    },
    async listPublished(count) {
      // Lite getDocs is server-only; no persistent cache or offline writes exist.
      const snapshot = await sdk.getDocs(sdk.query(sdk.collection(db, 'guestbook'),
        sdk.where('status', '==', 'published'), sdk.orderBy('createdAt', 'desc'), sdk.limit(count)));
      return snapshot.docs.flatMap(item => {
        const value = item.data();
        if (value.status !== 'published' || typeof value.body !== 'string') return [];
        return [{ id: item.id, body: value.body,
          displayName: typeof value.displayName === 'string' ? value.displayName : '',
          createdAt: typeof value.createdAt?.toMillis === 'function' ? value.createdAt.toMillis() : null }];
      });
    }
  };
}

export function createSubmissionsClient({
  loadRuntime,
  now = () => Date.now(),
  online = () => globalThis.navigator?.onLine !== false,
  ...runtimeOptions
} = {}) {
  let runtimePromise;
  let sending = false;
  let cooldownUntil = 0;
  const runtime = () => runtimePromise ??= Promise.resolve()
    .then(() => loadRuntime ? loadRuntime() : createFirebaseRuntime(runtimeOptions))
    .catch(error => { runtimePromise = null; throw error; });
  const getCooldown = () => ({
    remainingSeconds: Math.max(0, Math.ceil((cooldownUntil - now()) / 1000)),
    retryAt: cooldownUntil || null
  });
  function requireOnline() {
    if (!online()) throw new SubmissionError('offline', 'You are offline. Connect and try again.', { retryable: true });
  }
  function requireReady() {
    const { remainingSeconds } = getCooldown();
    if (remainingSeconds > 0) throw new SubmissionError('cooldown', 'Please wait a moment before sending another message.',
      { retryable: true, retryAfterSeconds: remainingSeconds });
  }
  async function refreshCooldown(service, uid) {
    const saved = await service.readLimiter(uid);
    cooldownUntil = saved ? saved.lastSentAt + COOLDOWN_MS : 0;
  }

  async function submit(kind, input) {
    const fields = normalize(kind, input);
    if (sending) throw new SubmissionError('busy', 'A message is already being sent.');
    requireOnline();
    requireReady();
    sending = true;
    let service, uid;
    let commitStarted = false;
    try {
      service = await runtime();
      ({ uid } = await service.ensureVisitor());
      await refreshCooldown(service, uid);
      requireReady();
      requireOnline();
      commitStarted = true;
      const id = await service.commit(kind, uid, fields);
      cooldownUntil = now() + COOLDOWN_MS;
      return { id, kind, status: kind === 'private' ? 'sent' : 'pending' };
    } catch (error) {
      if (commitStarted && error?.code === 'permission-denied') {
        try { await refreshCooldown(service, uid); } catch { /* Preserve the original denial. */ }
        requireReady();
      }
      const mapped = mapSubmissionError(error, { commitStarted });
      if (mapped.uncertain) cooldownUntil = now() + COOLDOWN_MS;
      throw mapped;
    } finally { sending = false; }
  }

  async function listPublished({ limit: count = 50 } = {}) {
    if (!Number.isInteger(count) || count < 1 || count > 50) throw invalid('limit');
    requireOnline();
    try { return await (await runtime()).listPublished(count); }
    catch (error) { throw mapSubmissionError(error); }
  }

  return { submit, listPublished, getCooldown };
}
