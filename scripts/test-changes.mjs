import assert from 'node:assert/strict';
import { GAME_BY_ID, GAMES } from '../src/data/games.js';
import { allMatches, getChampion, matchStatus, matchTeams, robinStandings } from '../src/engine.js';
import { computeStandings, rankByPercent, leadingTeams } from '../src/standings.js';
import { departmentPoints, PLACE_POINTS } from '../src/data/events.js';

// every team of every game plays at least once, and every winner slot points to an earlier game
GAMES.forEach((g) => {
  const nos = new Set(allMatches(g).map((m) => m.no));
  const played = new Set();
  allMatches(g).forEach((m) => m.slots.forEach((s) => (s.t != null ? played.add(s.t) : assert.ok(nos.has(s.w) && s.w < m.no, `${g.id} game ${m.no}`))));
  for (let n = 1; n <= g.teams; n += 1) assert.ok(played.has(n), `${g.id}: team ${n} never plays`);
  assert.equal(Math.max(...played), g.teams);
});

// Badminton WS: 7 teams, Game 4 waits for the winner of Game 1
const ws = GAME_BY_ID['badminton-ws'];
assert.equal(ws.teams, 7);
let res = {};
assert.equal(matchStatus(ws.rounds[1].matches[0], res), 'waiting');
res = { 1: 5, 2: 2, 3: 3 };
assert.deepEqual(matchTeams(ws.rounds[1].matches[0], res), [4, 5]);
assert.deepEqual(matchTeams(ws.rounds[1].matches[1], res), [2, 3]);
res = { ...res, 4: 4, 5: 2, 6: 4 };
assert.equal(getChampion(ws, res, undefined).champion, 4);

// Badminton WD: 6 teams, round 2 = round robin of the winners of games 1-3 (points only break a tie)
const wd = GAME_BY_ID['badminton-wd'];
assert.equal(wd.teams, 6);
assert.equal(wd.rounds[1].type, 'robin');
res = { 1: 1, 2: 4, 3: 5 };
assert.deepEqual(wd.rounds[1].matches.map((m) => matchTeams(m, res)), [[1, 4], [5, 4], [1, 5]]);
// most wins wins, no points needed
let r2 = { ...res, 4: 1, 5: 5, 6: 1 };
assert.equal(getChampion(wd, r2, undefined, { 4: [21, 10], 5: [21, 19], 6: [21, 5] }).champion, 1);
// all level on wins (1 win each) -> total points decide
r2 = { ...res, 4: 1, 5: 4, 6: 5 };
const sc = { 4: [21, 10], 5: [19, 21], 6: [15, 21] }; // pts: T1 36, T4 31, T5 42
const ch = getChampion(wd, r2, undefined, sc);
assert.equal(ch.champion, 5);
assert.equal(ch.reason, null);
// still level -> admin picks
const lvl = getChampion(wd, r2, undefined, { 4: [21, 21], 5: [21, 21], 6: [21, 21] });
assert.equal(lvl.champion, null);
assert.equal(lvl.tied.length, 3);
assert.equal(getChampion(wd, r2, 5, { 4: [21, 21], 5: [21, 21], 6: [21, 21] }).champion, 5);

// Cheer Dance / Muse points
assert.deepEqual(PLACE_POINTS, [100, 75, 60, 50, 40, 30, 20, 10]);
const placements = { 'cheer-dance': { 1: 'QCA', 2: 'Admin' }, muse: { 1: 'Admin', 3: 'QCA' } };
assert.deepEqual(departmentPoints(placements), { QCA: 160, Admin: 175 });

// overall ranking: only the percent counts; the department points are the FINAL tie-breaker
const base = { masterTeams: [], rosters: {}, results: {}, scores: {}, tiebreak: {}, committee: {}, placements };
const state = {
  ...base,
  masterTeams: [
    { id: '1', name: 'Makiling1', department: 'QCA', color: '#111' },
    { id: '2', name: 'Ambassador1', department: 'Admin', color: '#222' },
    { id: '3', name: 'Supreme1', department: 'PRD', color: '#333' },
  ],
  rosters: { basketball: { 1: { masterId: '1' }, 2: { masterId: '2' } }, 'badminton-ms': { 1: { masterId: '3' } } },
  results: { basketball: { 1: 1, 2: 2, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1 } }, // Makiling1 champion of basketball
};
let list = computeStandings(state);
let ranked = rankByPercent(list);
assert.equal(ranked[0].name, 'Makiling1'); // higher percent beats the department points
assert.equal(ranked[0].percent, 20);
// level percent -> department points decide
const tie = { ...state, results: {} };
ranked = rankByPercent(computeStandings(tie));
assert.deepEqual(ranked.map((r) => [r.name, r.rank]), [['Ambassador1', 1], ['Makiling1', 2], ['Supreme1', 3]]);
assert.deepEqual(leadingTeams(computeStandings(tie)), []); // nobody has won a game yet
// same percent and same department points still share the rank
const same = rankByPercent(computeStandings({ ...tie, placements: {} }));
assert.ok(same.every((r) => r.rank === 1));
console.log('CHANGES TESTS PASSED');
