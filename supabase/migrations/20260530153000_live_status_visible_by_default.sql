alter table public.profiles
add column if not exists share_live_status boolean default true;

alter table public.profiles
alter column share_live_status set default true;

update public.profiles
set share_live_status = true
where share_live_status is distinct from true;
