create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create type public.app_role as enum ('student', 'custodian', 'instructor');
create type public.profile_status as enum ('pending', 'active', 'disabled');
create type public.data_scope as enum ('operational', 'demo');
create type public.tool_condition as enum ('good', 'fair', 'damaged');
create type public.tool_status as enum ('available', 'borrowed', 'missing', 'unavailable', 'archived');
create type public.transaction_status as enum ('borrowed', 'partial', 'incomplete', 'returned');
create type public.item_status as enum ('borrowed', 'returned', 'missing');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null check (char_length(trim(full_name)) between 2 and 120),
  role public.app_role not null default 'student',
  status public.profile_status not null default 'pending',
  student_id text,
  year_section text,
  group_number text,
  contact_number text,
  photo_path text,
  qr_token uuid not null default gen_random_uuid() unique,
  must_change_password boolean not null default false,
  data_scope public.data_scope not null default 'operational',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_student_identity check (
    role <> 'student' or (student_id is not null and char_length(trim(student_id)) between 2 and 40)
  ),
  constraint profiles_email_lowercase check (email = lower(email)),
  constraint profiles_photo_path check (photo_path is null or photo_path like id::text || '/%')
);

create unique index profiles_scope_student_id_idx
  on public.profiles (data_scope, lower(student_id))
  where student_id is not null and status <> 'disabled';
create index profiles_scope_role_status_idx on public.profiles (data_scope, role, status);
create index profiles_status_created_idx on public.profiles (status, created_at desc);

create table private.asset_code_counters (
  data_scope public.data_scope not null,
  code_prefix text not null,
  next_number integer not null check (next_number > 0),
  primary key (data_scope, code_prefix),
  constraint asset_code_counters_prefix check (code_prefix ~ '^[A-Z0-9]{2,10}$')
);

create table public.tools (
  id uuid primary key default gen_random_uuid(),
  asset_code text not null,
  tool_name text not null check (char_length(trim(tool_name)) between 2 and 120),
  description text not null default '',
  category text not null check (char_length(trim(category)) between 2 and 80),
  condition public.tool_condition not null default 'good',
  status public.tool_status not null default 'available',
  qr_token uuid not null default gen_random_uuid() unique,
  creation_batch_id uuid not null,
  data_scope public.data_scope not null,
  created_by uuid not null references public.profiles(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tools_scope_asset_code_key unique (data_scope, asset_code),
  constraint tools_asset_code_format check (asset_code ~ '^[A-Z0-9]{2,10}-[0-9]{3,6}$'),
  constraint tools_archive_consistency check (
    (status = 'archived' and archived_at is not null) or
    (status <> 'archived' and archived_at is null)
  ),
  constraint tools_damage_availability check (condition <> 'damaged' or status in ('unavailable', 'archived'))
);

create index tools_scope_status_idx on public.tools (data_scope, status) where archived_at is null;
create index tools_scope_category_idx on public.tools (data_scope, category, asset_code) where archived_at is null;
create index tools_created_by_idx on public.tools (created_by);
create index tools_batch_idx on public.tools (creation_batch_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  borrower_id uuid not null references public.profiles(id),
  processed_by uuid not null references public.profiles(id),
  borrower_name_snapshot text not null,
  borrower_student_id_snapshot text not null,
  borrower_year_section_snapshot text,
  borrower_group_snapshot text,
  borrowed_at timestamptz not null default now(),
  completed_at timestamptz,
  status public.transaction_status not null default 'borrowed',
  data_scope public.data_scope not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_completion_consistency check (
    (status = 'returned' and completed_at is not null) or
    (status <> 'returned' and completed_at is null)
  )
);

create index transactions_borrower_status_idx on public.transactions (borrower_id, status, borrowed_at desc);
create index transactions_scope_borrowed_idx on public.transactions (data_scope, borrowed_at desc);
create index transactions_processed_by_idx on public.transactions (processed_by);
create index transactions_active_idx on public.transactions (data_scope, borrowed_at desc)
  where status <> 'returned';

create table public.transaction_items (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references public.transactions(id) on delete restrict,
  tool_id uuid not null references public.tools(id) on delete restrict,
  tool_name_snapshot text not null,
  asset_code_snapshot text not null,
  item_status public.item_status not null default 'borrowed',
  issue_condition public.tool_condition not null,
  return_condition public.tool_condition,
  return_note text,
  returned_by uuid references public.profiles(id),
  returned_at timestamptz,
  missing_at timestamptz,
  missing_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_items_one_per_transaction unique (transaction_id, tool_id),
  constraint transaction_items_return_consistency check (
    (item_status = 'returned' and returned_at is not null and returned_by is not null and return_condition is not null) or
    (item_status <> 'returned' and returned_at is null and returned_by is null and return_condition is null)
  ),
  constraint transaction_items_missing_consistency check (
    item_status <> 'missing' or (missing_at is not null and char_length(trim(missing_note)) > 0)
  )
);

create unique index transaction_items_one_open_custody_idx on public.transaction_items (tool_id)
  where item_status in ('borrowed', 'missing');
create index transaction_items_transaction_idx on public.transaction_items (transaction_id, item_status);
create index transaction_items_returned_by_idx on public.transaction_items (returned_by) where returned_by is not null;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function private.touch_updated_at();
create trigger tools_touch_updated_at before update on public.tools
for each row execute function private.touch_updated_at();
create trigger transactions_touch_updated_at before update on public.transactions
for each row execute function private.touch_updated_at();
create trigger transaction_items_touch_updated_at before update on public.transaction_items
for each row execute function private.touch_updated_at();

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id, email, full_name, role, status, student_id, year_section, group_number,
    contact_number, data_scope, must_change_password
  ) values (
    new.id,
    lower(new.email),
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''), 'Pending Student'),
    'student',
    'pending',
    nullif(trim(new.raw_user_meta_data ->> 'student_id'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'year_section'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'group_number'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'contact_number'), ''),
    'operational',
    false
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_auth_user();

