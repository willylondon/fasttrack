create table if not exists public.app_notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  notification_type text not null check (notification_type in ('encouragement_received', 'circle_challenge_created')),
  title text not null,
  body text not null,
  href text not null default '/',
  read_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_notifications_user_created
on public.app_notifications(user_id, created_at desc);

create table if not exists public.fasting_checkins (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  session_id uuid not null references public.fast_sessions(id) on delete cascade,
  energy integer not null check (energy between 1 and 5),
  mood integer not null check (mood between 1 and 5),
  hunger integer not null check (hunger between 1 and 5),
  sleep_quality integer not null check (sleep_quality between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, session_id)
);

create index if not exists idx_fasting_checkins_user_created
on public.fasting_checkins(user_id, created_at desc);

drop trigger if exists fasting_checkins_set_updated_at on public.fasting_checkins;
create trigger fasting_checkins_set_updated_at
before update on public.fasting_checkins
for each row execute function private.set_updated_at();

alter table public.app_notifications enable row level security;
alter table public.fasting_checkins enable row level security;

drop policy if exists "Users view own app notifications" on public.app_notifications;
drop policy if exists "Users update own app notifications" on public.app_notifications;
drop policy if exists "Users insert own app notifications" on public.app_notifications;
create policy "Users view own app notifications"
on public.app_notifications for select to authenticated
using (user_id = next_auth.uid());
create policy "Users update own app notifications"
on public.app_notifications for update to authenticated
using (user_id = next_auth.uid())
with check (user_id = next_auth.uid());
create policy "Users insert own app notifications"
on public.app_notifications for insert to authenticated
with check (user_id = next_auth.uid());

drop policy if exists "Users manage own fasting checkins" on public.fasting_checkins;
create policy "Users manage own fasting checkins"
on public.fasting_checkins for all to authenticated
using (user_id = next_auth.uid())
with check (user_id = next_auth.uid());

grant select, insert, update on public.app_notifications to authenticated;
grant select, insert, update, delete on public.fasting_checkins to authenticated;
