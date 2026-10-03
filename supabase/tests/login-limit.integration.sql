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
  for attempt in 1..6 loop
    allowed := public.consume_login_attempt(repeat('a',64));
    if allowed <> (attempt <= 5) then raise exception 'Incorrect attempt limit'; end if;
  end loop;
  if not public.consume_login_attempt(repeat('b',64)) then raise exception 'Different account blocked'; end if;
  update private.login_attempts set started_at = now() - interval '15 minutes' where key = repeat('a',64);
  if not public.consume_login_attempt(repeat('a',64)) then raise exception 'Cooldown did not reset'; end if;
end;
$$;
rollback;
