import type { Profile } from "@/types/app";

export type MfaFactor = { id: string; name: string };
export type MfaActionState = {
  error?: string;
  message?: string;
  enrollment?: { factorId: string; uri: string; secret: string };
};

export function requiresMfa(profile: Pick<Profile, "data_scope">, aal: unknown) {
  // Only the database-controlled demo scope is exempt, never email or user metadata.
  return profile.data_scope !== "demo" && aal !== "aal2";
}
