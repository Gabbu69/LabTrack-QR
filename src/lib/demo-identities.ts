// These are the seven identities restored by the owner's demo seed/reset script.
// The email alone never grants an exemption: use the trusted database profile scope.
export const SHARED_DEMO_EMAILS = [
  "custodian.demo@labtrackqr2026.com",
  "instructor.demo@labtrackqr2026.com",
  "jordan.demo@labtrackqr2026.com",
  "riley.demo@labtrackqr2026.com",
  "taylor.demo@labtrackqr2026.com",
  "blake.demo@labtrackqr2026.com",
  "morgan.demo@labtrackqr2026.com",
] as const;

export const DEMO_GUIDE_ACCOUNTS = {
  custodian: SHARED_DEMO_EMAILS[0],
  instructor: SHARED_DEMO_EMAILS[1],
  student: SHARED_DEMO_EMAILS[2],
} as const;

export function isSharedDemoIdentity(profile: { email?: string | null; data_scope?: string | null }) {
  return profile.data_scope === "demo" && typeof profile.email === "string"
    && SHARED_DEMO_EMAILS.some(email => email === profile.email?.trim().toLowerCase());
}

export const SHARED_DEMO_ACCOUNT_NOTICE = "Shared demo accounts keep their published sign-in details. Contact the deployment owner to recover demonstration access.";
