import "server-only";
import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { Profile } from "@/types/app";

// Call only after requireProfile: this optional freshness read is not the
// authorization gate. A provider outage must not discard a verified profile.
export async function loadProfileMetadata(client: Pick<SupabaseClient<Database>, "auth">, profile: Pick<Profile, "id" | "program">) {
  const fallback = { program: profile.program ?? "", programEditable: false };
  let result;
  try { result = await client.auth.getUser(); }
  catch {
    console.warn("Profile metadata refresh unavailable", { code: "request_failed" });
    return fallback;
  }
  const { data, error } = result;
  if (error) {
    const status = error.status ?? 0;
    if ((status >= 400 && status < 500 && status !== 429) || ["session_not_found", "session_expired", "user_not_found", "user_banned", "bad_jwt", "no_authorization", "refresh_token_not_found", "refresh_token_already_used"].includes(error.code ?? "")) {
      redirect("/login?error=Your%20session%20has%20ended.%20Please%20sign%20in%20again.");
    }
    // Log diagnostic codes only, never tokens, email addresses or provider bodies.
    console.warn("Profile metadata refresh unavailable", { code: error.code ?? "unknown", status: error.status });
    return fallback;
  }
  if (!data.user || data.user.id !== profile.id) redirect("/login?error=Please%20sign%20in%20again%20to%20load%20your%20profile.");
  return {
    program: typeof data.user.user_metadata?.program === "string" ? data.user.user_metadata.program.slice(0, 80) : "",
    programEditable: true,
  };
}
