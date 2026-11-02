-- Serverless instances don't share memory, so API limits need a shared counter.
create table if not exists public.rate_limits (
  key text primary key,
  count integer not null,
  reset_at timestamptz not null
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated;

create or replace function public.check_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (allowed boolean, remaining integer, retry_after_seconds integer)
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  current_count integer;
  current_reset timestamptz;
begin
  -- The upsert takes the row lock, so concurrent requests can't under-count.
  insert into public.rate_limits as limits (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update set
    count = case when limits.reset_at <= now() then 1 else limits.count + 1 end,
    reset_at = case when limits.reset_at <= now() then excluded.reset_at else limits.reset_at end
  returning limits.count, limits.reset_at into current_count, current_reset;

  if random() < 0.01 then
    delete from public.rate_limits where reset_at <= now();
  end if;

  return query select
    current_count <= p_limit,
    greatest(0, p_limit - current_count),
    case when current_count <= p_limit then 0
      else greatest(1, ceil(extract(epoch from current_reset - now()))::integer) end;
end $$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;
grant all on table public.rate_limits to service_role;
