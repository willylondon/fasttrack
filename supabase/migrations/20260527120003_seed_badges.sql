with badge_seed (name, slug, description, icon, category, requirement_type, requirement_value, xp_reward) as (
  values
  ('First Fast', 'first-fast', 'Completed your very first fast.', '🌱', 'milestone', 'first_fast', 1, 50),
  ('Sweet Spot', 'sweet-spot', 'Reached the 16-hour autophagy sweet spot.', '🧬', 'milestone', 'milestone_hours', 16, 80),
  ('Extended Warrior', 'extended-warrior', 'Held strong through an 18-hour fast.', '⚔️', 'milestone', 'milestone_hours', 18, 100),
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
)
insert into public.badges (name, slug, description, icon, category, requirement_type, requirement_value, xp_reward)
select name, slug, description, icon, category, requirement_type, requirement_value, xp_reward
from badge_seed
where not exists (
  select 1
  from public.badges
  where badges.slug = badge_seed.slug
    or badges.name = badge_seed.name
)
on conflict (slug) do nothing;
