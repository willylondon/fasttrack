alter table public.profiles
  add column if not exists highest_stage_reached integer default 0,
  add column if not exists friend_count integer default 0;

create table if not exists public.push_subscriptions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  endpoint text not null,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

drop policy if exists "Users manage own push subscriptions" on public.push_subscriptions;
create policy "Users manage own push subscriptions"
on public.push_subscriptions
for all
to authenticated
using (next_auth.uid() = user_id)
with check (next_auth.uid() = user_id);

insert into public.badges (name, slug, description, icon, category, requirement_type, requirement_value, xp_reward)
values
  ('First Fast', 'first-fast', 'Completed your very first fast.', '🌱', 'milestone', 'first_fast', 1, 50),
  ('Sweet Spot', 'sweet-spot', 'Reached the 16-hour autophagy sweet spot.', '🧬', 'milestone', 'milestone_hours', 16, 80),
  ('Extended Warrior', 'extended-warrior', 'Held strong through an 18-hour fast.', '⚔️', 'milestone', 'milestone_hours', 18, 100),
  ('One Day Strong', 'one-day-strong', 'Completed a full 24-hour reset.', '🏆', 'milestone', 'milestone_hours', 24, 140),
  ('Deep Healer', 'deep-healer', 'Crossed into 36-hour deep healing territory.', '🧘', 'milestone', 'milestone_hours', 36, 200),
  ('Centurion', 'centurion', 'Completed 100 fasts.', '💯', 'special', 'total_fasts', 100, 300),
  ('3-Day Streak', '3-day-streak', 'Built a 3-day fasting streak.', '🔥', 'streak', 'streak_days', 3, 60),
  ('7-Day Streak', '7-day-streak', 'Built a 7-day fasting streak.', '🔥', 'streak', 'streak_days', 7, 120),
  ('14-Day Streak', '14-day-streak', 'Built a 14-day fasting streak.', '🔥', 'streak', 'streak_days', 14, 180),
  ('30-Day Streak', '30-day-streak', 'Built a 30-day fasting streak.', '🔥', 'streak', 'streak_days', 30, 320),
  ('Dedicated', 'dedicated', 'Completed 10 fasts.', '📓', 'milestone', 'total_fasts', 10, 70),
  ('Veteran', 'veteran', 'Completed 50 fasts.', '🛡️', 'milestone', 'total_fasts', 50, 180),
  ('Legend', 'legend', 'Completed 250 fasts.', '👑', 'special', 'total_fasts', 250, 500),
  ('100 Hours', '100-hours', 'Logged 100 total fasting hours.', '⏱️', 'milestone', 'total_hours', 100, 100),
  ('500 Hours', '500-hours', 'Logged 500 total fasting hours.', '⌛', 'special', 'total_hours', 500, 300),
  ('Social Butterfly', 'social-butterfly', 'Added 5 friends on FastTrack.', '🦋', 'social', 'add_friends', 5, 90),
  ('Challenge Champ', 'challenge-champ', 'Completed your first challenge.', '🥇', 'challenge', 'complete_challenge', 1, 120),
  ('Body for Life', 'body-for-life', 'Joined 3 challenges and committed to the long game.', '💪', 'challenge', 'join_challenges', 3, 150)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  icon = excluded.icon,
  category = excluded.category,
  requirement_type = excluded.requirement_type,
  requirement_value = excluded.requirement_value,
  xp_reward = excluded.xp_reward;
