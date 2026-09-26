-- One trusted password operation per account, across all application instances.
alter table public.profiles add column if not exists password_operation_id uuid;
comment on column public.profiles.password_operation_id is 'Server-only compare-and-set lease for Auth password updates. Interrupted leases require verified owner recovery.';
