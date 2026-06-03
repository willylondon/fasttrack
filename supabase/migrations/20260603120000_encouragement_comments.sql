create table if not exists public.encouragement_comments (
  id uuid primary key default uuid_generate_v4(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  context text not null default 'leaderboard' check (context in ('leaderboard')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint encouragement_comments_no_self check (author_id <> recipient_id),
  constraint encouragement_comments_body_length check (char_length(trim(body)) between 1 and 180)
);

create index if not exists idx_encouragement_comments_recipient_created
on public.encouragement_comments(recipient_id, created_at desc);

create index if not exists idx_encouragement_comments_author_created
on public.encouragement_comments(author_id, created_at desc);

drop trigger if exists encouragement_comments_set_updated_at on public.encouragement_comments;
create trigger encouragement_comments_set_updated_at
before update on public.encouragement_comments
for each row execute function private.set_updated_at();

create or replace function private.can_view_profile_encouragement(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_profile_id = next_auth.uid()
    or exists (
      select 1
      from public.friendships
      where status = 'accepted'
        and (
          (sender_id = next_auth.uid() and receiver_id = target_profile_id)
          or (receiver_id = next_auth.uid() and sender_id = target_profile_id)
        )
    );
$$;

create or replace function private.can_send_profile_encouragement(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select target_profile_id <> next_auth.uid()
    and exists (
      select 1
      from public.friendships
      where status = 'accepted'
        and (
          (sender_id = next_auth.uid() and receiver_id = target_profile_id)
          or (receiver_id = next_auth.uid() and sender_id = target_profile_id)
        )
    );
$$;

grant execute on function private.can_view_profile_encouragement(uuid) to authenticated;
grant execute on function private.can_send_profile_encouragement(uuid) to authenticated;

alter table public.encouragement_comments enable row level security;

drop policy if exists "Users view profile encouragements" on public.encouragement_comments;
drop policy if exists "Users create friend encouragements" on public.encouragement_comments;
drop policy if exists "Users delete own encouragements" on public.encouragement_comments;

create policy "Users view profile encouragements"
on public.encouragement_comments for select to authenticated
using (
  author_id = next_auth.uid()
  or private.can_view_profile_encouragement(recipient_id)
);

create policy "Users create friend encouragements"
on public.encouragement_comments for insert to authenticated
with check (
  author_id = next_auth.uid()
  and private.can_send_profile_encouragement(recipient_id)
);

create policy "Users delete own encouragements"
on public.encouragement_comments for delete to authenticated
using (author_id = next_auth.uid());

grant select, insert, delete on public.encouragement_comments to authenticated;
