import { createHmac } from "node:crypto";
import { expect, it } from "vitest";
import { createCustodianInvitation, readCustodianInvitation } from "@/lib/custodian-invitation";

const secret = "unit-test-owner-secret-which-is-not-a-production-key";
const now = 1_800_000_000;
const identity = { name: "Lab Custodian", email: "custodian@example.test" };

it("binds an expiring owner-issued invitation to the exact normalized account", () => {
  const token = createCustodianInvitation({ name: " Lab Custodian ", email: "CUSTODIAN@example.test" }, secret, now);
  expect(readCustodianInvitation(token, secret, now)).toMatchObject({ ...identity, purpose: "custodian-account-setup", expires: now + 3600 });
  expect(readCustodianInvitation(token, secret, now + 3599)).not.toBeNull();
  expect(readCustodianInvitation(token, secret, now + 3600)).toBeNull();
});

it("rejects changes to the named account, an incorrect key, or extra token segments", () => {
  const token = createCustodianInvitation(identity, secret, now);
  const [payload, mac] = token.split(".");
  const changed = JSON.parse(Buffer.from(payload, "base64url").toString());
  changed.email = "attacker@example.test";
  expect(readCustodianInvitation(`${Buffer.from(JSON.stringify(changed)).toString("base64url")}.${mac}`, secret, now)).toBeNull();
  expect(readCustodianInvitation(token, "another-secret", now)).toBeNull();
  expect(readCustodianInvitation(`${token}.extra`, secret, now)).toBeNull();
});

it("rejects malformed, future-issued, and unsigned invitations", () => {
  for (const token of [null, "", "x.y", "x".repeat(2049)]) expect(readCustodianInvitation(token, secret, now)).toBeNull();
  expect(readCustodianInvitation(createCustodianInvitation(identity, secret, now + 1), secret, now)).toBeNull();
});

it("rejects signed payloads for another purpose or with injected role fields", () => {
  const [payload] = createCustodianInvitation(identity, secret, now).split(".");
  const original = JSON.parse(Buffer.from(payload, "base64url").toString());
  for (const altered of [{ ...original, purpose: "password-reset" }, { ...original, role: "custodian" }]) {
    const encoded = Buffer.from(JSON.stringify(altered)).toString("base64url");
    const mac = createHmac("sha256", secret).update(`labtrack-custodian-invitation-v1:${encoded}`).digest("base64url");
    expect(readCustodianInvitation(`${encoded}.${mac}`, secret, now)).toBeNull();
  }
});

it("validates identity and gives each invitation a distinct nonce", () => {
  expect(() => createCustodianInvitation({ name: "X", email: "bad" }, secret, now)).toThrow();
  expect(() => createCustodianInvitation(identity, "", now)).toThrow();
  expect(createCustodianInvitation(identity, secret, now)).not.toBe(createCustodianInvitation(identity, secret, now));
});
