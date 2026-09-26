import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, databaseFailure } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ borrowerToken: z.uuid(), toolTokens: z.array(z.uuid()).min(1).max(100) }).refine((value) => new Set(value.toolTokens).size === value.toolTokens.length, { message: "Duplicate tools are not allowed." });

export const POST = apiRoute({ roles: ["custodian"], active: true }, async (request) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid checkout request." }, { status: 400 });
  const supabase = await createClient(); const { data, error } = await supabase.rpc("borrow_tools", { p_borrower_token: parsed.data.borrowerToken, p_tool_tokens: parsed.data.toolTokens });
  if (error) return databaseFailure(error, "Checkout could not be completed. Confirm the borrower is active and every tool is still available, then try again.");
  return NextResponse.json({ transactionId: data });
});
