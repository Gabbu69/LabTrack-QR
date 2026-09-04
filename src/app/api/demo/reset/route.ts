import { NextResponse } from "next/server";
import { requireCustodian } from "@/lib/auth";
import { resetDemoDataFromEnv } from "@/lib/demo.mjs";

export async function POST() {
  const profile = await requireCustodian();
  if (profile.data_scope !== "demo") return NextResponse.json({ error: "Demo reset is available only to the demo custodian." }, { status: 403 });
  try { const result = await resetDemoDataFromEnv(); return NextResponse.json(result); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Demo reset failed." }, { status: 500 }); }
}
