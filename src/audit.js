// Audit trail: turns the lines of the sf_audit table (supabase/schema.sql) into readable sentences. No React in here.
import { GAME_BY_ID } from './data/games.js';
import { EVENT_BY_ID } from './data/events.js';

export const gameLabel = (id) => (!id ? '' : GAME_BY_ID[id] ? GAME_BY_ID[id].name : EVENT_BY_ID[id] ? EVENT_BY_ID[id].name : id);

// filter chips of the Audit screen
export const AUDIT_GROUPS = [
  { key: 'all', label: 'All', actions: null },
  { key: 'logins', label: 'Logins', actions: ['login', 'login.failed', 'logout', 'password.change', 'account.password.reset'] },
  { key: 'scores', label: 'Winners & points', actions: ['result.set', 'result.change', 'result.clear', 'tiebreak.set', 'tiebreak.clear', 'placement.set', 'placement.clear'] },
  { key: 'setup', label: 'Teams & setup', actions: ['teamname.add', 'teamname.update', 'teamname.delete', 'roster.set', 'roster.clear', 'committee.set', 'committee.clear', 'time.set', 'time.clear'] },
  { key: 'accounts', label: 'Accounts', actions: ['account.create', 'account.delete', 'account.update', 'account.password.reset', 'account.game.add', 'account.game.remove', 'admin.grant', 'admin.revoke'] },
  { key: 'resets', label: 'Resets & backups', actions: ['reset.game', 'reset.results', 'reset.all', 'backup.download', 'backup.restore'] },
];

// short name of an action (used when many lines are folded together)
export const ACTION_LABEL = {
  login: 'Signed in',
  'login.failed': 'Failed login',
  logout: 'Signed out',
  'password.change': 'Changed own password',
  'account.password.reset': 'Reset a password',
  'result.set': 'Set winner / points',
  'result.change': 'Changed winner / points',
  'result.clear': 'Cleared a result',
  'tiebreak.set': 'Set tie-break champion',
  'tiebreak.clear': 'Cleared tie-break champion',
  'placement.set': 'Set a place',
  'placement.clear': 'Cleared a place',
  'teamname.add': 'Added a team name',
  'teamname.update': 'Changed a team name',
  'teamname.delete': 'Deleted a team name',
  'roster.set': 'Set a team slot',
  'roster.clear': 'Cleared a team slot',
  'committee.set': 'Set committee name',
  'committee.clear': 'Cleared committee name',
  'time.set': 'Set a match time',
  'time.clear': 'Cleared a match time',
  'account.create': 'Created an account',
  'account.delete': 'Deleted an account',
  'account.update': 'Changed an account',
  'account.game.add': 'Gave access to a game',
  'account.game.remove': 'Removed access to a game',
  'admin.grant': 'Made an admin',
  'admin.revoke': 'Removed an admin',
  'reset.game': 'Reset a game',
  'reset.results': 'Reset all results',
  'reset.all': 'Reset everything',
  'backup.download': 'Downloaded a backup',
  'backup.restore': 'Restored a backup',
};

const q = (v) => `“${v == null || v === '' ? '—' : v}”`;
const score = (a, b) => (a != null && b != null ? `${a}–${b}` : null);

export function who(e) {
  if (e.action === 'login.failed') return 'Nobody (not signed in)';
  if (e.fullName && e.username) return `${e.fullName} (${e.username})`;
  return e.fullName || e.username || 'Unknown (no login)';
}

