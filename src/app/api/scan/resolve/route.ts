import { NextResponse } from "next/server";
import { z } from "zod";
import { requireCustodian } from "@/lib/auth";
import { parseQrPayload } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Tool } from "@/types/app";

const schema = z.object({ value: z.string().trim().min(1).max(200), kind: z.enum(["student", "tool"]) });

export async function POST(request: Request) {
  await requireCustodian();
  const parsedBody = schema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: "Enter or scan a valid code." }, { status: 400 });
  const { value, kind } = parsedBody.data; const qr = parseQrPayload(value);
  if (qr && qr.kind !== kind) return NextResponse.json({ error: `That is a ${qr.kind} QR, not a ${kind} QR.` }, { status: 400 });
  const supabase = await createClient();
  if (kind === "student") {
    const query = supabase.from("profiles").select("*").eq("role", "student");
    const { data } = qr ? await query.eq("qr_token", qr.token).maybeSingle() : await query.ilike("student_id", value).maybeSingle();
    if (!data) return NextResponse.json({ error: "Student was not found in your data scope." }, { status: 404 });
    const student = data as Profile;
    return NextResponse.json({ kind: "student", token: student.qr_token, fullName: student.full_name, studentId: student.student_id, yearSection: student.year_section, groupNumber: student.group_number, status: student.status });
  }
  const query = supabase.from("tools").select("*");
  const { data } = qr ? await query.eq("qr_token", qr.token).maybeSingle() : await query.ilike("asset_code", value).maybeSingle();
  if (!data) return NextResponse.json({ error: "Tool was not found in your data scope." }, { status: 404 });
  const tool = data as Tool;
  return NextResponse.json({ kind: "tool", token: tool.qr_token, id: tool.id, assetCode: tool.asset_code, toolName: tool.tool_name, condition: tool.condition, status: tool.status });
}
