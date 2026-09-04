import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { publicEnv, requireSupabaseEnv, requireSupabaseSecret } from "@/lib/env";

export function createAdminClient() {
  requireSupabaseEnv();
  return createClient<Database>(publicEnv.supabaseUrl, requireSupabaseSecret(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
