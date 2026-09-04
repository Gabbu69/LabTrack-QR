"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "@/lib/env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
  const { supabaseUrl, supabasePublishableKey } = requireSupabaseEnv();
  client ??= createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
  return client;
}
