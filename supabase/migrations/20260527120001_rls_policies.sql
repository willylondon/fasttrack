create schema if not exists private;

create or replace function private.can_view_feed_event(event_owner_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select event_owner_id = next_auth.uid()
    or exists (
      select 1
      from public.friendships
      where status = 'accepted'
        and (
          (sender_id = next_auth.uid() and receiver_id = event_owner_id)
          or (receiver_id = next_auth.uid() and sender_id = event_owner_id)
        )
    );
$$;

grant usage on schema private to authenticated;
grant execute on function private.can_view_feed_event(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.fast_sessions enable row level security;
alter table public.friendships enable row level security;
alter table public.feed_events enable row level security;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.xp_transactions enable row level security;
alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;

drop policy if exists "Profiles are readable by authenticated users" on public.profiles;
drop policy if exists "Profiles are updatable by owner" on public.profiles;
drop policy if exists "Profiles are readable by owner" on public.profiles;
create policy "Profiles are readable by owner"
on public.profiles
for select
to authenticated
using (id = next_auth.uid());

drop policy if exists "Users manage own fast sessions" on public.fast_sessions;
drop policy if exists "Users select own fast sessions" on public.fast_sessions;
drop policy if exists "Users insert own fast sessions" on public.fast_sessions;
drop policy if exists "Users update own fast sessions" on public.fast_sessions;
drop policy if exists "Users delete own fast sessions" on public.fast_sessions;
create policy "Users select own fast sessions"
on public.fast_sessions for select to authenticated
using (user_id = next_auth.uid());
create policy "Users insert own fast sessions"
on public.fast_sessions for insert to authenticated
with check (user_id = next_auth.uid());
create policy "Users update own fast sessions"
on public.fast_sessions for update to authenticated
using (user_id = next_auth.uid())
with check (user_id = next_auth.uid());
create policy "Users delete own fast sessions"
on public.fast_sessions for delete to authenticated
using (user_id = next_auth.uid());

drop policy if exists "Users view own friendships" on public.friendships;
drop policy if exists "Users create friendships as sender" on public.friendships;
drop policy if exists "Users update own friendships" on public.friendships;
drop policy if exists "Users update received friendships" on public.friendships;
create policy "Users view own friendships"
on public.friendships for select to authenticated
using (sender_id = next_auth.uid() or receiver_id = next_auth.uid());
create policy "Users create friendships as sender"
on public.friendships for insert to authenticated
with check (sender_id = next_auth.uid());
create policy "Users update received friendships"
on public.friendships for update to authenticated
using (receiver_id = next_auth.uid())
with check (receiver_id = next_auth.uid());

drop policy if exists "Users manage own feed" on public.feed_events;
drop policy if exists "Users view own and friend feed" on public.feed_events;
drop policy if exists "Users insert own feed" on public.feed_events;
create policy "Users view own and friend feed"
on public.feed_events for select to authenticated
using (private.can_view_feed_event(user_id));
create policy "Users insert own feed"
on public.feed_events for insert to authenticated
with check (user_id = next_auth.uid());

drop policy if exists "Badges are readable by authenticated users" on public.badges;
drop policy if exists "Badges are publicly readable" on public.badges;
drop policy if exists "badges_select" on public.badges;
create policy "Badges are publicly readable"
on public.badges for select
using (true);

drop policy if exists "Users view own earned badges" on public.user_badges;
drop policy if exists "Users insert own earned badges" on public.user_badges;
drop policy if exists "user_badges_select" on public.user_badges;
drop policy if exists "user_badges_insert" on public.user_badges;
create policy "Users view own earned badges"
on public.user_badges for select to authenticated
using (user_id = next_auth.uid());
create policy "Users insert own earned badges"
on public.user_badges for insert to authenticated
with check (user_id = next_auth.uid());

drop policy if exists "Users manage own xp transactions" on public.xp_transactions;
drop policy if exists "Users view own xp transactions" on public.xp_transactions;
drop policy if exists "xp_transactions_select" on public.xp_transactions;
drop policy if exists "xp_transactions_insert" on public.xp_transactions;
create policy "Users view own xp transactions"
on public.xp_transactions for select to authenticated
using (user_id = next_auth.uid());

drop policy if exists "Users read public or owned challenges" on public.challenges;
drop policy if exists "Challenges are readable for discovery" on public.challenges;
drop policy if exists "Users create own challenges" on public.challenges;
drop policy if exists "Creators update own challenges" on public.challenges;
drop policy if exists "Creators delete own challenges" on public.challenges;
create policy "Challenges are readable for discovery"
on public.challenges for select to authenticated
using (true);
create policy "Users create own challenges"
on public.challenges for insert to authenticated
with check (creator_id = next_auth.uid());
create policy "Creators update own challenges"
on public.challenges for update to authenticated
using (creator_id = next_auth.uid())
with check (creator_id = next_auth.uid());
create policy "Creators delete own challenges"
on public.challenges for delete to authenticated
using (creator_id = next_auth.uid());

drop policy if exists "Users manage own challenge participation" on public.challenge_participants;
drop policy if exists "Users view own challenge participation" on public.challenge_participants;
drop policy if exists "Users join challenges as self" on public.challenge_participants;
drop policy if exists "Users update own challenge progress" on public.challenge_participants;
create policy "Users view own challenge participation"
on public.challenge_participants for select to authenticated
using (user_id = next_auth.uid());
create policy "Users join challenges as self"
on public.challenge_participants for insert to authenticated
with check (user_id = next_auth.uid());
create policy "Users update own challenge progress"
on public.challenge_participants for update to authenticated
using (user_id = next_auth.uid())
with check (user_id = next_auth.uid());
