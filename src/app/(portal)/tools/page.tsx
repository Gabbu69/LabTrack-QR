import Link from "next/link";
import { Plus, Printer, Search, Wrench } from "lucide-react";
import { createToolBatchAction } from "@/app/actions/operations";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Tool } from "@/types/app";

export const metadata = { title: "Tool Inventory" };

export default async function ToolsPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; status?: string; error?: string; message?: string }> }) {
  const profile = await requireStaff();
  const filters = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("tools").select("*").order("asset_code").limit(1000);
  const tools = ((data ?? []) as Tool[]).filter((tool) => {
    const query = filters.q?.trim().toLowerCase();
    return (!query || `${tool.asset_code} ${tool.tool_name} ${tool.category}`.toLowerCase().includes(query)) && (!filters.category || tool.category === filters.category) && (!filters.status || tool.status === filters.status);
  });
  const categories = [...new Set(((data ?? []) as Tool[]).map((tool) => tool.category))].sort();
  return (
    <div className="page-wrap">
      <PageHeader eyebrow="PHYSICAL ASSETS" title="TOOL INVENTORY" description="Each row represents one physical tool with its own immutable asset code and QR label." actions={<Link className="button button-secondary" href="/tools/labels"><Printer aria-hidden="true" />Print labels</Link>} />
      <Notice error={filters.error} message={filters.message} />
      {profile.role === "custodian" && <details className="content-card disclosure" open={(data ?? []).length === 0}><summary><Plus aria-hidden="true" /><span><strong>Add a tool batch</strong><small>Quantity creates individual physical assets and labels.</small></span></summary>
        <form action={createToolBatchAction} className="form-grid padded-form">
          <label className="field"><span>Tool name</span><input name="tool_name" required placeholder="Digital Multimeter" /></label>
          <label className="field"><span>Category</span><input name="category" required placeholder="Measuring & Inspection" list="tool-categories" /><datalist id="tool-categories">{categories.map((category) => <option key={category} value={category} />)}</datalist></label>
          <label className="field"><span>Asset code prefix</span><input name="code_prefix" required placeholder="DM" maxLength={12} /><small>2–10 letters or numbers; numbering is automatic.</small></label>
          <label className="field"><span>Quantity</span><input name="quantity" type="number" min="1" max="100" defaultValue="1" required /></label>
          <label className="field"><span>Starting condition</span><select name="condition" defaultValue="good"><option value="good">Good</option><option value="fair">Fair</option></select></label>
          <label className="field full"><span>Description</span><textarea name="description" rows={3} placeholder="Optional distinguishing details" /></label>
          <div className="form-footer full"><span>Example: prefix DM and quantity 5 creates DM-001 through DM-005.</span><SubmitButton>Create assets & labels</SubmitButton></div>
        </form>
      </details>}
      <section className="content-card">
        <form className="filter-bar" action="/tools"><label className="search-field"><Search aria-hidden="true" /><input name="q" defaultValue={filters.q} placeholder="Search asset code, tool, or category" /></label><select name="status" defaultValue={filters.status ?? ""} aria-label="Filter by status"><option value="">All statuses</option>{["available","borrowed","missing","unavailable","archived"].map((status) => <option key={status} value={status}>{status}</option>)}</select><button className="button button-secondary" type="submit">Filter</button></form>
        {tools.length === 0 ? <div className="empty-state"><Wrench aria-hidden="true" /><h2>No matching tools</h2><p>Add the first batch or clear the current filters.</p></div> : <div className="table-wrap"><table><thead><tr><th>Asset code</th><th>Tool</th><th>Category</th><th>Condition</th><th>Status</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{tools.map((tool) => <tr key={tool.id}><td><Link className="mono table-link" href={`/tools/${tool.id}`}>{tool.asset_code}</Link></td><td>{tool.tool_name}</td><td>{tool.category}</td><td><StatusBadge value={tool.condition} /></td><td><StatusBadge value={tool.status} /></td><td><Link className="text-link" href={`/tools/${tool.id}`}>View</Link></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}