// One sentence for one line.
export function describe(e) {
  const d = e.detail || {};
  const game = gameLabel(e.gameId);
  const g = game ? `${game} · ` : '';
  const target = d.full_name && d.username ? `${d.full_name} (${d.username})` : d.username || d.full_name || 'an account';
  switch (e.action) {
    case 'login': return 'Signed in';
    case 'logout': return 'Signed out';
    case 'login.failed': return `Wrong username or password (typed ${q(d.login)})`;
    case 'password.change': return 'Changed their own password';
    case 'account.password.reset': return `Reset the password of ${target}`;

    case 'result.set': {
      const sc = score(d.score1, d.score2);
      return `${g}Match ${d.match_no}: set winner ${q(d.winner_name)}${sc ? ` (${sc})` : ''}`;
    }
    case 'result.change': {
      const sc = score(d.score1, d.score2);
      const was = score(d.from_score1, d.from_score2);
      if (d.winner === d.from_winner) return `${g}Match ${d.match_no}: changed the score to ${sc || '—'} (was ${was || '—'})`;
      return `${g}Match ${d.match_no}: changed winner from ${q(d.from_winner_name)} to ${q(d.winner_name)}${sc ? ` (${sc})` : ''}`;
    }
    case 'result.clear': return `${g}Match ${d.match_no}: cleared the result (was ${q(d.winner_name)})`;

    case 'tiebreak.set': return `${g}Set the tie-break champion: ${q(d.team_name)}${d.from_team_name ? ` (was ${q(d.from_team_name)})` : ''}`;
    case 'tiebreak.clear': return `${g}Cleared the tie-break champion (was ${q(d.team_name)})`;
    case 'placement.set': return `${g}Place ${d.place}: ${q(d.department)}${d.from_department ? ` (was ${q(d.from_department)})` : ''}`;
    case 'placement.clear': return `${g}Cleared place ${d.place} (was ${q(d.department)})`;

    case 'teamname.add': return `Added team name ${q(d.name)}${d.department ? ` (${d.department})` : ''}`;
    case 'teamname.update': {
      const parts = [];
      if (d.from_name !== d.name) parts.push(`renamed ${q(d.from_name)} to ${q(d.name)}`);
      if ((d.from_department || '') !== (d.department || '')) parts.push(`department ${q(d.from_department)} → ${q(d.department)}`);
      return `Team name ${q(d.name)}: ${parts.join(', ') || 'changed the color'}`;
    }
    case 'teamname.delete': return `Deleted team name ${q(d.name)}`;
    case 'roster.set': {
      const playersChanged = JSON.stringify(d.players || null) !== JSON.stringify(d.from_players || null) && 'from_players' in d;
      const nameChanged = d.from_name !== undefined && d.from_name !== d.name;
      if (!('from_name' in d)) return `${g}Team slot ${d.team_no}: named ${q(d.name)}${d.players && d.players.length ? ` with ${d.players.length} player(s)` : ''}`;
      return `${g}Team slot ${d.team_no}: ${nameChanged ? `changed ${q(d.from_name)} to ${q(d.name)}` : `${q(d.name)}`}${playersChanged ? (nameChanged ? ', ' : ': ') + 'changed the players' : ''}`;
    }
    case 'roster.clear': return `${g}Team slot ${d.team_no}: cleared (was ${q(d.name)})`;
    case 'committee.set': return `${g}${d.role}: ${q(d.name)}${d.from_name !== undefined ? ` (was ${q(d.from_name)})` : ''}`;
    case 'committee.clear': return `${g}${d.role}: cleared (was ${q(d.name)})`;
    case 'time.set': return `${g}Match ${d.match_no} time: ${d.time_text}${d.from_time_text ? ` (was ${d.from_time_text})` : ''}`;
    case 'time.clear': return `${g}Match ${d.match_no}: cleared the time (was ${d.time_text})`;

    case 'account.create': return `Created the ${d.role === 'admin' ? 'admin' : 'committee'} account ${target}${d.role !== 'admin' && Array.isArray(d.games) ? ` with ${d.games.length} game(s)` : ''}`;
    case 'account.delete': return `Deleted the account of ${target}`;
    case 'account.update': {
      const parts = [];
      if (d.from_role !== d.role) parts.push(`role ${d.from_role} → ${d.role}`);
      if (d.from_full_name !== d.full_name) parts.push(`name ${q(d.from_full_name)} → ${q(d.full_name)}`);
      return `Changed the account ${d.username}: ${parts.join(', ')}`;
    }
    case 'account.game.add': return `Gave ${d.username || 'an account'} access to ${game || 'a game'}`;
    case 'account.game.remove': return `Removed ${d.username || 'an account'}’s access to ${game || 'a game'}`;
    case 'admin.grant': return `Made ${d.username || 'an account'} an admin`;
    case 'admin.revoke': return `Removed ${d.username || 'an account'} as admin`;

    case 'reset.game': return `Reset all winners and points of ${game || 'a game'}`;
    case 'reset.results': return 'Reset ALL winners and points of every game';
    case 'reset.all': return 'Reset EVERYTHING (results, team names, committee names, match times)';
    case 'backup.download': return 'Downloaded a backup';
    case 'backup.restore': return `Restored a backup (${d.teamNames ?? 0} team names, ${d.results ?? 0} results, ${d.committee ?? 0} committee names, ${d.times ?? 0} times)`;
    default: return e.action;
  }
}

// Fold lines of the same person and the same action that happen within `seconds` of each other (a reset or a restore writes
// hundreds of lines). entries: newest first. Returns [{ head, items, count, games }] newest first.
export function groupEntries(entries, seconds = 10) {
  const out = [];
  for (const e of entries) {
    const last = out[out.length - 1];
    const gap = last ? Math.abs(new Date(last.items[last.items.length - 1].at) - new Date(e.at)) / 1000 : Infinity;
    if (last && last.head.userId === e.userId && last.head.action === e.action && gap <= seconds && e.action !== 'login' && e.action !== 'login.failed') {
      last.items.push(e);
      last.count += 1;
    } else {
      out.push({ head: e, items: [e], count: 1 });
    }
  }
  return out.map((g) => ({ ...g, games: [...new Set(g.items.map((i) => gameLabel(i.gameId)).filter(Boolean))] }));
}

export function describeGroup(g) {
  if (g.count === 1) return describe(g.head);
  return `${ACTION_LABEL[g.head.action] || g.head.action} × ${g.count}${g.games.length ? ` (${g.games.slice(0, 3).join(', ')}${g.games.length > 3 ? ` +${g.games.length - 3} more` : ''})` : ''}`;
}

export function formatWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso || '');
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

// CSV for Excel (all lines given, one per row)
export function auditToCsv(entries) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Time', 'Username', 'Name', 'Action', 'Game', 'What happened'];
  const rows = entries.map((e) => [e.at, e.username, e.fullName, e.action, gameLabel(e.gameId), describe(e)].map(cell).join(','));
  return '\ufeff' + [head.map(cell).join(','), ...rows].join('\r\n');
}
