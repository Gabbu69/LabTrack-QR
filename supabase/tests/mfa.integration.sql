begin;

create function pg_temp.check_mfa(condition boolean, message text)
returns void language plpgsql as $$ begin
  if not coalesce(condition, false) then raise exception 'MFA TEST FAILED: %', message; end if;
end; $$;
create function pg_temp.expect_mfa_denied(statement text)
returns void language plpgsql as $$ begin
  begin
    execute statement;
    raise exception 'MFA TEST FAILED: access was allowed: %', statement;
  exception when insufficient_privilege then null;
  end;
end; $$;

insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
('d0000000-0000-4000-8000-000000000001','mfa-custodian@test.invalid','{"full_name":"MFA Custodian"}','{"labtrack_staff_role":"custodian"}'),
('d0000000-0000-4000-8000-000000000002','mfa-instructor@test.invalid','{"full_name":"MFA Instructor"}','{"labtrack_staff_role":"instructor"}'),
('d0000000-0000-4000-8000-000000000003','mfa-student@test.invalid','{"full_name":"MFA Student","student_id":"MFA-1","data_scope":"demo","aal":"aal2"}','{}'),
('d0000000-0000-4000-8000-000000000004','mfa-demo-custodian@test.invalid','{"full_name":"MFA Demo Custodian"}','{"labtrack_staff_role":"custodian","labtrack_data_scope":"demo"}'),
('d0000000-0000-4000-8000-000000000005','mfa-demo-student@test.invalid','{"full_name":"MFA Demo Student","student_id":"MFA-DEMO-1"}','{"labtrack_data_scope":"demo"}');
update public.profiles set status='active', must_change_password=false where id::text like 'd0000000-%';
insert into public.tools(id,asset_code,tool_name,category,status,creation_batch_id,data_scope,created_by) values
('d1000000-0000-4000-8000-000000000001','MFA-001','MFA Operational Tool','Testing','borrowed',gen_random_uuid(),'operational','d0000000-0000-4000-8000-000000000001'),
('d1000000-0000-4000-8000-000000000002','MFA-001','MFA Demo Tool','Testing','borrowed',gen_random_uuid(),'demo','d0000000-0000-4000-8000-000000000004');
insert into public.transactions(id,borrower_id,processed_by,borrower_name_snapshot,borrower_student_id_snapshot,data_scope) values
('d2000000-0000-4000-8000-000000000001','d0000000-0000-4000-8000-000000000003','d0000000-0000-4000-8000-000000000001','MFA Student','MFA-1','operational'),
('d2000000-0000-4000-8000-000000000002','d0000000-0000-4000-8000-000000000005','d0000000-0000-4000-8000-000000000004','MFA Demo Student','MFA-DEMO-1','demo');
insert into public.transaction_items(id,transaction_id,tool_id,tool_name_snapshot,asset_code_snapshot,issue_condition) values
('d3000000-0000-4000-8000-000000000001','d2000000-0000-4000-8000-000000000001','d1000000-0000-4000-8000-000000000001','MFA Operational Tool','MFA-001','good'),
('d3000000-0000-4000-8000-000000000002','d2000000-0000-4000-8000-000000000002','d1000000-0000-4000-8000-000000000002','MFA Demo Tool','MFA-001','good');
insert into storage.objects(bucket_id,name) values
('profile-photos','d0000000-0000-4000-8000-000000000001/photo.png'),
('profile-photos','d0000000-0000-4000-8000-000000000003/photo.png'),
('profile-photos','d0000000-0000-4000-8000-000000000005/photo.png');

select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
set local role authenticated;
select pg_temp.check_mfa(not private.has_required_mfa(), 'operational password-only session needs MFA');
select pg_temp.check_mfa((select count(*)=1 from public.profiles), 'password-only session can read only its identity');
select pg_temp.check_mfa((private.current_profile()).id='d0000000-0000-4000-8000-000000000001', 'own identity remains available for setup');
select pg_temp.check_mfa((select count(*)=0 from public.tools), 'password-only custodian cannot read inventory');
select pg_temp.check_mfa((select count(*)=0 from public.transactions), 'password-only custodian cannot read transactions');
select pg_temp.check_mfa((select count(*)=0 from public.transaction_items), 'password-only custodian cannot read items');
select pg_temp.check_mfa((select count(*)=0 from storage.objects), 'password-only session cannot read photos');
select pg_temp.check_mfa(not private.is_active_staff_for_scope('operational') and not private.is_active_custodian_for_scope('operational') and not private.is_current_profile_active(), 'all access helpers require MFA');
select pg_temp.expect_mfa_denied('select public.dashboard_summary()');

