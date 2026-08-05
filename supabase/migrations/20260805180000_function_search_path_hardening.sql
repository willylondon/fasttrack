-- Prevent callers from shadowing unqualified built-ins used by these functions.
alter function next_auth.uid() set search_path = '';
alter function public.calculate_level(integer) set search_path = '';
