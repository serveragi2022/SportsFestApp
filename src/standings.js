import { GAMES } from './data/games.js';
import { compareTeams } from './data/departments.js';
import { allMatches, eliminatedTeams, getChampion, matchTeams } from './engine.js';
import { resolveTeam } from './teams.js';

// Overall standings grouped by TEAM NAME (group), across every game.
// One group (e.g. "Ambassador") can own several team slots (Team 1 and Team 2 of Basketball, Team 4 of Chess, ...).
// Every match won / lost by any of its slots counts for the group.
// Percent: every game won (champion) adds 20%, up to 100% (a team joins about 5 games).
export const PERCENT_PER_GAME_WON = 20;

export function computeStandings(state) {
  const groups = new Map();
  const deptByName = new Map();
  (state.masterTeams || []).forEach((t) => deptByName.set(t.name.trim().toLowerCase(), (t.department || '').trim()));

  const groupFor = (info) => {
    const key = info.name.trim().toLowerCase();
    if (!groups.has(key)) {
      groups.set(key, { key, name: info.name.trim(), color: info.color, department: deptByName.get(key) || '', gamesWon: 0, wins: 0, losses: 0, champions: 0, games: new Map() });
    }
    return groups.get(key);
  };

  // every team name of the master list is listed, even before it joined a game
  (state.masterTeams || []).forEach((t) => groupFor({ name: t.name, color: t.color }));

  GAMES.forEach((game) => {
    const results = state.results[game.id] || {};
    const scores = (state.scores && state.scores[game.id]) || {};
    const { champion } = getChampion(game, results, state.tiebreak[game.id], scores);
    const out = eliminatedTeams(game, results);

    // every named slot of this game joins the group, even before it has played
    for (let n = 1; n <= game.teams; n += 1) {
      const info = resolveTeam(state, game.id, n);
      if (!info.name) continue;
      const g = groupFor(info);
      if (!g.games.has(game.id)) g.games.set(game.id, { game, slots: new Map() });
      g.games.get(game.id).slots.set(n, { team: n, wins: 0, losses: 0, status: 'idle' });
    }

    const slotOf = (teamNo) => {
      const info = resolveTeam(state, game.id, teamNo);
      if (!info.name) return null;
      const g = groupFor(info);
      return { g, slot: g.games.get(game.id).slots.get(teamNo) };
    };

    allMatches(game).forEach((m) => {
      const winner = results[m.no];
      const teams = matchTeams(m, results);
      teams.forEach((t) => {
        if (t == null) return;
        const hit = slotOf(t);
        if (!hit) return;
        if (hit.slot.status === 'idle') hit.slot.status = 'playing';
        if (winner == null) return;
        if (t === winner) {
          hit.slot.wins += 1;
          hit.g.wins += 1;
        } else {
          hit.slot.losses += 1;
          hit.g.losses += 1;
        }
      });
    });

    // final status of each slot in this game
    groups.forEach((g) => {
      const gg = g.games.get(game.id);
      if (!gg) return;
      let wonThis = false;
      gg.slots.forEach((slot) => {
        if (champion != null && slot.team === champion) {
          slot.status = 'champion';
          g.champions += 1;
          wonThis = true;
        } else if (out.has(slot.team) || champion != null) {
          slot.status = 'lose';
        }
      });
      if (wonThis) g.gamesWon += 1;
    });
  });

  return [...groups.values()].map((g) => ({
    key: g.key,
    name: g.name,
    color: g.color,
    department: g.department,
    gamesWon: g.gamesWon,
    percent: Math.min(100, g.gamesWon * PERCENT_PER_GAME_WON),
    wins: g.wins,
    losses: g.losses,
    champions: g.champions,
    gamesJoined: g.games.size,
    games: [...g.games.values()].map((gg) => ({ game: gg.game, slots: [...gg.slots.values()] })),
  }));
}

// sortBy: 'wins' (most wins first) | 'champions' (most championships first)
export function rankStandings(list, sortBy = 'wins') {
  const sorted = [...list].sort((a, b) => {
    if (sortBy === 'champions') return b.champions - a.champions || b.wins - a.wins || a.losses - b.losses || a.name.localeCompare(b.name);
    return b.wins - a.wins || b.champions - a.champions || a.losses - b.losses || a.name.localeCompare(b.name);
  });
  const keyOf = (r) => (sortBy === 'champions' ? `${r.champions}|${r.wins}|${r.losses}` : `${r.wins}|${r.champions}|${r.losses}`);
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || keyOf(r) !== keyOf(sorted[i - 1])) rank = i + 1;
    return { ...r, rank };
  });
}

// Team standing grouped by department: [{ department, teams: [{...group, rank}] }].
// Departments AND teams keep the order of the master team list (department after department, team after team).
export function groupByDepartment(state, list) {
  const map = new Map();
  [...list].sort(compareTeams).forEach((g) => {
    const d = (g.department || '').trim();
    if (!map.has(d)) map.set(d, []);
    map.get(d).push(g);
  });
  return [...map.entries()].map(([department, teams]) => ({ department, teams }));
}

// All teams, best percent first. Only the percent counts (games won as champion); match wins/losses do not.
// Teams with the same percent share the same rank and keep the fixed list order.
export function rankByPercent(list) {
  const sorted = [...list].sort((a, b) => b.percent - a.percent || compareTeams(a, b));
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.percent !== sorted[i - 1].percent) rank = i + 1;
    return { ...r, rank };
  });
}

// The team(s) in front: rank 1 of the percent ranking. Empty until a team has won a game.
export function leadingTeams(list) {
  return rankByPercent(list).filter((r) => r.rank === 1 && r.percent > 0);
}
