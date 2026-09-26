import type { AppRole, Profile } from "@/types/app";

export type AccessOptions = { roles?: AppRole[]; active?: boolean; allowPasswordChange?: boolean };

export function accessFailure(profile: Profile | null, options: AccessOptions = {}) {
  if (!profile) return { status: 401, code: "AUTH_REQUIRED", message: "Your session has expired. Sign in again." };
  if (profile.status === "disabled") return { status: 403, code: "ACCOUNT_DISABLED", message: "This account is disabled. Contact the custodian." };
  if (profile.must_change_password && !options.allowPasswordChange) return { status: 403, code: "PASSWORD_CHANGE_REQUIRED", message: "Set a private password before continuing." };
  if (options.active && profile.status !== "active") return { status: 403, code: "APPROVAL_REQUIRED", message: "Custodian approval is required before continuing." };
  if (options.roles && !options.roles.includes(profile.role)) return { status: 403, code: "ACCESS_DENIED", message: "You do not have access to this action." };
  return null;
}
