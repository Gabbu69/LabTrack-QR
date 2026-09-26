import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";
import { outstandingTransactions, transactionItems } from "@/lib/records";
import type { Profile, Tool } from "@/types/app";

export const GET = apiRoute({ roles: ["custodian"], active: true }, async (request) => {
  const token = z.uuid().safeParse(request.nextUrl.searchParams.get("token"));
  if (!token.success) return NextResponse.json({ error: "Borrower token is invalid." }, { status: 400 });
  const supabase = await createClient(); const { data: profileData, error: profileError } = await supabase.from("profiles").select("*").eq("qr_token", token.data).eq("role", "student").maybeSingle();
  if (profileError) return NextResponse.json({ error: "Borrower details could not be loaded. Try again." }, { status: 503 });
  if (!profileData) return NextResponse.json({ error: "Borrower was not found." }, { status: 404 }); const profile = profileData as Profile;
  const transactions = await outstandingTransactions(supabase, profile.id); const ids = transactions.map((transaction) => transaction.id);
  if (!ids.length) return NextResponse.json({ items: [] });
  const items = (await transactionItems(supabase, ids)).filter((item) => ["borrowed", "missing"].includes(item.item_status));
  const toolIds = [...new Set(items.map((item) => item.tool_id))]; const tools: Tool[] = [];
  for (let offset = 0; offset < toolIds.length; offset += 50) {
    const { data, error } = await supabase.from("tools").select("*").in("id", toolIds.slice(offset, offset + 50));
    if (error) throw new Error("Tool details could not be loaded.");
    tools.push(...data);
  }
  if (tools.length !== toolIds.length) return NextResponse.json({ error: "Tool details are incomplete. Reload custody before continuing." }, { status: 503 });
  const toolMap = new Map(tools.map((tool) => [tool.id, tool])); const txMap = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  return NextResponse.json({ items: items.map((item) => ({ itemId: item.id, transactionId: item.transaction_id, toolToken: toolMap.get(item.tool_id)?.qr_token, assetCode: item.asset_code_snapshot, toolName: item.tool_name_snapshot, itemStatus: item.item_status, issueCondition: item.issue_condition, borrowedAt: txMap.get(item.transaction_id)?.borrowed_at, missingAt: item.missing_at })).filter((item) => item.toolToken) });
});
