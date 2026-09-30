// Local, disposable Postgres/WASM verification. Never connects to Supabase.
// npm install --prefix /tmp/fasttrack-sql-check @electric-sql/pglite
// node tests/verify-fasting-sql.mjs /tmp/fasttrack-sql-check/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const migration = await readFile(new URL('../supabase/migrations/20260930170000_fasting_mutation_reliability.sql', import.meta.url), 'utf8');
const fixture = `
create role anon; create role authenticated; create role service_role;
create schema private;
create table public.profiles(id uuid primary key, xp integer default 0, level integer default 1);
create table public.fast_sessions(id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id), status text,
 started_at timestamptz default now() - interval '4 hours', import_key text, stage_reached integer default 0);
create table public.xp_transactions(id uuid primary key default gen_random_uuid(), user_id uuid references profiles(id), amount integer not null, source text not null, reference_id uuid);
create table public.badges(id uuid primary key, name text, icon text, xp_reward integer);
create table public.user_badges(user_id uuid references profiles(id), badge_id uuid references badges(id), primary key(user_id,badge_id));
create table public.feed_events(id uuid default gen_random_uuid(), user_id uuid references profiles(id), event_type text, metadata jsonb);
insert into profiles(id) values('00000000-0000-0000-0000-000000000001');
insert into badges values('00000000-0000-0000-0000-000000000003','First Fast','seed',50);
`;
const user = '00000000-0000-0000-0000-000000000001';
const session = '00000000-0000-0000-0000-000000000002';
const badge = '00000000-0000-0000-0000-000000000003';
const db = new PGlite();
await db.exec(fixture);
await db.exec(await readFile(new URL('../supabase/migrations/20260531140000_xp_triggers.sql',import.meta.url),'utf8'));
await db.exec(migration);
await db.query(`insert into fast_sessions(id,user_id,status,import_key) values($1,$2,'active','start-key')`,[session,user]);
await assert.rejects(db.query(`insert into fast_sessions(user_id,status) values($1,'active')`,[user]), e => e.code === '23505');
await db.query(`select record_fast_milestone($1,$2,1,2,'Two hours')`,[user,session]);
await db.query(`select record_fast_milestone($1,$2,1,2,'Two hours')`,[user,session]);
assert.equal((await db.query(`select count(*)::int as n from feed_events`)).rows[0].n,1);
await assert.rejects(db.query(`select record_fast_milestone($1,$2,5,10,'Ten hours')`,[user,session]));
await db.query(`update fast_sessions set status='completed' where id=$1`,[session]);
await assert.rejects(db.query(`select record_fast_milestone($1,$2,1,2,'Two hours')`,[user,session]),e=>e.code==='P0002');
const awarded = await db.query(`select * from award_fasttrack_badge($1,$2)`,[user,badge]);
assert.deepEqual(awarded.rows,[{new_badge:true,xp_awarded:50}]);
assert.deepEqual((await db.query(`select * from award_fasttrack_badge($1,$2)`,[user,badge])).rows,[{new_badge:false,xp_awarded:0}]);
assert.equal((await db.query('select xp from profiles')).rows[0].xp,50);
// ON CONFLICT inference matches the real PostgREST upsert keys.
await db.query(`insert into fast_sessions(user_id,status,import_key) values($1,'completed','start-key') on conflict(user_id,import_key) do nothing`,[user]);
assert.equal((await db.query('select count(*)::int as n from fast_sessions')).rows[0].n,1);
await db.query(`insert into xp_transactions(user_id,amount,source,reference_id) values($1,100,'fast_completed',$2) on conflict(user_id,source,reference_id) do nothing`,[user,session]);
await db.query(`insert into xp_transactions(user_id,amount,source,reference_id) values($1,100,'fast_completed',$2) on conflict(user_id,source,reference_id) do nothing`,[user,session]);
assert.equal((await db.query('select xp from profiles')).rows[0].xp,150);
assert.equal((await db.query(`select has_function_privilege('anon','public.award_fasttrack_badge(uuid,uuid)','execute') as allowed`)).rows[0].allowed,false);
assert.equal((await db.query(`select has_function_privilege('authenticated','public.record_fast_milestone(uuid,uuid,integer,integer,text)','execute') as allowed`)).rows[0].allowed,false);
// A feed failure does not undo an awarded badge/XP transaction.
await db.query(`insert into badges values('00000000-0000-0000-0000-000000000004','Second','seed',25)`);
await db.exec(`alter table feed_events add constraint reject_badge_feed check(event_type <> 'badge_earned') not valid`);
assert.deepEqual((await db.query(`select * from award_fasttrack_badge($1,'00000000-0000-0000-0000-000000000004')`,[user])).rows,[{new_badge:true,xp_awarded:25}]);
assert.equal((await db.query('select xp from profiles')).rows[0].xp,175);
await db.close();
for (const kind of ['active','xp']) {
 const legacy = new PGlite(); await legacy.exec(fixture);
 if(kind==='active') await legacy.query(`insert into fast_sessions(user_id,status) values($1,'active'),($1,'active')`,[user]);
 else await legacy.query(`insert into xp_transactions(user_id,source,reference_id,amount) values($1,'fast_completed',$2,1),($1,'fast_completed',$2,1)`,[user,session]);
 await assert.rejects(legacy.exec(migration),e=>e.message.includes('Resolve duplicate'));
 await legacy.exec('rollback');
 const table = kind === 'active' ? 'fast_sessions' : 'xp_transactions';
 assert.equal((await legacy.query(`select count(*)::int as n from ${table}`)).rows[0].n,2);
 await legacy.close();
}
console.log('PASS: constraints, keyed upserts, milestone terminal guards, atomic badge/XP retries, grants, feed failure, and non-destructive duplicate preflight');
console.log('LIMIT: PGlite is single-connection; genuine concurrent Postgres transactions still need staging verification');
