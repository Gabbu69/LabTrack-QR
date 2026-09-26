import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getProfile } from "@/lib/auth";
import { accessFailure, type AccessOptions } from "@/lib/access-policy";
import type { Profile } from "@/types/app";

export function apiRoute(options: AccessOptions, handler: (request: NextRequest, profile: Profile) => Promise<Response>) {
  return async (request: NextRequest) => {
    try {
      if (!["GET", "HEAD"].includes(request.method)) {
        const origin = request.headers.get("origin");
        if ((origin && origin !== request.nextUrl.origin) || request.headers.get("sec-fetch-site") === "cross-site") {
          return NextResponse.json({ error: "This request must come from LabTrack.", code: "INVALID_ORIGIN" }, { status: 403 });
        }
      }
      const profile = await getProfile();
      const failure = accessFailure(profile, options);
      if (failure) return NextResponse.json({ error: failure.message, code: failure.code }, { status: failure.status, headers: { "Cache-Control": "private, no-store" } });
      const response = await handler(request, profile!);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    } catch {
      return NextResponse.json({ error: "The service could not complete this request. Please try again.", code: "SERVICE_UNAVAILABLE" }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
    }
  };
}

export function databaseFailure(error: { code?: string }, fallback: string) {
  const status = error.code === "42501" ? 403 : ["P0001", "23505", "23514"].includes(error.code ?? "") ? 409 : 503;
  return NextResponse.json({ error: fallback }, { status });
}
