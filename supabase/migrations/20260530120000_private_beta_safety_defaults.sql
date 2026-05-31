alter table public.profiles
alter column share_live_status set default false;

update public.profiles
set share_live_status = false
where share_live_status is distinct from false;

delete from public.badges
where slug in ('one-day-strong', 'deep-healer');
