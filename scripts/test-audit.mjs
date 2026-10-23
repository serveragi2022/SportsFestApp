import assert from 'node:assert/strict';
import { AUDIT_GROUPS, ACTION_LABEL, auditToCsv, describe, describeGroup, groupEntries, who } from '../src/audit.js';

const e = (action, detail = {}, extra = {}) => ({ id: 1, at: '2026-10-22T08:00:00Z', userId: 'u1', username: 'ana', fullName: 'Ana Cruz', action, gameId: null, detail, ...extra });

assert.equal(who(e('login')), 'Ana Cruz (ana)');
assert.equal(who(e('login.failed', {}, { userId: null, username: '', fullName: '' })), 'Nobody (not signed in)');
assert.equal(who(e('x', {}, { userId: null, username: '', fullName: '' })), 'Unknown (no login)');

assert.equal(describe(e('login')), 'Signed in');
assert.equal(describe(e('login.failed', { login: 'ana' })), 'Wrong username or password (typed “ana”)');
assert.equal(describe(e('result.set', { match_no: 3, winner: 2, winner_name: 'Mayon1', score1: 11, score2: 7 }, { gameId: 'pickleball-ws' })), 'Pickleball Women\'s Singles · Match 3: set winner “Mayon1” (11–7)');
assert.match(describe(e('result.set', { match_no: 1, winner: 2, winner_name: 'Team 2', score1: null, score2: null }, { gameId: 'chess' })), /^Chess · Match 1: set winner “Team 2”$/);
assert.match(describe(e('result.change', { match_no: 1, winner: 3, winner_name: 'B', from_winner: 2, from_winner_name: 'A' }, { gameId: 'chess' })), /changed winner from “A” to “B”/);
assert.match(describe(e('result.change', { match_no: 1, winner: 2, from_winner: 2, score1: 11, score2: 9, from_score1: 11, from_score2: 7 }, { gameId: 'darts' })), /changed the score to 11–9 \(was 11–7\)/);
assert.match(describe(e('result.clear', { match_no: 4, winner_name: 'A' }, { gameId: 'chess' })), /cleared the result \(was “A”\)/);
assert.match(describe(e('committee.set', { role: 'Tournament Head', name: 'Hawk', from_name: 'Eagle' }, { gameId: 'basketball' })), /Tournament Head: “Hawk” \(was “Eagle”\)/);
assert.match(describe(e('placement.set', { place: 1, department: 'SALES' }, { gameId: 'muse' })), /^Mr & Ms Team Ambassador · Place 1: “SALES”$/);
assert.match(describe(e('time.set', { match_no: 1, time_text: '9:20 - 10:00', from_time_text: '8:25 - 9:00' }, { gameId: 'basketball' })), /9:20 - 10:00 \(was 8:25 - 9:00\)/);
assert.match(describe(e('roster.set', { team_no: 1, name: 'Zebra', players: null })), /Team slot 1: named “Zebra”/);
assert.match(describe(e('roster.set', { team_no: 1, name: 'Zebra', from_name: 'Team 1', players: ['A'], from_players: null })), /changed “Team 1” to “Zebra”, changed the players/);
assert.match(describe(e('teamname.update', { name: 'B', from_name: 'A', department: 'X', from_department: 'X' })), /renamed “A” to “B”/);
assert.match(describe(e('account.create', { username: 'ben', full_name: 'Ben', role: 'committee', games: ['chess', 'darts'] })), /Created the committee account Ben \(ben\) with 2 game/);
assert.match(describe(e('account.password.reset', { username: 'ben', full_name: 'Ben' })), /Reset the password of Ben \(ben\)/);
assert.match(describe(e('account.game.add', { username: 'ben' }, { gameId: 'chess' })), /Gave ben access to Chess/);
assert.match(describe(e('reset.game', {}, { gameId: 'chess' })), /Reset all winners and points of Chess/);
assert.match(describe(e('backup.restore', { teamNames: 17, results: 40, committee: 3, times: 7 })), /Restored a backup \(17 team names, 40 results, 3 committee names, 7 times\)/);
assert.equal(describe(e('something.new')), 'something.new');

// every action the database or the app writes has a label and sits in a filter group
const all = new Set(AUDIT_GROUPS.flatMap((g) => g.actions || []));
Object.keys(ACTION_LABEL).forEach((a) => assert.ok(all.has(a), `${a} is in a filter group`));
all.forEach((a) => assert.ok(ACTION_LABEL[a], `${a} has a label`));

// folding: same person + same action within 10 s; logins are never folded
const t = (s) => new Date(Date.UTC(2026, 9, 22, 8, 0, s)).toISOString();
const lines = [
  e('result.set', { match_no: 3, winner_name: 'A' }, { id: 6, at: t(5), gameId: 'chess' }),
  e('result.set', { match_no: 2, winner_name: 'B' }, { id: 5, at: t(4), gameId: 'darts' }),
  e('result.set', { match_no: 1, winner_name: 'C' }, { id: 4, at: t(3), gameId: 'chess' }),
  e('result.set', { match_no: 9, winner_name: 'D' }, { id: 3, at: t(40), gameId: 'chess' }),
  e('result.set', { match_no: 9, winner_name: 'D' }, { id: 2, at: t(41), gameId: 'chess' }, ),
  e('login', {}, { id: 1, at: t(60) }),
  e('login', {}, { id: 0, at: t(61) }),
];
lines[4].userId = 'u2'; // another person
const groups = groupEntries(lines);
assert.deepEqual(groups.map((g) => g.count), [3, 1, 1, 1, 1]);
assert.equal(describeGroup(groups[0]), 'Set winner / points × 3 (Chess, Darts)');
assert.equal(describeGroup(groups[1]), describe(lines[3]));

// CSV
const csv = auditToCsv([e('committee.set', { role: 'Head', name: 'He said "hi"' }, { gameId: 'chess' })]);
assert.ok(csv.startsWith('\ufeff"Time"'));
assert.ok(csv.includes('He said ""hi""'));
console.log('AUDIT TESTS PASSED');
