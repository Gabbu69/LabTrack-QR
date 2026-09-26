import { ConfirmSubmit } from "@/components/forms/confirm-submit";
import { z } from "zod";
import Link from "next/link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, pageNumber, pageHref, formatLabDate, type SearchParams } from "@/lib/query-filters";
import { notFound, redirect } from "next/navigation";
import { deleteUnusedToolAction, updateToolAction } from "@/app/actions/operations";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { QrCard } from "@/components/qr/qr-card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { toolQrPayload } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import type { Tool, TransactionItem } from "@/types/app";

export default async function ToolPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const profile = await requireStaff();
  const { id } = await params; const query = await searchParams;
  if (!z.uuid().safeParse(id).success) notFound();
  const supabase = await createClient(); const page = pageNumber(query.page);
  const [{ data, error: toolError }, { data: history, error: historyError, count }] = await Promise.all([
    supabase.from("tools").select("*").eq("id", id).maybeSingle(),
    supabase.from("transaction_items").select("*", { count: "exact" }).eq("tool_id", id).order("created_at", { ascending: false }).order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
  ]);
  if (toolError || historyError) throw new Error("Tool details could not be loaded. Please try again.");
  if (!data) notFound();
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  if (page > pages) redirect(pageHref(`/tools/${id}`, query, pages));
  const tool = data as Tool; const items = (history ?? []) as TransactionItem[];
  return <div className="page-wrap"><Link className="back-link" href="/tools"><ArrowLeft aria-hidden="true" />Back to inventory</Link><PageHeader eyebrow="ASSET RECORD" title={`${tool.asset_code} · ${tool.tool_name.toUpperCase()}`} description="QR identity, current condition, availability, and borrowing history." /><Notice error={query.error} message={query.message} />
    <div className="detail-grid"><QrCard payload={toolQrPayload(tool.qr_token)} label={tool.asset_code} caption={tool.tool_name} />
      <section className="content-card"><div className="card-heading"><div><h2>ASSET DETAILS</h2><p>Asset codes never change after creation.</p></div><div className="chip-row"><StatusBadge value={tool.condition} /><StatusBadge value={tool.status} /></div></div>
        {profile.role === "custodian" ? <form action={updateToolAction} className="form-grid"><input type="hidden" name="tool_id" value={tool.id} /><label className="field"><span>Tool name</span><input name="tool_name" required defaultValue={tool.tool_name} /></label><label className="field"><span>Category</span><input name="category" required defaultValue={tool.category} /></label><label className="field"><span>Condition</span><select name="condition" defaultValue={tool.condition}><option value="good">Good</option><option value="fair">Fair</option><option value="damaged">Damaged</option></select></label><label className="field"><span>Status</span><select name="status" defaultValue={tool.status}>{["available","borrowed","missing","unavailable","archived"].map((value) => <option key={value}>{value}</option>)}</select></label><label className="field full"><span>Description</span><textarea name="description" rows={4} defaultValue={tool.description} /></label><div className="form-footer full"><span>Issued or missing assets must be resolved through Return.</span><SubmitButton>Save asset</SubmitButton></div></form> : <dl className="data-list"><div><dt>Category</dt><dd>{tool.category}</dd></div><div><dt>Description</dt><dd>{tool.description || "No description"}</dd></div><div><dt>Created</dt><dd>{formatLabDate(tool.created_at)}</dd></div></dl>}
        {profile.role === "custodian" && count === 0 && <form action={deleteUnusedToolAction} className="danger-zone"><input type="hidden" name="tool_id" value={tool.id} /><p><strong>Mistaken record?</strong><br />Only never-used tool records can be permanently deleted.</p><ConfirmSubmit className="button button-danger" message="Permanently delete this never-used tool record? This cannot be undone."><Trash2 aria-hidden="true" />Delete unused tool</ConfirmSubmit></form>}
      </section>
    </div>
    <section className="content-card"><div className="card-heading"><div><h2>TOOL USAGE HISTORY</h2><p>Immutable snapshots preserve the asset identity at the time of issue.</p></div></div>{items.length === 0 ? <div className="empty-state compact"><p>This tool has not been borrowed.</p></div> : <div className="table-wrap"><table><thead><tr><th>Issued</th><th>Status</th><th>Return condition</th><th>Return note</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td>{formatLabDate(item.created_at)}</td><td><StatusBadge value={item.item_status} /></td><td>{item.return_condition ? <StatusBadge value={item.return_condition} /> : "—"}</td><td>{item.return_note ?? item.missing_note ?? "—"}</td></tr>)}</tbody></table></div>}</section>
    <Pagination path={`/tools/${id}`} params={query} page={page} count={count ?? 0} />
  </div>;
}
