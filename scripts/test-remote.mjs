import assert from 'node:assert/strict';
import { makeRemote, rowsToState, TABLES } from '../src/remote.js';

// Fake supabase client: records every call chain.
function fakeClient(tableData = {}) {
  const log = [];
  const client = {
    from(table) {
      const call = { table, ops: [] };
      const b = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') {
            return (resolve) => { log.push(call); resolve({ data: tableData[table] ?? [], error: null }); };
          }
          return (...args) => { call.ops.push([prop, ...args]); return b; };
        },
      });
      return b;
    },
    channel(name) { const ch = { name, handlers: [], on(...a) { ch.handlers.push(a); return ch; }, subscribe() { ch.subscribed = true; return ch; } }; client._ch = ch; return ch; },
    removeChannel(ch) { client._removed = ch; },
    log,
  };
  return client;
}
const last = (c) => c.log[c.log.length - 1];
const opNames = (call) => call.ops.map((o) => o[0]);

// rowsToState
const st = rowsToState({
  masters: [{ id: 'm1', name: 'Ambassador', color: '#111' }],
  rosters: [{ game_id: 'basketball', team_no: 1, master_id: 'm1', custom_name: null }, { game_id: 'basketball', team_no: 2, master_id: 'm1', custom_name: null }, { game_id: 'chess', team_no: 3, master_id: null, custom_name: 'Custom' }],
  results: [{ game_id: 'darts', match_no: 10, winner: 7, score1: 40, score2: 31 }, { game_id: 'basketball', match_no: 1, winner: 1, score1: null, score2: null }],
  tiebreak: [{ game_id: 'darts', team_no: 7 }],
  committee: [{ game_id: 'chess', role: 'Scorekeeper / Results Recorder', name: 'X' }],
});
assert.deepEqual(st.rosters.basketball, { 1: { masterId: 'm1' }, 2: { masterId: 'm1' } }, 'two slots share the same master name');
assert.deepEqual(st.rosters.chess[3], { name: 'Custom' });
assert.deepEqual(st.scores.darts[10], [40, 31]);
assert.equal(st.scores.basketball, undefined);
assert.equal(st.results.basketball[1], 1);
assert.equal(st.tiebreak.darts, 7);
assert.equal(st.committee.chess['Scorekeeper / Results Recorder'], 'X');

// setResult with cascade
let c = fakeClient();
let r = makeRemote(c);
await r.setResult('basketball', 1, 5, null, [5, 7]);
assert.deepEqual(c.log.map((x) => x.table), [TABLES.results, TABLES.tiebreak, TABLES.results]);
assert.deepEqual(c.log[0].ops, [['delete'], ['eq', 'game_id', 'basketball'], ['in', 'match_no', [5, 7]]]);
assert.deepEqual(c.log[2].ops[0], ['upsert', { game_id: 'basketball', match_no: 1, winner: 5, score1: null, score2: null }]);

// setResult with points, no cascade
c = fakeClient(); r = makeRemote(c);
await r.setResult('pickleball-ws', 2, 3, [9, 11], []);
assert.deepEqual(c.log.map((x) => x.table), [TABLES.tiebreak, TABLES.results]);
assert.deepEqual(last(c).ops[0], ['upsert', { game_id: 'pickleball-ws', match_no: 2, winner: 3, score1: 9, score2: 11 }]);

// assignTeam
c = fakeClient(); r = makeRemote(c);
await r.assignTeam('chess', 4, { masterId: 'm1' });
assert.deepEqual(last(c).ops[0], ['upsert', { game_id: 'chess', team_no: 4, master_id: 'm1', custom_name: null }]);
await r.assignTeam('chess', 4, { name: 'Walk-in' });
assert.deepEqual(last(c).ops[0], ['upsert', { game_id: 'chess', team_no: 4, master_id: null, custom_name: 'Walk-in' }]);
await r.assignTeam('chess', 4, null);
assert.deepEqual(opNames(last(c)), ['delete', 'eq', 'eq']);

// clearing a name keeps the row when the slot has players
await r.assignTeam('chess', 4, null, true);
assert.deepEqual(last(c).ops[0], ['upsert', { game_id: 'chess', team_no: 4, master_id: null, custom_name: null }]);

