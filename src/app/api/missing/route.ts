import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustodian } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ itemIds: z.array(z.uuid()).min(1).max(100), note: z.string().trim().min(3).max(500) }).refine((value) => new Set(value.itemIds).size === value.itemIds.length, { message: "Duplicate items are not allowed." });

export async function POST(request: Request) {
  await requireCustodian(); const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid missing-item request." }, { status: 400 });
  const supabase = await createClient(); const { data, error } = await supabase.rpc("mark_items_missing", { p_item_ids: parsed.data.itemIds, p_note: parsed.data.note });
  if (error) return NextResponse.json({ error: error.message }, { status: 409 });
  return NextResponse.json({ updatedCount: data });
}
