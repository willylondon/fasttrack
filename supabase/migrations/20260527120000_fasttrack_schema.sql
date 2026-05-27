create extension if not exists "uuid-ossp";

create schema if not exists next_auth;
create schema if not exists private;

grant usage on schema next_auth to service_role;
grant all on schema next_auth to postgres;

create table if not exists next_auth.users (
  id uuid not null default uuid_generate_v4(),
  name text,
  email text,
  "emailVerified" timestamptz,
  image text,
  constraint users_pkey primary key (id),
  constraint email_unique unique (email)
);

grant all on table next_auth.users to postgres;
grant all on table next_auth.users to service_role;

create or replace function next_auth.uid() returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create table if not exists next_auth.sessions (
  id uuid not null default uuid_generate_v4(),
  expires timestamptz not null,
  "sessionToken" text not null,
  "userId" uuid,
  constraint sessions_pkey primary key (id),
  constraint session_token_unique unique ("sessionToken"),
  constraint sessions_user_id_fkey foreign key ("userId")
    references next_auth.users (id)
    on delete cascade
);

grant all on table next_auth.sessions to postgres;
grant all on table next_auth.sessions to service_role;

create table if not exists next_auth.accounts (
  id uuid not null default uuid_generate_v4(),
  type text not null,
  provider text not null,
  "providerAccountId" text not null,
  refresh_token text,
  access_token text,
  expires_at bigint,
  token_type text,
  scope text,
  id_token text,
  session_state text,
  oauth_token_secret text,
  oauth_token text,
  "userId" uuid,
  constraint accounts_pkey primary key (id),
  constraint provider_unique unique (provider, "providerAccountId"),
  constraint accounts_user_id_fkey foreign key ("userId")
    references next_auth.users (id)
    on delete cascade
);

grant all on table next_auth.accounts to postgres;
grant all on table next_auth.accounts to service_role;

create table if not exists next_auth.verification_tokens (
  identifier text,
  token text,
  expires timestamptz not null,
  constraint verification_tokens_pkey primary key (token),
  constraint token_identifier_unique unique (token, identifier)
);

grant all on table next_auth.verification_tokens to postgres;
grant all on table next_auth.verification_tokens to service_role;

create table if not exists public.profiles (
  id uuid primary key references next_auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text not null default '',
  total_fasts integer not null default 0,
  total_fast_hours numeric(10, 2) not null default 0,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  xp integer not null default 0,
  level integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fast_sessions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_minutes integer,
  duration_planned_minutes integer,
  status text not null default 'active' check (status in ('active', 'completed', 'cancelled')),
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists idx_fast_sessions_user on public.fast_sessions(user_id);

create table if not exists public.friendships (
  id uuid primary key default uuid_generate_v4(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected', 'blocked')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(sender_id, receiver_id)
);

create table if not exists public.feed_events (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  event_type text not null check (
    event_type in (
      'fast_started',
      'fast_completed',
      'milestone_hit',
      'streak_milestone',
      'badge_earned',
      'challenge_joined',
      'challenge_completed',
      'level_up'
    )
  ),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.badges (
  id uuid primary key default uuid_generate_v4(),
  name text not null unique,
  slug text not null unique,
  description text not null,
  icon text not null,
  category text not null check (category in ('streak', 'milestone', 'challenge', 'social', 'special')),
  requirement_type text not null,
  requirement_value integer not null,
  xp_reward integer not null default 50
);

create table if not exists public.user_badges (
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

create table if not exists public.xp_transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  source text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default uuid_generate_v4(),
  creator_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  challenge_type text not null check (challenge_type in ('streak_days', 'total_hours', 'daily_fast', 'milestone_reach')),
  target_value integer not null,
  duration_days integer not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_public boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.challenge_participants (
  challenge_id uuid not null references public.challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  progress integer not null default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);

create or replace function private.set_updated_at() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function private.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.name, split_part(coalesce(new.email, 'user@example.com'), '@', 1), 'User'),
    new.image
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function private.set_updated_at();

drop trigger if exists friendships_set_updated_at on public.friendships;
create trigger friendships_set_updated_at
before update on public.friendships
for each row execute function private.set_updated_at();

drop trigger if exists on_next_auth_user_created on next_auth.users;
create trigger on_next_auth_user_created
after insert on next_auth.users
for each row execute function private.handle_new_user();

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
create policy "Profiles are readable by authenticated users"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "Profiles are updatable by owner" on public.profiles;
create policy "Profiles are updatable by owner"
on public.profiles
for update
to authenticated
using (next_auth.uid() = id)
with check (next_auth.uid() = id);

drop policy if exists "Users manage own fast sessions" on public.fast_sessions;
create policy "Users manage own fast sessions"
on public.fast_sessions
for all
to authenticated
using (next_auth.uid() = user_id)
with check (next_auth.uid() = user_id);

drop policy if exists "Users view own friendships" on public.friendships;
create policy "Users view own friendships"
on public.friendships
for select
to authenticated
using (next_auth.uid() = sender_id or next_auth.uid() = receiver_id);

drop policy if exists "Users create friendships as sender" on public.friendships;
create policy "Users create friendships as sender"
on public.friendships
for insert
to authenticated
with check (next_auth.uid() = sender_id);

drop policy if exists "Users update own friendships" on public.friendships;
create policy "Users update own friendships"
on public.friendships
for update
to authenticated
using (next_auth.uid() = sender_id or next_auth.uid() = receiver_id)
with check (next_auth.uid() = sender_id or next_auth.uid() = receiver_id);

drop policy if exists "Users manage own feed" on public.feed_events;
create policy "Users manage own feed"
on public.feed_events
for all
to authenticated
using (next_auth.uid() = user_id)
with check (next_auth.uid() = user_id);

drop policy if exists "Badges are readable by authenticated users" on public.badges;
create policy "Badges are readable by authenticated users"
on public.badges
for select
to authenticated
using (true);

drop policy if exists "Users view own earned badges" on public.user_badges;
create policy "Users view own earned badges"
on public.user_badges
for select
to authenticated
using (next_auth.uid() = user_id);

drop policy if exists "Users manage own xp transactions" on public.xp_transactions;
create policy "Users manage own xp transactions"
on public.xp_transactions
for all
to authenticated
using (next_auth.uid() = user_id)
with check (next_auth.uid() = user_id);

drop policy if exists "Users read public or owned challenges" on public.challenges;
create policy "Users read public or owned challenges"
on public.challenges
for select
to authenticated
using (is_public or next_auth.uid() = creator_id);

drop policy if exists "Users create own challenges" on public.challenges;
create policy "Users create own challenges"
on public.challenges
for insert
to authenticated
with check (next_auth.uid() = creator_id);

drop policy if exists "Creators update own challenges" on public.challenges;
create policy "Creators update own challenges"
on public.challenges
for update
to authenticated
using (next_auth.uid() = creator_id)
with check (next_auth.uid() = creator_id);

drop policy if exists "Users manage own challenge participation" on public.challenge_participants;
create policy "Users manage own challenge participation"
on public.challenge_participants
for all
to authenticated
using (next_auth.uid() = user_id)
with check (next_auth.uid() = user_id);

comment on schema next_auth is 'Schema required by the Auth.js Supabase adapter.';
comment on table public.badges is 'Seed the 18 badge rows once the final badge list is confirmed.';
