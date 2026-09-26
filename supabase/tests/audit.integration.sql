begin;
create function pg_temp.check_audit(condition boolean, message text)
returns void language plpgsql as $$ begin
  if not coalesce(condition, false) then raise exception 'AUDIT TEST FAILED: %', message; end if;
end; $$;

insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
('b0000000-0000-4000-8000-000000000001','audit-custodian@test.invalid','{"full_name":"Audit Custodian"}','{"labtrack_staff_role":"custodian","labtrack_data_scope":"demo"}'),
('b0000000-0000-4000-8000-000000000002','audit-student@test.invalid','{"full_name":"Audit Student","student_id":"AUDIT-1","role":"custodian","status":"active","data_scope":"demo"}','{}'),
('b0000000-0000-4000-8000-000000000003','audit-instructor@test.invalid','{"full_name":"Audit Instructor"}','{"labtrack_staff_role":"instructor","labtrack_data_scope":"demo"}');
select pg_temp.check_audit((select role='student' and status='pending' and data_scope='operational' from public.profiles where id='b0000000-0000-4000-8000-000000000002'), 'signup metadata must not grant staff, approval or demo scope');
select pg_temp.check_audit(not has_table_privilege('anon','public.tools','select'), 'anonymous inventory denied');
select pg_temp.check_audit(not has_function_privilege('authenticated','public.complete_password_change()','execute'), 'public password completion revoked');
select pg_temp.check_audit(not has_function_privilege('authenticated','private.complete_password_change_impl()','execute'), 'private password completion revoked');
insert into public.tools(asset_code,tool_name,category,creation_batch_id,data_scope,created_by)
select 'AUD-'||lpad(n::text,4,'0'), 'Audit Tool '||n, 'Testing',gen_random_uuid(),'demo','b0000000-0000-4000-8000-000000000001' from generate_series(1,1205) n;
insert into storage.objects(bucket_id,name) values ('profile-photos','b0000000-0000-4000-8000-000000000001/photo.png');

select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select pg_temp.check_audit((select count(*)=0 from public.tools), 'temporary custodian cannot read tools');
select pg_temp.check_audit((select count(*)=1 from public.profiles), 'temporary custodian can only read own profile');
select pg_temp.check_audit((select count(*)=0 from storage.objects), 'temporary custodian cannot read photos');
do $$ begin
  begin perform public.create_tool_batch('Forbidden','','Testing',1,'NO','good'); raise exception 'AUDIT TEST FAILED: temporary password write';
  exception when insufficient_privilege then null; end;
  begin perform public.complete_password_change(); raise exception 'AUDIT TEST FAILED: public completion bypass';
  exception when insufficient_privilege then null; end;
  begin perform private.complete_password_change_impl(); raise exception 'AUDIT TEST FAILED: private completion bypass';
  exception when insufficient_privilege then null; end;
  begin perform public.update_my_profile('Forbidden',null,null,null,null); raise exception 'AUDIT TEST FAILED: temporary profile write';
  exception when insufficient_privilege then null; end;
end; $$;
set local role postgres;
update public.profiles set must_change_password=false where id in ('b0000000-0000-4000-8000-000000000001','b0000000-0000-4000-8000-000000000003');
set local role authenticated;
select pg_temp.check_audit((public.dashboard_summary()->'metrics'->>'total')::integer=1205, 'dashboard totals exceed response row cap');
select pg_temp.check_audit((select count(*)=5 from (select id from public.tools order by asset_code offset 1200 limit 50) t), 'last inventory page preserves records beyond 1000');
select pg_temp.check_audit((select count(*)=1 from public.tools where tool_name ilike '%1205%'), 'database search reaches records beyond 1000');

set local role postgres;
update public.profiles set status='disabled' where id='b0000000-0000-4000-8000-000000000003';
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000003',true);
set local role authenticated;
select pg_temp.check_audit((select count(*)=0 from public.tools), 'disabled instructor cannot read inventory');
set local role postgres;
select set_config('request.jwt.claim.sub','b0000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select pg_temp.check_audit((select count(*)=0 from public.tools), 'pending student cannot read inventory');
select pg_temp.check_audit((select count(*)=0 from storage.objects), 'student cannot read another profile photo');
set local role postgres;
-- A second server cannot acquire or clear another server's password lease.
update public.profiles set password_operation_id='c0000000-0000-4000-8000-000000000001',must_change_password=true where id='b0000000-0000-4000-8000-000000000003' and password_operation_id is null;
with attempt as (update public.profiles set password_operation_id=gen_random_uuid() where id='b0000000-0000-4000-8000-000000000003' and password_operation_id is null returning id)
select pg_temp.check_audit((select count(*)=0 from attempt),'password lease rejects concurrent update');
with attempt as (update public.profiles set must_change_password=false where id='b0000000-0000-4000-8000-000000000003' and password_operation_id='c0000000-0000-4000-8000-000000000002' returning id)
select pg_temp.check_audit((select count(*)=0 from attempt),'foreign operation cannot clear restriction');
delete from auth.users where id='b0000000-0000-4000-8000-000000000002';
select pg_temp.check_audit(not exists(select 1 from public.profiles where id='b0000000-0000-4000-8000-000000000002'),'auth deletion removes pending profile');
rollback;
