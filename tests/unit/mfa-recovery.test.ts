import { expect, it } from "vitest";
import { createRecoveryCode, recoveryCodeHash, matchesRecoveryCode } from "@/lib/mfa-recovery";

it("creates distinct 128-bit recovery codes without storing their plaintext", () => {
  const codes = Array.from({ length: 100 }, createRecoveryCode);
  expect(new Set(codes).size).toBe(100);
  for (const code of codes) {
    expect(code).toMatch(/^[A-F0-9]{8}(-[A-F0-9]{8}){3}$/);
    const hash = recoveryCodeHash("alice", code);
    expect(hash).toHaveLength(64);
    expect(hash).not.toContain(code);
    expect(matchesRecoveryCode("alice", code.toLowerCase().replaceAll("-", " "), hash)).toBe(true);
    expect(matchesRecoveryCode("bob", code, hash)).toBe(false);
  }
});

it.each(["", "123456", "G".repeat(32), "A".repeat(31), "A".repeat(33)])("rejects malformed recovery code %s", code => {
  expect(recoveryCodeHash("alice", code)).toBeNull();
  expect(matchesRecoveryCode("alice", code, "a".repeat(64))).toBe(false);
});

it.each([null, undefined, "", "x".repeat(64), {}, "a".repeat(63)])("rejects absent or corrupt stored recovery state %#", stored => {
  expect(matchesRecoveryCode("alice", createRecoveryCode(), stored)).toBe(false);
});
