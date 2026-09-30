// Disposable local Postgres/WASM checks. Never connects to Supabase.
// node tests/verify-social-sql.mjs /tmp/fasttrack-sql-check/node_modules/@electric-sql/pglite/dist/index.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const { PGlite } = await import(pathToFileURL(process.argv[2]).href);
const read = (name) => readFileSync(new URL(`../supabase/migrations/${name}`, import.meta.url), 'utf8');
const privacy = read('20260930160000_restore_private_live_sharing.sql');
const pairs = read('20260930161000_unique_friend_pairs.sql');
const ids = [1, 2, 3].map((n) => `00000000-0000-0000-0000-00000000000${n}`);
const fixture = `
create role authenticated; create schema next_auth; create schema private;
create function next_auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema next_auth,private to authenticated;
create table profiles(id uuid primary key,share_live_status boolean default true);
create table friendships(id uuid default gen_random_uuid(),sender_id uuid,receiver_id uuid,status text);
create table feed_events(id uuid default gen_random_uuid(),user_id uuid,event_type text);
create table badges(slug text,name text,description text);
create table fast_sessions(status text,ended_at timestamptz,duration_planned_minutes integer);
alter table profiles enable row level security;
alter table friendships enable row level security;
alter table feed_events enable row level security;
create policy "Profiles are readable by owner" on profiles for select to authenticated using(id=next_auth.uid());
create policy "Users view own friendships" on friendships for select to authenticated using(sender_id=next_auth.uid() or receiver_id=next_auth.uid());
create policy "Users create friendships as sender" on friendships for insert to authenticated with check(sender_id=next_auth.uid());
create policy "Users update received friendships" on friendships for update to authenticated using(receiver_id=next_auth.uid()) with check(receiver_id=next_auth.uid());
grant select,insert,update,delete on profiles,friendships,feed_events to authenticated;
insert into profiles(id) values ${ids.map((id) => `('${id}')`).join(',')};
insert into friendships(sender_id,receiver_id,status) values('${ids[0]}','${ids[1]}','accepted');
insert into feed_events(user_id,event_type) values('${ids[1]}','fast_started'),('${ids[1]}','milestone_hit'),('${ids[1]}','fast_completed');
`;
const db = new PGlite();
try {
  await db.exec(fixture);
  // Use the actual original helper and legacy permissive policy, with a minimal
  // fixture for unrelated schema. This is not a full migration-chain test.
  await db.exec(read('20260527120001_rls_policies.sql').split('alter table public.profiles enable')[0]);
  await db.exec('create policy "Users view own and friend feed" on feed_events for select to authenticated using(private.can_view_feed_event(user_id))');
  await db.exec(read('20260527154500_social_backend_delta.sql'));
  await db.exec(privacy);
  await db.exec(pairs);
  assert.deepEqual((await db.query('select share_live_status from profiles')).rows.map((row) => row.share_live_status), [false, false, false]);
  assert.equal((await db.query("select column_default from information_schema.columns where table_name='profiles' and column_name='share_live_status'")).rows[0].column_default, 'false');
  assert.equal((await db.query("select count(*)::int n from pg_policies where policyname='Friends can view accepted feed events'")).rows[0].n, 0);
  const asUser = async (id) => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
    await db.exec('set role authenticated');
  };
  const events = async () => (await db.query('select event_type from feed_events order by event_type')).rows.map((row) => row.event_type);
  const allEvents = ['fast_completed', 'fast_started', 'milestone_hit'];
  await asUser(ids[0]);
  assert.deepEqual(await events(), ['fast_completed']);
  await db.exec('reset role');
  await db.query('update profiles set share_live_status=true where id=$1', [ids[1]]);
  await asUser(ids[0]);
  assert.deepEqual(await events(), allEvents);
  await asUser(ids[2]);
  assert.deepEqual(await events(), []);
  await asUser(ids[1]);
  assert.deepEqual(await events(), allEvents);
  await db.exec('reset role');
  await db.query('update profiles set share_live_status=false where id=$1', [ids[1]]);
  await asUser(ids[1]);
  assert.deepEqual(await events(), allEvents);
  await asUser(ids[0]);
  await assert.rejects(db.query("insert into friendships(sender_id,receiver_id,status) values($1,$2,'accepted')", [ids[0], ids[2]]), (error) => error.code === '42501');
  assert.equal((await db.query("update friendships set status='blocked' returning id")).rows.length, 0);
  await db.exec('reset role');
  await assert.rejects(db.query("insert into friendships(sender_id,receiver_id,status) values($1,$2,'pending')", [ids[1], ids[0]]), (error) => error.code === '23505');
  await db.query('delete from friendships where sender_id=$1 and receiver_id=$2', [ids[0], ids[1]]);
  await asUser(ids[0]);
  assert.deepEqual(await events(), []);
} finally {
  await db.close();
}
const duplicate = new PGlite();
try {
  await duplicate.exec(fixture);
  await duplicate.query("insert into friendships(sender_id,receiver_id,status) values($1,$2,'pending')", [ids[1], ids[0]]);
  await assert.rejects(duplicate.exec(pairs), /Duplicate friendship pairs/);
  await duplicate.exec('rollback');
  assert.equal((await duplicate.query('select count(*)::int n from friendships')).rows[0].n, 2);
} finally {
  await duplicate.close();
}
console.log('PASS: 14 assertions covering consent reset/default, legacy policy removal, accepted friend off/on, stranger, owner off/on, direct INSERT/UPDATE denial, reverse pair uniqueness, removal revocation, duplicate preflight and preserved data');
console.log('LIMIT: minimal schema fixture and single-connection PGlite; full migration chain and real concurrent Postgres transactions require separate verification');
