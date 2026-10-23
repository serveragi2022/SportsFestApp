-- Sports Fest Scorekeeper - Supabase schema
-- Run this whole file once in the Supabase SQL Editor (Dashboard > SQL Editor > New query).
--
-- Access model
--   guest      = anyone with the app (no login): can READ brackets, results, team names, standings
--   committee  = a signed-in account (created by an admin) that is assigned to one or more games.
--                In ITS games it can choose winners / encode points, pick a tie-break champion and
--                give team names to the team slots. It can also add new team names to the list.
--                It cannot reset games, rename/delete team names, edit the committee list or manage accounts.
--                (Changing a winner clears the later matches of that game, so deleting results in its own games is
--                allowed by the database; the app only shows the Clear button to admins.)
--   admin      = a signed-in user listed in sf_admins: can do everything, and creates the other accounts

-- ---------------------------------------------------------------- tables
create table if not exists public.sf_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create table if not exists public.sf_master_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#2563EB',
  department text,
  created_at timestamptz not null default now()
);
alter table public.sf_master_teams add column if not exists department text;
-- "Team N" of a game -> a team name (from the master list, or a custom name).
-- Several team numbers may share the same name.
create table if not exists public.sf_rosters (
  game_id text not null,
  team_no int not null,
  master_id uuid references public.sf_master_teams (id) on delete set null,
  custom_name text,
  primary key (game_id, team_no)
);
-- players of a team slot (optional, filled by the admin)
alter table public.sf_rosters add column if not exists players text[];

-- Winner of a match. score1/score2 (points of the 1st and 2nd team of the match) are only used by
-- Pickleball and the Darts / Sungka championship rounds.
create table if not exists public.sf_results (
  game_id text not null,
  match_no int not null,
  winner int not null,
  score1 int,
  score2 int,
  updated_at timestamptz not null default now(),
  primary key (game_id, match_no)
);

-- Time of a match (editable by the admin). Overrides the default time written in the app.
create table if not exists public.sf_match_times (
  game_id text not null,
  match_no int not null,
  time_text text not null,
  primary key (game_id, match_no)
);

-- Cheer Dance / Muse: which DEPARTMENT finished in which place (1..8). Admin, or a committee account assigned to the event
-- (event_id 'cheer-dance' or 'muse', put in sf_staff_games like a game).
create table if not exists public.sf_placements (
  event_id text not null,
  place int not null,
  department text not null,
  primary key (event_id, place),
  unique (event_id, department)
);

-- Champion picked by the admin when a round robin is still tied after wins and points.
create table if not exists public.sf_tiebreak (
  game_id text primary key,
  team_no int not null
);

create table if not exists public.sf_committee (
  game_id text not null,
  role text not null,
  name text not null default '',
  primary key (game_id, role)
);

-- Accounts created by an admin (committee members, or extra admins). Created through the
-- 'sf-admin' Edge Function (see supabase/functions/sf-admin), because creating a login needs the service role key.
create table if not exists public.sf_staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,   -- what the person types to sign in
  email text not null,             -- internal login address made from the username (no email is ever sent)
  full_name text not null default '',
  role text not null default 'committee' check (role in ('committee', 'admin')),
  created_at timestamptz not null default now()
);

-- Which games a committee account may score. One account can have many games.
create table if not exists public.sf_staff_games (
  user_id uuid not null references public.sf_staff (user_id) on delete cascade,
  game_id text not null,
  primary key (user_id, game_id)
);

-- ---------------------------------------------------------------- admin check
create or replace function public.sf_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.sf_admins where user_id = auth.uid());
$$;

-- committee account (or admin)
create or replace function public.sf_is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sf_is_admin() or exists (select 1 from public.sf_staff where user_id = auth.uid());
$$;

