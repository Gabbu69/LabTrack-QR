-- Gabs Project only: validated additive release migration. No inventory reset.
begin;
set local lock_timeout='5s';
-- BEFORE DELETE triggers must return OLD for every permitted deletion.
-- Returning NEW (NULL during DELETE) silently keeps orphaned profiles.
create or replace function private.guard_last_custodian()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.role = 'custodian' and old.status = 'active' then
    if not exists (
      select 1 from public.profiles p
      where p.role = 'custodian' and p.status = 'active'
        and p.data_scope = old.data_scope and p.id <> old.id
    ) then
      raise exception 'The last active custodian cannot be deactivated' using errcode = '23514';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.role = 'custodian' and old.status = 'active'
     and (new.role <> 'custodian' or new.status <> 'active') then
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


-- Do not rely on Supabase project-specific default table grants.
grant select, insert, update, delete on public.profiles, public.tools,
  public.transactions, public.transaction_items to service_role;

insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260919092338','complete_database_workflows',array[$migration$-- BEFORE DELETE triggers must return OLD for every permitted deletion.
-- Returning NEW (NULL during DELETE) silently keeps orphaned profiles.
create or replace function private.guard_last_custodian()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and old.role = 'custodian' and old.status = 'active' then
    if not exists (
      select 1 from public.profiles p
      where p.role = 'custodian' and p.status = 'active'
        and p.data_scope = old.data_scope and p.id <> old.id
    ) then
      raise exception 'The last active custodian cannot be deactivated' using errcode = '23514';
    end if;
    return old;
  end if;
  if tg_op = 'UPDATE' and old.role = 'custodian' and old.status = 'active'
     and (new.role <> 'custodian' or new.status <> 'active') then
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


-- Do not rely on Supabase project-specific default table grants.
grant select, insert, update, delete on public.profiles, public.tools,
  public.transactions, public.transaction_items to service_role;
$migration$]) on conflict (version) do nothing;
-- One trusted password operation per account, across all application instances.
alter table public.profiles add column if not exists password_operation_id uuid;
comment on column public.profiles.password_operation_id is 'Server-only compare-and-set lease for Auth password updates. Interrupted leases require verified owner recovery.';

insert into supabase_migrations.schema_migrations(version,name,statements) values ('20260926030000','serialize_password_operations',array[$migration$-- One trusted password operation per account, across all application instances.
alter table public.profiles add column if not exists password_operation_id uuid;
comment on column public.profiles.password_operation_id is 'Server-only compare-and-set lease for Auth password updates. Interrupted leases require verified owner recovery.';
$migration$]) on conflict (version) do nothing;
commit;
select column_name from information_schema.columns where table_schema='public' and table_name='profiles' and column_name='password_operation_id';
