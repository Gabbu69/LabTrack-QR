begin;
do $$
declare allowed boolean;
begin
  if has_function_privilege('anon', 'public.consume_login_attempt(text)', 'execute')
    or has_function_privilege('authenticated', 'public.consume_login_attempt(text)', 'execute') then
    raise exception 'Client roles must not control login limits';
  end if;
  if not has_function_privilege('service_role', 'public.consume_login_attempt(text)', 'execute') then
    raise exception 'Server must be able to enforce login limits';
  end if;
  if has_function_privilege('anon', 'public.reset_login_attempts(text)', 'execute')
    or has_function_privilege('authenticated', 'public.reset_login_attempts(text)', 'execute') then
    raise exception 'Client roles must not reset login limits';
  end if;
  if not has_function_privilege('service_role', 'public.reset_login_attempts(text)', 'execute') then
    raise exception 'Server must be able to reset accepted authentication';
  end if;
  for attempt in 1..6 loop
    allowed := public.consume_login_attempt(repeat('a',64));
    if allowed <> (attempt <= 5) then raise exception 'Incorrect attempt limit'; end if;
  end loop;
  if not public.consume_login_attempt(repeat('b',64)) then raise exception 'Different account blocked'; end if;
  update private.login_attempts set started_at = now() - interval '15 minutes' where key = repeat('a',64);
  if not public.consume_login_attempt(repeat('a',64)) then raise exception 'Cooldown did not reset'; end if;
  for attempt in 1..6 loop
    if not public.consume_login_attempt(repeat('c',64)) then raise exception 'Successful sign-ins exhausted the limit'; end if;
    perform public.reset_login_attempts(repeat('c',64));
  end loop;
  if not exists (select 1 from private.login_attempts where key = repeat('b',64)) then
    raise exception 'Reset cleared a different counter';
  end if;
  perform public.reset_login_attempts(repeat('c',64)); -- A repeated reset is harmless.
  begin
    perform public.reset_login_attempts('not-a-key');
    raise exception 'Invalid reset key accepted';
  exception when invalid_parameter_value then null;
  end;
end;
$$;
rollback;
