import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";
import { requireSupabaseEnv } from "@/lib/env";
import { authCookieOptions } from "@/lib/session-policy";

export async function createClient() {
  const { supabaseUrl, supabasePublishableKey } = requireSupabaseEnv();
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabasePublishableKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies. src/proxy.ts refreshes them.
        }
      },
    },
  });
}
