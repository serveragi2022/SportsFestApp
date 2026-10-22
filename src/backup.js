// Backup / restore of the Sports Fest data (no React in here, so it can be tested on its own).
//
// A backup is one JSON file with everything the admin entered: team names, team slots (+ players), winners and points,
// tie-breaks, committee names, match times and Cheer Dance / Mr & Ms Team Ambassador places.
// Login accounts (committee usernames and passwords) are NOT in the backup: they live in Supabase Authentication.

export const BACKUP_APP = 'sportsfest';
export const BACKUP_VERSION = 1;

const KEYS = ['masterTeams', 'rosters', 'results', 'scores', 'tiebreak', 'committee', 'times', 'placements'];

const isObj = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

export function emptyData() {
  return { masterTeams: [], rosters: {}, results: {}, scores: {}, tiebreak: {}, committee: {}, times: {}, placements: {} };
}

// state -> JSON text
export function buildBackup(state, now = new Date()) {
  const data = emptyData();
  KEYS.forEach((k) => {
    if (state && state[k] != null) data[k] = JSON.parse(JSON.stringify(state[k]));
  });
  return JSON.stringify({ app: BACKUP_APP, version: BACKUP_VERSION, createdAt: now.toISOString(), data }, null, 2);
}

export function backupFileName(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `sportsfest-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}_${p(now.getHours())}${p(now.getMinutes())}.json`;
}

// JSON text -> { ok: true, data, createdAt, summary } | { ok: false, error }
export function parseBackup(text) {
  let json;
  try {
    json = JSON.parse(String(text || '').trim());
  } catch (e) {
    return { ok: false, error: 'This is not a valid backup file (cannot read it).' };
  }
  if (!isObj(json) || json.app !== BACKUP_APP || !isObj(json.data)) return { ok: false, error: 'This file is not a Sports Fest backup.' };
  if (typeof json.version === 'number' && json.version > BACKUP_VERSION) return { ok: false, error: 'This backup was made by a newer version of the app.' };

  const d = json.data;
  const data = emptyData();
  if (d.masterTeams != null) {
    if (!Array.isArray(d.masterTeams)) return { ok: false, error: 'Backup problem: team names are not a list.' };
    const bad = d.masterTeams.find((t) => !isObj(t) || !t.id || !String(t.name || '').trim());
    if (bad) return { ok: false, error: 'Backup problem: a team name is missing its id or name.' };
    data.masterTeams = d.masterTeams.map((t) => ({ id: String(t.id), name: String(t.name).trim(), color: t.color || '#64748B', department: String(t.department || '').trim() }));
  }
  for (const k of KEYS.filter((x) => x !== 'masterTeams')) {
    if (d[k] == null) continue;
    if (!isObj(d[k])) return { ok: false, error: `Backup problem: "${k}" has a wrong format.` };
    data[k] = d[k];
  }
  const count = (o) => Object.values(o).reduce((n, v) => n + (isObj(v) ? Object.keys(v).length : 1), 0);
  return {
    ok: true,
    data,
    createdAt: json.createdAt || null,
    summary: { teamNames: data.masterTeams.length, results: count(data.results), committeeNames: count(data.committee), times: count(data.times) },
  };
}

// state -> flat rows for Supabase (used by remote.restoreAll)
export function dataToRows(data) {
  const rows = { masters: [], rosters: [], results: [], tiebreak: [], committee: [], times: [], placements: [] };
  data.masterTeams.forEach((t) => rows.masters.push({ id: t.id, name: t.name, color: t.color, department: t.department || null }));
  Object.entries(data.rosters).forEach(([game_id, byNo]) =>
    Object.entries(byNo || {}).forEach(([no, v]) => {
      if (!v) return;
      rows.rosters.push({
        game_id,
        team_no: Number(no),
        master_id: v.masterId || null,
        custom_name: v.masterId ? null : v.name || null,
        players: Array.isArray(v.players) && v.players.length ? v.players : null,
      });
    })
  );
  Object.entries(data.results).forEach(([game_id, byNo]) =>
    Object.entries(byNo || {}).forEach(([no, winner]) => {
      if (winner == null) return;
      const sc = (data.scores[game_id] || {})[no];
      rows.results.push({ game_id, match_no: Number(no), winner: Number(winner), score1: sc ? sc[0] : null, score2: sc ? sc[1] : null });
    })
  );
  Object.entries(data.tiebreak).forEach(([game_id, team_no]) => rows.tiebreak.push({ game_id, team_no: Number(team_no) }));
  Object.entries(data.committee).forEach(([game_id, byRole]) => Object.entries(byRole || {}).forEach(([role, name]) => rows.committee.push({ game_id, role, name: String(name ?? '') })));
  Object.entries(data.times).forEach(([game_id, byNo]) => Object.entries(byNo || {}).forEach(([no, time_text]) => time_text && rows.times.push({ game_id, match_no: Number(no), time_text: String(time_text) })));
  Object.entries(data.placements).forEach(([event_id, byPlace]) => Object.entries(byPlace || {}).forEach(([place, department]) => department && rows.placements.push({ event_id, place: Number(place), department: String(department) })));
  return rows;
}
