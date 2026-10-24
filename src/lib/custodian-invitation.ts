import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";

const invitationSchema = z.object({
  purpose: z.literal("custodian-account-setup"),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  expires: z.number().int().positive(),
  nonce: z.uuid(),
}).strict();

function signature(payload: string, secret: string) {
  if (!secret) throw new Error("Account setup is unavailable.");
  return createHmac("sha256", secret).update(`labtrack-custodian-invitation-v1:${payload}`).digest("base64url");
}

export function createCustodianInvitation(input: { name: string; email: string }, secret: string, now = Math.floor(Date.now() / 1000)) {
  const invitation = invitationSchema.parse({ ...input, purpose: "custodian-account-setup", nonce: randomUUID(), expires: now + 3600 });
  const payload = Buffer.from(JSON.stringify(invitation)).toString("base64url");
  return `${payload}.${signature(payload, secret)}`;
}

export function readCustodianInvitation(token: unknown, secret: string, now = Math.floor(Date.now() / 1000)) {
  if (typeof token !== "string" || token.length > 2048 || !secret) return null;
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra) return null;
  const expected = Buffer.from(signature(payload, secret));
  const actual = Buffer.from(mac);
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  try {
    const invitation = invitationSchema.parse(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
    if (invitation.expires <= now || invitation.expires > now + 3600) return null;
    return invitation;
  } catch { return null; }
}
