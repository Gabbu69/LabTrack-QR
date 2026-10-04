-- Clear only the server-derived counter whose credentials/code were accepted.
-- consume_login_attempt remains atomic and retains the five-attempt cooldown.
create function public.reset_login_attempts(p_key text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_key is null or p_key !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid limiter key' using errcode = '22023';
  end if;
  delete from private.login_attempts where key = p_key;
end;
$$;
revoke all on function public.reset_login_attempts(text) from public, anon, authenticated;
grant execute on function public.reset_login_attempts(text) to service_role;
