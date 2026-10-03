import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";
import { authCookieOptions, IDLE_SECONDS, MAX_SESSION_SECONDS, readSession, SESSION_COOKIE, signSession } from "@/lib/session-policy";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!isSupabaseConfigured()) return response;

  const supabase = createServerClient<Database>(publicEnv.supabaseUrl, publicEnv.supabasePublishableKey, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub;
  const sessionId = data?.claims?.session_id;
  if (typeof user === "string" && typeof sessionId === "string") {
    const session = readSession(request.cookies.get(SESSION_COOKIE)?.value, user, sessionId);
    if (session && request.nextUrl.pathname !== "/api/session" && !request.headers.has("next-router-prefetch") && request.headers.get("purpose") !== "prefetch") {
      const now = Math.floor(Date.now() / 1000);
      const value = signSession({ ...session, seen: now });
      request.cookies.set(SESSION_COOKIE, value);
      response.cookies.set(SESSION_COOKIE, value, { ...authCookieOptions, maxAge: Math.min(IDLE_SECONDS, session.started + MAX_SESSION_SECONDS - now) });
    } else if (!session) {
      await supabase.auth.signOut({ scope: "local" });
      request.cookies.delete(SESSION_COOKIE);
      response.cookies.delete(SESSION_COOKIE);
    }
    response.headers.set("Cache-Control", "private, no-store");
  }
  return response;
}
