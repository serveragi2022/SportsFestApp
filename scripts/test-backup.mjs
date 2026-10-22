import assert from 'node:assert/strict';
import { buildBackup, parseBackup, dataToRows, backupFileName } from '../src/backup.js';
import { GAMES } from '../src/data/games.js';
import { allMatches } from '../src/engine.js';

const state = {
  masterTeams: [{ id: 'm1', name: 'Ambassador1', color: '#111', department: 'Admin' }, { id: 'm2', name: 'Mayon1', color: '#222', department: 'WH/PPD' }],
  rosters: { basketball: { 1: { masterId: 'm1', players: ['A', 'B'] }, 2: { name: 'Custom' }, 3: { name: '', players: ['Z'] } } },
  results: { basketball: { 1: 1, 2: 2 }, pickleball: { 1: 2 } },
  scores: { pickleball: { 1: [11, 7] } },
  tiebreak: { chess: 4 },
  committee: { basketball: { 'Tournament Head': 'Eagle' } },
  times: { basketball: { 1: '9:20 - 10:00' } },
  placements: { muse: { 1: 'SALES' } },
  somethingElse: 'ignored',
};

// round trip
const text = buildBackup(state, new Date('2026-10-22T08:00:00Z'));
const r = parseBackup(text);
assert.ok(r.ok);
assert.deepEqual(r.data.results, state.results);
assert.deepEqual(r.data.rosters, state.rosters);
assert.deepEqual(r.data.masterTeams, state.masterTeams);
assert.equal(r.data.somethingElse, undefined);
assert.equal(r.summary.teamNames, 2);
assert.equal(r.summary.results, 3);

// bad input
assert.equal(parseBackup('hello').ok, false);
assert.equal(parseBackup('{"app":"other","data":{}}').ok, false);
assert.equal(parseBackup(JSON.stringify({ app: 'sportsfest', version: 99, data: {} })).ok, false);
assert.equal(parseBackup(JSON.stringify({ app: 'sportsfest', version: 1, data: { masterTeams: [{ name: 'x' }] } })).ok, false);
assert.equal(parseBackup(JSON.stringify({ app: 'sportsfest', version: 1, data: { results: [] } })).ok, false);
// a backup with missing parts still restores (empty parts)
assert.deepEqual(parseBackup(JSON.stringify({ app: 'sportsfest', version: 1, data: {} })).data.results, {});

// rows for the database
const rows = dataToRows(r.data);
assert.equal(rows.masters.length, 2);
assert.equal(rows.rosters.length, 3);
assert.deepEqual(rows.rosters.find((x) => x.team_no === 1), { game_id: 'basketball', team_no: 1, master_id: 'm1', custom_name: null, players: ['A', 'B'] });
assert.deepEqual(rows.rosters.find((x) => x.team_no === 3), { game_id: 'basketball', team_no: 3, master_id: null, custom_name: null, players: ['Z'] });
assert.deepEqual(rows.results.find((x) => x.game_id === 'pickleball'), { game_id: 'pickleball', match_no: 1, winner: 2, score1: 11, score2: 7 });
assert.deepEqual(rows.tiebreak, [{ game_id: 'chess', team_no: 4 }]);
assert.deepEqual(rows.committee, [{ game_id: 'basketball', role: 'Tournament Head', name: 'Eagle' }]);
assert.deepEqual(rows.times, [{ game_id: 'basketball', match_no: 1, time_text: '9:20 - 10:00' }]);
assert.deepEqual(rows.placements, [{ event_id: 'muse', place: 1, department: 'SALES' }]);
assert.match(backupFileName(new Date(2026, 9, 22, 8, 5)), /^sportsfest-backup-2026-10-22_0805\.json$/);

// basketball timing: every round has a timing, and the numbers add up like the schedule sheet
const bb = GAMES.find((g) => g.id === 'basketball');
bb.rounds.forEach((rd) => {
  const t = rd.timing;
  assert.ok(t, `${rd.name} has timing`);
  assert.equal(t.prep + t.q1 + t.q2 + t.half + t.q3 + t.q4 + t.timeout, t.duration, `${rd.name} adds up`);
});
assert.deepEqual(allMatches(bb).map((m) => m.time), ['9:20 - 10:00', '10:00 - 10:40', '10:40 - 11:20', '11:20 - 12:00', '1:30 - 2:10', '2:10 - 2:50', '3:20 - 4:30']);
assert.equal(allMatches(bb).find((m) => m.no === 7).timing.duration, 60);
assert.equal(allMatches(GAMES.find((g) => g.id === 'chess'))[0].timing, null);

console.log('backup + timing tests passed');
