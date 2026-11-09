-- Live stream per game (VDO.Ninja). Run once in the Supabase SQL Editor (safe to run again).
-- Rules enforced HERE in the database, not only in the app:
--   * only a COMMITTEE account assigned to that game can start a stream for it
--   * only ONE streamer per game: while a stream is live, nobody else can start one
--   * only the person who is streaming can end it (an admin can force-end it, e.g. when a phone died)
--   * everyone (guests too) can read whether a game is live; the stream PASSWORD is never stored in the database
create table if not exists public.sf_streams (
  game_id text primary key,
  stream_id text not null check (stream_id ~ '^[A-Za-z0-9_-]{6,64}$'),
  live boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.sf_streams add column if not exists streamer_id uuid;
alter table public.sf_streams add column if not exists streamer_name text not null default '';

alter table public.sf_streams enable row level security;

-- no direct writes from the app: everything goes through the two functions below
drop policy if exists sf_streams_read   on public.sf_streams;
drop policy if exists sf_streams_insert on public.sf_streams;
drop policy if exists sf_streams_update on public.sf_streams;
drop policy if exists sf_streams_delete on public.sf_streams;
create policy sf_streams_read on public.sf_streams for select to anon, authenticated using (true);

revoke all on public.sf_streams from anon, authenticated;
grant select on public.sf_streams to anon, authenticated;

-- committee account assigned to this game (admins are NOT included on purpose)
create or replace function public.sf_is_game_committee(g text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.sf_staff_games where user_id = auth.uid() and game_id = g);
$$;

create or replace function public.sf_stream_start(g text, sid text)
returns void language plpgsql security definer set search_path = public as $$
declare
  nm text;
  n int;
  other text;
begin
  if auth.uid() is null or not public.sf_is_game_committee(g) then
    raise exception 'Only the committee assigned to this game can stream it.';
  end if;
  if sid is null or sid !~ '^[A-Za-z0-9_-]{6,64}$' then
    raise exception 'Invalid stream id.';
  end if;
  select full_name into nm from public.sf_staff where user_id = auth.uid();

  -- one atomic statement: succeeds only if nobody is live on this game, or the live one is me (resuming)
  insert into public.sf_streams as s (game_id, stream_id, live, streamer_id, streamer_name, updated_at)
  values (g, sid, true, auth.uid(), coalesce(nm, ''), now())
  on conflict (game_id) do update
    set stream_id = excluded.stream_id, live = true, streamer_id = excluded.streamer_id,
        streamer_name = excluded.streamer_name, updated_at = now()
    where s.live = false or s.streamer_id = auth.uid();
  get diagnostics n = row_count;
  if n = 0 then
    select nullif(streamer_name, '') into other from public.sf_streams where game_id = g;
    raise exception '% is already streaming this game.', coalesce(other, 'Another committee member');
  end if;
end $$;

create or replace function public.sf_stream_stop(g text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in.';
  end if;
  if not (public.sf_is_admin() or exists (select 1 from public.sf_streams where game_id = g and streamer_id = auth.uid())) then
    raise exception 'Only the person streaming (or an admin) can end this stream.';
  end if;
  update public.sf_streams set live = false, updated_at = now() where game_id = g;
end $$;

revoke all on function public.sf_stream_start(text, text) from public, anon;
revoke all on function public.sf_stream_stop(text) from public, anon;
grant execute on function public.sf_stream_start(text, text) to authenticated;
grant execute on function public.sf_stream_stop(text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.sf_streams;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