-- Check both PostgREST entrypoints and their separately granted implementations.
select pg_temp.expect_mfa_denied('select public.create_tool_batch(''Forbidden'','''',''Testing'',1,''NO'',''good'')');
select pg_temp.expect_mfa_denied('select private.create_tool_batch_impl(''Forbidden'','''',''Testing'',1,''NO'',''good'')');
select pg_temp.expect_mfa_denied('select public.borrow_tools(gen_random_uuid(),array[gen_random_uuid()])');
select pg_temp.expect_mfa_denied('select private.borrow_tools_impl(gen_random_uuid(),array[gen_random_uuid()])');
select pg_temp.expect_mfa_denied('select public.return_tools(gen_random_uuid(),''[]'')');
select pg_temp.expect_mfa_denied('select private.return_tools_impl(gen_random_uuid(),''[]'')');
select pg_temp.expect_mfa_denied('select public.mark_items_missing(array[gen_random_uuid()],''Missing'')');
select pg_temp.expect_mfa_denied('select private.mark_items_missing_impl(array[gen_random_uuid()],''Missing'')');
select pg_temp.expect_mfa_denied('select public.update_tool(gen_random_uuid(),''Forbidden'','''',''Testing'',''good'',''available'')');
select pg_temp.expect_mfa_denied('select private.update_tool_impl(gen_random_uuid(),''Forbidden'','''',''Testing'',''good'',''available'')');
select pg_temp.expect_mfa_denied('select public.delete_unused_tool(gen_random_uuid())');
select pg_temp.expect_mfa_denied('select private.delete_unused_tool_impl(gen_random_uuid())');
select pg_temp.expect_mfa_denied('select public.set_profile_status(gen_random_uuid(),''active'')');
select pg_temp.expect_mfa_denied('select private.set_profile_status_impl(gen_random_uuid(),''active'')');
select pg_temp.expect_mfa_denied('select public.reset_demo_records()');
select pg_temp.expect_mfa_denied('select private.reset_demo_records_impl()');
select pg_temp.expect_mfa_denied('select public.update_my_profile(''Forbidden'',null,null,null,null)');
select pg_temp.expect_mfa_denied('select private.update_my_profile_impl(''Forbidden'',null,null,null,null)');
select pg_temp.expect_mfa_denied('insert into storage.objects(bucket_id,name) values(''profile-photos'',''d0000000-0000-4000-8000-000000000001/forbidden.png'')');
with changed as (
  update storage.objects set name=name||'.forbidden' where name like 'd0000000-0000-4000-8000-000000000001/%' returning id
) select pg_temp.check_mfa((select count(*)=0 from changed), 'password-only session cannot update its photo');
with removed as (
  delete from storage.objects where name like 'd0000000-0000-4000-8000-000000000001/%' returning id
) select pg_temp.check_mfa((select count(*)=0 from removed), 'password-only session cannot delete its photo');
select pg_temp.check_mfa(not has_function_privilege('anon','private.has_required_mfa()','execute'), 'anonymous callers cannot invoke the assurance helper');
select pg_temp.check_mfa(not has_function_privilege('authenticated','private.require_custodian()','execute'), 'custodian identity helper is not a direct mutation bypass');
select pg_temp.check_mfa(not has_function_privilege('authenticated','private.refresh_transaction_statuses(uuid[])','execute'), 'unguarded internal refresh cannot be called directly');
select pg_temp.check_mfa(not has_table_privilege('authenticated','public.profiles','update'), 'users cannot update their trusted demo scope');

select set_config('request.jwt.claims','{}',true);
select pg_temp.check_mfa(not private.has_required_mfa(), 'missing assurance claim fails closed');
select set_config('request.jwt.claims','{"aal":"unexpected"}',true);
select pg_temp.check_mfa(not private.has_required_mfa(), 'unknown assurance claim fails closed');
select set_config('request.jwt.claims','{"aal":"aal1","user_metadata":{"data_scope":"demo","aal":"aal2"}}',true);
select pg_temp.check_mfa(not private.has_required_mfa(), 'editable metadata is not an MFA or demo exemption');

