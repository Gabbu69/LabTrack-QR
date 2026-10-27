-- Roll the application back to its prior release before running this file.
begin;
create or replace function private.has_required_mfa()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
      and (p.data_scope = 'demo' or coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
        or (select public.email_otp_verified()))
  );
$$;
drop function public.turnstile_verified();
drop function public.record_turnstile_verification(uuid,uuid,timestamptz);
drop table private.turnstile_sessions;
commit;
