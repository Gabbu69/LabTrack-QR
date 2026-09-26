import { NextResponse } from "next/server";
import { apiRoute } from "@/lib/api";
import { resetDemoDataFromEnv } from "@/lib/demo.mjs";

export const POST = apiRoute({ roles: ["custodian"], active: true }, async (_request, profile) => {
  if (profile.data_scope !== "demo") return NextResponse.json({ error: "Demo reset is available only to the demo custodian." }, { status: 403 });
  try { const result = await resetDemoDataFromEnv(); return NextResponse.json(result); }
  catch { return NextResponse.json({ error: "Demo reset could not finish. Ask the deployment owner to check it before retrying." }, { status: 503 }); }
});
