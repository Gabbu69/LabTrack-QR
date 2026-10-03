import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";

// Explicit disposable-account opt-in. Never enroll existing or shared demo users.
if (process.env.MFA_ALLOW_DISPOSABLE_ACCOUNT !== "true") throw new Error("Set MFA_ALLOW_DISPOSABLE_ACCOUNT=true for the authorized disposable-account trial.");
const base = new URL(process.argv[2] || "http://localhost:3000");
if (!(["localhost", "127.0.0.1"].includes(base.hostname) || base.hostname.endsWith(".vercel.app"))) throw new Error("Unexpected application target.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
if (url !== "https://tsusogeqjduyahoskteb.supabase.co") throw new Error("Unexpected Supabase project.");
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const counter = async () => {
  const result = {};
  for (const name of ["profiles", "tools", "transactions", "transaction_items"]) {
    const { count, error } = await admin.from(name).select("id", { count: "exact", head: true });
    assert.equal(error, null, `Count ${name}`); result[name] = count;
  }
  return result;
};
function totp(secret) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of secret.toUpperCase().replace(/=+$/, "")) { assert(alphabet.includes(char)); bits += alphabet.indexOf(char).toString(2).padStart(5, "0"); }
  const key = Buffer.from((bits.match(/.{8}/g) || []).map(byte => parseInt(byte, 2)));
  const step = Buffer.alloc(8); step.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30000)));
  const hash = createHmac("sha1", key).update(step).digest(); const offset = hash.at(-1) & 15;
  return String((hash.readUInt32BE(offset) & 0x7fffffff) % 1000000).padStart(6, "0");
}
const before = await counter();
const email = `mfa-audit-${Date.now()}-${randomBytes(4).toString("hex")}@test.invalid`;
const password = `Audit!${randomBytes(24).toString("base64url")}9a`;
let id, browser;
try {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { full_name: "Disposable MFA Verification" }, app_metadata: { labtrack_staff_role: "custodian", labtrack_data_scope: "operational" } });
  assert.equal(created.error, null, "Disposable Auth account creation"); id = created.data.user.id;
  const prepared = await admin.from("profiles").update({ role: "custodian", data_scope: "operational", student_id: null, status: "active", must_change_password: false }).eq("id", id).select("id,data_scope,role").single();
  assert.equal(prepared.error, null, "Prepare only the new fixture profile"); assert.equal(prepared.data.data_scope, "operational"); assert.equal(prepared.data.role, "custodian");
  if (process.env.MFA_REQUIRE_DATABASE_GATE === "true") {
    const passwordOnly = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await passwordOnly.auth.signInWithPassword({ email, password })).error, null);
    assert.equal((await passwordOnly.rpc("dashboard_summary")).error?.code, "42501", "Direct password-only operational RPC is denied");
    const tools = await passwordOnly.from("tools").select("id").limit(1); assert.equal(tools.error, null); assert.deepEqual(tools.data, [], "Direct AAL1 inventory rows are hidden");
    await passwordOnly.auth.signOut({ scope: "local" });
    console.log("PASS: hosted database directly rejects AAL1 RPC and inventory access");
  }
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const context = await browser.newContext(); // No video, traces, screenshots or saved authentication state.
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET && base.hostname.endsWith(".vercel.app")) await context.request.get(base.href, { headers: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" } });
  const page = await context.newPage(); page.setDefaultTimeout(45000);
  async function signIn() {
    await page.goto(new URL("/login", base).href); await page.getByLabel("Email address").fill(email); await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL("**/two-factor");
  }
  async function setup(name) {
    await page.getByLabel("Authenticator name", { exact: false }).fill(name);
    await page.getByRole("button", { name: name === "Audit phone" ? "Set up authenticator" : "Add authenticator", exact: true }).click();
    await page.locator(".mfa-manual-key").waitFor(); const secret = await page.locator(".mfa-manual-key code").textContent(); assert(secret);
    await page.getByLabel("6-digit code", { exact: true }).fill(totp(secret)); await page.getByRole("button", { name: "Confirm authenticator", exact: true }).click();
    return secret;
  }
  await signIn();
  const session = await context.request.get(new URL("/api/session", base).href); assert.equal(session.status(), 403, "AAL1 cannot authorize portal APIs");
  await page.goto(new URL("/dashboard", base).href); await page.waitForURL("**/two-factor");
  const secret = await setup("Audit phone"); await page.waitForURL("**/dashboard");
  assert.equal((await context.request.get(new URL("/api/session", base).href)).status(), 204);
  console.log("PASS: real hosted initial enrollment, AAL1 rejection and AAL2 portal access");
  // A new browser forces a fresh password-only session.
  await context.close(); const second = await browser.newContext();
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET && base.hostname.endsWith(".vercel.app")) await second.request.get(base.href, { headers: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" } });
  // Reuse helpers through a new page while closing the first authenticated context.
  const login = await second.newPage(); login.setDefaultTimeout(45000);
  await login.goto(new URL("/login", base).href); await login.getByLabel("Email address").fill(email); await login.getByLabel("Password", { exact: true }).fill(password);
  await login.getByRole("button", { name: "Sign in", exact: true }).click(); await login.waitForURL("**/two-factor");
  const current = totp(secret); const invalid = String((Number(current) + 1) % 1000000).padStart(6, "0");
  await login.getByLabel("6-digit code", { exact: true }).fill(invalid); await login.getByRole("button", { name: "Verify and continue", exact: true }).click();
  await login.getByText("Code was not accepted. Use the current code and try again.", { exact: true }).waitFor();
  assert.equal((await second.request.get(new URL("/api/session", base).href)).status(), 403);
  await login.getByLabel("6-digit code", { exact: true }).fill(totp(secret)); await login.getByRole("button", { name: "Verify and continue", exact: true }).click(); await login.waitForURL("**/dashboard");
  await login.goto(new URL("/two-factor?manage=1", base).href);
  assert.equal(await login.getByRole("button", { name: "Remove Audit phone", exact: true }).count(), 0, "Last factor removal is unavailable");
  await login.getByLabel("Authenticator name", { exact: false }).fill("Audit backup"); await login.getByRole("button", { name: "Add authenticator", exact: true }).click();
  await login.locator(".mfa-manual-key code").waitFor({ state: "attached" }); const backupSecret = await login.locator(".mfa-manual-key code").textContent(); assert(backupSecret);
  await login.getByLabel("6-digit code", { exact: true }).fill(totp(backupSecret)); await login.getByRole("button", { name: "Confirm authenticator", exact: true }).click();
  await login.getByRole("button", { name: "Remove Audit phone", exact: true }).waitFor(); await login.getByRole("button", { name: "Remove Audit phone", exact: true }).click();
  await login.getByText("Authenticator removed.", { exact: true }).waitFor(); assert.equal(await login.getByRole("button", { name: "Remove Audit backup", exact: true }).count(), 0);
  console.log("PASS: subsequent sign-in, invalid-code rejection, verified backup, device replacement and last-factor guard");
} finally {
  await browser?.close();
  if (id) { const deleted = await admin.auth.admin.deleteUser(id); assert.equal(deleted.error, null, "Disposable account cleanup"); }
  assert.deepEqual(await counter(), before, "Existing hosted record counts remain unchanged");
  console.log("PASS: disposable account removed; hosted profile/tool/transaction/item counts unchanged");
}