create or replace function private.current_profile()
returns public.profiles
language sql
stable
security definer
set search_path = ''
as $$
  select p from public.profiles p where p.id = (select auth.uid());
$$;

create or replace function private.is_active_staff_for_scope(target_scope public.data_scope)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'active'
      and p.role in ('custodian', 'instructor')
      and p.data_scope = target_scope
  );
$$;

create or replace function private.is_active_custodian_for_scope(target_scope public.data_scope)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'active'
      and p.role = 'custodian'
      and p.data_scope = target_scope
  );
$$;

create or replace function private.require_custodian()
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  actor public.profiles;
begin
  select * into actor from public.profiles where id = (select auth.uid());
  if actor.id is null or actor.status <> 'active' or actor.role <> 'custodian' then
    raise exception 'Active custodian access is required' using errcode = '42501';
  end if;
  return actor;
end;
$$;

create or replace function private.guard_last_custodian()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'custodian' and old.status = 'active'
     and (tg_op = 'DELETE' or new.role <> 'custodian' or new.status <> 'active') then
    if not exists (
      select 1 from public.profiles p
      where p.role = 'custodian' and p.status = 'active'
        and p.data_scope = old.data_scope and p.id <> old.id
    ) then
      raise exception 'The last active custodian cannot be deactivated' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger profiles_guard_last_custodian
before update of role, status or delete on public.profiles
for each row execute function private.guard_last_custodian();

create or replace function private.enforce_transaction_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.profiles borrower
    join public.profiles custodian on custodian.id = new.processed_by
    where borrower.id = new.borrower_id
      and borrower.data_scope = new.data_scope
      and custodian.data_scope = new.data_scope
      and borrower.role = 'student'
      and custodian.role = 'custodian'
  ) then
    raise exception 'Transaction participants must share the transaction scope' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transactions_enforce_scope
before insert or update of borrower_id, processed_by, data_scope on public.transactions
for each row execute function private.enforce_transaction_scope();

create or replace function private.enforce_item_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.transactions tx
    join public.tools t on t.id = new.tool_id
    where tx.id = new.transaction_id and tx.data_scope = t.data_scope
  ) then
    raise exception 'Transaction item and tool must share the same scope' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger transaction_items_enforce_scope
before insert or update of transaction_id, tool_id on public.transaction_items
for each row execute function private.enforce_item_scope();

alter table public.profiles enable row level security;
alter table public.tools enable row level security;
alter table public.transactions enable row level security;
alter table public.transaction_items enable row level security;

create policy profiles_read_authorized on public.profiles for select to authenticated
using (
  id = (select auth.uid())
  or (select private.is_active_staff_for_scope(data_scope))
);

create policy tools_read_staff on public.tools for select to authenticated
using ((select private.is_active_staff_for_scope(data_scope)));

create policy transactions_read_authorized on public.transactions for select to authenticated
using (
  borrower_id = (select auth.uid())
  or (select private.is_active_staff_for_scope(data_scope))
);

create policy transaction_items_read_authorized on public.transaction_items for select to authenticated
using (
  exists (
    select 1 from public.transactions tx
    where tx.id = transaction_id
      and (tx.borrower_id = (select auth.uid()) or (select private.is_active_staff_for_scope(tx.data_scope)))
  )
);

