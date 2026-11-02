-- Member blocking and reporting, required by Google Play's user-generated content
-- policy. Blocking reuses the existing friendships 'blocked' status: every sharing
-- path already requires 'accepted', and search and requests already refuse the pair.
alter table public.friendships
  add column if not exists blocked_by uuid references public.profiles(id) on delete cascade;

alter table public.friendships
  add constraint friendships_blocked_by_matches_status
  check ((status = 'blocked') = (blocked_by is not null)) not valid;
alter table public.friendships validate constraint friendships_blocked_by_matches_status;

create table if not exists public.user_reports (
  id uuid primary key default uuid_generate_v4(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null check (reason in ('harassment', 'hate', 'sexual', 'self_harm', 'spam', 'impersonation', 'other')),
  details text check (char_length(details) <= 500),
  content_type text not null check (content_type in ('profile', 'encouragement', 'challenge')),
  content_id uuid,
  -- Keeps what was reported reviewable after blocking removes the original.
  content_snapshot text,
  status text not null default 'open' check (status in ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint user_reports_no_self check (reporter_id <> reported_user_id)
);

create index if not exists idx_user_reports_status_created
on public.user_reports(status, created_at desc);

-- Service-role only: reports are never readable or writable from the client.
alter table public.user_reports enable row level security;
revoke all on table public.user_reports from anon, authenticated;
grant all on table public.user_reports to service_role;
