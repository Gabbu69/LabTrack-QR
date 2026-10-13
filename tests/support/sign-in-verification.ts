import { createHmac } from "node:crypto";
import { expect, type Page } from "@playwright/test";

// These helpers are only called by the opt-in disposable-backend suite.
// Codes/setup keys remain in memory; that suite disables traces and screenshots.
function authenticatorCode(secret: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase().replace(/=+$/, "")].map(char => {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new Error("Invalid disposable authenticator configuration.");
    return value.toString(2).padStart(5, "0");
  }).join("");
  const key = Buffer.from((bits.match(/.{8}/g) ?? []).map(byte => parseInt(byte, 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const hash = createHmac("sha1", key).update(counter).digest();
  const offset = hash[hash.length - 1] & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}

async function emailCode(page: Page, email: string, sentAfter: number) {
  const configured = process.env.E2E_MAILPIT_URL;
  if (!configured) throw new Error("Email verification requires E2E_MAILPIT_URL for the disposable test inbox.");
  const inbox = new URL(configured);
  if (!/^https?:$/.test(inbox.protocol) || inbox.username || inbox.password) throw new Error("Use a dedicated test inbox URL without embedded credentials.");
  const deadline = Date.now() + 45_000;
  while (Date.now() < deadline) {
    const search = new URL("/api/v1/search", inbox);
    search.searchParams.set("query", `to:${email}`);
    search.searchParams.set("limit", "10");
    const response = await page.request.get(search.href);
    if (!response.ok()) throw new Error("Disposable inbox search is unavailable.");
    const result = await response.json() as { messages: { ID: string; Created: string; To: { Address: string }[] }[] };
    for (const message of result.messages ?? []) {
      if (Date.parse(message.Created) < sentAfter - 5_000 || !message.To.some(recipient => recipient.Address.toLowerCase() === email.toLowerCase())) continue;
      const detail = await page.request.get(new URL(`/api/v1/message/${encodeURIComponent(message.ID)}`, inbox).href);
      if (!detail.ok()) continue;
      const body = await detail.json() as { Text: string; HTML: string };
      const match = `${body.Text}\n${body.HTML.replace(/<[^>]*>/g, " ")}`.match(/\b\d{6}\b/);
      if (match) return match[0];
    }
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
  throw new Error("No fresh six-digit code reached the disposable test inbox.");
}

export async function finishSignInVerification(page: Page, email: string, sentAfter: number, existingSecret?: string): Promise<string | undefined> {
  await page.waitForURL(/\/(dashboard|change-password|two-factor|verify-email)(?:\?|$)/);
  const path = new URL(page.url()).pathname;
  if (path === "/verify-email") {
    await page.getByLabel("6-digit email code", { exact: true }).fill(await emailCode(page, email, sentAfter));
    await page.getByRole("button", { name: "Verify and continue", exact: true }).click();
  } else if (path === "/two-factor") {
    let secret = existingSecret;
    if (await page.getByRole("button", { name: "Set up authenticator", exact: true }).isVisible()) {
      await page.getByLabel("Authenticator name", { exact: false }).fill("Disposable E2E device");
      await page.getByRole("button", { name: "Set up authenticator", exact: true }).click();
      await expect(page.locator(".mfa-manual-key code")).toHaveCount(1);
      secret = (await page.locator(".mfa-manual-key code").textContent())?.trim();
    }
    if (!secret) throw new Error("An existing disposable authenticator needs its private E2E fixture secret.");
    await page.getByLabel("6-digit code", { exact: true }).fill(authenticatorCode(secret));
    await page.getByRole("button", { name: /^(Confirm authenticator|Verify and continue)$/ }).click();
    await expect(page).toHaveURL(/\/(dashboard|change-password)(?:\?|$)/, { timeout: 30_000 });
    return secret;
  }
  await expect(page).toHaveURL(/\/(dashboard|change-password)(?:\?|$)/, { timeout: 30_000 });
  return existingSecret;
}
