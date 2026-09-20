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
