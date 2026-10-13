-- Serialize provider-managed factor changes across application instances.
-- Authenticated users have SELECT only on profiles; only the trusted server can
-- acquire or release this lease. Interrupted operations require owner recovery.
alter table public.profiles add column if not exists mfa_operation_id uuid;
comment on column public.profiles.mfa_operation_id is 'Server-only lease for authenticator enrollment, verification and removal. No automatic expiry; interrupted leases require verified owner recovery.';

-- Lock a scope before its last-custodian check. Existence checks alone allow
-- concurrent deactivations to each observe the other's uncommitted active row.
create or replace function private.guard_last_custodian()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'custodian' and old.status = 'active'
    and (tg_op = 'DELETE' or new.role <> 'custodian' or new.status <> 'active'
      or new.data_scope <> old.data_scope) then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtext('labtrack-active-custodian'), pg_catalog.hashtext(old.data_scope::text));
    if not exists (select 1 from public.profiles p
      where p.role = 'custodian' and p.status = 'active'
        and p.data_scope = old.data_scope and p.id <> old.id) then
      raise exception 'The last active custodian cannot be deactivated' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

-- Acquire the same lock before the target row, then recheck actor access after
-- waiting. This also rejects an actor disabled by the preceding scope mutation.
create or replace function private.set_profile_status_impl(p_profile_id uuid, p_status public.profile_status)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare actor public.profiles; locked_scope public.data_scope; target public.profiles; result public.profiles;
begin
  actor := private.require_custodian();
  locked_scope := actor.data_scope;
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtext('labtrack-active-custodian'), pg_catalog.hashtext(locked_scope::text));
  actor := private.require_custodian();
  if actor.data_scope <> locked_scope then
    raise exception 'Account permissions changed. Reload and try again' using errcode = '42501';
  end if;
  select * into target from public.profiles where id = p_profile_id for update;
  if target.id is null or target.data_scope <> actor.data_scope then
    raise exception 'Profile not found in your scope' using errcode = '42501';
  end if;
  if target.id = actor.id and p_status <> 'active' then
    raise exception 'You cannot deactivate your current account' using errcode = '23514';
  end if;
  update public.profiles set status = p_status where id = p_profile_id returning * into result;
  return result;
end;
$$;
