-- Stop for manual review instead of removing or merging existing relationships.
do $$
begin
  if exists (
    select 1 from public.friendships
    group by least(sender_id, receiver_id), greatest(sender_id, receiver_id)
    having count(*) > 1
  ) then
    raise exception 'Duplicate friendship pairs exist. Review and reconcile with the account owners before retrying this migration.';
  end if;
end $$;
create unique index if not exists friendships_unique_pair
  on public.friendships (least(sender_id, receiver_id), greatest(sender_id, receiver_id));

-- All shipped friendship mutations use authenticated server routes and the
-- service role. Remove unused direct-client write policies, which otherwise
-- let a sender insert an already-accepted relationship without consent.
drop policy if exists "Users create friendships as sender" on public.friendships;
drop policy if exists "Users update received friendships" on public.friendships;
drop policy if exists "Users update own friendships" on public.friendships;
