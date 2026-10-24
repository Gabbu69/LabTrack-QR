import assert from "node:assert/strict";
import { randomBytes, createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "@playwright/test";
import { createCustodianInvitation } from "../src/lib/custodian-invitation.ts";
import sharp from "sharp";

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
const existingCustodians = await admin.from("profiles").select("id", { head: true, count: "exact" })
  .eq("role", "custodian").eq("status", "active").eq("data_scope", "operational");
assert.equal(existingCustodians.error, null, "Verify safe cleanup of the disposable staff fixture");
assert(existingCustodians.count > 0, "An existing active operational custodian is required before creating a disposable staff fixture");
const registrationTrial = process.env.MFA_REGISTER_STUDENT === "true";
const temporaryPasswordTrial = process.env.MFA_TEMPORARY_PASSWORD === "true";
const custodianSetupTrial = process.env.MFA_CUSTODIAN_INVITATION === "true";
if (process.env.MFA_FORGOT_PASSWORD_WORKFLOWS === "true" && process.env.MFA_RECOVERY_WORKFLOWS === "true") throw new Error("Run password-reset and lost-authenticator trials separately.");
if ([registrationTrial, temporaryPasswordTrial, custodianSetupTrial].filter(Boolean).length > 1) throw new Error("Run student registration, custodian setup, and temporary staff trials separately.");
const fixtureId = `${Date.now()}-${randomBytes(4).toString("hex")}`;
const email = `mfa-audit-${fixtureId}@${registrationTrial ? "example.com" : "test.invalid"}`;
const studentId = `REG-${fixtureId}`;
const password = `Audit!${randomBytes(24).toString("base64url")}9a`;
let signInPassword = password;
let id, browser, managedStudentId;
const managedEmail = `managed-student-${fixtureId}@test.invalid`;
try {
  browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
  const context = await browser.newContext(); // No video, traces or saved authentication state.
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET && base.hostname.endsWith(".vercel.app")) await context.request.get(base.href, { headers: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" } });
  const page = await context.newPage(); page.setDefaultTimeout(45000);
  if (process.env.MFA_MANAGED_WORKFLOWS === "true") {
    const anonymous = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const attempt = await anonymous.auth.signUp({ email: `signup-denied-${fixtureId}@example.com`, password });
    if (attempt.data.user) await admin.auth.admin.deleteUser(attempt.data.user.id);
    assert.equal(attempt.error?.code, "signup_disabled", "Public provider signup is disabled");
    await page.goto(new URL("/guide", base).href); await page.waitForURL("**/login");
    assert.equal(await page.getByRole("button", { name: "Help and user guide", exact: true }).count(), 0);
    assert.equal(await page.getByText("STEP 1 OF 2", { exact: false }).count(), 0);
    console.log("PASS: direct public signup is blocked; help is not exposed before login");
  }
  if (registrationTrial) {
    async function fillRegistration(target, address) {
      await target.goto(new URL("/register", base).href);
      await target.getByLabel("Full name").fill("Disposable Registration Verification");
      await target.getByLabel(/Student ID/).fill(studentId);
      await target.getByLabel("Year / Section").fill("2nd Year / Audit");
      await target.getByLabel("Group number").fill("Audit");
      await target.getByLabel("Contact number").fill("09000000000");
      await target.getByLabel(/Email address/).fill(address);
      await target.getByLabel("Password", { exact: true }).fill(password);
    }
    await fillRegistration(page, email);
    await page.getByRole("button", { name: "Create account", exact: true }).click();
    await page.waitForURL("**/two-factor");
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    assert.equal(users.error, null); id = users.data.users.find(user => user.email === email)?.id;
    assert(id, "Actual registration creates the disposable Auth account");
    const profile = await admin.from("profiles").select("role,status,data_scope,student_id").eq("id", id).single();
    assert.equal(profile.error, null);
    assert.deepEqual(profile.data, { role: "student", status: "pending", data_scope: "operational", student_id: studentId });
    console.log("PASS: actual registration form creates a pending operational student and establishes sign-in");
    const duplicate = await browser.newContext();
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET && base.hostname.endsWith(".vercel.app")) await duplicate.request.get(base.href, { headers: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" } });
    const duplicatePage = await duplicate.newPage(); duplicatePage.setDefaultTimeout(45000);
    await fillRegistration(duplicatePage, email.replace("mfa-audit-", "duplicate-audit-"));
    await duplicatePage.getByRole("button", { name: "Create account", exact: true }).click();
    await duplicatePage.getByRole("alert").filter({ hasText: "This Student ID already has an account" }).waitFor();
    assert.equal(await duplicatePage.getByLabel("Full name").inputValue(), "Disposable Registration Verification");
    assert.equal(await duplicatePage.getByLabel(/Student ID/).inputValue(), studentId);
    assert.equal(await duplicatePage.getByLabel("Password", { exact: true }).inputValue(), "", "Password is cleared on rejected registration");
    assert.equal(await duplicatePage.getByRole("link", { name: "Go to sign in" }).getAttribute("href"), "/login");
    for (const width of [320, 390, 1366]) {
      await duplicatePage.setViewportSize({ width, height: 900 });
      assert(await duplicatePage.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), "Registration error fits the viewport");
    }
    await duplicate.close();
    console.log("PASS: duplicate Student ID explains recovery, preserves details, clears password and fits mobile/desktop");
  } else if (custodianSetupTrial) {
    const invitation = createCustodianInvitation({ name: "Disposable Custodian Setup", email }, process.env.SUPABASE_SECRET_KEY);
    const setupUrl = new URL("/setup-custodian", base);
    setupUrl.searchParams.set("invitation", invitation);
    await page.goto(setupUrl.href);
    assert.equal(await page.getByLabel("Email address", { exact: true }).inputValue(), email);
    await page.getByLabel("Create password", { exact: true }).fill(password);
    await page.getByLabel("Confirm password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Create custodian account", exact: true }).click();
    await page.waitForFunction(() => location.pathname === "/login" || document.querySelector('[role="alert"]'));
    if (new URL(page.url()).pathname !== "/login") throw new Error(`Custodian setup: ${await page.getByRole("alert").textContent()}`);
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    assert.equal(users.error, null); id = users.data.users.find(user => user.email === email)?.id;
    assert(id, "Actual setup form creates the named account");
    const prepared = await admin.from("profiles").select("role,status,data_scope,must_change_password,student_id").eq("id", id).single();
    assert.equal(prepared.error, null);
    assert.deepEqual(prepared.data, { role: "custodian", status: "active", data_scope: "operational", must_change_password: false, student_id: null });
    // Replay cannot replace this account's chosen password or authenticators.
    await page.goto(setupUrl.href);
    await page.getByLabel("Create password", { exact: true }).fill(`Different!${randomBytes(20).toString("hex")}8`);
    await page.getByLabel("Confirm password", { exact: true }).fill(await page.getByLabel("Create password", { exact: true }).inputValue());
    await page.getByRole("button", { name: "Create custodian account", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "The account could not be created" }).waitFor();
    console.log("PASS: private setup form creates real operational custodian; replay cannot overwrite the chosen password");
  } else {
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true,
    user_metadata: { full_name: "Disposable MFA Verification" }, app_metadata: { labtrack_staff_role: "custodian", labtrack_data_scope: "operational" } });
  assert.equal(created.error, null, "Disposable Auth account creation"); id = created.data.user.id;
  const prepared = await admin.from("profiles").update({ role: "custodian", data_scope: "operational", student_id: null, status: "active", must_change_password: temporaryPasswordTrial }).eq("id", id).select("id,data_scope,role").single();
  assert.equal(prepared.error, null, "Prepare only the new fixture profile"); assert.equal(prepared.data.data_scope, "operational"); assert.equal(prepared.data.role, "custodian");
  }
  if (process.env.MFA_REQUIRE_DATABASE_GATE === "true") {
    const passwordOnly = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await passwordOnly.auth.signInWithPassword({ email, password })).error, null);
    assert.equal((await passwordOnly.rpc("dashboard_summary")).error?.code, "42501", "Direct password-only operational RPC is denied");
    const tools = await passwordOnly.from("tools").select("id").limit(1); assert.equal(tools.error, null); assert.deepEqual(tools.data, [], "Direct AAL1 inventory rows are hidden");
    await passwordOnly.auth.signOut({ scope: "local" });
    console.log("PASS: hosted database directly rejects AAL1 RPC and inventory access");
  }
  async function signIn() {
    await page.goto(new URL("/login", base).href); await page.getByLabel("Email address").fill(email); await page.getByLabel("Password", { exact: true }).fill(signInPassword);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL("**/two-factor");
  }
  async function setup(name) {
    await page.getByLabel("Authenticator name", { exact: false }).fill(name);
    await page.getByRole("button", { name: name === "Audit phone" ? "Set up authenticator" : "Add authenticator", exact: true }).click();
    await page.locator(".mfa-manual-key").waitFor(); const secret = await page.locator(".mfa-manual-key code").textContent(); assert(secret);
    await page.getByLabel("6-digit code", { exact: true }).fill(totp(secret)); await page.getByRole("button", { name: "Confirm authenticator", exact: true }).click();
    if (name === "Audit phone") {
      await page.waitForURL("**/recovery-code"); await page.getByRole("button", { name: "Create recovery code", exact: true }).click();
      await page.locator(".recovery-code").waitFor();
      const recovery = await page.locator(".recovery-code").textContent(); assert.match(recovery, /^[A-F0-9]{8}(-[A-F0-9]{8}){3}$/);
      await page.setViewportSize({ width: 390, height: 844 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Recovery code fits mobile width");
      await page.screenshot({ path: "output/playwright/recovery-setup-mobile-redacted.png", fullPage: true, mask: [page.locator(".recovery-code")] });
      await page.setViewportSize({ width: 1366, height: 900 });
      await page.getByLabel("I saved my recovery code", { exact: true }).check();
      await page.getByRole("button", { name: "Continue", exact: true }).click();
    }
    return secret;
  }
  await signIn();
  const session = await context.request.get(new URL("/api/session", base).href); assert.equal(session.status(), 403, "AAL1 cannot authorize portal APIs");
  assert.equal((await context.request.get(new URL("/api/reports/inventory.csv", base).href)).status(), 403, "Password-only sign-in cannot export inventory");
  await page.goto(new URL("/dashboard", base).href); await page.waitForURL("**/two-factor");
  const secret = await setup("Audit phone");
  if (temporaryPasswordTrial) {
    await page.waitForURL("**/change-password");
    const protectedRecords = await context.request.get(new URL("/api/reports/transactions.csv", base).href);
    assert.equal(protectedRecords.status(), 403, "AAL2 alone does not bypass temporary-password restriction on records");
    assert.equal((await protectedRecords.json()).code, "PASSWORD_CHANGE_REQUIRED");
    const changing = await admin.from("profiles").select("must_change_password").eq("id", id).single();
    assert.equal(changing.error, null); assert.equal(changing.data.must_change_password, true);
    signInPassword = `Private!${randomBytes(24).toString("base64url")}8b`;
    await page.getByLabel("New password", { exact: true }).fill(signInPassword);
    await page.getByLabel("Confirm password", { exact: true }).fill(signInPassword);
    await page.getByRole("button", { name: "Save password and continue", exact: true }).click();
    console.log("PASS: operational temporary staff verify their authenticator before replacing the temporary password");
  }
  await page.waitForURL("**/dashboard");
  assert.equal((await context.request.get(new URL("/api/session", base).href)).status(), 204);
  const inventory = await context.request.get(new URL("/api/reports/inventory.csv", base).href);
  assert.equal(inventory.status(), registrationTrial ? 403 : 200, "Inventory export respects the verified account role and approval");
  assert.equal(inventory.headers()["cache-control"], "private, no-store");
  if (!registrationTrial) assert((await inventory.text()).startsWith("\uFEFFAsset Code,Tool,Category,Condition,Status,Description"));
  console.log("PASS: real hosted initial enrollment, AAL1 rejection and AAL2 portal access");
  if (process.env.MFA_MANAGED_WORKFLOWS === "true") {
    await page.getByRole("button", { name: "Help and user guide", exact: true }).click();
    await page.getByRole("dialog", { name: "Help & user guide" }).waitFor();
    await page.getByRole("button", { name: "Close help", exact: true }).click();
    await page.goto(new URL("/profile", base).href);
    assert.equal(await page.getByLabel("Group number", { exact: true }).count(), 0);
    await page.getByLabel("Course / Program", { exact: true }).fill("Aircraft Maintenance Technology");
    const image = await sharp({ create: { width: 64, height: 64, channels: 3, background: "#07577f" } }).png().toBuffer();
    await page.getByLabel("Profile picture", { exact: true }).setInputFiles({ name: "verification-picture.png", mimeType: "image/png", buffer: image });
    await page.getByRole("button", { name: "Save profile", exact: true }).click();
    await page.waitForURL("**/profile?message=*");
    await page.reload();
    assert.equal(await page.getByLabel("Course / Program", { exact: true }).inputValue(), "Aircraft Maintenance Technology");
    const saved = await admin.from("profiles").select("photo_path").eq("id", id).single();
    assert.equal(saved.error, null); assert(saved.data.photo_path?.startsWith(`${id}/profile-`));
    await page.getByRole("img", { name: "Profile photo", exact: true }).waitFor();
    const object = await admin.storage.from("profile-photos").download(saved.data.photo_path);
    assert.equal(object.error, null); assert.equal(object.data.type, "image/webp");
    console.log("PASS: profile picture uploaded to real private storage and survives refresh; Course / Program persists");
    await page.goto(new URL("/users", base).href);
    await page.getByText("Create a student account", { exact: true }).click();
    const studentForm = page.locator("form").filter({ has: page.getByRole("button", { name: "Create student account", exact: true }) });
    const temporary = `Temporary!${randomBytes(20).toString("hex")}7a`;
    await studentForm.getByLabel("Full name", { exact: true }).fill("Disposable Managed Student");
    await studentForm.getByLabel("Email address", { exact: true }).fill(managedEmail);
    await studentForm.getByLabel("Student ID", { exact: true }).fill(`MANAGED-${fixtureId}`);
    await studentForm.getByLabel("Year / Section", { exact: true }).fill("2nd Year / Verification");
    await studentForm.getByLabel("Course / Program", { exact: true }).fill("Aircraft Maintenance Technology");
    await studentForm.getByLabel("Contact number", { exact: true }).fill("09000000000");
    await studentForm.getByLabel("One-time temporary password", { exact: false }).fill(temporary);
    await studentForm.getByRole("button", { name: "Create student account", exact: true }).click();
    await page.waitForURL("**/users?message=*");
    const createdStudent = await admin.from("profiles").select("id,role,status,data_scope,must_change_password").eq("email", managedEmail).single();
    assert.equal(createdStudent.error, null); managedStudentId = createdStudent.data.id;
    assert.equal(createdStudent.data.role, "student"); assert.equal(createdStudent.data.data_scope, "operational"); assert(createdStudent.data.must_change_password);
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage(); studentPage.setDefaultTimeout(45000);
    await studentPage.goto(new URL("/login", base).href);
    await studentPage.getByLabel("Email address", { exact: true }).fill(managedEmail);
    await studentPage.getByLabel("Password", { exact: true }).fill(temporary);
    await studentPage.getByRole("button", { name: "Sign in", exact: true }).click(); await studentPage.waitForURL("**/two-factor");
    await studentPage.getByRole("button", { name: "Set up authenticator", exact: true }).click();
    const studentSecret = await studentPage.locator(".mfa-manual-key code").textContent(); assert(studentSecret);
    await studentPage.getByLabel("6-digit code", { exact: true }).fill(totp(studentSecret));
    await studentPage.getByRole("button", { name: "Confirm authenticator", exact: true }).click();
    await studentPage.waitForURL("**/recovery-code"); await studentPage.getByRole("button", { name: "Create recovery code", exact: true }).click();
    await studentPage.getByLabel("I saved my recovery code", { exact: true }).check(); await studentPage.getByRole("button", { name: "Continue", exact: true }).click(); await studentPage.waitForURL("**/change-password");
    const privatePassword = `Private!${randomBytes(20).toString("hex")}9b`;
    await studentPage.getByLabel("New password", { exact: true }).fill(privatePassword);
    await studentPage.getByLabel("Confirm password", { exact: true }).fill(privatePassword);
    await studentPage.getByRole("button", { name: "Save password and continue", exact: true }).click(); await studentPage.waitForURL("**/dashboard");
    await studentPage.goto(new URL("/users", base).href); await studentPage.waitForURL("**/dashboard?error=*");
    await studentContext.close();
    console.log("PASS: only verified custodian creates a real student account; student enrolls authenticator, replaces temporary password, and cannot open account management");
    await page.goto(new URL("/dashboard", base).href);
    await page.getByRole("button", { name: "Log Out", exact: true }).click();
    await page.getByRole("button", { name: "Stay signed in", exact: true }).click();
    assert.equal((await context.request.get(new URL("/api/session", base).href)).status(), 204);
    await page.getByRole("button", { name: "Log Out", exact: true }).click();
    await page.getByRole("button", { name: "Yes, log out", exact: true }).click(); await page.waitForURL("**/login");
    assert.equal((await context.request.get(new URL("/api/session", base).href)).status(), 401);
    console.log("PASS: logout asks for confirmation; cancel preserves the session and confirm ends it");
  }
  // A new browser forces a fresh password-only session.
  await context.close(); const second = await browser.newContext();
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET && base.hostname.endsWith(".vercel.app")) await second.request.get(base.href, { headers: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" } });
  // Reuse helpers through a new page while closing the first authenticated context.
  const login = await second.newPage(); login.setDefaultTimeout(45000);
  await login.goto(new URL("/login", base).href); await login.getByLabel("Email address").fill(email); await login.getByLabel("Password", { exact: true }).fill(signInPassword);
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
  if (process.env.MFA_FORGOT_PASSWORD_WORKFLOWS === "true") {
    const resetBrowser = await browser.newContext({ extraHTTPHeaders: { "x-forwarded-for": `2001:db8:${randomBytes(2).toString("hex")}::1` } });
    const resetPage = await resetBrowser.newPage(); resetPage.setDefaultTimeout(45000);
    const beforeResetUser = await admin.auth.admin.getUserById(id); assert.equal(beforeResetUser.error, null);
    const beforeResetFactors = await admin.auth.admin.mfa.listFactors({ userId: id }); assert.equal(beforeResetFactors.error, null);
    const oldPassword = signInPassword; const newPassword = `Reset!${randomBytes(22).toString("hex")}4a`;
    await resetPage.goto(new URL("/login", base).href); await resetPage.getByRole("link", { name: "Forgot password?", exact: true }).click(); await resetPage.waitForURL("**/forgot-password");
    assert.equal(await resetPage.getByRole("button", { name: "Help and user guide", exact: true }).count(), 0);
    await resetPage.setViewportSize({ width: 390, height: 844 });
    assert(await resetPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "Password reset fits mobile width");
    await resetPage.screenshot({ path: "output/playwright/forgot-password-mobile.png", fullPage: true });
    await resetPage.setViewportSize({ width: 1366, height: 900 });
    await resetPage.screenshot({ path: "output/playwright/forgot-password-desktop.png", fullPage: true });
    async function fillReset(code, password) {
      await resetPage.getByLabel("Email address", { exact: true }).fill(email);
      await resetPage.getByLabel("Authenticator code", { exact: true }).fill(code);
      await resetPage.getByLabel("New password", { exact: true }).fill(password);
      await resetPage.getByLabel("Confirm new password", { exact: true }).fill(password);
    }
    const invalidResetCode = String((Number(totp(backupSecret)) + 1) % 1000000).padStart(6, "0");
    await fillReset(invalidResetCode, newPassword); await resetPage.getByRole("button", { name: "Reset password", exact: true }).click();
    await resetPage.getByRole("alert").filter({ hasText: "Check your email and authenticator code" }).waitFor();
    assert.equal((await resetBrowser.request.get(new URL("/api/session", base).href)).status(), 401);
    const oldCheck = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert.equal((await oldCheck.auth.signInWithPassword({ email, password: oldPassword })).error, null, "Wrong OTP cannot change the original password"); await oldCheck.auth.signOut({ scope: "local" });
    await new Promise(resolve => setTimeout(resolve, 31000 - Date.now() % 30000));
    const resetCode = totp(backupSecret);
    await fillReset(resetCode, newPassword); await resetPage.getByRole("button", { name: "Reset password", exact: true }).click();
    await resetPage.waitForURL("**/login?message=*", { timeout: 60000 }).catch(async error => { console.error("Password-reset notices:", await resetPage.locator(".notice.error").allTextContents()); throw error; });
    await resetPage.getByText("Password reset. Sign in with your new password.", { exact: true }).waitFor();
    assert.equal((await resetBrowser.request.get(new URL("/api/session", base).href)).status(), 401, "Password reset never grants a portal session");
    assert.equal((await resetBrowser.cookies()).filter(cookie => cookie.name === "labtrack-session" || cookie.name.startsWith("sb-")).length, 0, "Provider recovery session never reaches browser cookies");
    const afterResetUser = await admin.auth.admin.getUserById(id); assert.equal(afterResetUser.error, null);
    assert.equal(afterResetUser.data.user.app_metadata.labtrack_mfa_recovery?.hash, beforeResetUser.data.user.app_metadata.labtrack_mfa_recovery?.hash, "Password reset preserves the saved recovery code");
    const proofs = afterResetUser.data.user.app_metadata.labtrack_otp_password_resets; assert(Array.isArray(proofs) && proofs.length === 1);
    assert.deepEqual(Object.keys(proofs[0]).sort(), ["expires", "proof"]); assert.match(proofs[0].proof, /^[a-f0-9]{64}$/);
    const check = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    assert((await check.auth.signInWithPassword({ email, password: oldPassword })).error, "Old password is rejected after reset");
    assert.equal((await check.auth.signInWithPassword({ email, password: newPassword })).error, null, "New password works");
    const afterResetFactors = await check.auth.mfa.listFactors(); assert.equal(afterResetFactors.error, null);
    assert.deepEqual(afterResetFactors.data.all.map(factor => factor.id).sort(), beforeResetFactors.data.factors.map(factor => factor.id).sort(), "Existing authenticators remain linked");
    assert.equal((await check.rpc("dashboard_summary")).error?.code, "42501", "New password alone cannot bypass MFA"); await check.auth.signOut({ scope: "local" });
    await resetPage.goto(new URL("/forgot-password", base).href); await fillReset(resetCode, `Replay!${randomBytes(20).toString("hex")}8b`); await resetPage.getByRole("button", { name: "Reset password", exact: true }).click();
    await resetPage.getByRole("alert").filter({ hasText: "Check your email and authenticator code" }).waitFor();
    await resetPage.goto(new URL("/login", base).href); await resetPage.getByLabel("Email address", { exact: true }).fill(email); await resetPage.getByLabel("Password", { exact: true }).fill(newPassword); await resetPage.getByRole("button", { name: "Sign in", exact: true }).click(); await resetPage.waitForURL("**/two-factor");
    assert.equal(await resetPage.getByRole("button", { name: "Set up authenticator", exact: true }).count(), 0);
    await new Promise(resolve => setTimeout(resolve, 31000 - Date.now() % 30000));
    await resetPage.getByLabel("6-digit code", { exact: true }).fill(totp(backupSecret)); await resetPage.getByRole("button", { name: "Verify and continue", exact: true }).click(); await resetPage.waitForURL("**/dashboard");
    assert.equal((await resetBrowser.request.get(new URL("/api/session", base).href)).status(), 204);
    signInPassword = newPassword; await resetBrowser.close();
    console.log("PASS: anonymous forgot-password rejects wrong OTP and replay, changes the real password without the old password, preserves MFA/recovery, leaks no session, and requires new-password plus OTP sign-in");
  }
  if (process.env.MFA_RECOVERY_WORKFLOWS === "true") {
    await login.getByRole("button", { name: "Create recovery code", exact: true }).click();
    const recoveryCode = await login.locator(".recovery-code").textContent(); assert.match(recoveryCode, /^[A-F0-9]{8}(-[A-F0-9]{8}){3}$/);
    const userBeforeRecovery = await admin.auth.admin.getUserById(id); assert.equal(userBeforeRecovery.error, null);
    const stored = userBeforeRecovery.data.user.app_metadata.labtrack_mfa_recovery;
    assert(stored.hash && !JSON.stringify(stored).includes(recoveryCode), "Only a recovery hash is stored");
    const downloadPromise = login.waitForEvent("download"); await login.getByRole("button", { name: "Download code", exact: true }).click();
    const download = await downloadPromise; assert.equal(download.suggestedFilename(), "LabTrack-QR-Recovery-Code.txt");
    const { readFile } = await import("node:fs/promises"); assert((await readFile(await download.path(), "utf8")).includes(recoveryCode));
    const recoveryBrowser = await browser.newContext(); const recoveryPage = await recoveryBrowser.newPage(); recoveryPage.setDefaultTimeout(45000);
    await recoveryPage.goto(new URL("/login", base).href); await recoveryPage.getByLabel("Email address", { exact: true }).fill(email); await recoveryPage.getByLabel("Password", { exact: true }).fill(signInPassword);
    await recoveryPage.getByRole("button", { name: "Sign in", exact: true }).click(); await recoveryPage.waitForURL("**/two-factor");
    await recoveryPage.getByText("Use recovery code", { exact: true }).click();
    await recoveryPage.getByLabel("Password", { exact: true }).fill(signInPassword); await recoveryPage.getByLabel("Recovery code", { exact: true }).fill("00000000-00000000-00000000-00000000");
    await recoveryPage.getByRole("button", { name: "Recover authenticator", exact: true }).click(); await recoveryPage.getByText("Recovery code is incorrect or already used.", { exact: true }).waitFor();
    assert.equal((await admin.auth.admin.getUserById(id)).data.user.app_metadata.labtrack_mfa_recovery.hash, stored.hash, "Invalid recovery does not consume the code");
    await recoveryPage.getByLabel("Recovery code", { exact: true }).fill(recoveryCode); await recoveryPage.getByLabel("Password", { exact: true }).fill("Wrong-password-for-recovery-9");
    await recoveryPage.getByRole("button", { name: "Recover authenticator", exact: true }).click(); await recoveryPage.getByText("Password is incorrect.", { exact: true }).waitFor();
    assert.equal((await admin.auth.admin.getUserById(id)).data.user.app_metadata.labtrack_mfa_recovery.hash, stored.hash, "Wrong password does not consume recovery");
    await recoveryPage.getByLabel("Recovery code", { exact: true }).fill(recoveryCode); await recoveryPage.getByLabel("Password", { exact: true }).fill(signInPassword); await recoveryPage.getByRole("button", { name: "Recover authenticator", exact: true }).click();
    await recoveryPage.waitForURL("**/login?message=*", { timeout: 20000 }).catch(async error => {
      console.error("Recovery failure route:", new URL(recoveryPage.url()).pathname);
      console.error("Recovery notices:", await recoveryPage.locator(".notice.error").allTextContents());
      const state = await admin.auth.admin.getUserById(id);
      console.error("Recovery hash present:", Boolean(state.data?.user?.app_metadata?.labtrack_mfa_recovery?.hash));
      throw error;
    });
    assert.equal((await admin.auth.admin.getUserById(id)).data.user.app_metadata.labtrack_mfa_recovery?.hash, undefined, "Recovery code is consumed once");
    const recoveredFactors = await admin.auth.admin.mfa.listFactors({ userId: id }); assert.equal(recoveredFactors.error, null); assert.equal(recoveredFactors.data.factors.length, 0);
    assert.equal((await recoveryBrowser.request.get(new URL("/api/session", base).href)).status(), 401, "Recovery itself never grants portal access");
    await recoveryPage.getByLabel("Email address", { exact: true }).fill(email); await recoveryPage.getByLabel("Password", { exact: true }).fill(signInPassword); await recoveryPage.getByRole("button", { name: "Sign in", exact: true }).click(); await recoveryPage.waitForURL("**/two-factor");
    assert.equal((await recoveryBrowser.request.get(new URL("/api/session", base).href)).status(), 403, "Re-enrollment is required after recovery");
    await recoveryPage.getByRole("button", { name: "Set up authenticator", exact: true }).click(); await recoveryPage.locator(".mfa-manual-key code").waitFor({ state: "attached" });
    const replacementSecret = await recoveryPage.locator(".mfa-manual-key code").textContent(); assert(replacementSecret);
    await recoveryPage.getByLabel("6-digit code", { exact: true }).fill(totp(replacementSecret)); await recoveryPage.getByRole("button", { name: "Confirm authenticator", exact: true }).click();
    await recoveryPage.waitForURL("**/recovery-code"); await recoveryPage.getByRole("button", { name: "Create recovery code", exact: true }).click();
    await recoveryPage.locator(".recovery-code").waitFor(); const replacementCode = await recoveryPage.locator(".recovery-code").textContent(); assert.notEqual(replacementCode, recoveryCode);
    await recoveryPage.getByLabel("I saved my recovery code", { exact: true }).check(); await recoveryPage.getByRole("button", { name: "Continue", exact: true }).click(); await recoveryPage.waitForURL("**/dashboard");
    assert.equal((await recoveryBrowser.request.get(new URL("/api/session", base).href)).status(), 204);
    await recoveryBrowser.close();
    const replayBrowser = await browser.newContext(); const replay = await replayBrowser.newPage();
    await replay.goto(new URL("/login", base).href); await replay.getByLabel("Email address", { exact: true }).fill(email); await replay.getByLabel("Password", { exact: true }).fill(signInPassword); await replay.getByRole("button", { name: "Sign in", exact: true }).click(); await replay.waitForURL("**/two-factor");
    await replay.getByText("Use recovery code", { exact: true }).click(); await replay.getByLabel("Password", { exact: true }).fill(signInPassword); await replay.getByLabel("Recovery code", { exact: true }).fill(recoveryCode); await replay.getByRole("button", { name: "Recover authenticator", exact: true }).click(); await replay.getByText("Recovery code is incorrect or already used.", { exact: true }).waitFor();
    await replayBrowser.close();
    console.log("PASS: real recovery download, hashed storage, wrong-code/password rejection, one-use consumption, mandatory QR re-enrollment and replay rejection");
  }
} finally {
  await browser?.close();
  if (process.env.MFA_MANAGED_WORKFLOWS === "true") {
    if (!managedStudentId) { const student = await admin.from("profiles").select("id").eq("email", managedEmail).maybeSingle(); if (student.data) managedStudentId = student.data.id; }
    if (managedStudentId) assert.equal((await admin.auth.admin.deleteUser(managedStudentId)).error, null, "Managed student fixture cleanup");
    if (id) { const photo = await admin.from("profiles").select("photo_path").eq("id", id).maybeSingle(); if (photo.data?.photo_path?.startsWith(`${id}/`)) assert.equal((await admin.storage.from("profile-photos").remove([photo.data.photo_path])).error, null, "Fixture picture cleanup"); }
  }
  if ((registrationTrial || custodianSetupTrial) && !id) {
    const users = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    assert.equal(users.error, null, "Look up only this disposable registration for cleanup");
    id = users.data.users.find(user => user.email === email)?.id;
  }
  if (id) {
    let deletionError;
    for (let attempt = 0; attempt < 3; attempt++) {
      const deleted = await admin.auth.admin.deleteUser(id); deletionError = deleted.error;
      if (!deletionError || deletionError.code === "user_not_found") { deletionError = null; break; }
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
    }
    assert.equal(deletionError, null, "Disposable account cleanup");
  }
  assert.deepEqual(await counter(), before, "Existing hosted record counts remain unchanged");
  console.log("PASS: disposable account removed; hosted profile/tool/transaction/item counts unchanged");
}
