import { createHmac, timingSafeEqual } from "node:crypto";

export const PASSWORD_RESET_PROOFS = "labtrack_otp_password_resets";
export type ResetProof = { proof: string; expires: number };

export function resetProof(userId: string, code: string, secret: string) {
  return createHmac("sha256", secret).update(`labtrack-password-reset-v1:${userId}:${code}`).digest("hex");
}

export function recentResetProofs(value: unknown, now: number): ResetProof[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > 10 || value.some(item => !item || typeof item.proof !== "string" || !/^[a-f0-9]{64}$/.test(item.proof) || !Number.isFinite(item.expires))) throw new Error("Invalid reset proof state.");
  return value.filter(item => item.expires > now);
}

export function resetProofUsed(proofs: ResetProof[], proof: string) {
  return proofs.some(item => timingSafeEqual(Buffer.from(item.proof, "hex"), Buffer.from(proof, "hex")));
}
