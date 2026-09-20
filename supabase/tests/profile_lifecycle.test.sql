begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

-- Disposable fixtures; the entire test is rolled back.
insert into auth.users (id, email, raw_user_meta_data, raw_app_meta_data)
values
  ('09190000-0000-4000-8000-000000000001', 'delete-student@test.invalid', '{"full_name":"Delete Student","student_id":"DELETE-STUDENT"}', '{}'),
  ('09190000-0000-4000-8000-000000000002', 'delete-instructor@test.invalid', '{"full_name":"Delete Instructor"}', '{"labtrack_staff_role":"instructor","labtrack_data_scope":"demo"}');

delete from auth.users where id in ('09190000-0000-4000-8000-000000000001', '09190000-0000-4000-8000-000000000002');
select is((select count(*) from public.profiles where id in ('09190000-0000-4000-8000-000000000001', '09190000-0000-4000-8000-000000000002')), 0::bigint,
  'deleting unused student and instructor accounts cascades to their profiles');

select ok(has_table_privilege('service_role', 'public.profiles', 'INSERT,UPDATE,DELETE'), 'server account management has explicit profile access');
select ok(has_table_privilege('service_role', 'public.tools', 'INSERT,UPDATE,DELETE'), 'server demo seeding has explicit inventory access');
select ok(not has_table_privilege('authenticated', 'public.profiles', 'UPDATE'), 'browser clients cannot bypass profile RPC authorization');

select * from finish();
rollback;
