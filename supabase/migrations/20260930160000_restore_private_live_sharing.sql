-- Privacy reset: the 20260530153000 migration enabled every profile, so an
-- existing true value cannot establish deliberate consent. Users may opt in
-- again in Profile after this release. No fasting history is modified.
alter table public.profiles alter column share_live_status set default false;
update public.profiles set share_live_status = false
where share_live_status is distinct from false;

-- Resolve consent inside a narrow helper: profiles has owner-only SELECT RLS.
-- No identity or profile data is returned, only this viewer's event visibility.
create or replace function private.can_view_live_feed_event(event_owner_id uuid)
returns boolean language sql stable security definer set search_path = ''
as $$
  select private.can_view_feed_event(event_owner_id)
    and exists (select 1 from public.profiles p
      where p.id = event_owner_id and p.share_live_status is true);
$$;
revoke all on function private.can_view_live_feed_event(uuid) from public;
grant execute on function private.can_view_live_feed_event(uuid) to authenticated;

-- Apply the same rule to direct authenticated reads, not only server routes.
drop policy if exists "Users view own and friend feed" on public.feed_events;
drop policy if exists "Friends can view accepted feed events" on public.feed_events;
create policy "Users view own and friend feed"
on public.feed_events for select to authenticated
using (
  user_id = next_auth.uid()
  or (
    private.can_view_feed_event(user_id)
    and (
      event_type not in ('fast_started', 'milestone_hit')
      or private.can_view_live_feed_event(user_id)
    )
  )
);

-- Timer checkpoints describe elapsed time, not measured physiology.
update public.badges set name = '16-Hour Check-in',
  description = 'Logged a 16-hour window. This badge does not measure autophagy or health benefits.'
where slug = 'sweet-spot';
update public.badges set name = '18-Hour Check-in',
  description = 'Logged an 18-hour window. Longer windows are not a measure of better health.'
where slug = 'extended-warrior';
