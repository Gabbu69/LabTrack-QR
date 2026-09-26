if (process.env.E2E_ISOLATED_DATABASE !== "true" || !process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.includes("tsusogeqjduyahoskteb")) throw new Error("Mutating smoke tests require an isolated backend. Use scripts/smoke-http.mjs for shared smoke checks.");
// Exercises a production build over HTTP against the isolated demo scope.
// Leaves a completed demo checkout in history; never resets existing data.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";

const password = process.env.E2E_DEMO_PASSWORD || process.env.DEMO_ACCOUNT_PASSWORD;
if (!password) throw new Error("Set E2E_DEMO_PASSWORD or DEMO_ACCOUNT_PASSWORD in .env.local.");
const base = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3100";
const server = process.env.SMOKE_BASE_URL ? null : spawn(process.execPath,
  ["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3100"],
  { stdio: ["ignore", "pipe", "pipe"], env: process.env });

async function request(path, cookie = "", body) {
  return fetch(`${base}${path}`, {
    method: body ? "POST" : "GET", redirect: "manual",
    signal: AbortSignal.timeout(90_000),
    headers: { cookie, origin: base, ...(body && !(body instanceof FormData) ? { "content-type": "application/json" } : {}) },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
}

async function login(email) {
  const page = await request("/login");
  const html = await page.text();
  const action = html.match(/name="(\$ACTION_ID_[^"]+)"/);
  assert.ok(action, "Login page must render a server-action form");
  const form = new FormData();
  form.set(action[1], ""); form.set("email", email); form.set("password", password);
  const response = await request("/login", "", form);
  assert.equal(response.status, 303, `Login failed for ${email}`);
  assert.equal(response.headers.get("location"), "/dashboard", `Account not ready: ${email}`);
  const cookie = response.headers.getSetCookie().map((value) => value.split(";")[0]).join("; ");
  assert.ok(cookie, "Login must issue session cookies");
  return cookie;
}

async function json(path, cookie, body, status = 200) {
  const response = await request(path, cookie, body);
  const data = await response.json();
  assert.equal(response.status, status, `${path}: ${data.error || response.status}`);
  return data;
}

let custodian;
let borrower;
let checkedOut = false;
let tool;
try {
  if (server) {
    let logs = "";
    server.stderr.on("data", (data) => { logs += data; });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("Production server did not start")), 30_000);
      server.once("error", reject);
      server.once("exit", (code) => { clearTimeout(timer); reject(new Error(`Server exited ${code}: ${logs}`)); });
      server.stdout.on("data", (data) => {
        if (data.toString().includes("Ready in")) { clearTimeout(timer); resolve(); }
      });
    });
  }
  const unauthenticated = await request("/tools");
  assert.equal(unauthenticated.status, 307);
  assert.ok(unauthenticated.headers.get("location")?.endsWith("/login"));
  console.log("PASS protected page redirects anonymous visitors");

  const cookies = await Promise.all([
    "custodian.demo@labtrackqr2026.com", "instructor.demo@labtrackqr2026.com", "jordan.demo@labtrackqr2026.com",
  ].map(login));
  [custodian] = cookies;
  await Promise.all(cookies.map(async (cookie, index) => {
    const response = await request("/dashboard", cookie);
    const html = await response.text();
    assert.equal(response.status, 200);
    assert.ok(html.includes(["TOOL-CRIB CHECKOUT COUNTER", "LABORATORY STATUS", "WELCOME, JORDAN MITCHELL"][index]), "Expected role dashboard");
    assert.ok(html.includes("DEMO MODE"), "Smoke tests require demo accounts");
    assert.ok(!html.includes('"digest":"'), "Dashboard must not render a server error");
  }));
  console.log("PASS custodian, instructor, and student login/session/dashboard");

  const blocked = await request("/api/borrow", cookies[1], {});
  assert.equal(blocked.status, 307);
  assert.ok(blocked.headers.get("location")?.includes("/dashboard?error="));
  console.log("PASS instructor cannot check out tools");

  borrower = await json("/api/scan/resolve", custodian, { kind: "student", value: "DEMO-2026-01" });
  tool = await json("/api/scan/resolve", custodian, { kind: "tool", value: "DMM-002" });
  assert.equal(tool.status, "available", "DMM-002 must be available before the smoke test");
  const checkout = { borrowerToken: borrower.token, toolTokens: [tool.token] };
  const tx = await json("/api/borrow", custodian, checkout);
  checkedOut = true;
  assert.ok(tx.transactionId);
  await json("/api/borrow", custodian, checkout, 409);
  const custody = await json(`/api/custody?token=${borrower.token}`, custodian);
  assert.ok(custody.items.some((item) => item.toolToken === tool.token));
  console.log("PASS QR resolution, checkout, duplicate-checkout rejection, and custody");

  const returned = await json("/api/return", custodian, { borrowerToken: borrower.token,
    returnedItems: [{ toolToken: tool.token, condition: tool.condition, note: "Automated demo verification", unavailable: false }] });
  checkedOut = false;
  assert.equal(returned.returnedCount, 1);
  const after = await json("/api/scan/resolve", custodian, { kind: "tool", value: "DMM-002" });
  assert.equal(after.status, "available");
  const csv = await request("/api/reports/transactions.csv", custodian);
  assert.equal(csv.status, 200);
  assert.ok((await csv.text()).includes(tx.transactionId));
  console.log("PASS return restores availability and CSV contains the saved transaction");
  console.log("Production HTTP smoke checks passed.");
} finally {
  try {
    if (checkedOut) await json("/api/return", custodian, { borrowerToken: borrower.token,
      returnedItems: [{ toolToken: tool.token, condition: tool.condition, note: "Smoke-test cleanup", unavailable: false }] });
  } finally {
    if (server && server.exitCode === null) {
      const exited = once(server, "exit"); server.kill("SIGTERM"); await exited;
    }
  }
}
