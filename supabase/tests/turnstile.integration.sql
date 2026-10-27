begin;
create function pg_temp.check_turnstile(condition boolean, message text)
returns void language plpgsql as $$ begin if condition is distinct from true then raise exception '%', message; end if; end $$;

insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
('e0000000-0000-4000-8000-000000000001','turnstile-custodian@test.invalid','{"full_name":"Turnstile Custodian"}','{"labtrack_staff_role":"custodian"}'),
('e0000000-0000-4000-8000-000000000002','turnstile-student@test.invalid','{"full_name":"Turnstile Student","student_id":"TS-1"}','{}');
update public.profiles set status='active',must_change_password=false where id::text like 'e0000000-%';
insert into auth.sessions(id,user_id) values
('e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001'),
('e1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001'),
('e1000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000002');
insert into public.tools(asset_code,tool_name,category,creation_batch_id,data_scope,created_by)
values('TS-001','Turnstile Tool','Testing',gen_random_uuid(),'operational','e0000000-0000-4000-8000-000000000001');
select pg_temp.check_turnstile(not has_function_privilege('authenticated','public.record_turnstile_verification(uuid,uuid,timestamptz)','execute'), 'client cannot attest its own verification');
select pg_temp.check_turnstile(not has_table_privilege('authenticated','private.turnstile_sessions','insert'), 'client cannot insert a grant');
select pg_temp.check_turnstile(not has_function_privilege('anon','public.turnstile_verified()','execute'), 'anonymous verification lookup denied');
set local role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000001","user_metadata":{"turnstile_verified":true}}',true);
select pg_temp.check_turnstile(not public.turnstile_verified() and not private.has_required_mfa(), 'password-only and editable metadata fail closed');
select pg_temp.check_turnstile((select count(*)=0 from public.tools), 'password-only direct database read denied');
reset role;
set local role service_role;
select public.record_turnstile_verification('e0000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000001',now()+interval '1 hour');
reset role;
set local role authenticated;
select pg_temp.check_turnstile(public.turnstile_verified() and private.has_required_mfa(), 'server-attested password plus Turnstile permits AAL1 access');
select pg_temp.check_turnstile((select count(*)=1 from public.tools), 'verified custodian can read operational inventory');
select pg_temp.check_turnstile((select count(*)=1 from public.create_tool_batch('Verified Tool','','Testing',1,'TS','good')), 'verified custodian can use guarded RPC');
select set_config('request.jwt.claims','{"aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000002"}',true);
select pg_temp.check_turnstile(not public.turnstile_verified(), 'grant does not authorize another session of the same user');
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000001"}',true);
select pg_temp.check_turnstile(not public.turnstile_verified(), 'grant does not authorize a different user');
reset role;
update public.profiles set must_change_password=true where id='e0000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
select pg_temp.check_turnstile((select count(*)=0 from public.tools), 'Turnstile cannot bypass mandatory password change');
reset role;
update public.profiles set must_change_password=false,status='disabled' where id='e0000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.check_turnstile(not public.turnstile_verified(), 'disabled accounts lose verification access');
reset role;
update public.profiles set status='active' where id='e0000000-0000-4000-8000-000000000001';
update private.turnstile_sessions set verified_at=now()-interval '2 hours',expires_at=now()-interval '1 hour';
set local role authenticated;
select pg_temp.check_turnstile(not public.turnstile_verified(), 'expired grants fail closed');
reset role;
update private.turnstile_sessions set verified_at=now(),expires_at=now()+interval '1 hour';
delete from auth.sessions where id='e1000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.check_turnstile(not public.turnstile_verified(), 'revoked provider session cannot reuse a grant');
rollback;
