-- Temporary credentials may identify an account, but cannot access laboratory data.
create or replace function private.is_active_staff_for_scope(target_scope public.data_scope)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.status = 'active' and not p.must_change_password
    and p.role in ('custodian', 'instructor') and p.data_scope = target_scope);
$$;

create or replace function private.is_active_custodian_for_scope(target_scope public.data_scope)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.status = 'active' and not p.must_change_password
    and p.role = 'custodian' and p.data_scope = target_scope);
$$;

create or replace function private.is_current_profile_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.status = 'active' and not p.must_change_password);
$$;

create or replace function private.require_custodian()
returns public.profiles language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles;
begin
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.status <> 'active' or actor.role <> 'custodian' or actor.must_change_password then
    raise exception 'Active custodian access with a private password is required' using errcode = '42501';
  end if;
  return actor;
end;
$$;

-- Preserve the legacy signatures, but revoke both exposed and implementation entrypoints.
revoke execute on function public.complete_password_change() from public, anon, authenticated;
revoke execute on function private.complete_password_change_impl() from public, anon, authenticated;

create or replace function private.update_my_profile_impl(
  p_full_name text, p_student_id text, p_year_section text, p_group_number text,
  p_contact_number text, p_photo_path text default null
)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare result public.profiles;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if char_length(trim(p_full_name)) not between 2 and 120
    or char_length(coalesce(p_student_id, '')) > 40
    or char_length(coalesce(p_year_section, '')) > 60
    or char_length(coalesce(p_group_number, '')) > 30
    or char_length(coalesce(p_contact_number, '')) > 30 then
    raise exception 'Profile details exceed the allowed length' using errcode = '22023';
  end if;
  update public.profiles
  set full_name = trim(p_full_name), student_id = nullif(trim(p_student_id), ''),
    year_section = nullif(trim(p_year_section), ''), group_number = nullif(trim(p_group_number), ''),
    contact_number = nullif(trim(p_contact_number), ''), photo_path = coalesce(p_photo_path, photo_path)
  where id = (select auth.uid()) and status <> 'disabled' and not must_change_password
  returning * into result;
  if result.id is null then raise exception 'Profile access is restricted' using errcode = '42501'; end if;
  return result;
end;
$$;
