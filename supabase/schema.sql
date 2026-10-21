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