-- admin, or a committee account assigned to this game
create or replace function public.sf_can_edit_game(g text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.sf_is_admin()
      or exists (select 1 from public.sf_staff_games where user_id = auth.uid() and game_id = g);
$$;

-- ---------------------------------------------------------------- row level security
alter table public.sf_admins       enable row level security;
alter table public.sf_staff        enable row level security;
alter table public.sf_staff_games  enable row level security;
alter table public.sf_master_teams enable row level security;
alter table public.sf_rosters      enable row level security;
alter table public.sf_results      enable row level security;
alter table public.sf_tiebreak     enable row level security;
alter table public.sf_committee    enable row level security;
alter table public.sf_match_times  enable row level security;
alter table public.sf_placements   enable row level security;

-- start clean so this file can be run again after an update
do $$
declare
  r record;
begin
  for r in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename in ('sf_admins','sf_staff','sf_staff_games','sf_master_teams','sf_rosters','sf_results','sf_tiebreak','sf_committee','sf_match_times','sf_placements')
  loop
    execute format('drop policy if exists %I on %I.%I', r.policyname, r.schemaname, r.tablename);
  end loop;
end $$;

-- who am I: a user sees only their own admin / staff rows (the app uses this to know the role)
create policy sf_admins_self_read on public.sf_admins for select to authenticated using (user_id = auth.uid());

-- accounts: admins see and manage everyone, a user sees their own row. Creating/deleting logins goes through the Edge Function.
create policy sf_staff_read on public.sf_staff for select to authenticated using (user_id = auth.uid() or public.sf_is_admin());
create policy sf_staff_admin_update on public.sf_staff for update to authenticated using (public.sf_is_admin()) with check (public.sf_is_admin());

create policy sf_staff_games_read on public.sf_staff_games for select to authenticated using (user_id = auth.uid() or public.sf_is_admin());
create policy sf_staff_games_admin_insert on public.sf_staff_games for insert to authenticated with check (public.sf_is_admin());
create policy sf_staff_games_admin_delete on public.sf_staff_games for delete to authenticated using (public.sf_is_admin());

-- everybody (guests too) can read the competition data
create policy sf_master_teams_read on public.sf_master_teams for select to anon, authenticated using (true);
create policy sf_rosters_read      on public.sf_rosters      for select to anon, authenticated using (true);
create policy sf_results_read      on public.sf_results      for select to anon, authenticated using (true);
create policy sf_tiebreak_read     on public.sf_tiebreak     for select to anon, authenticated using (true);
create policy sf_committee_read    on public.sf_committee    for select to anon, authenticated using (true);
create policy sf_match_times_read  on public.sf_match_times  for select to anon, authenticated using (true);
create policy sf_placements_read   on public.sf_placements   for select to anon, authenticated using (true);

-- team names list: only admins can add, rename or delete
create policy sf_master_teams_admin_insert on public.sf_master_teams for insert to authenticated with check (public.sf_is_admin());
create policy sf_master_teams_admin_update on public.sf_master_teams for update to authenticated using (public.sf_is_admin()) with check (public.sf_is_admin());
create policy sf_master_teams_admin_delete on public.sf_master_teams for delete to authenticated using (public.sf_is_admin());

-- team slot names: admins only. Winners/points and the tie-break champion: admins and the committee assigned to that game
create policy sf_rosters_admin_insert on public.sf_rosters for insert to authenticated with check (public.sf_is_admin());
create policy sf_rosters_admin_update on public.sf_rosters for update to authenticated using (public.sf_is_admin()) with check (public.sf_is_admin());
create policy sf_rosters_admin_delete on public.sf_rosters for delete to authenticated using (public.sf_is_admin());

create policy sf_results_game_insert on public.sf_results for insert to authenticated with check (public.sf_can_edit_game(game_id));
create policy sf_results_game_update on public.sf_results for update to authenticated using (public.sf_can_edit_game(game_id)) with check (public.sf_can_edit_game(game_id));
create policy sf_results_game_delete on public.sf_results for delete to authenticated using (public.sf_can_edit_game(game_id));

create policy sf_tiebreak_game_insert on public.sf_tiebreak for insert to authenticated with check (public.sf_can_edit_game(game_id));
create policy sf_tiebreak_game_update on public.sf_tiebreak for update to authenticated using (public.sf_can_edit_game(game_id)) with check (public.sf_can_edit_game(game_id));
create policy sf_tiebreak_game_delete on public.sf_tiebreak for delete to authenticated using (public.sf_can_edit_game(game_id));

-- committee list of each game (Tournament Head, Referee, ...): admins only
create policy sf_committee_admin_insert on public.sf_committee for insert to authenticated with check (public.sf_is_admin());
create policy sf_committee_admin_update on public.sf_committee for update to authenticated using (public.sf_is_admin()) with check (public.sf_is_admin());
create policy sf_committee_admin_delete on public.sf_committee for delete to authenticated using (public.sf_is_admin());

-- match times: admins only. Cheer Dance / Muse places: admins and the committee assigned to the event
create policy sf_match_times_admin_insert on public.sf_match_times for insert to authenticated with check (public.sf_is_admin());
create policy sf_match_times_admin_update on public.sf_match_times for update to authenticated using (public.sf_is_admin()) with check (public.sf_is_admin());
create policy sf_match_times_admin_delete on public.sf_match_times for delete to authenticated using (public.sf_is_admin());

create policy sf_placements_event_insert on public.sf_placements for insert to authenticated with check (public.sf_can_edit_game(event_id));
create policy sf_placements_event_update on public.sf_placements for update to authenticated using (public.sf_can_edit_game(event_id)) with check (public.sf_can_edit_game(event_id));
create policy sf_placements_event_delete on public.sf_placements for delete to authenticated using (public.sf_can_edit_game(event_id));

grant select on public.sf_match_times, public.sf_placements to anon, authenticated;
grant insert, update, delete on public.sf_match_times, public.sf_placements to authenticated;
grant select on public.sf_master_teams, public.sf_rosters, public.sf_results, public.sf_tiebreak, public.sf_committee to anon, authenticated;
grant insert, update, delete on public.sf_master_teams, public.sf_rosters, public.sf_results, public.sf_tiebreak, public.sf_committee to authenticated;
-- sanity limits (stops junk values even from a signed-in committee account)
do $$
begin
  begin alter table public.sf_results add constraint sf_results_sane check (match_no between 1 and 100 and winner between 1 and 50 and (score1 is null or score1 between 0 and 999) and (score2 is null or score2 between 0 and 999)); exception when duplicate_object then null; end;
  begin alter table public.sf_rosters add constraint sf_rosters_sane check (team_no between 1 and 50 and length(coalesce(custom_name, '')) <= 80); exception when duplicate_object then null; end;
  begin alter table public.sf_rosters add constraint sf_rosters_players_sane check (players is null or (cardinality(players) <= 10 and length(array_to_string(players, '')) <= 600)); exception when duplicate_object then null; end;
  begin alter table public.sf_match_times add constraint sf_match_times_sane check (match_no between 1 and 100 and length(time_text) between 1 and 60); exception when duplicate_object then null; end;
  begin alter table public.sf_placements add constraint sf_placements_sane check (event_id in ('cheer-dance', 'muse') and place between 1 and 8 and length(department) between 1 and 40); exception when duplicate_object then null; end;
  begin alter table public.sf_master_teams add constraint sf_master_teams_sane check (length(name) between 1 and 80 and length(coalesce(department, '')) <= 40); exception when duplicate_object then null; end;
end $$;

grant select on public.sf_admins to authenticated;
grant select, update on public.sf_staff to authenticated;
grant select, insert, delete on public.sf_staff_games to authenticated;

-- ---------------------------------------------------------------- realtime (guests see updates live)
do $$
declare
  t text;
begin
  foreach t in array array['sf_master_teams', 'sf_rosters', 'sf_results', 'sf_tiebreak', 'sf_committee', 'sf_match_times', 'sf_placements']
  loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;  -- already published
      when undefined_object then null;  -- publication does not exist (not on Supabase)
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------- audit trail (who did what, and when)
-- Every change to winners, points, tie-breaks, team names, team slots, committee, match times, places and accounts is written
-- here by database triggers, with the account that made it (taken from the login, so the app cannot fake it).
-- Logins, logouts, failed logins, password changes and resets / restores are written through the two functions below.
-- Only admins can read it. Nobody can add, edit or delete rows from the app, and a trigger blocks UPDATE / DELETE / TRUNCATE.
-- To clear it on purpose (e.g. after a test run), run in the SQL editor:  alter table public.sf_audit disable trigger sf_audit_no_change;
--   truncate public.sf_audit;  alter table public.sf_audit enable trigger sf_audit_no_change;
create table if not exists public.sf_audit (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,                              -- null = no login (failed login, SQL editor)
  username text,
  full_name text,
  action text not null,                      -- e.g. 'result.set', 'login'  (see src/audit.js)
  game_id text,
  detail jsonb not null default '{}'::jsonb
);
create index if not exists sf_audit_game_idx on public.sf_audit (game_id, id desc);
create index if not exists sf_audit_user_idx on public.sf_audit (user_id, id desc);
create index if not exists sf_audit_action_idx on public.sf_audit (action, id desc);

alter table public.sf_audit enable row level security;
revoke all on public.sf_audit from anon, authenticated;
grant select on public.sf_audit to authenticated;
drop policy if exists sf_audit_admin_read on public.sf_audit;
create policy sf_audit_admin_read on public.sf_audit for select to authenticated using (public.sf_is_admin());

create or replace function public.sf_audit_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'The audit trail cannot be changed or deleted.';
end $$;
drop trigger if exists sf_audit_no_change on public.sf_audit;
create trigger sf_audit_no_change before update or delete on public.sf_audit for each row execute function public.sf_audit_immutable();
drop trigger if exists sf_audit_no_truncate on public.sf_audit;
create trigger sf_audit_no_truncate before truncate on public.sf_audit for each statement execute function public.sf_audit_immutable();

-- name of a team slot: the team name, else the custom name, else "Team N"
create or replace function public.sf_roster_name(m uuid, c text, n int)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.sf_master_teams where id = m), nullif(c, ''), 'Team ' || n);
$$;

