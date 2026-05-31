alter table public.feed_events
drop constraint if exists feed_events_event_type_check;

alter table public.feed_events
add constraint feed_events_event_type_check
check (
  event_type in (
    'fast_started',
    'fast_completed',
    'milestone_hit',
    'streak_updated',
    'streak_milestone',
    'badge_earned',
    'challenge_joined',
    'challenge_completed',
    'level_up'
  )
);
