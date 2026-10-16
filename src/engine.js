// Pure bracket logic. No React in here so it can be tested on its own.
//
// results: { [matchNo]: winnerTeamNo }
// scores:  { [matchNo]: [pointsOfSlot1, pointsOfSlot2] }   (only rounds flagged `scoring: true`)

export function allMatches(game) {
  const out = [];
  game.rounds.forEach((round, roundIndex) => {
    round.matches.forEach((match) =>
      out.push({ ...match, roundIndex, roundName: round.name, roundType: round.type, scoring: !!round.scoring, venue: match.venue || game.venue })
    );
  });
  return out;
}

export function findMatch(game, no) {
  return allMatches(game).find((m) => m.no === no);
}

export function resolveSlot(slot, results) {
  if (slot.t != null) return slot.t;
  const w = results[slot.w];
  return w == null ? null : w;
}

export function matchTeams(match, results) {
  return match.slots.map((s) => resolveSlot(s, results));
}

export function matchStatus(match, results) {
  if (results[match.no] != null) return 'done';
  return matchTeams(match, results).every((t) => t != null) ? 'ready' : 'waiting';
}

// All match numbers that depend (directly or through other matches) on the winner of `no`.
export function downstream(game, no) {
  const matches = allMatches(game);
  const found = new Set();
  const queue = [no];
  while (queue.length) {
    const cur = queue.shift();
    matches.forEach((m) => {
      if (m.slots.some((s) => s.w === cur) && !found.has(m.no)) {
        found.add(m.no);
        queue.push(m.no);
      }
    });
  }
  return [...found];
}

export function slotLabel(slot) {
  return slot.t != null ? `Team ${slot.t}` : `Winner of Game ${slot.w}`;
}

// Teams that lost a single-elimination match.
export function eliminatedTeams(game, results) {
  const out = new Set();
  allMatches(game).forEach((m) => {
    if (m.roundType !== 'elim') return;
    const w = results[m.no];
    if (w == null) return;
    matchTeams(m, results).forEach((t) => {
      if (t != null && t !== w) out.add(t);
    });
  });
  return out;
}

// The team with the most points wins. Returns the team number, or null when a score is
// missing or the scores are equal (then the admin has to choose the winner).
export function winnerFromScores(teams, scores) {
  if (!teams || !scores || scores.length !== teams.length) return null;
  if (scores.some((s) => s == null || Number.isNaN(s))) return null;
  const max = Math.max(...scores);
  const top = teams.filter((_, i) => scores[i] === max);
  return top.length === 1 ? top[0] : null;
}

// Wins / losses (and points) of every team in a round robin round.
export function robinStandings(game, roundIndex, results, scores = {}) {
  const round = game.rounds[roundIndex];
  const rows = {};
  let done = 0;
  round.matches.forEach((m) => {
    const teams = matchTeams(m, results);
    teams.forEach((t) => {
      if (t != null && !rows[t]) rows[t] = { team: t, wins: 0, losses: 0, played: 0, pf: 0, pa: 0, diff: 0 };
    });
    const w = results[m.no];
    if (w == null) return;
    done += 1;
    const sc = round.scoring ? scores[m.no] : null;
    teams.forEach((t, i) => {
      if (t == null) return;
      rows[t].played += 1;
      if (t === w) rows[t].wins += 1;
      else rows[t].losses += 1;
      if (sc) {
        rows[t].pf += Number(sc[i]) || 0;
        rows[t].pa += sc.reduce((sum, v, j) => (j === i ? sum : sum + (Number(v) || 0)), 0);
      }
    });
  });
  Object.values(rows).forEach((r) => {
    r.diff = r.pf - r.pa;
  });
  const list = Object.values(rows).sort((a, b) => b.wins - a.wins || (round.scoring ? b.pf - a.pf : 0) || a.team - b.team);
  return { rows: list, complete: done === round.matches.length, done, total: round.matches.length, scoring: !!round.scoring };
}

// Champion of a game.
// Returns { champion: teamNo|null, tied: teamNo[]|null, reason: 'wins'|'points'|null }
//   Round robin: most wins; if level and the round is scored, the TOTAL POINTS SCORED in the round decide;
//   if still level the admin picks the champion (tiebreak = the picked team number).
//   `tied` lists the teams that are still level; `reason` says on what ('wins' or 'points').
export function getChampion(game, results, tiebreak, scores = {}) {
  const lastIndex = game.rounds.length - 1;
  const last = game.rounds[lastIndex];
  if (last.type === 'robin') {
    const st = robinStandings(game, lastIndex, results, scores);
    if (!st.complete) return { champion: null, tied: null, reason: null };
    const top = st.rows[0].wins;
    let leaders = st.rows.filter((r) => r.wins === top);
    let reason = 'wins';
    if (leaders.length > 1 && st.scoring) {
      const bestPts = Math.max(...leaders.map((r) => r.pf));
      leaders = leaders.filter((r) => r.pf === bestPts);
      reason = 'points';
    }
    if (leaders.length === 1) return { champion: leaders[0].team, tied: null, reason: null };
    const tied = leaders.map((r) => r.team);
    if (tiebreak != null && tied.includes(tiebreak)) return { champion: tiebreak, tied, reason };
    return { champion: null, tied, reason };
  }
  const finalMatch = last.matches[last.matches.length - 1];
  const w = results[finalMatch.no];
  return { champion: w == null ? null : w, tied: null, reason: null };
}

export function gameProgress(game, results) {
  const matches = allMatches(game);
  const done = matches.filter((m) => results[m.no] != null).length;
  return { done, total: matches.length };
}

// Runner-up of an elimination final.
export function getRunnerUp(game, results, champion) {
  const last = game.rounds[game.rounds.length - 1];
  if (last.type !== 'elim' || champion == null) return null;
  const finalMatch = last.matches[last.matches.length - 1];
  const teams = matchTeams(finalMatch, results).filter((t) => t != null && t !== champion);
  return teams.length === 1 ? teams[0] : null;
}
