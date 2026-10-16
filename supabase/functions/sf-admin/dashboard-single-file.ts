// SINGLE-FILE VERSION for the Supabase dashboard editor (handler.ts + index.ts combined).
// Paste ALL of this into the sf-admin function, then Deploy.
import { createClient } from 'npm:@supabase/supabase-js@2';

// Logic of the "sf-admin" Edge Function: lets an ADMIN create / delete committee accounts and reset passwords.
// Kept free of Deno / Supabase imports so it can be tested with plain Node (scripts/test-sf-admin.mjs).

export type Caller = { id: string; email?: string | null };

export interface Deps {
  getCaller(token: string): Promise<Caller | null>;
  isAdmin(userId: string): Promise<boolean>;
  createUser(email: string, password: string): Promise<{ id: string }>;
  deleteUser(userId: string): Promise<void>;
  setPassword(userId: string, password: string): Promise<void>;
  insertStaff(row: { user_id: string; username: string; email: string; full_name: string; role: string }): Promise<void>;
  insertAdmin(userId: string): Promise<void>;
  setGames(userId: string, gameIds: string[]): Promise<void>;
  staffExists(userId: string): Promise<boolean>;
}

export type Result = { status: number; body: Record<string, unknown> };

// Accounts sign in with a username + password. The login address is made from the username; no email is sent.
// Keep USERNAME_DOMAIN the same as in src/permissions.js.
export const USERNAME_DOMAIN = 'sportsfest.example.com';
const USERNAME = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const fail = (status: number, error: string): Result => ({ status, body: { error } });

export async function handle(authHeader: string | null, body: any, deps: Deps): Promise<Result> {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return fail(401, 'Please sign in.');
  const caller = await deps.getCaller(token);
  if (!caller) return fail(401, 'Please sign in again.');
  if (!(await deps.isAdmin(caller.id))) return fail(403, 'Only admins can manage accounts.');

  const action = body && body.action;

  if (action === 'create') {
    const username = String(body.username || '').trim().toLowerCase();
    const email = `${username}@${USERNAME_DOMAIN}`;
    const password = String(body.password || '');
    const fullName = String(body.fullName || '').trim().slice(0, 80);
    const role = body.role === 'admin' ? 'admin' : 'committee';
    const gameIds: string[] = Array.isArray(body.gameIds) ? [...new Set<string>(body.gameIds.map(String))].slice(0, 50) : [];
    if (!USERNAME.test(username)) return fail(400, 'The username needs 3-30 characters: letters, numbers, dot, dash or underscore.');
    if (password.length < 8) return fail(400, 'The password needs at least 8 characters.');
    if (!fullName) return fail(400, 'Enter the name of the person.');

    let created: { id: string };
    try {
      created = await deps.createUser(email, password);
    } catch (e) {
      const msg = (e as Error).message || '';
      return fail(400, /already|registered|exists/i.test(msg) ? 'That username is already taken.' : msg || 'Could not create the account.');
    }
    try {
      await deps.insertStaff({ user_id: created.id, username, email, full_name: fullName, role });
      if (role === 'admin') await deps.insertAdmin(created.id);
      else await deps.setGames(created.id, gameIds);
    } catch (e) {
      await deps.deleteUser(created.id).catch(() => {}); // do not leave a half-made account
      return fail(500, (e as Error).message || 'Could not save the account.');
    }
    return { status: 200, body: { ok: true, userId: created.id } };
  }

  if (action === 'delete') {
    const userId = String(body.userId || '');
    if (!userId) return fail(400, 'Missing account.');
    if (userId === caller.id) return fail(400, 'You cannot delete your own account.');
    if (!(await deps.staffExists(userId))) return fail(404, 'Account not found.');
    try {
      await deps.deleteUser(userId);
    } catch (e) {
      return fail(500, (e as Error).message || 'Could not delete the account.');
    }
    return { status: 200, body: { ok: true } };
  }

  if (action === 'password') {
    const userId = String(body.userId || '');
    const password = String(body.password || '');
    if (!userId) return fail(400, 'Missing account.');
    if (password.length < 8) return fail(400, 'The password needs at least 8 characters.');
    if (!(await deps.staffExists(userId))) return fail(404, 'Account not found.');
    try {
      await deps.setPassword(userId, password);
    } catch (e) {
      return fail(500, (e as Error).message || 'Could not change the password.');
    }
    return { status: 200, body: { ok: true } };
  }

  return fail(400, 'Unknown action.');
}

// Supabase Edge Function "sf-admin". Deploy with:  supabase functions deploy sf-admin
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically inside Edge Functions.
// The service role key stays on the server; the app only sends the signed-in user's token.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const must = ({ error }: { error: { message: string } | null }) => {
  if (error) throw new Error(error.message);
};

const deps = {
  async getCaller(token: string) {
    const { data, error } = await admin.auth.getUser(token);
    return error || !data.user ? null : { id: data.user.id, email: data.user.email };
  },
  async isAdmin(userId: string) {
    const { data, error } = await admin.from('sf_admins').select('user_id').eq('user_id', userId).maybeSingle();
    must({ error });
    return !!data;
  },
  async createUser(email: string, password: string) {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    if (error || !data.user) throw new Error(error ? error.message : 'Could not create the account.');
    return { id: data.user.id };
  },
  async deleteUser(userId: string) {
    must(await admin.auth.admin.deleteUser(userId));
  },
  async setPassword(userId: string, password: string) {
    must(await admin.auth.admin.updateUserById(userId, { password }));
  },
  async insertStaff(row: { user_id: string; username: string; email: string; full_name: string; role: string }) {
    must(await admin.from('sf_staff').insert(row));
  },
  async insertAdmin(userId: string) {
    must(await admin.from('sf_admins').upsert({ user_id: userId }));
  },
  async setGames(userId: string, gameIds: string[]) {
    must(await admin.from('sf_staff_games').delete().eq('user_id', userId));
    if (gameIds.length) must(await admin.from('sf_staff_games').insert(gameIds.map((game_id) => ({ user_id: userId, game_id }))));
  },
  async staffExists(userId: string) {
    const { data, error } = await admin.from('sf_staff').select('user_id').eq('user_id', userId).maybeSingle();
    must({ error });
    return !!data;
  },
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });
  let body: unknown = null;
  try {
    body = await req.json();
  } catch (_e) {
    body = null;
  }
  try {
    const out = await handle(req.headers.get('Authorization'), body, deps);
    return new Response(JSON.stringify(out.body), { status: out.status, headers: { ...cors, 'Content-Type': 'application/json' } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
});
