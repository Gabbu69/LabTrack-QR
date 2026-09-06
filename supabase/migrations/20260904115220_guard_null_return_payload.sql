create or replace function private.return_tools_impl(p_borrower_token uuid, p_returned_items jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles; borrower public.profiles; affected_ids uuid[]; item_count integer; updated_count integer;
begin
  actor := private.require_custodian();
  select * into borrower from public.profiles where qr_token = p_borrower_token for share;
  if borrower.id is null or borrower.role <> 'student' then raise exception 'Borrower QR is unknown'; end if;
  if borrower.data_scope <> actor.data_scope then raise exception 'Borrower is outside your data scope' using errcode = '42501'; end if;
  if p_returned_items is null or jsonb_typeof(p_returned_items) <> 'array' or jsonb_array_length(p_returned_items) = 0 then raise exception 'Scan at least one returned tool'; end if;

  with incoming as (
    select (x ->> 'tool_token')::uuid tool_token from jsonb_array_elements(p_returned_items) x
  ) select count(*), count(distinct tool_token) into item_count, updated_count from incoming;
  if item_count <> updated_count then raise exception 'Duplicate returned-tool scans are not allowed'; end if;

  perform i.id from public.transaction_items i
  join public.transactions tx on tx.id = i.transaction_id
  join public.tools t on t.id = i.tool_id
  join lateral (select (x ->> 'tool_token')::uuid token from jsonb_array_elements(p_returned_items) x) incoming on incoming.token = t.qr_token
  where tx.borrower_id = borrower.id and tx.data_scope = actor.data_scope and i.item_status in ('borrowed', 'missing')
  order by i.id for update of i, t;

  with incoming as (
    select (x ->> 'tool_token')::uuid tool_token,
      coalesce(nullif(x ->> 'condition', ''), 'good')::public.tool_condition return_condition,
      nullif(trim(x ->> 'note'), '') note,
      coalesce((x ->> 'unavailable')::boolean, false) unavailable
    from jsonb_array_elements(p_returned_items) x
  ), matched as (
    select i.id, i.transaction_id, i.tool_id, incoming.return_condition, incoming.note, incoming.unavailable
    from incoming join public.tools t on t.qr_token = incoming.tool_token
    join public.transaction_items i on i.tool_id = t.id
    join public.transactions tx on tx.id = i.transaction_id
    where tx.borrower_id = borrower.id and tx.data_scope = actor.data_scope and i.item_status in ('borrowed', 'missing')
  ), updated_items as (
    update public.transaction_items i
    set item_status = 'returned', return_condition = m.return_condition, return_note = m.note,
        returned_by = actor.id, returned_at = now()
    from matched m where i.id = m.id
    returning i.transaction_id, i.tool_id
  ), updated_tools as (
    update public.tools t
    set condition = m.return_condition,
        status = case when m.return_condition = 'damaged' or m.unavailable then 'unavailable'::public.tool_status else 'available'::public.tool_status end
    from matched m where t.id = m.tool_id returning t.id
  )
  select array_agg(distinct transaction_id), count(*) into affected_ids, updated_count from updated_items;

  if updated_count <> item_count then raise exception 'Every returned tool must be outstanding for this borrower'; end if;
  perform private.refresh_transaction_statuses(affected_ids);
  return updated_count;
end;
$$;
