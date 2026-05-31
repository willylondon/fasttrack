update public.fast_sessions
set stage_reached = 0
where stage_reached is null;

alter table public.fast_sessions
alter column stage_reached set default 0,
alter column stage_reached set not null;
