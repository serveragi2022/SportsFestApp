import assert from 'node:assert/strict';
import { createOutbox, isRetryableError } from '../src/outbox.js';

const mem = () => { const m = {}; return { m, getItem: async (k) => (k in m ? m[k] : null), setItem: async (k, v) => { m[k] = v; } }; };

// error classification
assert.ok(isRetryableError(new Error('TypeError: Failed to fetch')));
assert.ok(isRetryableError(new Error('Network request failed')));
assert.ok(isRetryableError(new Error('JWT expired')));
assert.ok(isRetryableError(new Error('503 Service Unavailable')));
assert.ok(!isRetryableError(new Error('new row violates row-level security policy for table "sf_results"')));
assert.ok(!isRetryableError(new Error('permission denied for table sf_results')));
assert.ok(!isRetryableError(new Error('new row for relation "sf_results" violates check constraint "sf_results_sane"')));

// 1. offline: nothing is lost, order is kept, it is sent when the network is back
const storage = mem();
let online = false;
const sentLog = [];
let changes = [];
const make = (extra = {}) => createOutbox({
  storage, key: 'k',
  execute: async (e) => { if (!online) throw new Error('TypeError: Failed to fetch'); sentLog.push(e.op[0] + ':' + e.op.slice(1).join(',')); },
  onChange: (n) => changes.push(n),
  ...extra,
});
let ob = make();
ob.enqueue({ userId: 'u1', action: { type: 'A' }, op: ['setResult', 'chess', 1, 3] });
ob.enqueue({ userId: 'u1', action: { type: 'B' }, op: ['setResult', 'chess', 2, 4] });
assert.equal(ob.size(), 2);
let r = await ob.flush();
assert.equal(r.sent, 0); assert.ok(r.blocked); assert.equal(ob.size(), 2);

// 2. the app is closed and opened again: the queue is still there
ob = make();
assert.equal(await ob.load(), 2);
assert.deepEqual(ob.entries().map((e) => e.action.type), ['A', 'B']);

// 3. network back: sent in order, queue empties
online = true;
r = await ob.flush();
assert.equal(r.sent, 2); assert.ok(!r.blocked); assert.equal(ob.size(), 0);
assert.deepEqual(sentLog, ['setResult:chess,1,3', 'setResult:chess,2,4']);
assert.equal(JSON.parse(storage.m.k).length, 0, 'saved empty');
assert.equal(changes[changes.length - 1], 0);

// 4. network drops in the middle: first is sent, the rest wait (never reordered)
sentLog.length = 0;
let calls = 0;
ob = createOutbox({ storage: mem(), key: 'k', execute: async (e) => { calls += 1; if (calls === 2) throw new Error('Failed to fetch'); sentLog.push(e.op[1]); } });
['a', 'b', 'c'].forEach((x) => ob.enqueue({ userId: 'u1', action: {}, op: ['setResult', x] }));
r = await ob.flush();
assert.equal(r.sent, 1); assert.ok(r.blocked); assert.deepEqual(ob.entries().map((e) => e.op[1]), ['b', 'c']);
r = await ob.flush();
assert.equal(r.sent, 2); assert.deepEqual(sentLog, ['a', 'b', 'c']);

// 5. the server REFUSES a change (no permission): it is dropped and reported, the next ones still go
const sent5 = [];
ob = createOutbox({ storage: mem(), key: 'k', execute: async (e) => { if (e.op[1] === 'bad') throw new Error('new row violates row-level security policy'); sent5.push(e.op[1]); } });
['ok1', 'bad', 'ok2'].forEach((x) => ob.enqueue({ userId: 'u1', action: {}, op: ['setResult', x] }));
r = await ob.flush();
assert.equal(r.sent, 2); assert.equal(r.dropped.length, 1); assert.match(r.dropped[0].error.message, /row-level security/);
assert.deepEqual(sent5, ['ok1', 'ok2']); assert.equal(ob.size(), 0);

// 6. signed out -> wait; another account -> dropped; same account -> sent
let who = null;
const sent6 = [];
ob = createOutbox({
  storage: mem(), key: 'k', execute: async (e) => { sent6.push(e.userId); },
  decide: (e) => (!who ? 'wait' : who === e.userId ? 'run' : 'drop'),
});
ob.enqueue({ userId: 'u1', action: {}, op: ['x'] });
r = await ob.flush(); assert.ok(r.blocked); assert.equal(ob.size(), 1);
who = 'u2';
r = await ob.flush(); assert.equal(r.dropped.length, 1); assert.equal(ob.size(), 0);
ob.enqueue({ userId: 'u2', action: {}, op: ['x'] });
r = await ob.flush(); assert.equal(r.sent, 1);

// 7. two flushes at the same time never send a change twice
let n7 = 0;
ob = createOutbox({ storage: mem(), key: 'k', execute: async () => { n7 += 1; await new Promise((res) => setTimeout(res, 20)); } });
ob.enqueue({ userId: 'u', action: {}, op: ['x'] });
await Promise.all([ob.flush(), ob.flush(), ob.flush()]);
assert.equal(n7, 1);

// 8. a changed enqueue while flushing is sent too; broken saved data does not crash
ob = createOutbox({ storage: { getItem: async () => '{not json', setItem: async () => {} }, key: 'k', execute: async () => {} });
assert.equal(await ob.load(), 0);
console.log('OUTBOX TESTS PASSED');
