import Form from "next/form";
import Link from "next/link";
import { Download, Plus, Printer, Search, Wrench } from "lucide-react";
import { createToolBatchAction } from "@/app/actions/operations";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, pageNumber, pageHref, TOOL_STATUSES } from "@/lib/query-filters";
import { inventoryQuery, parseInventoryFilters } from "@/lib/inventory";
import { redirect } from "next/navigation";

export const metadata = { title: "Tool Inventory" };

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string; error?: string; message?: string; page?: string }> }) {
  const profile = await requireStaff();
  const filters = await searchParams;
  const supabase = await createClient();
  const page = pageNumber(filters.page);
  let invalidFilter = "";
  try { parseInventoryFilters(filters); } catch (error) { invalidFilter = error instanceof Error ? error.message : "Check the inventory filters."; }
  const result = invalidFilter ? { data: [], error: null, count: 0 } : await inventoryQuery(supabase, filters).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (result.error) throw new Error("Inventory could not be loaded. Please try again.");
  const count = result.count ?? 0;
  const lastPage = Math.max(1, Math.ceil(count / PAGE_SIZE));
  if (page > lastPage) redirect(pageHref("/tools", filters, lastPage));
  const data = result.data ?? []; const tools = data;
  const categories = [...new Set(tools.map((tool) => tool.category))].sort();
  const exportParams = new URLSearchParams();
  for (const key of ["q", "category", "status"] as const) if (filters[key]) exportParams.set(key, filters[key]);
  const exportHref = `/api/reports/inventory.csv?${exportParams}`;
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="LABORATORY TOOLS" title="Tool inventory" description="Find a tool, check its status, or add new equipment. Each physical tool has its own asset code and QR label." actions={<><a className="button button-secondary" href={exportHref}><Download aria-hidden="true" />Export inventory</a><Link className="button button-secondary" href="/tools/labels"><Printer aria-hidden="true" />Print labels</Link></>} />
      <Notice error={invalidFilter || filters.error} message={filters.message} />
      {profile.role === "custodian" && <details id="add-tools" className="content-card disclosure" open={count === 0 && !filters.q && !filters.status && !filters.category}><summary><Plus aria-hidden="true" /><span><strong>Add tools</strong><small>Enter a name and quantity. Each tool gets its own QR label.</small></span></summary>
        <form action={createToolBatchAction} className="form-grid padded-form">
          <label className="field"><span>Tool name</span><input name="tool_name" required placeholder="Digital Multimeter" /></label>
          <label className="field"><span>Category</span><input name="category" required placeholder="Measuring & Inspection" list="tool-categories" /><datalist id="tool-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist></label>
          <label className="field"><span>Asset code prefix</span><input name="code_prefix" required placeholder="DM" maxLength={12} /><small>2–10 letters or numbers; numbering is automatic.</small></label>
          <label className="field"><span>Quantity</span><input name="quantity" type="number" min="1" max="100" defaultValue="1" required /></label>
          <label className="field"><span>Starting condition</span><select name="condition" defaultValue="good"><option value="good">Good</option><option value="fair">Fair</option></select></label>
          <label className="field full"><span>Description</span><textarea name="description" rows={3} placeholder="Optional distinguishing details" /></label>
          <div className="form-footer full"><span>Example: prefix DM and quantity 5 creates DM-001 through DM-005.</span><SubmitButton>Save tools & create labels</SubmitButton></div>
        </form>
      </details>}
      <section className="content-card">
        <nav className="inventory-status-tabs" aria-label="Inventory status shortcuts">{["", ...TOOL_STATUSES].map(status => { const params = new URLSearchParams(); if (filters.q) params.set("q", filters.q); if (filters.category) params.set("category", filters.category); if (status) params.set("status", status); return <Link key={status} href={`/tools?${params}`} aria-current={(filters.status ?? "") === status ? "page" : undefined}>{status || "All tools"}</Link>; })}</nav>
        <Form key={`${filters.q ?? ""}:${filters.status ?? ""}:${filters.category ?? ""}`} className="filter-bar" action="/tools"><label className="search-field"><Search aria-hidden="true" /><input aria-label="Search inventory" maxLength={120} name="q" defaultValue={filters.q} placeholder="Search asset code, tool, or category" /></label>{filters.category && <input type="hidden" name="category" value={filters.category} />}{filters.status && <input type="hidden" name="status" value={filters.status} />}<SubmitButton className="button button-secondary" pendingText="Loading…">Search</SubmitButton></Form>
        <div className="inventory-results" role="status"><span>{count} {count === 1 ? "tool" : "tools"} found{filters.category ? ` in ${filters.category}` : ""}. Exports include all matching pages.</span>{(filters.q || filters.status || filters.category) && <Link className="text-link" href="/tools">Clear filters</Link>}</div>
        {tools.length === 0 ? <div className="empty-state"><Wrench aria-hidden="true" /><h2>No matching tools</h2><p>{profile.role === "custodian" ? "Use Add tools above to enter equipment, or clear your filters." : "Try another search or clear your filters."}</p></div> : <div className="table-wrap"><table><thead><tr><th>Asset code</th><th>Tool</th><th>Category</th><th>Condition</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{tools.map((tool) => <tr key={tool.id}><td><Link className="mono table-link" href={`/tools/${tool.id}`}>{tool.asset_code}</Link></td><td>{tool.tool_name}</td><td>{tool.category}</td><td><StatusBadge value={tool.condition} /></td><td><StatusBadge value={tool.status} /></td><td><Link className="text-link" href={`/tools/${tool.id}`}>View</Link></td></tr>)}</tbody></table></div>}
        <Pagination path="/tools" params={filters} page={page} count={count} />
      </section>
    </div>
  );
}
