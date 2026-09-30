-- Deliberately abort rather than silently remove or rewrite existing user data.
begin;
lock table public.fast_sessions, public.xp_transactions in share row exclusive mode;
do $$
begin
  if exists (select 1 from public.fast_sessions where status = 'active' group by user_id having count(*) > 1) then
    raise exception 'Resolve duplicate active fasts manually before applying fasting reliability migration';
  end if;
  if exists (select 1 from public.fast_sessions where import_key is not null group by user_id, import_key having count(*) > 1) then
    raise exception 'Resolve duplicate fast import keys manually before applying fasting reliability migration';
  end if;
  if exists (select 1 from public.xp_transactions where reference_id is not null group by user_id, source, reference_id having count(*) > 1) then
    raise exception 'Resolve duplicate keyed XP transactions manually before applying fasting reliability migration';
  end if;
end $$;
create unique index fast_sessions_one_active_per_user on public.fast_sessions(user_id) where status = 'active';
-- A full index supports PostgREST ON CONFLICT inference; NULL operation IDs remain independent.
create unique index fast_sessions_user_import_key_all on public.fast_sessions(user_id, import_key);
create unique index xp_transactions_reward_once on public.xp_transactions(user_id, source, reference_id);

-- Serialize per-user session mutations before the existing aggregate-stat trigger reads
-- history. Concurrent import statements otherwise risk replacing totals with a stale sum.
create or replace function private.lock_fast_profile()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from public.profiles where id = new.user_id for update;
  return new;
end $$;
revoke all on function private.lock_fast_profile() from public, anon, authenticated;
create trigger fast_sessions_lock_profile
before insert or update on public.fast_sessions
for each row execute function private.lock_fast_profile();

create or replace function public.award_fasttrack_badge(target_user_id uuid, target_badge_id uuid)
returns table (new_badge boolean, xp_awarded integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  badge public.badges%rowtype;
  inserted_count integer;
  reward_count integer;
begin
  -- Serialize badge grants for this profile; badge and XP writes commit together.
  perform 1 from public.profiles where id = target_user_id for update;
  select * into strict badge from public.badges where id = target_badge_id;
  insert into public.user_badges(user_id, badge_id) values(target_user_id, target_badge_id)
    on conflict do nothing;
  get diagnostics inserted_count = row_count;
  insert into public.xp_transactions(user_id, amount, source, reference_id)
    values(target_user_id, badge.xp_reward, 'badge_earned', target_badge_id)
    on conflict (user_id, source, reference_id) do nothing;
  get diagnostics reward_count = row_count;
  if inserted_count > 0 then
    begin
      insert into public.feed_events(user_id, event_type, metadata) values(target_user_id, 'badge_earned',
        jsonb_build_object('badgeId', badge.id, 'badgeName', badge.name, 'badgeIcon', badge.icon, 'xpReward', badge.xp_reward));
    exception when others then
      raise warning 'Badge saved; feed delivery failed: %', sqlerrm;
    end;
  end if;
  return query select inserted_count > 0, case when reward_count > 0 then badge.xp_reward else 0 end;
end $$;
revoke all on function public.award_fasttrack_badge(uuid, uuid) from public, anon, authenticated;
grant execute on function public.award_fasttrack_badge(uuid, uuid) to service_role;

create or replace function public.record_fast_milestone(target_user_id uuid, target_session_id uuid,
  target_stage integer, threshold_hours integer, stage_label text)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare session public.fast_sessions%rowtype;
begin
  select * into session from public.fast_sessions where id = target_session_id and user_id = target_user_id for update;
  if not found or session.status <> 'active' then
    raise exception 'Active fast not found' using errcode = 'P0002';
  end if;
  if target_stage < 1 or target_stage > 9 or threshold_hours <> target_stage * 2 then
    raise exception 'Invalid milestone stage';
  end if;
  if extract(epoch from (now() - session.started_at)) < threshold_hours * 3600 then
    raise exception 'Milestone has not been reached yet';
  end if;
  update public.fast_sessions set stage_reached = greatest(stage_reached, target_stage) where id = session.id;
  if not exists (select 1 from public.feed_events where user_id = target_user_id and event_type = 'milestone_hit'
    and metadata->>'sessionId' = target_session_id::text and metadata->>'stageIndex' = target_stage::text) then
    insert into public.feed_events(user_id, event_type, metadata) values(target_user_id, 'milestone_hit',
      jsonb_build_object('sessionId', target_session_id, 'stageIndex', target_stage, 'stageLabel', stage_label, 'thresholdHours', threshold_hours));
  end if;
end $$;
revoke all on function public.record_fast_milestone(uuid, uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function public.record_fast_milestone(uuid, uuid, integer, integer, text) to service_role;
commit;
