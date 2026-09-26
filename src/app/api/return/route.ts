import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute, databaseFailure } from "@/lib/api";
import { createClient } from "@/lib/supabase/server";

const itemSchema = z.object({ toolToken: z.uuid(), condition: z.enum(["good", "fair", "damaged"]), note: z.string().trim().max(500), unavailable: z.boolean() });
const schema = z.object({ borrowerToken: z.uuid(), returnedItems: z.array(itemSchema).min(1).max(100) }).refine((value) => new Set(value.returnedItems.map((item) => item.toolToken)).size === value.returnedItems.length, { message: "Duplicate returned tools are not allowed." });

export const POST = apiRoute({ roles: ["custodian"], active: true }, async (request) => {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid return request." }, { status: 400 });
  const payload = parsed.data.returnedItems.map((item) => ({ tool_token: item.toolToken, condition: item.condition, note: item.note, unavailable: item.unavailable }));
  const supabase = await createClient(); const { data, error } = await supabase.rpc("return_tools", { p_borrower_token: parsed.data.borrowerToken, p_returned_items: payload as never });
  if (error) return databaseFailure(error, "Return could not be completed. Reload the borrower's custody and check the condition of each tool.");
  return NextResponse.json({ returnedCount: data });
});
