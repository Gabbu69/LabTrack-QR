import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const RECOVERY_METADATA_KEY = "labtrack_mfa_recovery";

export function createRecoveryCode() {
  return randomBytes(16).toString("hex").toUpperCase().match(/.{8}/g)!.join("-");
}

export function recoveryCodeHash(userId: string, code: string) {
  const normalized = code.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-F0-9]{32}$/.test(normalized)) return null;
  return createHash("sha256").update(`labtrack-recovery-v1:${userId}:${normalized}`).digest("hex");
}

export function matchesRecoveryCode(userId: string, code: string, stored: unknown) {
  const hash = recoveryCodeHash(userId, code);
  return Boolean(hash && typeof stored === "string" && /^[a-f0-9]{64}$/.test(stored)
    && timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(stored, "hex")));
}
