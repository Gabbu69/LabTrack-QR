-- Supabase email OTP tokens remain AAL1. Only the application server may attest
-- that a password-authenticated browser also verified its inbox. Bind that proof
-- to the resulting provider session, never to editable user metadata.
create table private.email_otp_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint email_otp_session_expiry check (expires_at > verified_at and expires_at <= verified_at + interval '8 hours')
);
alter table private.email_otp_sessions enable row level security;
revoke all on private.email_otp_sessions from public, anon, authenticated, service_role;

create function public.record_email_otp_verification(p_user uuid, p_password_session uuid, p_session uuid, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '8 hours'
    or not exists (select 1 from auth.sessions s where s.id = p_session and s.user_id = p_user)
    or not exists (select 1 from auth.sessions s where s.id = p_password_session and s.user_id = p_user)
    or not exists (select 1 from public.profiles p where p.id = p_user and p.data_scope = 'operational' and p.status <> 'disabled')
    or exists (select 1 from auth.mfa_factors f where f.user_id = p_user and f.status = 'verified') then
    raise exception 'Email verification cannot authorize this session' using errcode = '42501';
  end if;
  delete from private.email_otp_sessions where expires_at <= now();
  insert into private.email_otp_sessions(session_id, user_id, expires_at) values (p_session, p_user, p_expires_at)
  on conflict (session_id) do nothing; -- Verification never extends an existing grant.
end;
$$;
revoke all on function public.record_email_otp_verification(uuid,uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.record_email_otp_verification(uuid,uuid,uuid,timestamptz) to service_role;

create function public.email_otp_verified()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.email_otp_sessions e
    join auth.sessions s on s.id = e.session_id and s.user_id = e.user_id
    where e.user_id = (select auth.uid())
      and e.session_id::text = (select auth.jwt()) ->> 'session_id'
      and e.expires_at > now()
      and not exists (select 1 from auth.mfa_factors f where f.user_id = e.user_id and f.status = 'verified')
  );
$$;
revoke all on function public.email_otp_verified() from public, anon;
grant execute on function public.email_otp_verified() to authenticated;

create or replace function private.has_required_mfa()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
      and (p.data_scope = 'demo' or coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
        or (select public.email_otp_verified()))
  );
$$;
comment on function private.has_required_mfa() is 'Operational access requires provider AAL2 or server-attested password plus email OTP for the current session. Trusted demo profiles are exempt.';
comment on function public.record_email_otp_verification(uuid,uuid,uuid,timestamptz) is 'Service-role only: call after password proof and successful provider email OTP verification. Never call for email-only login.';
