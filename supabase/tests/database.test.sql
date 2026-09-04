begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'forged@student.test', crypt('password', gen_salt('bf')), now(), '{"full_name":"Forged Student","student_id":"ST-001","year_section":"2-AMT","group_number":"1","role":"custodian","status":"active","data_scope":"demo"}', '{}'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'custodian@demo.test', crypt('password', gen_salt('bf')), now(), '{"full_name":"Demo Custodian"}', '{"labtrack_staff_role":"custodian","labtrack_data_scope":"demo"}'),
  ('00000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@student.test', crypt('password', gen_salt('bf')), now(), '{"full_name":"Other Student","student_id":"ST-002","year_section":"2-AMT","group_number":"2"}', '{"labtrack_data_scope":"operational"}'),
  ('00000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'instructor@demo.test', crypt('password', gen_salt('bf')), now(), '{"full_name":"Demo Instructor"}', '{"labtrack_staff_role":"instructor","labtrack_data_scope":"demo"}'),
  ('00000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'custodian@operational.test', crypt('password', gen_salt('bf')), now(), '{"full_name":"Operational Custodian"}', '{"labtrack_staff_role":"custodian","labtrack_data_scope":"operational"}');

select is((select role::text from public.profiles where id = '00000000-0000-4000-8000-000000000001'), 'student', 'forged user metadata cannot create staff');
select is((select status::text from public.profiles where id = '00000000-0000-4000-8000-000000000001'), 'pending', 'student signup is always pending');
select is((select data_scope::text from public.profiles where id = '00000000-0000-4000-8000-000000000001'), 'operational', 'student metadata cannot forge demo scope');
select results_eq($$ select role::text, status::text, data_scope::text from public.profiles where id = '00000000-0000-4000-8000-000000000002' $$, $$ values ('custodian','active','demo') $$, 'trusted app metadata bootstraps active demo staff');

update public.profiles set status = 'active' where id in ('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000003');
insert into public.tools (id, asset_code, tool_name, description, category, condition, status, creation_batch_id, data_scope, created_by)
values ('10000000-0000-4000-8000-000000000001','TST-001','Test Meter','','Measuring','good','borrowed','20000000-0000-4000-8000-000000000001','operational','00000000-0000-4000-8000-000000000005');
insert into public.transactions (id, borrower_id, processed_by, borrower_name_snapshot, borrower_student_id_snapshot, status, data_scope)
values ('30000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000005','Forged Student','ST-001','borrowed','operational');
insert into public.transaction_items (transaction_id, tool_id, tool_name_snapshot, asset_code_snapshot, item_status, issue_condition)
values ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Test Meter','TST-001','borrowed','good');

set local role anon;
select is((select count(*) from public.tools), 0::bigint, 'anonymous users cannot read tool records');
set local role postgres;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select is((select count(*) from public.transactions), 0::bigint, 'students cannot read another student custody record');
set local role postgres;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is((select count(*) from public.transactions), 1::bigint, 'active students can read their own custody record');
set local role postgres;

update public.profiles set status = 'disabled' where id = '00000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
set local role authenticated;
select is((select count(*) from public.transactions), 0::bigint, 'disabled students cannot read custody data');
set local role postgres;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
set local role authenticated;
select throws_ok($$ select public.set_profile_status('00000000-0000-4000-8000-000000000002','disabled') $$, '23514', 'You cannot deactivate your current account', 'current custodian cannot deactivate their account');
set local role postgres;

select * from finish();
rollback;
