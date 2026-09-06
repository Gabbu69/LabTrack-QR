begin;

create function pg_temp.assert_true(condition boolean, message text)
returns void language plpgsql as $$
begin
  if not coalesce(condition, false) then
    raise exception 'TEST FAILED: %', message;
  end if;
end;
$$;

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data)
values
  ('01000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'workflow-custodian@test.invalid', crypt('password', gen_salt('bf')), now(), '{"full_name":"Workflow Custodian"}', '{"labtrack_staff_role":"custodian","labtrack_data_scope":"operational"}'),
  ('01000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'workflow-instructor@test.invalid', crypt('password', gen_salt('bf')), now(), '{"full_name":"Workflow Instructor"}', '{"labtrack_staff_role":"instructor","labtrack_data_scope":"operational"}'),
  ('01000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'workflow-student@test.invalid', crypt('password', gen_salt('bf')), now(), '{"full_name":"Workflow Student","student_id":"WF-001","year_section":"2-AMT","group_number":"1"}', '{}'),
  ('01000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'pending-student@test.invalid', crypt('password', gen_salt('bf')), now(), '{"full_name":"Pending Student","student_id":"WF-002","year_section":"2-AMT","group_number":"2"}', '{}'),
  ('01000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-student@test.invalid', crypt('password', gen_salt('bf')), now(), '{"full_name":"Other Student","student_id":"WF-003","year_section":"2-AMT","group_number":"3"}', '{}'),
  ('01000000-0000-4000-8000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'workflow-demo-custodian@test.invalid', crypt('password', gen_salt('bf')), now(), '{"full_name":"Demo Custodian"}', '{"labtrack_staff_role":"custodian","labtrack_data_scope":"demo"}'),
  ('01000000-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'workflow-demo-student@test.invalid', crypt('password', gen_salt('bf')), now(), '{"full_name":"Demo Student","student_id":"DEMO-WF-001","year_section":"2-AMT","group_number":"1"}', '{"labtrack_data_scope":"demo"}');

update public.profiles
set status = 'active'
where id in (
  '01000000-0000-4000-8000-000000000003',
  '01000000-0000-4000-8000-000000000005',
  '01000000-0000-4000-8000-000000000007'
);

insert into public.tools (
  id, asset_code, tool_name, description, category, condition, status,
  qr_token, creation_batch_id, data_scope, created_by, archived_at
)
values
  ('11000000-0000-4000-8000-000000000001', 'WFT-001', 'Workflow Meter', '', 'Testing', 'good', 'available', '21000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000001', 'operational', '01000000-0000-4000-8000-000000000001', null),
  ('11000000-0000-4000-8000-000000000002', 'WFT-002', 'Workflow Driver', '', 'Testing', 'fair', 'available', '21000000-0000-4000-8000-000000000002', '31000000-0000-4000-8000-000000000001', 'operational', '01000000-0000-4000-8000-000000000001', null),
  ('11000000-0000-4000-8000-000000000003', 'WFT-003', 'Workflow Pliers', '', 'Testing', 'good', 'available', '21000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000001', 'operational', '01000000-0000-4000-8000-000000000001', null),
  ('11000000-0000-4000-8000-000000000004', 'WFT-004', 'Workflow Crimper', '', 'Testing', 'good', 'available', '21000000-0000-4000-8000-000000000004', '31000000-0000-4000-8000-000000000001', 'operational', '01000000-0000-4000-8000-000000000001', null),
  ('11000000-0000-4000-8000-000000000005', 'WFT-005', 'Archived Tool', '', 'Testing', 'good', 'archived', '21000000-0000-4000-8000-000000000005', '31000000-0000-4000-8000-000000000001', 'operational', '01000000-0000-4000-8000-000000000001', now()),
  ('11000000-0000-4000-8000-000000000006', 'WFT-006', 'Damaged Tool', '', 'Testing', 'damaged', 'unavailable', '21000000-0000-4000-8000-000000000006', '31000000-0000-4000-8000-000000000001', 'operational', '01000000-0000-4000-8000-000000000001', null),
  ('11000000-0000-4000-8000-000000000007', 'DMW-001', 'Demo Tool', '', 'Testing', 'good', 'available', '21000000-0000-4000-8000-000000000007', '31000000-0000-4000-8000-000000000002', 'demo', '01000000-0000-4000-8000-000000000006', null);

select set_config('request.jwt.claim.sub', '01000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
declare
  borrower_token uuid;
  pending_token uuid;
  first_tx uuid;
  second_tx uuid;
  third_tx uuid;
  missing_time timestamptz;
  batch_codes text[];
begin
  select qr_token into borrower_token from public.profiles where id = '01000000-0000-4000-8000-000000000003';
  select qr_token into pending_token from public.profiles where id = '01000000-0000-4000-8000-000000000004';

  select array_agg(asset_code order by asset_code) into batch_codes
  from public.create_tool_batch('Kit Tool', '', 'Testing', 2, 'KIT', 'good');
  perform pg_temp.assert_true(batch_codes = array['KIT-001', 'KIT-002'], 'first batch must start at 001');
  select array_agg(asset_code order by asset_code) into batch_codes
  from public.create_tool_batch('Kit Tool', '', 'Testing', 1, 'KIT', 'good');
  perform pg_temp.assert_true(batch_codes = array['KIT-003'], 'asset counter must advance without collision');

  begin
    perform public.borrow_tools(pending_token, array['21000000-0000-4000-8000-000000000003'::uuid]);
    raise exception 'TEST FAILED: pending borrower was accepted';
  exception when others then
    if sqlerrm = 'TEST FAILED: pending borrower was accepted' then raise; end if;
  end;

  begin
    perform public.borrow_tools(borrower_token, array['21000000-0000-4000-8000-000000000003'::uuid, '21000000-0000-4000-8000-000000000003'::uuid]);
    raise exception 'TEST FAILED: duplicate scans were accepted';
  exception when others then
    if sqlerrm = 'TEST FAILED: duplicate scans were accepted' then raise; end if;
  end;

  begin
    perform public.borrow_tools(borrower_token, array['21000000-0000-4000-8000-000000000003'::uuid, '29999999-0000-4000-8000-000000000099'::uuid]);
    raise exception 'TEST FAILED: unknown tool was accepted';
  exception when others then
    if sqlerrm = 'TEST FAILED: unknown tool was accepted' then raise; end if;
  end;
  perform pg_temp.assert_true((select status = 'available' from public.tools where asset_code = 'WFT-003'), 'unknown-tool failure must be atomic');

  begin
    perform public.borrow_tools(borrower_token, array['21000000-0000-4000-8000-000000000003'::uuid, '21000000-0000-4000-8000-000000000007'::uuid]);
    raise exception 'TEST FAILED: mixed-scope tool was accepted';
  exception when others then
    if sqlerrm = 'TEST FAILED: mixed-scope tool was accepted' then raise; end if;
  end;
  perform pg_temp.assert_true((select status = 'available' from public.tools where asset_code = 'WFT-003'), 'mixed-scope failure must be atomic');

  begin
    perform public.borrow_tools(borrower_token, array['21000000-0000-4000-8000-000000000005'::uuid]);
    raise exception 'TEST FAILED: archived tool was accepted';
  exception when others then
    if sqlerrm = 'TEST FAILED: archived tool was accepted' then raise; end if;
  end;

  begin
    perform public.borrow_tools(borrower_token, array['21000000-0000-4000-8000-000000000006'::uuid]);
    raise exception 'TEST FAILED: damaged tool was accepted';
  exception when others then
    if sqlerrm = 'TEST FAILED: damaged tool was accepted' then raise; end if;
  end;

  first_tx := public.borrow_tools(borrower_token, array['21000000-0000-4000-8000-000000000001'::uuid, '21000000-0000-4000-8000-000000000002'::uuid]);
  perform pg_temp.assert_true((select count(*) = 2 from public.transaction_items where transaction_id = first_tx and item_status = 'borrowed'), 'borrow must create two custody items');
  perform pg_temp.assert_true((select count(*) = 2 from public.tools where asset_code in ('WFT-001', 'WFT-002') and status = 'borrowed'), 'borrow must mark every tool borrowed');

  begin
    perform public.borrow_tools(borrower_token, array['21000000-0000-4000-8000-000000000001'::uuid, '21000000-0000-4000-8000-000000000003'::uuid]);
    raise exception 'TEST FAILED: already-borrowed tool was accepted';
  exception when others then
    if sqlerrm = 'TEST FAILED: already-borrowed tool was accepted' then raise; end if;
  end;
  perform pg_temp.assert_true((select status = 'available' from public.tools where asset_code = 'WFT-003'), 'unavailable checkout failure must be atomic');

  perform public.return_tools(borrower_token, '[{"tool_token":"21000000-0000-4000-8000-000000000001","condition":"good","unavailable":false}]'::jsonb);
  perform pg_temp.assert_true((select status = 'partial' from public.transactions where id = first_tx), 'one-of-two return must be partial');
  perform pg_temp.assert_true((select status = 'available' from public.tools where asset_code = 'WFT-001'), 'returned good tool must become available');

  perform public.mark_items_missing(array[(select id from public.transaction_items where transaction_id = first_tx and asset_code_snapshot = 'WFT-002')], 'Not found during reconciliation');
  select missing_at into missing_time from public.transaction_items where transaction_id = first_tx and asset_code_snapshot = 'WFT-002';
  perform pg_temp.assert_true(missing_time is not null, 'missing action must retain a timestamp');
  perform pg_temp.assert_true((select status = 'incomplete' from public.transactions where id = first_tx), 'missing item must make transaction incomplete');
  perform pg_temp.assert_true((select status = 'missing' from public.tools where asset_code = 'WFT-002'), 'missing item must mark tool missing');

  perform public.return_tools(borrower_token, '[{"tool_token":"21000000-0000-4000-8000-000000000002","condition":"damaged","note":"Handle cracked","unavailable":true}]'::jsonb);
  perform pg_temp.assert_true((select status = 'returned' and completed_at is not null from public.transactions where id = first_tx), 'late-found final item must complete transaction');
  perform pg_temp.assert_true((select item_status = 'returned' and missing_at = missing_time from public.transaction_items where transaction_id = first_tx and asset_code_snapshot = 'WFT-002'), 'late-found item must preserve original missing timestamp');
  perform pg_temp.assert_true((select condition = 'damaged' and status = 'unavailable' from public.tools where asset_code = 'WFT-002'), 'damaged return must remain unavailable');

  second_tx := public.borrow_tools(borrower_token, array['21000000-0000-4000-8000-000000000003'::uuid]);
  perform public.return_tools(borrower_token, '[{"tool_token":"21000000-0000-4000-8000-000000000003","condition":"good","unavailable":false}]'::jsonb);
  perform pg_temp.assert_true((select status = 'returned' from public.transactions where id = second_tx), 'complete return must close transaction');

  second_tx := public.borrow_tools(borrower_token, array[(select qr_token from public.tools where asset_code = 'KIT-001')]);
  third_tx := public.borrow_tools(borrower_token, array[(select qr_token from public.tools where asset_code = 'KIT-002')]);
  perform pg_temp.assert_true((select count(*) = 2 from public.transactions where id in (second_tx, third_tx) and status = 'borrowed'), 'student may have multiple active transactions');
  perform public.return_tools(borrower_token, jsonb_build_array(
    jsonb_build_object('tool_token', (select qr_token from public.tools where asset_code = 'KIT-001'), 'condition', 'good', 'unavailable', false),
    jsonb_build_object('tool_token', (select qr_token from public.tools where asset_code = 'KIT-002'), 'condition', 'good', 'unavailable', false)
  ));
  perform pg_temp.assert_true((select count(*) = 2 from public.transactions where id in (second_tx, third_tx) and status = 'returned'), 'one reconciliation may complete multiple transactions');

  begin
    perform public.return_tools(borrower_token, null);
    raise exception 'TEST FAILED: null return payload was accepted';
  exception when others then
    if sqlerrm = 'TEST FAILED: null return payload was accepted' then raise; end if;
  end;

  begin
    perform public.reset_demo_records();
    raise exception 'TEST FAILED: operational custodian reset demo data';
  exception when others then
    if sqlerrm = 'TEST FAILED: operational custodian reset demo data' then raise; end if;
  end;
end;
$$;

set local role postgres;
select set_config('request.jwt.claim.sub', '01000000-0000-4000-8000-000000000002', true);
set local role authenticated;

do $$
begin
  perform pg_temp.assert_true((select count(*) > 0 from public.tools), 'instructor must read same-scope inventory');
  perform pg_temp.assert_true((select count(*) = 0 from public.tools where data_scope = 'demo'), 'operational instructor must not see demo inventory');
  begin
    perform public.create_tool_batch('Forbidden Tool', '', 'Testing', 1, 'NOPE', 'good');
    raise exception 'TEST FAILED: instructor write was accepted';
  exception when others then
    if sqlerrm = 'TEST FAILED: instructor write was accepted' then raise; end if;
  end;
end;
$$;

set local role postgres;
select set_config('request.jwt.claim.sub', '01000000-0000-4000-8000-000000000005', true);
set local role authenticated;

do $$
begin
  perform pg_temp.assert_true((select count(*) = 0 from public.transactions), 'other student must not see borrower history');
end;
$$;

set local role postgres;
select set_config('request.jwt.claim.sub', '01000000-0000-4000-8000-000000000006', true);
set local role authenticated;
select public.reset_demo_records();

set local role postgres;
select pg_temp.assert_true(not has_table_privilege('anon', 'public.tools', 'select'), 'anonymous role must have no inventory grant');
select pg_temp.assert_true((select not public and file_size_limit = 2097152 from storage.buckets where id = 'profile-photos'), 'profile-photo bucket must remain private with a 2 MB limit');
select 'workflow database integration passed' as result;
rollback;
