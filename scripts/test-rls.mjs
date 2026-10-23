// Tests supabase/schema.sql (row level security) on a real Postgres running in memory.
// Optional (not part of package.json):  npm i --no-save @electric-sql/pglite && node scripts/test-rls.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const schemaPath = process.env.SCHEMA || new URL('../supabase/schema.sql', import.meta.url);
const db = new PGlite();
await db.exec(`
create schema auth;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create role anon; create role authenticated;
grant usage on schema public, auth to anon, authenticated;
create publication supabase_realtime;
`);
const sql = fs.readFileSync(schemaPath, 'utf8');
await db.exec(sql);
await db.exec(sql); // can be run again
const ADMIN = '00000000-0000-0000-0000-0000000000a1';
const ANA = '00000000-0000-0000-0000-0000000000c1'; // committee: chess + darts
const BEN = '00000000-0000-0000-0000-0000000000c2'; // committee: basketball
const NOBODY = '00000000-0000-0000-0000-0000000000d1'; // signed in, not staff
await db.exec(`
insert into auth.users (id,email) values ('${ADMIN}','admin@x.com'),('${ANA}','ana@x.com'),('${BEN}','ben@x.com'),('${NOBODY}','n@x.com');
insert into public.sf_admins (user_id) values ('${ADMIN}');
insert into public.sf_staff (user_id,username,email,full_name,role) values ('${ADMIN}','boss','admin@x.com','Boss','admin'),('${ANA}','ana','ana@x.com','Ana','committee'),('${BEN}','ben','ben@x.com','Ben','committee');
insert into public.sf_staff_games (user_id,game_id) values ('${ANA}','chess'),('${ANA}','darts'),('${BEN}','basketball');
`);

const as = async (role, sub, q) => {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub','${sub || ''}',false);`);
  try { return await db.query(q); } finally { await db.exec('reset role'); }
};
const ok = (role, sub, q) => as(role, sub, q);
const denied = (role, sub, q, label) => assert.rejects(() => as(role, sub, q), undefined, label);
const noRows = async (role, sub, q, label) => { const r = await as(role, sub, q); assert.equal(r.rows.length, 0, label); };

