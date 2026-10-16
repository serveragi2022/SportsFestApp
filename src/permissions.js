// Who may do what. Same rules as the database (supabase/schema.sql); the database is the real guard,
// this only decides what the app shows and tries.
//
// access = { role: 'guest' | 'committee' | 'admin', games: [gameId, ...] }   (games: only for committee)
//
// perm:
//   'admin'          admins only (resets, clear a result, edit/delete team names, committee list, accounts)
//   'staff'          admins and committee (add a team name to the list)
//   { game: gameId } admins, and committee assigned to that game (winners, points, tie-break, team slot names)

export const GUEST = { role: 'guest', games: [] };

export function can(access, perm) {
  if (!access || access.role === 'guest') return false;
  if (access.role === 'admin') return true;
  if (perm === 'admin') return false;
  if (perm === 'staff') return access.role === 'committee';
  if (perm && perm.game) return access.role === 'committee' && (access.games || []).includes(perm.game);
  return false;
}

export function roleLabel(access) {
  return access.role === 'admin' ? 'Admin' : access.role === 'committee' ? 'Committee' : 'Guest';
}

// Accounts sign in with a USERNAME + password. Supabase Auth needs an email, so the username is turned into an
// internal address (no email is ever sent). Keep USERNAME_DOMAIN the same as in supabase/functions/sf-admin/handler.ts.
export const USERNAME_DOMAIN = 'sportsfest.example.com';
export const USERNAME_RULE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export const cleanUsername = (v) => String(v || '').trim().toLowerCase();
export const usernameToEmail = (username) => `${cleanUsername(username)}@${USERNAME_DOMAIN}`;

// What the person types on the login screen: a username, or a real email (the first admin may have one).
export const loginToEmail = (login) => {
  const v = String(login || '').trim();
  return v.includes('@') ? v : usernameToEmail(v);
};

export const emailToUsername = (email) => {
  const e = String(email || '');
  return e.toLowerCase().endsWith(`@${USERNAME_DOMAIN}`) ? e.slice(0, e.length - USERNAME_DOMAIN.length - 1) : e;
};
