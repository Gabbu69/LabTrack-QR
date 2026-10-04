import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEMO_GUIDE_ACCOUNTS as accounts } from "@/lib/demo-identities";

// Only these explicitly public demo accounts may be offered by the guide.
export async function getDemoAccess(role: unknown) {
  if (typeof role !== "string" || !Object.hasOwn(accounts, role)) return null;
  const email = accounts[role as keyof typeof accounts];
  const password = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!password) return null;
  try {
    const { data, error } = await createAdminClient().from("profiles")
      .select("role,status,data_scope,must_change_password")
      .eq("email", email).single();
    if (error || !data || data.role !== role || data.status !== "active"
      || data.data_scope !== "demo" || data.must_change_password) return null;
    return { email, password, role };
  } catch {
    return null;
  }
}
