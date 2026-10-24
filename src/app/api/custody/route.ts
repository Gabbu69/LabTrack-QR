import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { outstandingTransactions, transactionItems } from "@/lib/records";
import { parseQrPayload } from "@/lib/qr";

export const GET = apiRoute({ roles: ["custodian"], active: true }, async (request) => {
  const params = request.nextUrl.searchParams;
  const token = z.uuid().safeParse(params.get("token"));
  const value = z.string().trim().min(1).max(200).safeParse(params.get("value"));
  if (!token.success && !value.success) return NextResponse.json({ error: "Borrower token is invalid." }, { status: 400 });
  const qr = value.success ? parseQrPayload(value.data) : null;
  if (qr && qr.kind !== "student") return NextResponse.json({ error: "Scan a student QR to identify the borrower." }, { status: 400 });
  const supabase = await createClient();
  const query = supabase.from("profiles").select("id,qr_token,full_name,student_id,year_section,group_number,status").eq("role", "student");
  const lookup = token.success ? query.eq("qr_token", token.data) : qr ? query.eq("qr_token", qr.token) : query.ilike("student_id", value.data!.replace(/[\\%_]/g, "\\$&"));
  const { data: matches, error: profileError } = await lookup.limit(2);
  if (profileError) return NextResponse.json({ error: "Borrower details could not be loaded. Try again." }, { status: 503 });
  if (!matches?.length) return NextResponse.json({ error: "Borrower was not found." }, { status: 404 });
  if (matches.length > 1) return NextResponse.json({ error: "More than one account has this Student ID. Scan the borrower's personal QR to identify the correct account." }, { status: 409 });
  const profile = matches[0];
  const student = { kind: "student", token: profile.qr_token, fullName: profile.full_name, studentId: profile.student_id, yearSection: profile.year_section, groupNumber: profile.group_number, status: profile.status };
  const transactions = await outstandingTransactions(supabase, profile.id); const ids = transactions.map((transaction) => transaction.id);
  if (!ids.length) return NextResponse.json({ student, items: [] });
  const items = (await transactionItems(supabase, ids)).filter((item) => ["borrowed", "missing"].includes(item.item_status));
  const toolIds = [...new Set(items.map((item) => item.tool_id))]; const tools: { id: string; qr_token: string }[] = [];
  for (let offset = 0; offset < toolIds.length; offset += 50) {
    const { data, error } = await supabase.from("tools").select("id,qr_token").in("id", toolIds.slice(offset, offset + 50));
    if (error) throw new Error("Tool details could not be loaded.");
    tools.push(...data);
  }
  if (tools.length !== toolIds.length) return NextResponse.json({ error: "Tool details are incomplete. Reload custody before continuing." }, { status: 503 });
  const toolMap = new Map(tools.map((tool) => [tool.id, tool])); const txMap = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  return NextResponse.json({ student, items: items.map((item) => ({ itemId: item.id, transactionId: item.transaction_id, toolToken: toolMap.get(item.tool_id)?.qr_token, assetCode: item.asset_code_snapshot, toolName: item.tool_name_snapshot, itemStatus: item.item_status, issueCondition: item.issue_condition, borrowedAt: txMap.get(item.transaction_id)?.borrowed_at, missingAt: item.missing_at })).filter((item) => item.toolToken) });
});
