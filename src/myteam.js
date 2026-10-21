import { GAMES } from './data/games.js';
import { allMatches, matchStatus, matchTeams } from './engine.js';
import { resolveTeam } from './teams.js';

// Everything one team name plays in, across all games (a team name can own several team numbers of a game).
// -> [{ game, match, mine: [teamNos], status: 'done'|'ready'|'waiting', winner, outcome: 'won'|'lost'|null, others: [teamNo|null] }]
export function myTeamMatches(state, name) {
  const key = String(name || '').trim().toLowerCase();
  if (!key) return [];
  const out = [];
  GAMES.forEach((game) => {
    const slotNos = [];
    for (let n = 1; n <= game.teams; n += 1) {
      if (resolveTeam(state, game.id, n).name.trim().toLowerCase() === key) slotNos.push(n);
    }
    if (!slotNos.length) return;
    const results = (state.results && state.results[game.id]) || {};
    allMatches(game).forEach((match) => {
      const teams = matchTeams(match, results);
      // the team is in the match when its number is resolved there, or is written in a slot (even if the opponent is not known yet)
      const mine = slotNos.filter((n) => teams.includes(n) || match.slots.some((s) => s.t === n));
      if (!mine.length) return;
      const winner = results[match.no];
      const status = matchStatus(match, results);
      out.push({
        game,
        match,
        mine,
        status,
        winner: winner == null ? null : winner,
        outcome: winner == null ? null : mine.includes(winner) ? 'won' : 'lost',
        others: teams.filter((t) => !mine.includes(t) || t == null),
        teams,
      });
    });
  });
  return out;
}
