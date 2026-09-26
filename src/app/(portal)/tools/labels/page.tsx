import { redirect, notFound } from "next/navigation";
import { z } from "zod";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, pageNumber, pageHref, type SearchParams } from "@/lib/query-filters";
import { QrCard } from "@/components/qr/qr-card";
import { PageHeader } from "@/components/ui/page-header";
import { PrintButton } from "@/components/ui/print-button";
import { requireStaff } from "@/lib/auth";
import { toolQrPayload } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import type { Tool } from "@/types/app";

export const metadata = { title: "QR Labels" };

export default async function LabelsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requireStaff(); const filters = await searchParams; const supabase = await createClient();
  const page = pageNumber(filters.page);
  if (filters.batch && !z.uuid().safeParse(filters.batch).success) notFound();
  let request = supabase.from("tools").select("*", { count: "exact" }).order("asset_code").order("id");
  if (filters.batch) request = request.eq("creation_batch_id", filters.batch);
  const { data, error, count } = await request.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("Labels could not be loaded. Please try again.");
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  if (page > pages) redirect(pageHref("/tools/labels", filters, pages));
  const tools = (data ?? []) as Tool[];
  return <div className="page-wrap print-page"><PageHeader eyebrow="A4 LABEL SHEET" title="TOOL QR LABELS" description={filters.batch ? "Newly created batch. Print each results page and attach labels to the physical tools." : "50 asset labels per page. Print each results page using A4 output."} actions={<PrintButton />} />
    {tools.length === 0 ? <div className="empty-state"><p>No labels matched this batch.</p></div> : <section className="label-sheet">{tools.map((tool) => <QrCard key={tool.id} payload={toolQrPayload(tool.qr_token)} label={tool.asset_code} caption={tool.tool_name} />)}</section>}
    <Pagination path="/tools/labels" params={filters} page={page} count={count ?? 0} />
  </div>;
}
