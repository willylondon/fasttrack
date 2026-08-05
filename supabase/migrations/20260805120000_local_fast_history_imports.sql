alter table public.fast_sessions
  add column if not exists import_key text;

create unique index if not exists idx_fast_sessions_user_import_key
  on public.fast_sessions(user_id, import_key)
  where import_key is not null;
