// Offline-safe saving. Every change a signed-in user makes is first put in a persistent queue (the "outbox")
// and then sent to Supabase in the same order. If the network is down, the change stays in the queue (it is also
// kept on the device if the app is closed) and is sent later. No React in here, so it can be tested on its own.
//
// entry = { id, userId, action, op: [remoteMethodName, ...args], ts }
//   action: the reducer action (re-applied on top of freshly loaded server data, so the screen keeps the change)
//   op:     what to call on the remote (see remote.js)

const NETWORK = /failed to fetch|fetch failed|network|timeout|timed out|offline|econn|enotfound|load failed|socket|abort|internet|connection/i;
const AUTH_LATER = /jwt expired|token.*expired|refresh_token|invalid jwt/i;
const SERVER_BUSY = /\b(502|503|504)\b|bad gateway|service unavailable|gateway time-?out|too many requests|\b429\b/i;

// true -> keep the change in the queue and try again later; false -> the server really refused it (drop it).
export function isRetryableError(e) {
  const msg = String((e && (e.message || e.error_description)) || e || '');
  return NETWORK.test(msg) || AUTH_LATER.test(msg) || SERVER_BUSY.test(msg);
}

let counter = 0;
const newId = () => `${Date.now().toString(36)}-${(counter += 1).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// storage: { getItem, setItem } (AsyncStorage)   execute(entry): sends it (throws on failure)
// decide(entry): 'run' | 'wait' | 'drop'  (e.g. 'wait' while signed out, 'drop' when another account is signed in)
export function createOutbox({ storage, key, execute, decide = () => 'run', onChange = () => {} }) {
  let queue = [];
  let flushing = false;

  const save = () => {
    try {
      return Promise.resolve(storage.setItem(key, JSON.stringify(queue))).catch(() => {});
    } catch (e) {
      return Promise.resolve();
    }
  };

  return {
    async load() {
      try {
        const raw = await storage.getItem(key);
        const parsed = raw ? JSON.parse(raw) : [];
        queue = Array.isArray(parsed) ? parsed.filter((e) => e && Array.isArray(e.op)) : [];
      } catch (e) {
        queue = [];
      }
      onChange(queue.length);
      return queue.length;
    },
    entries: () => queue.slice(),
    size: () => queue.length,

    enqueue(entry) {
      queue.push({ id: newId(), ts: Date.now(), ...entry });
      save();
      onChange(queue.length);
    },

    // Sends the queue in order. Stops at the first change that cannot be sent yet.
    // -> { sent, dropped: [{ entry, error }], blocked: boolean }
    async flush() {
      if (flushing) return { sent: 0, dropped: [], blocked: queue.length > 0, busy: true };
      flushing = true;
      let sent = 0;
      let blocked = false;
      const dropped = [];
      try {
        while (queue.length) {
          const entry = queue[0];
          const d = decide(entry);
          if (d === 'wait') {
            blocked = true;
            break;
          }
          if (d === 'drop') {
            queue.shift();
            dropped.push({ entry, error: new Error('This change was made by another account and was not sent.') });
            continue;
          }
          try {
            await execute(entry);
            queue.shift();
            sent += 1;
          } catch (error) {
            if (isRetryableError(error)) {
              blocked = true;
              break;
            }
            queue.shift();
            dropped.push({ entry, error });
          }
        }
      } finally {
        flushing = false;
        await save();
        onChange(queue.length);
      }
      return { sent, dropped, blocked };
    },

    clear() {
      queue = [];
      save();
      onChange(0);
    },
  };
}
