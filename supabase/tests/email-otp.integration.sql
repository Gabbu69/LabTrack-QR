begin;
create function pg_temp.check_email(condition boolean, message text)
returns void language plpgsql as $$ begin
  if not coalesce(condition,false) then raise exception 'EMAIL OTP TEST FAILED: %', message; end if;
end; $$;
create function pg_temp.email_denied(statement text)
returns void language plpgsql as $$ begin
  begin
    execute statement;
    raise exception 'EMAIL OTP TEST FAILED: access allowed: %', statement;
  exception when insufficient_privilege then null;
  end;
end; $$;

insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values
('e0000000-0000-4000-8000-000000000001','email-student@test.invalid','{"full_name":"Email Student","student_id":"EMAIL-1","email_otp_verified":true}','{}'),
('e0000000-0000-4000-8000-000000000002','email-other@test.invalid','{"full_name":"Other Student","student_id":"EMAIL-2"}','{}');
update public.profiles set status='active',must_change_password=false where id::text like 'e0000000-%';
insert into auth.sessions(id,user_id) values
('e1000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001'),
('e1000000-0000-4000-8000-000000000002','e0000000-0000-4000-8000-000000000001'),
('e1000000-0000-4000-8000-000000000003','e0000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);
select set_config('request.jwt.claims','{"aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000001","user_metadata":{"email_otp_verified":true}}',true);
set local role authenticated;
select pg_temp.check_email(not public.email_otp_verified() and not private.has_required_mfa(), 'password and editable metadata cannot authorize access');
select pg_temp.email_denied('select public.dashboard_summary()');
select pg_temp.email_denied('select public.record_email_otp_verification(''e0000000-0000-4000-8000-000000000001'',''e1000000-0000-4000-8000-000000000002'',''e1000000-0000-4000-8000-000000000001'',now()+interval ''1 hour'')');
select pg_temp.email_denied('select * from private.email_otp_sessions');
select pg_temp.check_email(not has_function_privilege('anon','public.record_email_otp_verification(uuid,uuid,uuid,timestamptz)','execute'), 'anonymous callers cannot grant email proof');

set local role service_role;
select public.record_email_otp_verification('e0000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001',now()+interval '1 hour');
select pg_temp.email_denied('select public.record_email_otp_verification(''e0000000-0000-4000-8000-000000000001'',''e1000000-0000-4000-8000-000000000002'',''e1000000-0000-4000-8000-000000000003'',now()+interval ''1 hour'')');
select pg_temp.email_denied('select public.record_email_otp_verification(''e0000000-0000-4000-8000-000000000001'',''e1000000-0000-4000-8000-000000000002'',''e1000000-0000-4000-8000-000000000002'',now()+interval ''9 hours'')');
select pg_temp.email_denied('select public.record_email_otp_verification(''e0000000-0000-4000-8000-000000000001'',''e1000000-0000-4000-8000-000000000002'',''e1000000-0000-4000-8000-000000000002'',now()-interval ''1 minute'')');
select public.record_email_otp_verification('e0000000-0000-4000-8000-000000000001','e1000000-0000-4000-8000-000000000002','e1000000-0000-4000-8000-000000000001',now()+interval '2 hours');
set local role postgres;
select pg_temp.check_email((select expires_at=now()+interval '1 hour' from private.email_otp_sessions where session_id='e1000000-0000-4000-8000-000000000001'), 'repeated attestation never extends the session deadline');

set local role authenticated;
select pg_temp.check_email(public.email_otp_verified() and private.has_required_mfa(), 'server-attested current session passes RLS assurance');
select pg_temp.check_email((public.update_my_profile('Email Verified','EMAIL-1',null,null,null)).full_name='Email Verified', 'verified email session can update its own profile');
select pg_temp.email_denied('select public.create_tool_batch(''Forbidden'','''',''Testing'',1,''NO'',''good'')');
select set_config('request.jwt.claims','{"aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000002"}',true);
select pg_temp.check_email(not public.email_otp_verified() and not private.has_required_mfa(), 'verification does not carry over to another sign-in');
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000002',true);
select set_config('request.jwt.claims','{"aal":"aal1","session_id":"e1000000-0000-4000-8000-000000000001"}',true);
select pg_temp.check_email(not public.email_otp_verified(), 'another user cannot reuse a verified session id');
select set_config('request.jwt.claim.sub','e0000000-0000-4000-8000-000000000001',true);

set local role postgres;
insert into auth.mfa_factors(id,user_id,status) values ('e2000000-0000-4000-8000-000000000001','e0000000-0000-4000-8000-000000000001','verified');
set local role authenticated;
select pg_temp.check_email(not public.email_otp_verified() and not private.has_required_mfa(), 'enrolling an authenticator prevents an email downgrade');
set local role service_role;
select pg_temp.email_denied('select public.record_email_otp_verification(''e0000000-0000-4000-8000-000000000001'',''e1000000-0000-4000-8000-000000000002'',''e1000000-0000-4000-8000-000000000002'',now()+interval ''1 hour'')');
set local role postgres;
delete from auth.mfa_factors where id='e2000000-0000-4000-8000-000000000001';
update public.profiles set status='pending' where id='e0000000-0000-4000-8000-000000000001';
set local role authenticated;
select pg_temp.check_email(public.email_otp_verified() and not private.is_current_profile_active(), 'email proof does not waive custodian approval');
set local role postgres;
update public.profiles set status='disabled' where id='e0000000-0000-4000-8000-000000000001';
set local role service_role;
select pg_temp.email_denied('select public.record_email_otp_verification(''e0000000-0000-4000-8000-000000000001'',''e1000000-0000-4000-8000-000000000002'',''e1000000-0000-4000-8000-000000000002'',now()+interval ''1 hour'')');
set local role authenticated;
select pg_temp.check_email(not private.is_current_profile_active(), 'disabled accounts remain denied');
set local role postgres;
update private.email_otp_sessions set verified_at=now()-interval '2 hours',expires_at=now()-interval '1 hour';
set local role authenticated;
select pg_temp.check_email(not public.email_otp_verified(), 'expired verification fails closed');
set local role postgres;
delete from auth.sessions where id='e1000000-0000-4000-8000-000000000001';
select pg_temp.check_email((select count(*)=0 from private.email_otp_sessions), 'provider session deletion revokes its email proof');
rollback;
