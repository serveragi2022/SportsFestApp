import assert from 'node:assert/strict';
import { myTeamMatches } from '../src/myteam.js';

const state = {
  masterTeams: [{ id: 'a', name: 'Makiling1', department: 'QCA', color: '#111' }, { id: 'b', name: 'Windmill1', department: 'ACC/FIN', color: '#222' }],
  rosters: {
    'badminton-wd': { 1: { masterId: 'a' }, 2: { masterId: 'b' } },
    basketball: { 1: { masterId: 'a' }, 5: { masterId: 'a' }, 2: { masterId: 'b' } },
  },
  results: {},
  scores: {}, tiebreak: {}, committee: {}, times: {}, placements: {},
};
let rows = myTeamMatches(state, 'Makiling1');
// WD: Game 1 (Team 1 vs Team 2), then championship games where Team 1 is only a "winner of game 1" slot -> not mine yet
assert.deepEqual(rows.filter((r) => r.game.id === 'badminton-wd').map((r) => r.match.no), [1]);
// Basketball: Team 1 and Team 5 are both Makiling1 and meet in game 1
const bk = rows.filter((r) => r.game.id === 'basketball');
assert.equal(bk.length, 1); assert.deepEqual(bk[0].mine, [1, 5]); assert.equal(bk[0].status, 'ready');
assert.equal(myTeamMatches(state, 'nobody').length, 0);
assert.equal(myTeamMatches(state, '').length, 0);
// result + the next game appears once the winner is known
state.results = { 'badminton-wd': { 1: 1 } };
rows = myTeamMatches(state, 'makiling1').filter((r) => r.game.id === 'badminton-wd');
assert.deepEqual(rows.map((r) => [r.match.no, r.outcome]), [[1, 'won'], [4, null], [6, null]]);
assert.equal(rows[1].status, 'waiting');
const lost = myTeamMatches(state, 'Windmill1').find((r) => r.game.id === 'badminton-wd');
assert.equal(lost.outcome, 'lost');
console.log('MY TEAM TESTS PASSED');