// ---- committee: only in its own games
await ok('authenticated', ANA, `insert into sf_results (game_id,match_no,winner,score1,score2) values ('chess',1,1,null,null)`);
await ok('authenticated', ANA, `insert into sf_results (game_id,match_no,winner,score1,score2) values ('darts',10,7,40,31)`);
await ok('authenticated', ANA, `insert into sf_results (game_id,match_no,winner) values ('chess',1,9) on conflict (game_id,match_no) do update set winner = excluded.winner`);
await denied('authenticated', ANA, `insert into sf_results (game_id,match_no,winner) values ('basketball',1,1)`, 'Ana cannot score basketball');
await denied('authenticated', BEN, `insert into sf_results (game_id,match_no,winner) values ('chess',2,1)`, 'Ben cannot score chess');
await ok('authenticated', BEN, `insert into sf_results (game_id,match_no,winner) values ('basketball',1,5)`);
await noRows('authenticated', BEN, `update sf_results set winner = 1 where game_id = 'chess' returning *`, 'Ben cannot change chess');
await noRows('authenticated', BEN, `delete from sf_results where game_id = 'chess' returning *`, 'Ben cannot delete chess');
let r = await ok('authenticated', ANA, `delete from sf_results where game_id = 'darts' returning *`); assert.equal(r.rows.length, 1, 'Ana can change her own game');
// tie-break + team names in own game only
await ok('authenticated', ANA, `insert into sf_tiebreak (game_id,team_no) values ('chess',3)`);
await denied('authenticated', ANA, `insert into sf_tiebreak (game_id,team_no) values ('basketball',3)`, 'tiebreak other game');
await denied('authenticated', ANA, `insert into sf_master_teams (id,name,color) values (gen_random_uuid(),'Ambassador','#111')`, 'committee cannot add team names');
await ok('authenticated', ADMIN, `insert into sf_master_teams (id,name,color) values (gen_random_uuid(),'Ambassador','#111')`);
await denied('authenticated', ANA, `insert into sf_rosters (game_id,team_no,master_id) select 'chess',1,id from sf_master_teams limit 1`, 'committee cannot name teams');
await ok('authenticated', ADMIN, `insert into sf_rosters (game_id,team_no,master_id) select 'chess',1,id from sf_master_teams limit 1`);
await denied('authenticated', ANA, `insert into sf_rosters (game_id,team_no,custom_name) values ('chess',2,'Walk-in')`, 'committee cannot name teams (own game)');
await ok('authenticated', ADMIN, `insert into sf_rosters (game_id,team_no,custom_name) values ('chess',2,'Walk-in')`);
await denied('authenticated', ANA, `insert into sf_results (game_id,match_no,winner,score1,score2) values ('chess',1,1,99999,0)`, 'absurd score rejected');
await denied('authenticated', ANA, `insert into sf_results (game_id,match_no,winner) values ('chess',1,999)`, 'absurd winner rejected');
await denied('authenticated', ANA, `insert into sf_rosters (game_id,team_no,players) values ('chess',3,array['X'])`, 'committee cannot set players');
await ok('authenticated', ADMIN, `insert into sf_rosters (game_id,team_no,players) values ('chess',3,array['Ana','Ben'])`);
await denied('authenticated', ADMIN, `insert into sf_rosters (game_id,team_no,players) values ('chess',4,array['1','2','3','4','5','6','7','8','9','10','11'])`, 'too many players rejected');
// master list: only admin can add, rename or delete
await noRows('authenticated', ANA, `update sf_master_teams set name = 'Hacked' returning *`, 'committee cannot rename');
await noRows('authenticated', ANA, `delete from sf_master_teams returning *`, 'committee cannot delete names');
// committee list of a game is admin only
// match times: admin only
await denied('authenticated', ANA, `insert into sf_match_times (game_id,match_no,time_text) values ('chess',1,'8:00')`, 'committee cannot set match times');
await ok('authenticated', ADMIN, `insert into sf_match_times (game_id,match_no,time_text) values ('chess',1,'8:00 - 8:30')`);
await denied('authenticated', ADMIN, `insert into sf_match_times (game_id,match_no,time_text) values ('chess',2,'')`, 'empty time rejected');
r = await ok('anon', null, `select time_text from sf_match_times`); assert.equal(r.rows.length, 1, 'guest can read times');
// Cheer Dance / Muse: admin, or committee assigned to the event
await db.exec(`insert into sf_staff_games (user_id,game_id) values ('${ANA}','muse')`);
await ok('authenticated', ANA, `insert into sf_placements (event_id,place,department) values ('muse',1,'QCA')`);
await denied('authenticated', ANA, `insert into sf_placements (event_id,place,department) values ('cheer-dance',1,'QCA')`, 'committee not assigned to cheer-dance');
await denied('authenticated', BEN, `insert into sf_placements (event_id,place,department) values ('muse',2,'PRD')`, 'other committee cannot encode muse');
await denied('authenticated', ANA, `insert into sf_placements (event_id,place,department) values ('muse',2,'QCA')`, 'a department holds one place per event');
await denied('authenticated', ADMIN, `insert into sf_placements (event_id,place,department) values ('muse',9,'PRD')`, 'place 9 rejected');
await denied('authenticated', ADMIN, `insert into sf_placements (event_id,place,department) values ('chess',1,'PRD')`, 'unknown event rejected');
await ok('authenticated', ADMIN, `insert into sf_placements (event_id,place,department) values ('cheer-dance',1,'Admin')`);
await denied('anon', null, `insert into sf_placements (event_id,place,department) values ('muse',3,'PRD')`, 'guest cannot encode');
r = await ok('anon', null, `select count(*)::int c from sf_placements`); assert.equal(r.rows[0].c, 2, 'guest can read placements');
await db.exec(`delete from sf_staff_games where user_id='${ANA}' and game_id='muse'`);
await denied('authenticated', ANA, `insert into sf_committee (game_id,role,name) values ('chess','Arbiter','Me')`, 'committee list');
await ok('authenticated', ADMIN, `insert into sf_committee (game_id,role,name) values ('chess','Arbiter','Zed')`);
// signed-in user without a role, and guests
await denied('authenticated', NOBODY, `insert into sf_results (game_id,match_no,winner) values ('chess',5,1)`, 'stranger insert');
await denied('authenticated', NOBODY, `insert into sf_master_teams (id,name,color) values (gen_random_uuid(),'Nope','#111')`, 'stranger master');
await denied('anon', null, `insert into sf_results (game_id,match_no,winner) values ('chess',5,1)`, 'guest insert');
for (const [role, sub] of [['anon', null], ['authenticated', NOBODY], ['authenticated', BEN]]) {
  const c = await ok(role, sub, `select (select count(*) from sf_results)::int results, (select count(*) from sf_rosters)::int rosters, (select count(*) from sf_master_teams)::int masters`);
  assert.ok(c.rows[0].results >= 2 && c.rows[0].masters === 1, `${role} can read`);
}
// accounts
await denied('anon', null, `select * from sf_staff`, 'guest cannot read accounts');
r = await ok('authenticated', ANA, `select username from sf_staff`); assert.deepEqual(r.rows.map((x) => x.username), ['ana'], 'committee sees only itself');
r = await ok('authenticated', ANA, `select game_id from sf_staff_games order by 1`); assert.deepEqual(r.rows.map((x) => x.game_id), ['chess', 'darts']);
r = await ok('authenticated', ADMIN, `select count(*)::int c from sf_staff`); assert.equal(r.rows[0].c, 3, 'admin sees all accounts');
await denied('authenticated', ANA, `insert into sf_staff_games (user_id,game_id) values ('${ANA}','basketball')`, 'cannot self-assign a game');
await denied('authenticated', ANA, `insert into sf_staff (user_id,username,email) values ('${NOBODY}','nn','n@x.com')`, 'cannot create accounts');
await noRows('authenticated', ANA, `update sf_staff set role = 'admin' where user_id = '${ANA}' returning *`, 'cannot promote self');
await denied('authenticated', ANA, `insert into sf_admins (user_id) values ('${ANA}')`, 'cannot make self admin');
// admin manages assignments
await ok('authenticated', ADMIN, `insert into sf_staff_games (user_id,game_id) values ('${BEN}','chess')`);
await ok('authenticated', BEN, `insert into sf_results (game_id,match_no,winner) values ('chess',7,1)`); // new assignment works immediately
r = await ok('authenticated', ADMIN, `delete from sf_staff_games where user_id = '${BEN}' and game_id = 'chess' returning *`); assert.equal(r.rows.length, 1);
await denied('authenticated', BEN, `insert into sf_results (game_id,match_no,winner) values ('chess',8,1)`, 'assignment removed');
// admin can do everything else
await ok('authenticated', ADMIN, `update sf_master_teams set name = 'Ambassadors' where name = 'Ambassador'`);
r = await ok('authenticated', ADMIN, `delete from sf_results returning *`); assert.ok(r.rows.length >= 3);
// ---- audit trail
const audit = async (where = '') => (await db.query(`select * from sf_audit ${where} order by id`)).rows;
{
  const before = (await audit()).length;
  assert.ok(before > 0, 'earlier changes were logged');

  // Ana (committee) sets a winner in chess: logged with HER name, the game and the team name
  await ok('authenticated', ANA, `insert into sf_results (game_id,match_no,winner,score1,score2) values ('chess',20,2,null,null)`);
  let rows = await audit(`where id > (select coalesce(max(id),0) from sf_audit) - 1`);
  let last = rows[rows.length - 1];
  assert.equal(last.action, 'result.set'); assert.equal(last.username, 'ana'); assert.equal(last.full_name, 'Ana'); assert.equal(last.game_id, 'chess');
  assert.equal(last.detail.match_no, 20); assert.equal(last.detail.winner, 2); assert.ok(last.detail.winner_name);

  // changing the winner logs the old one too; saving the same value again logs nothing
  await ok('authenticated', ANA, `insert into sf_results (game_id,match_no,winner) values ('chess',20,3) on conflict (game_id,match_no) do update set winner = excluded.winner`);
  last = (await audit()).pop();
  assert.equal(last.action, 'result.change'); assert.equal(last.detail.from_winner, 2); assert.equal(last.detail.winner, 3);
  const n1 = (await audit()).length;
  await ok('authenticated', ANA, `insert into sf_results (game_id,match_no,winner) values ('chess',20,3) on conflict (game_id,match_no) do update set winner = excluded.winner`);
  assert.equal((await audit()).length, n1, 'same value is not logged again');

  // clearing, tie-break, committee name, match time, placement, team name
  await ok('authenticated', ANA, `delete from sf_results where game_id = 'chess' and match_no = 20`);
  assert.equal((await audit()).pop().action, 'result.clear');
  await ok('authenticated', ANA, `insert into sf_tiebreak (game_id,team_no) values ('darts',4) on conflict (game_id) do update set team_no = excluded.team_no`);
  assert.equal((await audit()).pop().action, 'tiebreak.set');
  await ok('authenticated', ADMIN, `insert into sf_committee (game_id,role,name) values ('chess','Scorekeeper','Eagle') on conflict (game_id,role) do update set name = excluded.name`);
  last = (await audit()).pop(); assert.equal(last.action, 'committee.set'); assert.equal(last.detail.name, 'Eagle'); assert.equal(last.username, 'boss');
  await ok('authenticated', ADMIN, `insert into sf_committee (game_id,role,name) values ('chess','Scorekeeper','Hawk') on conflict (game_id,role) do update set name = excluded.name`);
  last = (await audit()).pop(); assert.equal(last.detail.from_name, 'Eagle'); assert.equal(last.detail.name, 'Hawk');
  await ok('authenticated', ADMIN, `insert into sf_match_times (game_id,match_no,time_text) values ('basketball',1,'9:20 - 10:01') on conflict (game_id,match_no) do update set time_text = excluded.time_text`);
  assert.equal((await audit()).pop().action, 'time.set');
  await ok('authenticated', ADMIN, `insert into sf_placements (event_id,place,department) values ('muse',1,'AUDIT-DEPT') on conflict (event_id,place) do update set department = excluded.department`);
  last = (await audit()).pop(); assert.equal(last.action, 'placement.set'); assert.equal(last.game_id, 'muse');
  await ok('authenticated', ADMIN, `insert into sf_master_teams (id,name,color) values (gen_random_uuid(),'Zebra','#000')`);
  assert.equal((await audit()).pop().action, 'teamname.add');
  await ok('authenticated', ADMIN, `insert into sf_rosters (game_id,team_no,master_id) select 'darts',5,id from sf_master_teams where name = 'Zebra'`);
  last = (await audit()).pop(); assert.equal(last.action, 'roster.set'); assert.equal(last.detail.name, 'Zebra');

  // a change that is refused is not logged
  const n2 = (await audit()).length;
  await denied('authenticated', BEN, `insert into sf_results (game_id,match_no,winner) values ('chess',30,1)`, 'refused');
  assert.equal((await audit()).length, n2, 'refused change is not logged');

  // accounts: games + role
  await ok('authenticated', ADMIN, `insert into sf_staff_games (user_id,game_id) values ('${BEN}','darts')`);
  last = (await audit()).pop(); assert.equal(last.action, 'account.game.add'); assert.equal(last.detail.username, 'ben');
  await ok('authenticated', ADMIN, `update sf_staff set full_name = 'Benjamin' where user_id = '${BEN}'`);
  assert.equal((await audit()).pop().action, 'account.update');
  await db.exec(`select set_config('request.jwt.claim.sub','',false); delete from sf_staff_games where user_id = '${BEN}' and game_id = 'darts'`); // no login (SQL editor / Edge Function): account tables are skipped
  assert.equal((await audit()).pop().action, 'account.update', 'no login = not logged for account tables');

  // login log + failed login + the actions the app may write
  await ok('authenticated', ANA, `select sf_audit_log('login')`);
  last = (await audit()).pop(); assert.equal(last.action, 'login'); assert.equal(last.username, 'ana');
  await ok('anon', '', `select sf_audit_login_failed('ana')`);
  last = (await audit()).pop(); assert.equal(last.action, 'login.failed'); assert.equal(last.user_id, null); assert.equal(last.detail.login, 'ana');
  await denied('anon', '', `select sf_audit_log('login')`, 'anon cannot write audit rows');
  await denied('authenticated', ANA, `select sf_audit_log('result.set')`, 'cannot fake a winner entry');
  await ok('authenticated', ANA, `select sf_audit_log('reset.game', 'chess', '{"x":1}'::jsonb)`);
  last = (await audit()).pop(); assert.equal(last.action, 'reset.game'); assert.equal(last.game_id, 'chess');
  await denied('authenticated', NOBODY, `select sf_audit_log('reset.all')`, 'a non-staff login cannot write a reset marker');
  await ok('authenticated', NOBODY, `select sf_audit_log('login')`);
  for (let i = 0; i < 30; i++) await ok('anon', '', `select sf_audit_login_failed('x${i}')`);
  const failed = (await audit(`where action = 'login.failed' and at > now() - interval '1 minute'`)).length;
  assert.ok(failed <= 20, 'failed logins are capped at 20 per minute (' + failed + ')');

  // who can read it: admin only
  r = await ok('authenticated', ADMIN, `select count(*)::int c from sf_audit`); assert.ok(r.rows[0].c > 10);
  await noRows('authenticated', ANA, `select * from sf_audit`, 'committee cannot read the audit trail');
  await denied('anon', '', `select * from sf_audit`, 'guest cannot read the audit trail');

  // nobody can write / change / delete it from the app, and the trigger blocks even the owner
  await denied('authenticated', ADMIN, `insert into sf_audit (action) values ('fake')`, 'admin cannot insert');
  await denied('authenticated', ADMIN, `update sf_audit set username = 'x'`, 'admin cannot update');
  await denied('authenticated', ADMIN, `delete from sf_audit`, 'admin cannot delete');
  await assert.rejects(() => db.exec(`update sf_audit set username = 'x'`), /cannot be changed/, 'owner cannot update');
  await assert.rejects(() => db.exec(`delete from sf_audit`), /cannot be changed/, 'owner cannot delete');
  await assert.rejects(() => db.exec(`truncate sf_audit`), /cannot be changed/, 'owner cannot truncate');
}

// deleting a login removes staff rows
await db.exec(`delete from auth.users where id = '${ANA}'`);
r = await db.query(`select count(*)::int c from sf_staff_games where user_id = '${ANA}'`); assert.equal(r.rows[0].c, 0);
console.log('RLS TESTS PASSED (committee, admin, guest, audit trail)');
