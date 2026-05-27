alter table public.fast_sessions
  add column if not exists stage_reached integer not null default 0;

alter table public.fast_sessions
  alter column duration_planned_minutes set not null;

create index if not exists idx_fast_sessions_status on public.fast_sessions(status);
create index if not exists idx_fast_sessions_ended on public.fast_sessions(ended_at desc);

drop policy if exists "Friends can view accepted feed events" on public.feed_events;
create policy "Friends can view accepted feed events"
on public.feed_events
for select
to authenticated
using (
  next_auth.uid() = user_id
  or exists (
    select 1
    from public.friendships
    where status = 'accepted'
      and (
        (sender_id = next_auth.uid() and receiver_id = public.feed_events.user_id)
        or
        (receiver_id = next_auth.uid() and sender_id = public.feed_events.user_id)
      )
  )
);
