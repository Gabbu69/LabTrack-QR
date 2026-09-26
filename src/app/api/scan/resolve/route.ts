import { NextResponse } from "next/server";
import { z } from "zod";
import { apiRoute } from "@/lib/api";
import { parseQrPayload } from "@/lib/qr";
import { createClient } from "@/lib/supabase/server";
import type { Profile, Tool } from "@/types/app";

const schema = z.object({ value: z.string().trim().min(1).max(200), kind: z.enum(["student", "tool"]) });

export const POST = apiRoute({ roles: ["custodian"], active: true }, async (request) => {
  const parsedBody = schema.safeParse(await request.json().catch(() => null));
  if (!parsedBody.success) return NextResponse.json({ error: "Enter or scan a valid code." }, { status: 400 });
  const { value, kind } = parsedBody.data; const qr = parseQrPayload(value);
  if (qr && qr.kind !== kind) return NextResponse.json({ error: `That is a ${qr.kind} QR, not a ${kind} QR.` }, { status: 400 });
  const supabase = await createClient();
  if (kind === "student") {
    const query = supabase.from("profiles").select("*").eq("role", "student");
    const { data: matches, error } = await (qr ? query.eq("qr_token", qr.token) : query.ilike("student_id", value.replace(/[\\%_]/g, "\\$&"))).limit(2);
    if (error) return NextResponse.json({ error: "Student lookup is unavailable. Try again." }, { status: 503 });
    if (matches.length > 1) return NextResponse.json({ error: "More than one account has this Student ID. Scan the borrower's personal QR to identify the correct account." }, { status: 409 });
    const data = matches[0];
    if (!data) return NextResponse.json({ error: "Student was not found in your data scope." }, { status: 404 });
    const student = data as Profile;
    return NextResponse.json({ kind: "student", token: student.qr_token, fullName: student.full_name, studentId: student.student_id, yearSection: student.year_section, groupNumber: student.group_number, status: student.status });
  }
  const query = supabase.from("tools").select("*");
  const { data, error } = qr ? await query.eq("qr_token", qr.token).maybeSingle() : await query.ilike("asset_code", value.replace(/[\\%_]/g, "\\$&")).maybeSingle();
  if (error) return NextResponse.json({ error: "Tool lookup is unavailable. Try again." }, { status: 503 });
  if (!data) return NextResponse.json({ error: "Tool was not found in your data scope." }, { status: 404 });
  const tool = data as Tool;
  return NextResponse.json({ kind: "tool", token: tool.qr_token, id: tool.id, assetCode: tool.asset_code, toolName: tool.tool_name, condition: tool.condition, status: tool.status });
});
