-- Additive: existing AAL2/email sessions continue during the application rollout.
create table private.turnstile_sessions (
  session_id uuid primary key references auth.sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  verified_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint turnstile_session_expiry check (expires_at > verified_at and expires_at <= verified_at + interval '8 hours')
);
alter table private.turnstile_sessions enable row level security;
revoke all on private.turnstile_sessions from public, anon, authenticated, service_role;

create function public.record_turnstile_verification(p_user uuid, p_session uuid, p_expires_at timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_expires_at is null or p_expires_at <= now() or p_expires_at > now() + interval '8 hours'
    or not exists (select 1 from auth.sessions s where s.id = p_session and s.user_id = p_user)
    or not exists (select 1 from public.profiles p where p.id = p_user and p.status <> 'disabled') then
    raise exception 'Verification cannot authorize this session' using errcode = '42501';
  end if;
  delete from private.turnstile_sessions where expires_at <= now();
  insert into private.turnstile_sessions(session_id, user_id, expires_at) values(p_session, p_user, p_expires_at)
  on conflict (session_id) do nothing;
end;
$$;
revoke all on function public.record_turnstile_verification(uuid,uuid,timestamptz) from public, anon, authenticated;
grant execute on function public.record_turnstile_verification(uuid,uuid,timestamptz) to service_role;

create function public.turnstile_verified()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from private.turnstile_sessions v
    join auth.sessions s on s.id = v.session_id and s.user_id = v.user_id
    join public.profiles p on p.id = v.user_id
    where v.user_id = (select auth.uid())
      and v.session_id::text = (select auth.jwt()) ->> 'session_id'
      and v.expires_at > now() and p.status <> 'disabled'
  );
$$;
revoke all on function public.turnstile_verified() from public, anon;
grant execute on function public.turnstile_verified() to authenticated;

create or replace function private.has_required_mfa()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
      and (p.data_scope = 'demo' or coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2'
        or (select public.email_otp_verified()) or (select public.turnstile_verified()))
  );
$$;
comment on function public.record_turnstile_verification(uuid,uuid,timestamptz) is 'Server only: attest a password-authenticated session after successful Cloudflare Siteverify with the expected action and hostname.';
comment on function private.has_required_mfa() is 'Operational access accepts server-attested password plus Turnstile; existing AAL2/email grants remain valid during migration. Role, approval, scope and password-change guards remain enforced.';
