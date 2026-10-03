-- Real laboratory accounts need a verified second factor. Demo isolation remains
-- database-controlled; editable user metadata cannot grant the demo exemption.
create or replace function private.has_required_mfa()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid())
      and (p.data_scope = 'demo' or coalesce((select auth.jwt()) ->> 'aal', '') = 'aal2')
  );
$$;
revoke all on function private.has_required_mfa() from public, anon;
grant execute on function private.has_required_mfa() to authenticated;

create or replace function private.is_active_staff_for_scope(target_scope public.data_scope)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.status = 'active' and not p.must_change_password
    and p.role in ('custodian', 'instructor') and p.data_scope = target_scope
    and (select private.has_required_mfa()));
$$;

create or replace function private.is_active_custodian_for_scope(target_scope public.data_scope)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.status = 'active' and not p.must_change_password
    and p.role = 'custodian' and p.data_scope = target_scope
    and (select private.has_required_mfa()));
$$;

create or replace function private.is_current_profile_active()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles p where p.id = (select auth.uid())
    and p.status = 'active' and not p.must_change_password
    and (select private.has_required_mfa()));
$$;

create or replace function private.require_custodian()
returns public.profiles language plpgsql stable security definer set search_path = '' as $$
declare actor public.profiles;
begin
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.status <> 'active' or actor.role <> 'custodian'
     or actor.must_change_password or not private.has_required_mfa() then
    raise exception 'Active custodian access with a private password and verified second factor is required' using errcode = '42501';
  end if;
  return actor;
end;
$$;

create or replace function private.update_my_profile_impl(
  p_full_name text, p_student_id text, p_year_section text, p_group_number text,
  p_contact_number text, p_photo_path text default null
)
returns public.profiles language plpgsql security definer set search_path = '' as $$
declare result public.profiles;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.has_required_mfa() then raise exception 'A verified second factor is required' using errcode = '42501'; end if;
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

-- Keep the aggregate invoker-security: MFA does not replace role/scope RLS.
create or replace function public.dashboard_summary()
returns jsonb language plpgsql stable security invoker set search_path = '' as $$
begin
  if not private.has_required_mfa() then
    raise exception 'A verified second factor is required' using errcode = '42501';
  end if;
  return (
    select jsonb_build_object(
      'metrics', (select jsonb_build_object('total', count(*),
        'available', count(*) filter (where status = 'available'),
        'borrowed', count(*) filter (where status = 'borrowed'),
        'missing', count(*) filter (where status = 'missing'),
        'activeTransactions', (select count(*) from public.transactions where status <> 'returned'))
        from public.tools where archived_at is null),
      'categories', coalesce((select jsonb_agg(c order by c.total desc, c.label) from (
        select category as label, count(*) as total, count(*) filter (where status = 'available') as available
        from public.tools where archived_at is null group by category) c), '[]'::jsonb),
      'borrowers', coalesce((select jsonb_agg(b order by b.name) from (
        select tx.borrower_id as id, max(tx.borrower_name_snapshot) as name,
          max(tx.borrower_student_id_snapshot) as "studentId", count(i.id) as tools
        from public.transactions tx join public.transaction_items i on i.transaction_id = tx.id
        where i.item_status in ('borrowed', 'missing') group by tx.borrower_id) b), '[]'::jsonb),
      'student', jsonb_build_object(
        'transactions', (select count(*) from public.transactions where borrower_id = (select auth.uid())),
        'borrowed', (select count(*) from public.transaction_items i join public.transactions tx on tx.id = i.transaction_id where tx.borrower_id = (select auth.uid()) and i.item_status = 'borrowed'),
        'missing', (select count(*) from public.transaction_items i join public.transactions tx on tx.id = i.transaction_id where tx.borrower_id = (select auth.uid()) and i.item_status = 'missing'),
        'items', coalesce((select jsonb_agg(r) from (select i.* from public.transaction_items i
          join public.transactions tx on tx.id = i.transaction_id where tx.borrower_id = (select auth.uid())
          and i.item_status in ('borrowed', 'missing') order by i.created_at desc, i.id limit 8) r), '[]'::jsonb))
    )
  );
end;
$$;

-- Own-profile SELECT and current_profile() deliberately remain identity-only:
-- enrollment and required password changes must not require laboratory access.
comment on function private.has_required_mfa() is 'Verified aal2 JWT required for operational accounts; only database-controlled demo profiles are exempt.';
