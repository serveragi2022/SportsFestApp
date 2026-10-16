// Supabase Edge Function "sf-admin". Deploy with:  supabase functions deploy sf-admin
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically inside Edge Functions.
// The service role key stays on the server; the app only sends the signed-in user's token.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { handle } from './handler.ts';

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
