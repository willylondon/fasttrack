-- Product decision (owner-approved 2026-10-07): accepted friends see each
-- other's live fasts by default. Members can still hide their live fast from
-- Profile (share_live_status = false). This re-enables every existing profile;
-- anyone who hid it since 20260930160000 will need to hide it again.
-- No fasting history is modified.
alter table public.profiles alter column share_live_status set default true;
update public.profiles set share_live_status = true
where share_live_status is distinct from true;
alter table public.profiles alter column share_live_status set not null;
