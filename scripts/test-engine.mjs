import assert from 'node:assert/strict';
import { GAMES } from '../src/data/games.js';
import { allMatches, matchTeams, matchStatus, downstream, getChampion, eliminatedTeams, gameProgress, robinStandings } from '../src/engine.js';

for (const g of GAMES) {
  const all = allMatches(g);
  // every team 1..N is used exactly once as a starting slot
  const used = all.flatMap((m) => m.slots.filter((s) => s.t != null).map((s) => s.t));
  const uniq = [...new Set(used)].sort((a, b) => a - b);
  assert.deepEqual(uniq, Array.from({ length: g.teams }, (_, i) => i + 1), `${g.id}: team slots`);
  // every winner reference points to an earlier match
  all.forEach((m) => m.slots.forEach((s) => { if (s.w != null) assert.ok(s.w < m.no && all.find((x) => x.no === s.w), `${g.id}: bad ref ${s.w}`); }));

  // play the whole game: always pick the first team
  const results = {};
  for (const m of all) {
    assert.equal(matchStatus(m, results), 'ready', `${g.id} G${m.no} should be ready in order`);
    results[m.no] = matchTeams(m, results)[0];
  }
  const { champion, tied } = getChampion(g, results);
  const p = gameProgress(g, results);
  assert.equal(p.done, p.total);
  console.log(g.id.padEnd(15), 'matches', String(p.total).padStart(2), 'champion', champion, tied ? `tied ${tied}` : '');
  assert.ok(champion != null || tied, `${g.id}: needs champion or tie`);
}

// Round robin tie handling (Pickleball WS): 1-1-1 cycle
const pb = GAMES.find((g) => g.id === 'pickleball-ws');
let r = { 1: 1, 2: 2, 3: 3 }; // T1 beats T2, T2 beats T3, T3 beats T1
let c = getChampion(pb, r);
assert.equal(c.champion, null); assert.deepEqual(c.tied.sort(), [1, 2, 3]);
c = getChampion(pb, r, 2); assert.equal(c.champion, 2);
r = { 1: 1, 2: 2, 3: 1 }; // T1 wins twice
assert.equal(getChampion(pb, r).champion, 1);
assert.equal(getChampion(pb, { 1: 1 }).champion, null);

// Basketball: downstream + elimination
const bb = GAMES[0];
assert.deepEqual(downstream(bb, 1).sort((a, b) => a - b), [5, 7]);
const res = { 1: 1, 2: 6 };
assert.deepEqual([...eliminatedTeams(bb, res)].sort(), [2, 5]);
assert.equal(matchStatus(bb.rounds[1].matches[0], res), 'ready');
assert.equal(matchStatus(bb.rounds[1].matches[1], res), 'waiting');

// Darts: robin only counts resolved teams
const darts = GAMES.find((g) => g.id === 'darts');
const dres = {};
allMatches(darts).slice(0, 9).forEach((m) => { dres[m.no] = matchTeams(m, dres)[0]; });
const st = robinStandings(darts, 2, dres);
assert.equal(st.rows.length, 3); assert.equal(st.complete, false);
console.log('ALL ENGINE TESTS PASSED');