// players (admin): saved on the roster row; cleared with null; row deleted only when nothing else is on it
await r.setPlayers('chess', 4, ['Ana', 'Ben']);
assert.deepEqual(last(c).ops[0], ['upsert', { game_id: 'chess', team_no: 4, players: ['Ana', 'Ben'] }]);
await r.setPlayers('chess', 4, [], true);
assert.deepEqual(last(c).ops[0], ['upsert', { game_id: 'chess', team_no: 4, players: null }]);
await r.setPlayers('chess', 4, [], false);
assert.deepEqual(opNames(last(c)), ['delete', 'eq', 'eq']);
const sp = rowsToState({ rosters: [{ game_id: 'chess', team_no: 1, master_id: 'm1', custom_name: null, players: ['Ana', 'Ben'] }, { game_id: 'chess', team_no: 2, master_id: null, custom_name: null, players: null }] });
assert.deepEqual(sp.rosters.chess[1], { masterId: 'm1', players: ['Ana', 'Ben'] });
assert.deepEqual(sp.rosters.chess[2], { name: '' });

// deleteMaster keeps name as custom label first
c = fakeClient(); r = makeRemote(c);
await r.deleteMaster('m1', 'Ambassador');
assert.deepEqual(c.log.map((x) => x.table), [TABLES.rosters, TABLES.masters]);
assert.deepEqual(c.log[0].ops[0], ['update', { master_id: null, custom_name: 'Ambassador' }]);

// match times + Cheer Dance / Muse placements
const st2 = rowsToState({ times: [{ game_id: 'badminton-wd', match_no: 1, time_text: '8:00 - 8:30' }], placements: [{ event_id: 'muse', place: 1, department: 'QCA' }] });
assert.equal(st2.times['badminton-wd'][1], '8:00 - 8:30');
assert.equal(st2.placements.muse[1], 'QCA');
c = fakeClient(); r = makeRemote(c);
await r.setMatchTime('badminton-wd', 1, '9:00');
assert.deepEqual(c.log.map((x) => [x.table, x.ops[0][0]]), [[TABLES.times, 'upsert']]);
await r.setMatchTime('badminton-wd', 1, '');
assert.equal(last(c).ops[0][0], 'delete');
c = fakeClient(); r = makeRemote(c);
await r.setPlacement('muse', 2, 'QCA');
assert.deepEqual(c.log.map((x) => [x.table, x.ops[0][0]]), [[TABLES.placements, 'delete'], [TABLES.placements, 'delete'], [TABLES.placements, 'insert']]);
c = fakeClient(); r = makeRemote(c);
await r.setPlacement('muse', 2, '');
assert.equal(c.log.length, 1);

// reset
c = fakeClient(); r = makeRemote(c);
await r.resetEverything();
assert.equal(c.log.length, 7); // + match times, placements
await r.resetGame('darts');
assert.deepEqual(c.log.slice(7).map((x) => x.table), [TABLES.results, TABLES.tiebreak]);

// fetchAll + errors
c = fakeClient({ [TABLES.masters]: [{ id: 'm1', name: 'A', color: '#fff' }] });
r = makeRemote(c);
const all = await r.fetchAll();
assert.equal(all.masterTeams.length, 1);
const bad = { from: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'permission denied' } }) }) };
await assert.rejects(() => makeRemote(bad).fetchAll(), /permission denied/);

// subscribe -> debounced refetch trigger, subscribes to the 5 data tables
c = fakeClient(); r = makeRemote(c);
let fired = 0;
const unsub = r.subscribe(() => { fired += 1; });
assert.equal(c._ch.handlers.length, 5); assert.ok(c._ch.subscribed);
c._ch.handlers[0][2](); c._ch.handlers[1][2]();
await new Promise((res) => setTimeout(res, 400));
assert.equal(fired, 1, 'debounced');
unsub(); assert.ok(c._removed);
// restoreAll: erase everything first, then write the backup (teams before the rows that point to them)
{
  const c2 = fakeClient(); const r2 = makeRemote(c2);
  await r2.restoreAll({
    masterTeams: [{ id: 'm1', name: 'Ambassador1', color: '#111', department: 'Admin' }],
    rosters: { basketball: { 1: { masterId: 'm1', players: ['A'] } } },
    results: { basketball: { 1: 1 } }, scores: {}, tiebreak: {},
    committee: { basketball: { 'Tournament Head': 'Eagle' } }, times: { basketball: { 1: '9:20 - 10:00' } }, placements: {},
  });
  const inserts = c2.log.filter((x) => x.ops[0][0] === 'insert').map((x) => x.table);
  assert.deepEqual(inserts, [TABLES.masters, TABLES.rosters, TABLES.results, TABLES.committee, TABLES.times]);
  const firstInsert = c2.log.findIndex((x) => x.ops[0][0] === 'insert');
  assert.ok(c2.log.slice(0, firstInsert).every((x) => x.ops[0][0] === 'delete'), 'everything is deleted before the first insert');
  assert.deepEqual(c2.log[firstInsert].ops[0], ['insert', [{ id: 'm1', name: 'Ambassador1', color: '#111', department: 'Admin' }]]);
}

console.log('REMOTE TESTS PASSED');
