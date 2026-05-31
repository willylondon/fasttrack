alter table public.fast_sessions
add column if not exists stage_reached integer not null default 0;

update public.fast_sessions
set stage_reached = 0
where stage_reached is null;

alter table public.fast_sessions
alter column stage_reached set default 0,
alter column stage_reached set not null;

comment on column public.fast_sessions.stage_reached is
  'Maps to the reached milestone index in FASTING_STAGES[].';
