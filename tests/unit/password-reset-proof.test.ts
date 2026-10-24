import { expect, it } from "vitest";
import { recentResetProofs, resetProof, resetProofUsed } from "@/lib/password-reset-proof";
it("binds reset proof to the user and server secret without exposing a six-digit code", () => {
  const proof = resetProof("alice", "123456", "secret"); expect(proof).toHaveLength(64); expect(proof).not.toContain("123456");
  expect(resetProof("bob", "123456", "secret")).not.toBe(proof); expect(resetProof("alice", "123456", "other")).not.toBe(proof);
  expect(resetProofUsed([{ proof, expires: 180 }], proof)).toBe(true);
});
it("keeps all recent proofs, preventing replay across multiple successful resets", () => {
  const first = resetProof("alice", "123456", "secret"), second = resetProof("alice", "654321", "secret");
  const recent = recentResetProofs([{ proof: first, expires: 120 }, { proof: second, expires: 180 }], 100);
  expect(resetProofUsed(recent, first)).toBe(true); expect(resetProofUsed(recent, second)).toBe(true);
  expect(recentResetProofs(recent, 200)).toEqual([]);
});
it.each(["bad", [{}], [{ proof: "bad", expires: 100 }], [{ proof: "a".repeat(64), expires: "future" }], Array(11).fill({ proof: "a".repeat(64), expires: 100 })])("fails closed on malformed proof state %#", state => {
  expect(() => recentResetProofs(state, 0)).toThrow();
});
