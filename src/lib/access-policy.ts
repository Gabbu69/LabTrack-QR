import type { AppRole, Profile } from "@/types/app";
import { requiresMfa } from "@/lib/mfa";

export type AccessOptions = { roles?: AppRole[]; active?: boolean; allowPasswordChange?: boolean; allowMfaSetup?: boolean };

export function accessFailure(profile: Profile | null, options: AccessOptions = {}, aal?: unknown, emailOtpVerified = false) {
  if (!profile) return { status: 401, code: "AUTH_REQUIRED", message: "Your session has expired. Sign in again." };
  if (!["student", "instructor", "custodian"].includes(profile.role) || !["pending", "active", "disabled"].includes(profile.status)) {
    return { status: 403, code: "ACCESS_DENIED", message: "Your account permissions are invalid. Contact the custodian." };
  }
  if (profile.status === "disabled") return { status: 403, code: "ACCOUNT_DISABLED", message: "This account is disabled. Contact the custodian." };
  if (!options.allowMfaSetup && requiresMfa(profile, aal, emailOtpVerified)) return { status: 403, code: "MFA_REQUIRED", message: "Verify your sign-in code before continuing." };
  if (profile.must_change_password && !options.allowPasswordChange) return { status: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "Set a private password before continuing." };
  if (options.active && profile.status !== "active") return { status: 403, code: "APPROVAL_REQUIRED", message: "Custodian approval is required before continuing." };
  if (options.roles && !options.roles.includes(profile.role)) return { status: 403, code: "ACCESS_DENIED", message: "You do not have access to this action." };
  return null;
}