// ---------- points + tie-break (Pickleball WS): total points scored ----------
{
  const pb2 = GAMES.find((g) => g.id === 'pickleball-ws');
  // 1-1-1 on wins. M1 = T1 v T2 (11-9), M2 = T2 v T3 (11-2), M3 = T1 v T3 (10-11, T3 wins)
  const res = { 1: 1, 2: 2, 3: 3 };
  const sc = { 1: [11, 9], 2: [11, 2], 3: [10, 11] };
  // total points scored: T1 = 11+10 = 21 ; T2 = 9+11 = 20 ; T3 = 2+11 = 13  -> T1 is champion
  let c = getChampion(pb2, res, undefined, sc);
  assert.equal(c.champion, 1, 'total points scored decides');
  const st0 = robinStandings(pb2, 0, res, sc);
  assert.deepEqual(st0.rows.map((r) => [r.team, r.pf]), [[1, 21], [2, 20], [3, 13]]);
  // same total points -> admin has to pick
  const two = { 1: [5, 7], 2: [3, 4], 3: [5, 3] };
  c = getChampion(pb2, { 1: 2, 2: 2, 3: 1 }, undefined, two); // wins: T1 1 (M3), T2 2 -> T2 alone on top
  assert.equal(c.champion, 2);
  // level wins AND level points: a=5,b=5,c=5,d=5,e=5,f=5 -> everyone 10
  const all = { 1: [5, 5], 2: [5, 5], 3: [5, 5] };
  c = getChampion(pb2, { 1: 1, 2: 2, 3: 3 }, undefined, all);
  assert.equal(c.champion, null); assert.equal(c.reason, 'points'); assert.deepEqual(c.tied.sort(), [1, 2, 3]);
  c = getChampion(pb2, { 1: 1, 2: 2, 3: 3 }, 3, all);
  assert.equal(c.champion, 3);
  console.log('POINTS TIE-BREAK TESTS PASSED');
}
// Darts: only the championship round is scored
{
  const darts2 = GAMES.find((g) => g.id === 'darts');
  assert.deepEqual(darts2.rounds.map((r) => !!r.scoring), [false, false, true]);
  const sungka2 = GAMES.find((g) => g.id === 'sungka');
  assert.deepEqual(sungka2.rounds.map((r) => !!r.scoring), [false, false, false, true]);
  assert.equal(GAMES.find((g) => g.id === 'pickleball-md').rounds[0].scoring, true);
  assert.equal(GAMES.find((g) => g.id === 'basketball').rounds.some((r) => r.scoring), false);
}
// winnerFromScores
{
  const { winnerFromScores } = await import('../src/engine.js');
  assert.equal(winnerFromScores([4, 7], [3, 1]), 4);
  assert.equal(winnerFromScores([4, 7], [3, 5]), 7);
  assert.equal(winnerFromScores([4, 7], [3, 3]), null);
  assert.equal(winnerFromScores([4, 7], [3, null]), null);
}

// ---------- overall standings by team name ----------
{
  const { computeStandings, rankStandings } = await import('../src/standings.js');
  const state = {
    masterTeams: [{ id: 'a', name: 'Ambassador', color: '#111' }, { id: 'b', name: 'Beta', color: '#222' }],
    rosters: {
      basketball: { 1: { masterId: 'a' }, 2: { masterId: 'a' }, 3: { masterId: 'b' }, 5: { name: 'ambassador ' } },
      chess: { 1: { masterId: 'a' }, 9: { masterId: 'b' } },
      'pickleball-md': { 1: { masterId: 'a' }, 2: { masterId: 'b' } },
    },
    results: { basketball: { 1: 1, 2: 6, 3: 3 }, chess: { 1: 1 }, 'pickleball-md': { 1: 2 } },
    scores: { 'pickleball-md': { 1: [5, 11] } },
    tiebreak: {}, committee: {},
  };
  const list = rankStandings(computeStandings(state), 'wins');
  const amb = list.find((x) => x.name === 'Ambassador');
  // basketball: T1 won (G1), T2 lost (G2: T2 vs T6, winner 6), T5 lost (G1 vs T1)  -> 1W 2L ; chess T1 won -> 2W ; pickleball T1 lost -> 1L
  assert.equal(amb.wins, 2); assert.equal(amb.losses, 3);
  assert.equal(amb.gamesJoined, 3, 'Ambassador joined 3 games (name matched case-insensitively)');
  const bb2 = amb.games.find((g) => g.game.id === 'basketball');
  assert.deepEqual(bb2.slots.map((s) => s.team), [1, 2, 5]);
  const beta = list.find((x) => x.name === 'Beta');
  assert.equal(beta.champions, 1, 'Beta won the Pickleball MD final');
  assert.equal(rankStandings(computeStandings(state), 'champions')[0].name, 'Beta');
  assert.equal(list[0].rank, 1);
  console.log('standings:', list.map((x) => `${x.rank}. ${x.name} ${x.wins}W ${x.losses}L ${x.champions}C games=${x.gamesJoined}`).join(' | '));
}
console.log('SCORING + STANDINGS TESTS PASSED');
