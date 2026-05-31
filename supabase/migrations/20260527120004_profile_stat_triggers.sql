create or replace function private.recalculate_profile_fast_stats(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  total_fasts_value integer;
  total_fast_hours_value numeric(10, 2);
  current_streak_value integer := 0;
  longest_streak_value integer := 0;
  run_length integer := 0;
  cursor_day date := current_date;
  session_day date;
  previous_day date := null;
begin
  select
    count(*)::integer,
    coalesce(round((sum(duration_minutes)::numeric / 60.0), 2), 0)
  into total_fasts_value, total_fast_hours_value
  from public.fast_sessions
  where user_id = target_user_id
    and status = 'completed'
    and duration_minutes > 0;

  while exists (
    select 1
    from public.fast_sessions
    where user_id = target_user_id
      and status = 'completed'
      and duration_minutes > 0
      and coalesce(ended_at, started_at)::date = cursor_day
  ) loop
    current_streak_value := current_streak_value + 1;
    cursor_day := cursor_day - interval '1 day';
  end loop;

  for session_day in
    select distinct coalesce(ended_at, started_at)::date as fast_day
    from public.fast_sessions
    where user_id = target_user_id
      and status = 'completed'
      and duration_minutes > 0
    order by fast_day
  loop
    if previous_day is null or session_day <> previous_day + 1 then
      run_length := 1;
    else
      run_length := run_length + 1;
    end if;

    longest_streak_value := greatest(longest_streak_value, run_length);
    previous_day := session_day;
  end loop;

  update public.profiles
  set
    total_fasts = total_fasts_value,
    total_fast_hours = total_fast_hours_value,
    current_streak = current_streak_value,
    longest_streak = greatest(longest_streak, current_streak_value, longest_streak_value)
  where id = target_user_id;
end;
$$;

create or replace function private.sync_profile_fast_stats()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'INSERT' and new.status = 'completed' then
    perform private.recalculate_profile_fast_stats(new.user_id);
  elsif tg_op = 'UPDATE'
    and new.status = 'completed'
    and (
      old.status is distinct from new.status
      or old.duration_minutes is distinct from new.duration_minutes
      or old.ended_at is distinct from new.ended_at
      or old.started_at is distinct from new.started_at
    ) then
    perform private.recalculate_profile_fast_stats(new.user_id);
  end if;

  return new;
end;
$$;

drop trigger if exists fast_sessions_sync_profile_fast_stats on public.fast_sessions;
create trigger fast_sessions_sync_profile_fast_stats
after insert or update on public.fast_sessions
for each row execute function private.sync_profile_fast_stats();
