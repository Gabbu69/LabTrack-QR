import { BorrowFlow } from "@/components/scanner/borrow-flow";
import { PageHeader } from "@/components/ui/page-header";
import { requireCustodian } from "@/lib/auth";

export const metadata = { title: "Borrow Tools" };
export default async function BorrowPage() { await requireCustodian(); return <div className="page-wrap workflow-page"><PageHeader eyebrow="GUIDED CHECKOUT" title="BORROW TOOLS" description="Identify the approved borrower, scan each physical tool, review, and confirm once." /><BorrowFlow /></div>; }
