-- Shared, atomic limit: five attempts per account in a fixed fifteen-minute window.
create table private.login_attempts (
  key text primary key check (key ~ '^[0-9a-f]{64}$'),
  started_at timestamptz not null,
  attempts integer not null check (attempts between 1 and 6)
);
revoke all on private.login_attempts from public, anon, authenticated;
alter table private.login_attempts enable row level security;

create function public.consume_login_attempt(p_key text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare attempt_count integer;
begin
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid limiter key' using errcode = '22023';
  end if;
  delete from private.login_attempts where started_at < now() - interval '1 day';
  insert into private.login_attempts as current (key, started_at, attempts)
    values (p_key, now(), 1)
  on conflict (key) do update set
    started_at = case when current.started_at <= now() - interval '15 minutes' then now() else current.started_at end,
    attempts = case when current.started_at <= now() - interval '15 minutes' then 1 else least(current.attempts + 1, 6) end
  returning attempts into attempt_count;
  return attempt_count <= 5;
end;
$$;
revoke all on function public.consume_login_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_login_attempt(text) to service_role;
