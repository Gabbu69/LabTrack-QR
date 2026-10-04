-- Bind reconciliation to the custody row the custodian actually reviewed.
-- Parent locks serialize status refreshes even when requests touch different
-- children. Every custody mutation uses parent -> tool -> item, each sorted.
create or replace function private.return_tools_impl(p_borrower_token uuid, p_returned_items jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare
  actor public.profiles;
  borrower public.profiles;
  affected_ids uuid[];
  item_count integer;
  distinct_items integer;
  distinct_tools integer;
  matched_count integer;
  updated_count integer;
begin
  actor := private.require_custodian();
  select * into borrower from public.profiles where qr_token = p_borrower_token for share;
  if borrower.id is null or borrower.role <> 'student' then raise exception 'Borrower QR is unknown'; end if;
  if borrower.data_scope <> actor.data_scope then raise exception 'Borrower is outside your data scope' using errcode = '42501'; end if;
  if p_returned_items is null or jsonb_typeof(p_returned_items) <> 'array' then raise exception 'Scan at least one returned tool'; end if;
  item_count := jsonb_array_length(p_returned_items);
  if item_count not between 1 and 100 then raise exception 'Scan between 1 and 100 returned tools'; end if;
  if exists (select 1 from jsonb_array_elements(p_returned_items) x
    where jsonb_typeof(x) <> 'object' or nullif(x ->> 'item_id', '') is null or nullif(x ->> 'tool_token', '') is null) then
    raise exception 'Reload the borrower custody: every return must identify the exact loan item';
  end if;
  select count(distinct (x ->> 'item_id')::uuid), count(distinct (x ->> 'tool_token')::uuid)
    into distinct_items, distinct_tools from jsonb_array_elements(p_returned_items) x;
  if item_count <> distinct_items or item_count <> distinct_tools then raise exception 'Duplicate returned-tool scans are not allowed'; end if;

  -- Include already-returned rows here: stale requests must lock their original
  -- parent and then fail, never discover and close a newer loan of the tool.
  select array_agg(distinct tx.id order by tx.id), count(*) into affected_ids, matched_count
  from jsonb_array_elements(p_returned_items) x
  join public.transaction_items i on i.id = (x ->> 'item_id')::uuid
  join public.transactions tx on tx.id = i.transaction_id
  join public.tools t on t.id = i.tool_id and t.qr_token = (x ->> 'tool_token')::uuid
  where tx.borrower_id = borrower.id and tx.data_scope = actor.data_scope and t.data_scope = actor.data_scope;
  if matched_count <> item_count then raise exception 'Custody changed. Reload the borrower custody and scan the returned tools again'; end if;

  perform tx.id from public.transactions tx where tx.id = any(affected_ids) order by tx.id for update;
  perform t.id from public.tools t join public.transaction_items i on i.tool_id = t.id
    where i.id in (select (x ->> 'item_id')::uuid from jsonb_array_elements(p_returned_items) x)
    order by t.id for update of t;
  perform i.id from public.transaction_items i
    where i.id in (select (x ->> 'item_id')::uuid from jsonb_array_elements(p_returned_items) x)
    order by i.id for update;

  -- This is a separate statement after any lock wait, so READ COMMITTED sees
  -- the latest committed custody before changing either rows or tool status.
  select count(*) into matched_count
  from jsonb_array_elements(p_returned_items) x
  join public.transaction_items i on i.id = (x ->> 'item_id')::uuid
  join public.transactions tx on tx.id = i.transaction_id
  join public.tools t on t.id = i.tool_id and t.qr_token = (x ->> 'tool_token')::uuid
  where tx.borrower_id = borrower.id and tx.data_scope = actor.data_scope and t.data_scope = actor.data_scope
    and i.item_status in ('borrowed', 'missing');
  if matched_count <> item_count then raise exception 'Custody changed. Reload the borrower custody and scan the returned tools again'; end if;

  with incoming as (
    select (x ->> 'item_id')::uuid item_id,
      coalesce(nullif(x ->> 'condition', ''), 'good')::public.tool_condition return_condition,
      nullif(trim(x ->> 'note'), '') note,
      coalesce((x ->> 'unavailable')::boolean, false) unavailable
    from jsonb_array_elements(p_returned_items) x
  )
  update public.transaction_items i
    set item_status = 'returned', return_condition = incoming.return_condition, return_note = incoming.note,
      returned_by = actor.id, returned_at = now()
    from incoming where i.id = incoming.item_id;
  get diagnostics updated_count = row_count;
  if updated_count <> item_count then raise exception 'Custody changed. Reload the borrower custody and scan the returned tools again'; end if;

  with incoming as (
    select (x ->> 'item_id')::uuid item_id,
      coalesce(nullif(x ->> 'condition', ''), 'good')::public.tool_condition return_condition,
      coalesce((x ->> 'unavailable')::boolean, false) unavailable
    from jsonb_array_elements(p_returned_items) x
  )
  update public.tools t
    set condition = incoming.return_condition,
      status = case when incoming.return_condition = 'damaged' or incoming.unavailable
        then 'unavailable'::public.tool_status else 'available'::public.tool_status end
    from incoming join public.transaction_items i on i.id = incoming.item_id where t.id = i.tool_id;
  perform private.refresh_transaction_statuses(affected_ids);
  return updated_count;
end;
$$;

create or replace function private.mark_items_missing_impl(p_item_ids uuid[], p_note text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles; affected_ids uuid[]; expected_count integer; matched_count integer; updated_count integer;
begin
  actor := private.require_custodian();
  expected_count := coalesce(cardinality(p_item_ids), 0);
  if expected_count not between 1 and 100 or expected_count <> (select count(distinct id) from unnest(p_item_ids) id) then
    raise exception 'Choose between 1 and 100 unique items';
  end if;
  if char_length(trim(coalesce(p_note, ''))) not between 3 and 500 then raise exception 'A missing-item note of 3 to 500 characters is required'; end if;

  select array_agg(distinct tx.id order by tx.id), count(*) into affected_ids, matched_count
    from public.transaction_items i join public.transactions tx on tx.id = i.transaction_id
    join public.tools t on t.id = i.tool_id
    where i.id = any(p_item_ids) and tx.data_scope = actor.data_scope and t.data_scope = actor.data_scope;
  if matched_count <> expected_count then raise exception 'Every selected item must be outstanding in your data scope. Reload custody'; end if;
  perform tx.id from public.transactions tx where tx.id = any(affected_ids) order by tx.id for update;
  perform t.id from public.tools t join public.transaction_items i on i.tool_id = t.id
    where i.id = any(p_item_ids) order by t.id for update of t;
  perform i.id from public.transaction_items i where i.id = any(p_item_ids) order by i.id for update;
  select count(*) into matched_count from public.transaction_items i
    join public.transactions tx on tx.id = i.transaction_id join public.tools t on t.id = i.tool_id
    where i.id = any(p_item_ids) and tx.data_scope = actor.data_scope and t.data_scope = actor.data_scope and i.item_status = 'borrowed';
  if matched_count <> expected_count then raise exception 'Every selected item must still be borrowed in your data scope. Reload custody'; end if;

  update public.transaction_items i set item_status = 'missing', missing_at = coalesce(i.missing_at, now()), missing_note = trim(p_note)
    where i.id = any(p_item_ids);
  get diagnostics updated_count = row_count;
  update public.tools t set status = 'missing' from public.transaction_items i where i.id = any(p_item_ids) and t.id = i.tool_id;
  perform private.refresh_transaction_statuses(affected_ids);
  return updated_count;
end;
$$;

comment on function private.return_tools_impl(uuid,jsonb) is 'Returns only exact item_id + tool_token custody selections; parent transaction locks serialize return/missing status refreshes.';