revoke all on public.profiles, public.tools, public.transactions, public.transaction_items from anon, authenticated;
grant select on public.profiles, public.tools, public.transactions, public.transaction_items to authenticated;

create or replace function private.update_my_profile_impl(
  p_full_name text,
  p_student_id text,
  p_year_section text,
  p_group_number text,
  p_contact_number text,
  p_photo_path text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare result public.profiles;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.profiles
  set full_name = trim(p_full_name), student_id = nullif(trim(p_student_id), ''),
      year_section = nullif(trim(p_year_section), ''), group_number = nullif(trim(p_group_number), ''),
      contact_number = nullif(trim(p_contact_number), ''),
      photo_path = coalesce(p_photo_path, photo_path)
  where id = (select auth.uid())
  returning * into result;
  if result.id is null then raise exception 'Profile not found'; end if;
  return result;
end;
$$;

create or replace function public.update_my_profile(
  p_full_name text, p_student_id text, p_year_section text,
  p_group_number text, p_contact_number text, p_photo_path text default null
)
returns public.profiles language sql security invoker set search_path = ''
as $$ select private.update_my_profile_impl($1, $2, $3, $4, $5, $6); $$;

create or replace function private.complete_password_change_impl()
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  update public.profiles set must_change_password = false where id = (select auth.uid());
end;
$$;

create or replace function public.complete_password_change()
returns void language sql security invoker set search_path = ''
as $$ select private.complete_password_change_impl(); $$;

create or replace function private.set_profile_status_impl(p_profile_id uuid, p_status public.profile_status)
returns public.profiles language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles; target public.profiles; result public.profiles;
begin
  actor := private.require_custodian();
  select * into target from public.profiles where id = p_profile_id for update;
  if target.id is null or target.data_scope <> actor.data_scope then raise exception 'Profile not found in your scope' using errcode = '42501'; end if;
  if target.id = actor.id and p_status <> 'active' then raise exception 'You cannot deactivate your current account' using errcode = '23514'; end if;
  update public.profiles set status = p_status where id = p_profile_id returning * into result;
  return result;
end;
$$;

create or replace function public.set_profile_status(p_profile_id uuid, p_status public.profile_status)
returns public.profiles language sql security invoker set search_path = ''
as $$ select private.set_profile_status_impl($1, $2); $$;

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
  if normalized_prefix !~ '^[A-Z0-9]{2,10}$' then raise exception 'Code prefix must contain 2 to 10 letters or numbers'; end if;
  if p_quantity < 1 or p_quantity > 100 then raise exception 'Quantity must be between 1 and 100'; end if;
  if p_condition = 'damaged' then raise exception 'New assets cannot begin in damaged condition'; end if;

  insert into private.asset_code_counters(data_scope, code_prefix, next_number)
  values (actor.data_scope, normalized_prefix, 1)
  on conflict (data_scope, code_prefix) do nothing;
  select next_number into start_number from private.asset_code_counters
  where data_scope = actor.data_scope and code_prefix = normalized_prefix for update;
  update private.asset_code_counters set next_number = next_number + p_quantity
  where data_scope = actor.data_scope and code_prefix = normalized_prefix;

  return query
  insert into public.tools (asset_code, tool_name, description, category, condition, status, creation_batch_id, data_scope, created_by)
  select normalized_prefix || '-' || lpad((start_number + n)::text, 3, '0'), trim(p_tool_name),
         coalesce(trim(p_description), ''), trim(p_category), p_condition, 'available', batch_id, actor.data_scope, actor.id
  from generate_series(0, p_quantity - 1) n
  order by n
  returning *;
end;
$$;

create or replace function public.create_tool_batch(
  p_tool_name text, p_description text, p_category text, p_quantity integer,
  p_code_prefix text, p_condition public.tool_condition
)
returns setof public.tools language sql security invoker set search_path = ''
as $$ select * from private.create_tool_batch_impl($1, $2, $3, $4, $5, $6); $$;

create or replace function private.borrow_tools_impl(p_borrower_token uuid, p_tool_tokens uuid[])
returns uuid language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles; borrower public.profiles; tx_id uuid := gen_random_uuid(); found_count integer;
begin
  actor := private.require_custodian();
  if coalesce(array_length(p_tool_tokens, 1), 0) = 0 then raise exception 'Scan at least one tool'; end if;
  if cardinality(p_tool_tokens) <> (select count(distinct token) from unnest(p_tool_tokens) token) then raise exception 'Duplicate tool scans are not allowed'; end if;
  select * into borrower from public.profiles where qr_token = p_borrower_token for share;
  if borrower.id is null or borrower.role <> 'student' or borrower.status <> 'active' then raise exception 'Borrower is unknown or not approved'; end if;
  if borrower.data_scope <> actor.data_scope then raise exception 'Borrower is outside your data scope' using errcode = '42501'; end if;

  perform id from public.tools where qr_token = any(p_tool_tokens) order by id for update;
  select count(*) into found_count from public.tools where qr_token = any(p_tool_tokens);
  if found_count <> cardinality(p_tool_tokens) then raise exception 'One or more tool QR codes are unknown'; end if;
  if exists (select 1 from public.tools where qr_token = any(p_tool_tokens) and (data_scope <> actor.data_scope or status <> 'available' or condition = 'damaged' or archived_at is not null)) then
    raise exception 'Every tool must be available, serviceable, and in your data scope';
  end if;

  insert into public.transactions (id, borrower_id, processed_by, borrower_name_snapshot, borrower_student_id_snapshot,
    borrower_year_section_snapshot, borrower_group_snapshot, status, data_scope)
  values (tx_id, borrower.id, actor.id, borrower.full_name, borrower.student_id,
    borrower.year_section, borrower.group_number, 'borrowed', actor.data_scope);

  insert into public.transaction_items (transaction_id, tool_id, tool_name_snapshot, asset_code_snapshot, item_status, issue_condition)
  select tx_id, t.id, t.tool_name, t.asset_code, 'borrowed', t.condition
  from public.tools t where t.qr_token = any(p_tool_tokens) order by t.id;
  update public.tools set status = 'borrowed' where qr_token = any(p_tool_tokens);
  return tx_id;
end;
$$;

create or replace function public.borrow_tools(p_borrower_token uuid, p_tool_tokens uuid[])
returns uuid language sql security invoker set search_path = ''
as $$ select private.borrow_tools_impl($1, $2); $$;

create or replace function private.refresh_transaction_statuses(p_transaction_ids uuid[])
returns void language plpgsql security definer set search_path = ''
as $$
begin
  update public.transactions tx
  set status = case
        when not exists (select 1 from public.transaction_items i where i.transaction_id = tx.id and i.item_status <> 'returned') then 'returned'::public.transaction_status
        when exists (select 1 from public.transaction_items i where i.transaction_id = tx.id and i.item_status = 'missing') then 'incomplete'::public.transaction_status
        when exists (select 1 from public.transaction_items i where i.transaction_id = tx.id and i.item_status = 'returned') then 'partial'::public.transaction_status
        else 'borrowed'::public.transaction_status end,
      completed_at = case when not exists (select 1 from public.transaction_items i where i.transaction_id = tx.id and i.item_status <> 'returned') then coalesce(tx.completed_at, now()) else null end
  where tx.id = any(p_transaction_ids);
end;
$$;

create or replace function private.return_tools_impl(p_borrower_token uuid, p_returned_items jsonb)
returns integer language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles; borrower public.profiles; affected_ids uuid[]; item_count integer; updated_count integer;
begin
  actor := private.require_custodian();
  select * into borrower from public.profiles where qr_token = p_borrower_token for share;
  if borrower.id is null or borrower.role <> 'student' then raise exception 'Borrower QR is unknown'; end if;
  if borrower.data_scope <> actor.data_scope then raise exception 'Borrower is outside your data scope' using errcode = '42501'; end if;
  if jsonb_typeof(p_returned_items) <> 'array' or jsonb_array_length(p_returned_items) = 0 then raise exception 'Scan at least one returned tool'; end if;

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

create or replace function public.return_tools(p_borrower_token uuid, p_returned_items jsonb)
returns integer language sql security invoker set search_path = ''
as $$ select private.return_tools_impl($1, $2); $$;

create or replace function private.mark_items_missing_impl(p_item_ids uuid[], p_note text)
returns integer language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles; affected_ids uuid[]; expected_count integer; updated_count integer;
begin
  actor := private.require_custodian();
  expected_count := coalesce(cardinality(p_item_ids), 0);
  if expected_count = 0 or expected_count <> (select count(distinct id) from unnest(p_item_ids) id) then raise exception 'Choose one or more unique items'; end if;
  if char_length(trim(coalesce(p_note, ''))) < 3 then raise exception 'A missing-item note is required'; end if;
  perform i.id from public.transaction_items i join public.transactions tx on tx.id = i.transaction_id
    where i.id = any(p_item_ids) and tx.data_scope = actor.data_scope order by i.id for update of i;
  with changed as (
    update public.transaction_items i set item_status = 'missing', missing_at = coalesce(i.missing_at, now()), missing_note = trim(p_note)
    from public.transactions tx
    where i.id = any(p_item_ids) and i.transaction_id = tx.id and tx.data_scope = actor.data_scope and i.item_status = 'borrowed'
    returning i.transaction_id, i.tool_id
  ), tools_changed as (
    update public.tools t set status = 'missing' from changed c where t.id = c.tool_id returning t.id
  ) select array_agg(distinct transaction_id), count(*) into affected_ids, updated_count from changed;
  if updated_count <> expected_count then raise exception 'Every selected item must be outstanding in your data scope'; end if;
  perform private.refresh_transaction_statuses(affected_ids);
  return updated_count;
end;
$$;

create or replace function public.mark_items_missing(p_item_ids uuid[], p_note text)
returns integer language sql security invoker set search_path = ''
as $$ select private.mark_items_missing_impl($1, $2); $$;

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
  if target.status in ('borrowed', 'missing') and p_status <> target.status then raise exception 'Use the return workflow to change an issued tool'; end if;
  if p_condition = 'damaged' and p_status not in ('unavailable', 'archived') then raise exception 'Damaged tools must be unavailable or archived'; end if;
  update public.tools set tool_name = trim(p_tool_name), description = coalesce(trim(p_description), ''), category = trim(p_category),
    condition = p_condition, status = p_status, archived_at = case when p_status = 'archived' then coalesce(archived_at, now()) else null end
  where id = p_tool_id returning * into result;
  return result;
end;
$$;

create or replace function public.update_tool(
  p_tool_id uuid, p_tool_name text, p_description text, p_category text,
  p_condition public.tool_condition, p_status public.tool_status
)
returns public.tools language sql security invoker set search_path = ''
as $$ select private.update_tool_impl($1, $2, $3, $4, $5, $6); $$;

create or replace function private.delete_unused_tool_impl(p_tool_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare actor public.profiles; target public.tools;
begin
  actor := private.require_custodian();
  select * into target from public.tools where id = p_tool_id for update;
  if target.id is null or target.data_scope <> actor.data_scope then raise exception 'Tool not found in your scope' using errcode = '42501'; end if;
  if exists (select 1 from public.transaction_items where tool_id = p_tool_id) then raise exception 'Used tools must be archived, not deleted'; end if;
  delete from public.tools where id = p_tool_id;
end;
$$;

create or replace function public.delete_unused_tool(p_tool_id uuid)
returns void language sql security invoker set search_path = ''
as $$ select private.delete_unused_tool_impl($1); $$;

revoke all on all functions in schema private from public, anon;
grant execute on function private.current_profile(), private.is_active_staff_for_scope(public.data_scope),
  private.is_active_custodian_for_scope(public.data_scope) to authenticated;
grant execute on function private.update_my_profile_impl(text,text,text,text,text,text), private.complete_password_change_impl(),
  private.set_profile_status_impl(uuid,public.profile_status), private.create_tool_batch_impl(text,text,text,integer,text,public.tool_condition),
  private.borrow_tools_impl(uuid,uuid[]), private.return_tools_impl(uuid,jsonb), private.mark_items_missing_impl(uuid[],text),
  private.update_tool_impl(uuid,text,text,text,public.tool_condition,public.tool_status), private.delete_unused_tool_impl(uuid) to authenticated;

revoke all on all functions in schema public from public, anon;
grant execute on function public.update_my_profile(text,text,text,text,text,text), public.complete_password_change(),
  public.set_profile_status(uuid,public.profile_status), public.create_tool_batch(text,text,text,integer,text,public.tool_condition),
  public.borrow_tools(uuid,uuid[]), public.return_tools(uuid,jsonb), public.mark_items_missing(uuid[],text),
  public.update_tool(uuid,text,text,text,public.tool_condition,public.tool_status), public.delete_unused_tool(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', false, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy profile_photos_owner_read on storage.objects for select to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy profile_photos_staff_read on storage.objects for select to authenticated
using (
  bucket_id = 'profile-photos' and exists (
    select 1 from public.profiles owner_profile
    where owner_profile.id::text = (storage.foldername(name))[1]
      and (select private.is_active_staff_for_scope(owner_profile.data_scope))
  )
);
create policy profile_photos_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy profile_photos_owner_update on storage.objects for update to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy profile_photos_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

comment on table public.profiles is 'Application identities; roles and data scope are database-controlled.';
comment on table public.tools is 'One row per physical laboratory tool asset.';
comment on column public.tools.asset_code is 'Immutable human-readable asset label assigned at batch creation.';
comment on column public.profiles.qr_token is 'Opaque QR identifier; not an authentication credential.';
comment on column public.tools.qr_token is 'Opaque QR identifier; not an authorization credential.';
