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
await ok('authenticated', ANA, `insert into sf_rosters (game_id,team_no,master_id) select 'chess',1,id from sf_master_teams limit 1`);
await ok('authenticated', ANA, `insert into sf_rosters (game_id,team_no,custom_name) values ('chess',2,'Walk-in')`);
await denied('authenticated', ANA, `insert into sf_rosters (game_id,team_no,custom_name) values ('basketball',1,'X')`, 'roster other game');
// master list: only admin can add, rename or delete
await noRows('authenticated', ANA, `update sf_master_teams set name = 'Hacked' returning *`, 'committee cannot rename');
await noRows('authenticated', ANA, `delete from sf_master_teams returning *`, 'committee cannot delete names');
// committee list of a game is admin only
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
// deleting a login removes staff rows
await db.exec(`delete from auth.users where id = '${ANA}'`);
r = await db.query(`select count(*)::int c from sf_staff_games where user_id = '${ANA}'`); assert.equal(r.rows[0].c, 0);
console.log('RLS TESTS PASSED (committee, admin, guest)');
