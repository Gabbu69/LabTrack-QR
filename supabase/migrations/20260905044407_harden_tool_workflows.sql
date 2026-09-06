create or replace function private.create_tool_batch_impl(
  p_tool_name text, p_description text, p_category text, p_quantity integer,
  p_code_prefix text, p_condition public.tool_condition
)
returns setof public.tools language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles; normalized_prefix text; start_number integer; batch_id uuid := gen_random_uuid();
begin
  actor := private.require_custodian();
  normalized_prefix := upper(regexp_replace(trim(p_code_prefix), '[^A-Za-z0-9]', '', 'g'));
  if normalized_prefix is null or normalized_prefix !~ '^[A-Z0-9]{2,10}$' then raise exception 'Code prefix must contain 2 to 10 letters or numbers'; end if;
  if p_quantity is null or p_quantity < 1 or p_quantity > 100 then raise exception 'Quantity must be between 1 and 100'; end if;
  if p_condition is null or p_condition = 'damaged' then raise exception 'New assets must begin in good or fair condition'; end if;
  insert into private.asset_code_counters(data_scope, code_prefix, next_number)
  values (actor.data_scope, normalized_prefix, 1) on conflict (data_scope, code_prefix) do nothing;
  select next_number into start_number from private.asset_code_counters
  where data_scope = actor.data_scope and code_prefix = normalized_prefix for update;
  if start_number + p_quantity - 1 > 999999 then raise exception 'This code prefix has reached its asset limit. Choose another prefix'; end if;
  update private.asset_code_counters set next_number = next_number + p_quantity
  where data_scope = actor.data_scope and code_prefix = normalized_prefix;
  return query
  insert into public.tools (asset_code, tool_name, description, category, condition, status, creation_batch_id, data_scope, created_by)
  select normalized_prefix || '-' || lpad((start_number + n)::text, greatest(3, length((start_number + n)::text)), '0'),
    trim(p_tool_name), coalesce(trim(p_description), ''), trim(p_category), p_condition, 'available', batch_id, actor.data_scope, actor.id
  from generate_series(0, p_quantity - 1) n order by n returning *;
end;
$$;

create or replace function private.update_tool_impl(
  p_tool_id uuid, p_tool_name text, p_description text, p_category text,
  p_condition public.tool_condition, p_status public.tool_status
)
returns public.tools language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles; target public.tools; result public.tools;
begin
  actor := private.require_custodian();
  select * into target from public.tools where id = p_tool_id for update;
  if target.id is null or target.data_scope <> actor.data_scope then raise exception 'Tool not found in your scope' using errcode = '42501'; end if;
  if (target.status in ('borrowed', 'missing') and p_status <> target.status)
    or (p_status in ('borrowed', 'missing') and p_status <> target.status) then
    raise exception 'Use the checkout, return or missing-item workflow to change custody';
  end if;
  if p_condition = 'damaged' and p_status not in ('unavailable', 'archived') then raise exception 'Damaged tools must be unavailable or archived'; end if;
  update public.tools set tool_name = trim(p_tool_name), description = coalesce(trim(p_description), ''), category = trim(p_category),
    condition = p_condition, status = p_status, archived_at = case when p_status = 'archived' then coalesce(archived_at, now()) else null end
  where id = p_tool_id returning * into result;
  return result;
end;
$$;
