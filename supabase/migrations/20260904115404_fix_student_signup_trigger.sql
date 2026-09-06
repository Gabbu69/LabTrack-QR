create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, email, full_name, role, status, student_id, year_section, group_number,
    contact_number, data_scope, must_change_password
  ) values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Pending Student'),
    case when new.raw_app_meta_data ->> 'labtrack_staff_role' in ('custodian', 'instructor')
      then (new.raw_app_meta_data ->> 'labtrack_staff_role')::public.app_role else 'student' end,
    case when new.raw_app_meta_data ->> 'labtrack_staff_role' in ('custodian', 'instructor')
      then 'active'::public.profile_status else 'pending'::public.profile_status end,
    nullif(trim(new.raw_user_meta_data ->> 'student_id'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'year_section'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'group_number'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'contact_number'), ''),
    case when new.raw_app_meta_data ->> 'labtrack_data_scope' = 'demo'
      then 'demo'::public.data_scope else 'operational'::public.data_scope end,
    coalesce((new.raw_app_meta_data ->> 'labtrack_staff_role' in ('custodian', 'instructor')), false)
  );
  return new;
end;
$$;
