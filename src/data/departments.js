// Departments shown in Standings. Teams are grouped under their department.
// The admin can type any other department when adding a team name.
export const DEPARTMENTS = ['EEG/CC', 'SALES', 'ACC/FIN', 'WH/PPD', 'KZN/MMG', 'PRD', 'QCA', 'Admin'];

// "House" colors: every department has its own color (bars, podium, live board).
export const DEPT_COLORS = {
  'EEG/CC': '#0284C7',
  SALES: '#EA580C',
  'ACC/FIN': '#0D9488',
  'WH/PPD': '#7C3AED',
  'KZN/MMG': '#DB2777',
  PRD: '#65A30D',
  QCA: '#DC2626',
  Admin: '#4F46E5',
};
export const deptColor = (d) => {
  const k = Object.keys(DEPT_COLORS).find((x) => x.toLowerCase() === (d || '').trim().toLowerCase());
  return k ? DEPT_COLORS[k] : '#64748B';
};

// Starting list of team names (local mode starts with these; for Supabase run supabase/seed_teams.sql).
export const DEFAULT_TEAMS = [
  ['Magnificent1', 'EEG/CC'],
  ['Tulip', 'SALES'],
  ['Windmill1', 'ACC/FIN'],
  ['Windmill2', 'ACC/FIN'],
  ['Banahaw1', 'WH/PPD'],
  ['Banahaw2', 'WH/PPD'],
  ['President1', 'KZN/MMG'],
  ['President2', 'KZN/MMG'],
  ['Supreme1', 'PRD'],
  ['Supreme2', 'PRD'],
  ['Makiling1', 'QCA'],
  ['Makiling2', 'QCA'],
  ['Makiling3', 'QCA'],
  ['Ambassador1', 'Admin'],
  ['Ambassador2', 'Admin'],
  ['Ambassador3', 'Admin'],
  ['Ambassador4', 'Admin'],
];

// One fixed order everywhere (lists, standings): departments as in DEPARTMENTS, teams as in DEFAULT_TEAMS.
// Anything new goes after, A-Z.
const deptIdx = (d) => {
  const i = DEPARTMENTS.findIndex((x) => x.toLowerCase() === (d || '').trim().toLowerCase());
  return i < 0 ? 1e6 : i;
};
const teamIdx = (n) => {
  const i = DEFAULT_TEAMS.findIndex(([x]) => x.toLowerCase() === (n || '').trim().toLowerCase());
  return i < 0 ? 1e6 : i;
};
export function compareTeams(a, b) {
  const da = (a.department || '').trim();
  const db = (b.department || '').trim();
  return (
    (da === '') - (db === '') ||
    deptIdx(da) - deptIdx(db) ||
    da.localeCompare(db) ||
    teamIdx(a.name) - teamIdx(b.name) ||
    a.name.localeCompare(b.name, undefined, { numeric: true })
  );
}
export const sortTeams = (list) => [...list].sort(compareTeams);
