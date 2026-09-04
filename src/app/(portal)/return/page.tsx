import { ReturnFlow } from "@/components/scanner/return-flow";
import { PageHeader } from "@/components/ui/page-header";
import { requireCustodian } from "@/lib/auth";

export const metadata = { title: "Return Tools" };
export default async function ReturnPage() { await requireCustodian(); return <div className="page-wrap workflow-page"><PageHeader eyebrow="GUIDED RECONCILIATION" title="PROCESS RETURN" description="Scan only the tools physically received. Anything unscanned stays outstanding unless explicitly marked missing." /><ReturnFlow /></div>; }
