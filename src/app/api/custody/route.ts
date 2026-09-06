import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireCustodian } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Tool, Transaction, TransactionItem } from "@/types/app";

export async function GET(request: NextRequest) {
  await requireCustodian(); const token = z.uuid().safeParse(request.nextUrl.searchParams.get("token"));
  if (!token.success) return NextResponse.json({ error: "Borrower token is invalid." }, { status: 400 });
  const supabase = await createClient(); const { data: profileData } = await supabase.from("profiles").select("*").eq("qr_token", token.data).eq("role", "student").maybeSingle();
  if (!profileData) return NextResponse.json({ error: "Borrower was not found." }, { status: 404 }); const profile = profileData as Profile;
  const { data: transactionData, error: transactionError } = await supabase.from("transactions").select("*").eq("borrower_id", profile.id).neq("status", "returned").order("borrowed_at", { ascending: false });
  if (transactionError) return NextResponse.json({ error: "Custody records could not be loaded. Try again before accepting a return." }, { status: 503 });
  const transactions = (transactionData ?? []) as Transaction[]; const ids = transactions.map((transaction) => transaction.id);
  if (!ids.length) return NextResponse.json({ items: [] });
  const { data: itemData, error: itemError } = await supabase.from("transaction_items").select("*").in("transaction_id", ids).in("item_status", ["borrowed", "missing"]);
  if (itemError) return NextResponse.json({ error: "Outstanding items could not be loaded. Try again." }, { status: 503 });
  const items = (itemData ?? []) as TransactionItem[]; const toolIds = items.map((item) => item.tool_id);
  const { data: toolData, error: toolError } = toolIds.length ? await supabase.from("tools").select("*").in("id", toolIds) : { data: [], error: null };
  if (toolError || (toolData?.length ?? 0) !== new Set(toolIds).size) return NextResponse.json({ error: "Tool details are incomplete. Reload custody before continuing." }, { status: 503 });
  const tools = (toolData ?? []) as Tool[]; const toolMap = new Map(tools.map((tool) => [tool.id, tool])); const txMap = new Map(transactions.map((transaction) => [transaction.id, transaction]));
  return NextResponse.json({ items: items.map((item) => ({ itemId: item.id, transactionId: item.transaction_id, toolToken: toolMap.get(item.tool_id)?.qr_token, assetCode: item.asset_code_snapshot, toolName: item.tool_name_snapshot, itemStatus: item.item_status, issueCondition: item.issue_condition, borrowedAt: txMap.get(item.transaction_id)?.borrowed_at, missingAt: item.missing_at })).filter((item) => item.toolToken) });
}
