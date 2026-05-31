-- Create level calculation function based on level * 250 formula
create or replace function public.calculate_level(xp integer)
returns integer
language sql
immutable
as $$
  select floor((1 + sqrt(1 + greatest(0, xp) / 31.25)) / 2)::integer;
$$;

-- Create sync profile XP trigger function
create or replace function private.sync_profile_xp()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  update public.profiles
  set
    xp = xp + new.amount,
    level = public.calculate_level(xp + new.amount)
  where id = new.user_id;

  return new;
end;
$$;

-- Create trigger on public.xp_transactions
drop trigger if exists xp_transactions_sync_profile_xp on public.xp_transactions;
create trigger xp_transactions_sync_profile_xp
after insert on public.xp_transactions
for each row execute function private.sync_profile_xp();
