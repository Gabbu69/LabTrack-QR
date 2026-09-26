-- Aggregates run before PostgREST's response row cap and inherit caller RLS.
create or replace function public.dashboard_summary()
returns jsonb language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'metrics', (select jsonb_build_object('total', count(*),
      'available', count(*) filter (where status = 'available'),
      'borrowed', count(*) filter (where status = 'borrowed'),
      'missing', count(*) filter (where status = 'missing'),
      'activeTransactions', (select count(*) from public.transactions where status <> 'returned'))
      from public.tools where archived_at is null),
    'categories', coalesce((select jsonb_agg(c order by c.total desc, c.label) from (
      select category as label, count(*) as total, count(*) filter (where status = 'available') as available
      from public.tools where archived_at is null group by category) c), '[]'::jsonb),
    'borrowers', coalesce((select jsonb_agg(b order by b.name) from (
      select tx.borrower_id as id, max(tx.borrower_name_snapshot) as name,
        max(tx.borrower_student_id_snapshot) as "studentId", count(i.id) as tools
      from public.transactions tx join public.transaction_items i on i.transaction_id = tx.id
      where i.item_status in ('borrowed', 'missing') group by tx.borrower_id) b), '[]'::jsonb),
    'student', jsonb_build_object(
      'transactions', (select count(*) from public.transactions where borrower_id = (select auth.uid())),
      'borrowed', (select count(*) from public.transaction_items i join public.transactions tx on tx.id = i.transaction_id where tx.borrower_id = (select auth.uid()) and i.item_status = 'borrowed'),
      'missing', (select count(*) from public.transaction_items i join public.transactions tx on tx.id = i.transaction_id where tx.borrower_id = (select auth.uid()) and i.item_status = 'missing'),
      'items', coalesce((select jsonb_agg(r) from (select i.* from public.transaction_items i
        join public.transactions tx on tx.id = i.transaction_id where tx.borrower_id = (select auth.uid())
        and i.item_status in ('borrowed', 'missing') order by i.created_at desc, i.id limit 8) r), '[]'::jsonb))
  );
$$;
revoke all on function public.dashboard_summary() from public, anon;
grant execute on function public.dashboard_summary() to authenticated;

create index if not exists transaction_items_outstanding_idx
  on public.transaction_items (transaction_id, created_at desc, id)
  where item_status in ('borrowed', 'missing');
create index if not exists transactions_scope_borrowed_id_idx
  on public.transactions (data_scope, borrowed_at desc, id);
