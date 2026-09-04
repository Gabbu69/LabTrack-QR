import { QrCard } from "@/components/qr/qr-card";
import { PageHeader } from "@/components/ui/page-header";
import { PrintButton } from "@/components/ui/print-button";
import { requireStaff } from "@/lib/auth";
import { toolQrPayload } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import type { Tool } from "@/types/app";

export const metadata = { title: "QR Labels" };

export default async function LabelsPage({ searchParams }: { searchParams: Promise<{ batch?: string }> }) {
  await requireStaff(); const filters = await searchParams; const supabase = await createClient();
  let request = supabase.from("tools").select("*").order("asset_code").limit(100);
  if (filters.batch) request = request.eq("creation_batch_id", filters.batch);
  const { data } = await request; const tools = (data ?? []) as Tool[];
  return <div className="page-wrap print-page"><PageHeader eyebrow="A4 LABEL SHEET" title="TOOL QR LABELS" description={filters.batch ? "Newly created batch, ready to print and attach to each physical tool." : "Showing up to 100 asset labels. Use the browser print dialog for A4 output."} actions={<PrintButton />} />
    {tools.length === 0 ? <div className="empty-state"><p>No labels matched this batch.</p></div> : <section className="label-sheet">{tools.map((tool) => <QrCard key={tool.id} payload={toolQrPayload(tool.qr_token)} label={tool.asset_code} caption={tool.tool_name} />)}</section>}
  </div>;
}