create or replace function public.sf_team_label(g text, n int)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select public.sf_roster_name(r.master_id, r.custom_name, n) from public.sf_rosters r where r.game_id = g and r.team_no = n), 'Team ' || n);
$$;

-- writes one row for the signed-in account (internal: not callable from the app)
create or replace function public.sf_audit_write(p_action text, p_game text, p_detail jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  un text;
  fn text;
begin
  if uid is not null then
    select s.username, s.full_name into un, fn from public.sf_staff s where s.user_id = uid;
    if un is null then
      select split_part(u.email, '@', 1) into un from auth.users u where u.id = uid;
    end if;
  end if;
  insert into public.sf_audit (user_id, username, full_name, action, game_id, detail)
  values (uid, un, nullif(fn, ''), p_action, p_game, coalesce(p_detail, '{}'::jsonb));
end $$;
revoke all on function public.sf_audit_write(text, text, jsonb) from public, anon, authenticated;

-- trigger: one audit row per real change (a save that changes nothing is not logged)
create or replace function public.sf_audit_trg()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  t text := tg_table_name;
  n jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  o jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
  r jsonb := coalesce(n, o);
  act text;
  g text;
  det jsonb;
begin
  -- changes made without a login: the account tables are logged by the sf-admin Edge Function itself
  if auth.uid() is null and t in ('sf_staff', 'sf_staff_games', 'sf_admins') then return null; end if;

  if t = 'sf_results' then
    g := r->>'game_id';
    det := jsonb_build_object('match_no', (r->>'match_no')::int, 'winner', (r->>'winner')::int,
                              'winner_name', public.sf_team_label(g, (r->>'winner')::int), 'score1', r->'score1', 'score2', r->'score2');
    if tg_op = 'INSERT' then act := 'result.set';
    elsif tg_op = 'DELETE' then act := 'result.clear';
    else
      if o->>'winner' = n->>'winner' and (o->'score1') is not distinct from (n->'score1') and (o->'score2') is not distinct from (n->'score2') then return null; end if;
      act := 'result.change';
      det := det || jsonb_build_object('from_winner', (o->>'winner')::int, 'from_winner_name', public.sf_team_label(g, (o->>'winner')::int),
                                       'from_score1', o->'score1', 'from_score2', o->'score2');
    end if;

  elsif t = 'sf_tiebreak' then
    g := r->>'game_id';
    det := jsonb_build_object('team_no', (r->>'team_no')::int, 'team_name', public.sf_team_label(g, (r->>'team_no')::int));
    if tg_op = 'INSERT' then act := 'tiebreak.set';
    elsif tg_op = 'DELETE' then act := 'tiebreak.clear';
    else
      if o->>'team_no' = n->>'team_no' then return null; end if;
      act := 'tiebreak.set';
      det := det || jsonb_build_object('from_team_name', public.sf_team_label(g, (o->>'team_no')::int));
    end if;

  elsif t = 'sf_committee' then
    g := r->>'game_id';
    det := jsonb_build_object('role', r->>'role', 'name', r->>'name');
    if tg_op = 'DELETE' then act := 'committee.clear';
    else
      act := 'committee.set';
      if tg_op = 'UPDATE' then
        if o->>'name' = n->>'name' then return null; end if;
        det := det || jsonb_build_object('from_name', o->>'name');
      end if;
    end if;

  elsif t = 'sf_rosters' then
    g := r->>'game_id';
    det := jsonb_build_object('team_no', (r->>'team_no')::int,
                              'name', public.sf_roster_name((r->>'master_id')::uuid, r->>'custom_name', (r->>'team_no')::int), 'players', r->'players');
    if tg_op = 'DELETE' then act := 'roster.clear';
    else
      act := 'roster.set';
      if tg_op = 'UPDATE' then
        if o->>'master_id' is not distinct from n->>'master_id' and o->>'custom_name' is not distinct from n->>'custom_name' and (o->'players') is not distinct from (n->'players') then return null; end if;
        det := det || jsonb_build_object('from_name', public.sf_roster_name((o->>'master_id')::uuid, o->>'custom_name', (o->>'team_no')::int), 'from_players', o->'players');
      end if;
    end if;

  elsif t = 'sf_match_times' then
    g := r->>'game_id';
    det := jsonb_build_object('match_no', (r->>'match_no')::int, 'time_text', r->>'time_text');
    if tg_op = 'DELETE' then act := 'time.clear';
    else
      act := 'time.set';
      if tg_op = 'UPDATE' then
        if o->>'time_text' = n->>'time_text' then return null; end if;
        det := det || jsonb_build_object('from_time_text', o->>'time_text');
      end if;
    end if;

  elsif t = 'sf_placements' then
    g := r->>'event_id';
    det := jsonb_build_object('place', (r->>'place')::int, 'department', r->>'department');
    if tg_op = 'DELETE' then act := 'placement.clear';
    else
      act := 'placement.set';
      if tg_op = 'UPDATE' then
        if o->>'department' = n->>'department' then return null; end if;
        det := det || jsonb_build_object('from_department', o->>'department');
      end if;
    end if;

  elsif t = 'sf_master_teams' then
    det := jsonb_build_object('name', r->>'name', 'department', r->>'department');
    if tg_op = 'INSERT' then act := 'teamname.add';
    elsif tg_op = 'DELETE' then act := 'teamname.delete';
    else
      if o->>'name' = n->>'name' and o->>'color' = n->>'color' and o->>'department' is not distinct from n->>'department' then return null; end if;
      act := 'teamname.update';
      det := det || jsonb_build_object('from_name', o->>'name', 'from_department', o->>'department');
    end if;

  elsif t = 'sf_staff_games' then
    g := r->>'game_id';
    det := jsonb_build_object('username', (select s.username from public.sf_staff s where s.user_id = (r->>'user_id')::uuid));
    act := case when tg_op = 'DELETE' then 'account.game.remove' else 'account.game.add' end;

  elsif t = 'sf_staff' then
    if o->>'role' = n->>'role' and o->>'full_name' = n->>'full_name' then return null; end if;
    act := 'account.update';
    det := jsonb_build_object('username', n->>'username', 'role', n->>'role', 'from_role', o->>'role', 'full_name', n->>'full_name', 'from_full_name', o->>'full_name');

  elsif t = 'sf_admins' then
    det := jsonb_build_object('username', (select s.username from public.sf_staff s where s.user_id = (r->>'user_id')::uuid));
    act := case when tg_op = 'DELETE' then 'admin.revoke' else 'admin.grant' end;

  else
    return null;
  end if;

  perform public.sf_audit_write(act, g, det);
  return null;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['sf_results', 'sf_tiebreak', 'sf_committee', 'sf_rosters', 'sf_match_times', 'sf_placements', 'sf_master_teams', 'sf_staff_games']
  loop
    execute format('drop trigger if exists sf_audit_row on public.%I', t);
    execute format('create trigger sf_audit_row after insert or update or delete on public.%I for each row execute function public.sf_audit_trg()', t);
  end loop;
end $$;
drop trigger if exists sf_audit_row on public.sf_staff;
create trigger sf_audit_row after update on public.sf_staff for each row execute function public.sf_audit_trg();
drop trigger if exists sf_audit_row on public.sf_admins;
create trigger sf_audit_row after insert or delete on public.sf_admins for each row execute function public.sf_audit_trg();

-- called by the app for what a trigger cannot see (signed-in accounts only; only these actions are accepted)
create or replace function public.sf_audit_log(p_action text, p_game text default null, p_detail jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Please sign in.'; end if;
  if p_action not in ('login', 'logout', 'password.change', 'backup.download', 'backup.restore', 'reset.game', 'reset.results', 'reset.all') then
    raise exception 'Unknown audit action.';
  end if;
  if p_action not in ('login', 'logout', 'password.change') and not public.sf_is_staff() then
    raise exception 'Only the committee or admin can do this.';
  end if;
  if length(coalesce(p_detail, '{}'::jsonb)::text) > 2000 then raise exception 'Too much detail.'; end if;
  perform public.sf_audit_write(p_action, left(p_game, 40), p_detail);
end $$;
revoke all on function public.sf_audit_log(text, text, jsonb) from public, anon;
grant execute on function public.sf_audit_log(text, text, jsonb) to authenticated;

-- a wrong username / password (no login yet, so anyone may call it). At most 20 per minute, so it cannot flood the table.
create or replace function public.sf_audit_login_failed(p_login text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.sf_audit where action = 'login.failed' and at > now() - interval '1 minute') >= 20 then return; end if;
  insert into public.sf_audit (action, detail) values ('login.failed', jsonb_build_object('login', left(coalesce(p_login, ''), 40)));
end $$;
revoke all on function public.sf_audit_login_failed(text) from public;
grant execute on function public.sf_audit_login_failed(text) to anon, authenticated;

-- ---------------------------------------------------------------- the first admin
-- Only the FIRST admin is made by hand. After that, admins create all other accounts inside the app (Admin > Accounts).
-- 1. Dashboard > Authentication > Users > Add user (email + password, tick "Auto Confirm User")
-- 2. Run (change the email):
--
--   insert into public.sf_admins (user_id)
--   select id from auth.users where email = 'admin@example.com'
--   on conflict do nothing;
--
-- 3. Recommended: Authentication > Providers > Email > turn OFF "Allow new users to sign up",
--    so only the accounts created by an admin can log in. (Even if someone signed up, they could not write anything.)
-- 4. Deploy the Edge Function that lets admins create accounts: see supabase/functions/sf-admin/README.md