select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select pg_temp.check_mfa(private.has_required_mfa(), 'verified operational custodian passes MFA gate');
select pg_temp.check_mfa((select count(*)=1 from public.tools), 'verified custodian reads only operational inventory');
select pg_temp.check_mfa((select count(*)=1 from public.transactions), 'verified custodian reads only operational transactions');
select pg_temp.check_mfa((select count(*)=1 from public.transaction_items), 'verified custodian reads only operational items');
select pg_temp.check_mfa((select count(*)=3 from public.profiles), 'verified custodian reads only operational profiles');
select pg_temp.check_mfa((select count(*)=2 from storage.objects), 'verified custodian reads only operational photos');
select pg_temp.check_mfa((public.dashboard_summary()->'metrics'->>'total')::integer=1, 'verified dashboard preserves scope RLS');
select pg_temp.check_mfa((select count(*)=1 from public.create_tool_batch('Verified Tool','','Testing',1,'OK','good')), 'verified operational writes succeed');
select pg_temp.expect_mfa_denied('select public.set_profile_status(''d0000000-0000-4000-8000-000000000005'',''active'')');
select pg_temp.expect_mfa_denied('select public.update_tool(''d1000000-0000-4000-8000-000000000002'',''Forbidden'','''',''Testing'',''good'',''borrowed'')');

select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000003',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select pg_temp.check_mfa((private.current_profile()).data_scope='operational', 'student signup cannot claim the demo scope');
select pg_temp.check_mfa(not private.has_required_mfa(), 'operational student also needs MFA');
select pg_temp.check_mfa((select count(*)=0 from public.transactions), 'password-only student cannot read own transactions');
select pg_temp.check_mfa((select count(*)=0 from public.transaction_items), 'password-only student cannot read own items');
select pg_temp.check_mfa((select count(*)=0 from storage.objects), 'password-only student cannot read own photo');
select pg_temp.expect_mfa_denied('select public.update_my_profile(''Forbidden'',''MFA-1'',null,null,null)');
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select pg_temp.check_mfa((select count(*)=1 from public.transactions), 'verified student reads own transaction');
select pg_temp.check_mfa((select count(*)=1 from public.transaction_items), 'verified student reads own item');
select pg_temp.check_mfa((select count(*)=1 from storage.objects), 'verified student reads only own photo');
select pg_temp.check_mfa((select count(*)=0 from public.tools), 'verified student does not become staff');
select pg_temp.check_mfa((public.update_my_profile('MFA Student Updated','MFA-1',null,null,null)).full_name='MFA Student Updated', 'verified profile update succeeds');
select pg_temp.check_mfa((public.dashboard_summary()->'student'->>'transactions')::integer=1, 'verified student dashboard retains own records');
select pg_temp.expect_mfa_denied('select public.create_tool_batch(''Forbidden'','''',''Testing'',1,''NO'',''good'')');

select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select pg_temp.check_mfa((select count(*)=0 from public.tools), 'password-only instructor cannot read inventory');
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
select pg_temp.check_mfa((select count(*)=2 from public.tools), 'verified instructor keeps staff read access');
select pg_temp.expect_mfa_denied('select public.create_tool_batch(''Forbidden'','''',''Testing'',1,''NO'',''good'')');

select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000004',true);
select set_config('request.jwt.claims','{"aal":"aal1"}',true);
select pg_temp.check_mfa(private.has_required_mfa(), 'trusted demo profile is exempt');
select pg_temp.check_mfa((select count(*)=1 from public.tools), 'demo password-only custodian sees only demo inventory');
select pg_temp.check_mfa((select count(*)=1 from public.transactions), 'demo cannot read operational transactions');
select pg_temp.check_mfa((public.dashboard_summary()->'metrics'->>'total')::integer=1, 'demo aggregate stays isolated');
select pg_temp.check_mfa((select count(*)=1 from public.create_tool_batch('Demo Tool','','Testing',1,'DM','good')), 'demo write remains usable without MFA');
select pg_temp.expect_mfa_denied('select public.set_profile_status(''d0000000-0000-4000-8000-000000000003'',''active'')');
select pg_temp.expect_mfa_denied('select public.update_tool(''d1000000-0000-4000-8000-000000000001'',''Forbidden'','''',''Testing'',''good'',''borrowed'')');
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000005',true);
select pg_temp.check_mfa((select count(*)=1 from public.transactions), 'demo student exemption is limited to own demo transaction');
select pg_temp.check_mfa((select count(*)=1 from storage.objects), 'demo student exemption is limited to own photo');

-- MFA does not waive a forced password change, approval, or a disabled account.
set local role postgres;
update public.profiles set must_change_password=true where id='d0000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal2"}',true);
set local role authenticated;
select pg_temp.check_mfa((select count(*)=1 from public.profiles), 'forced password change retains identity access after MFA');
select pg_temp.check_mfa((select count(*)=0 from public.tools), 'MFA does not bypass forced password change');
select pg_temp.expect_mfa_denied('select public.create_tool_batch(''Forbidden'','''',''Testing'',1,''NO'',''good'')');
select pg_temp.expect_mfa_denied('select public.complete_password_change()');
set local role postgres;
update public.profiles set status='disabled' where id='d0000000-0000-4000-8000-000000000002';
update public.profiles set status='pending' where id='d0000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.check_mfa((select count(*)=0 from public.tools), 'MFA does not restore disabled staff access');
select set_config('request.jwt.claim.sub','d0000000-0000-4000-8000-000000000003',true);
select pg_temp.check_mfa((select count(*)=0 from public.transactions), 'MFA does not approve a pending student');
select set_config('request.jwt.claim.sub','',true);
select pg_temp.check_mfa(not private.has_required_mfa(), 'assurance without an authenticated identity is insufficient');
select pg_temp.expect_mfa_denied('select public.dashboard_summary()');

rollback;
