import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { chromium } from "@playwright/test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = join(root, ".audit-evidence", "mfa-ui");
const entryId = "\0virtual:mfa-ui-entry.tsx";
const actionId = "\0virtual:mfa-ui-actions.ts";

// This fixture bundles the actual UI but never imports server actions or calls Supabase.
const entry = `
  import React from "react";
  import { createRoot } from "react-dom/client";
  import { TwoFactorForm } from "@/components/auth/two-factor-form";
  import { LabTrackMark } from "@/components/branding/labtrack-mark";
  const mode = window.__MFA_FIXTURE_MODE__;
  const manage = mode.startsWith("manage");
  const first = { id: "550e8400-e29b-41d4-a716-446655440001", name: "My phone" };
  const backup = { id: "550e8400-e29b-41d4-a716-446655440002", name: "Backup authenticator with a deliberately long display name" };
  const factors = mode.startsWith("setup") ? [] : mode.endsWith("two") ? [first, backup] : [first];
  createRoot(document.getElementById("fixture-root")).render(
    <main className="mfa-shell">
      <header className="mfa-header"><div className="mfa-brand"><LabTrackMark/><span>LabTrack <b>QR</b></span></div><button className="button button-secondary" type="button">Sign out</button></header>
      <div className="mfa-main">
        <div className="mfa-heading"><div><h1>{manage ? "Two-factor authentication" : mode.startsWith("setup") ? "Secure your account" : "Verify your sign-in"}</h1><p>dummy-account@example.test</p></div></div>
        <p className="mfa-intro">{manage ? "Your account is protected with authenticator codes." : "An authenticator code is required with your password to access laboratory records."}</p>
        <TwoFactorForm factors={factors} manage={manage}/>
      </div>
    </main>
  );
`;

const actions = `
  export async function enrollMfaAction() {
    if (window.__MFA_FIXTURE_MODE__ === "setup-error") return { error: "Authenticator setup is temporarily unavailable. Try again later." };
    return { enrollment: { factorId: "550e8400-e29b-41d4-a716-446655440003", secret: "JBSWY3DPEHPK3PXP", uri: "otpauth://totp/Fixture:dummy?secret=JBSWY3DPEHPK3PXP&issuer=Fixture" } };
  }
  export async function verifyMfaAction() {
    window.__MFA_VERIFY_ATTEMPTS__ += 1;
    return { error: "Code was not accepted. Use the current code and try again." };
  }
  export async function removeMfaAction() { return { message: "Fixture authenticator removal checked." }; }
`;

const compiled = await build({
  configFile: false,
  root,
  logLevel: "error",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  resolve: { alias: { "@": join(root, "src") } },
  plugins: [{
    name: "read-only-mfa-fixture",
    enforce: "pre",
    resolveId(id) {
      if (id === "virtual:mfa-ui-entry") return entryId;
      if (id === "@/app/actions/mfa" || id.replaceAll("\\", "/") === join(root, "src", "app", "actions", "mfa").replaceAll("\\", "/")) return actionId;
      return null;
    },
    load(id) {
      if (id === entryId) return entry;
      if (id === actionId) return actions;
      return null;
    },
  }],
  build: { write: false, minify: false, lib: { entry: "virtual:mfa-ui-entry", name: "MfaUiFixture", formats: ["iife"] }, rolldownOptions: { input: "virtual:mfa-ui-entry" } },
});
const bundles = Array.isArray(compiled) ? compiled : [compiled];
const bundle = bundles.flatMap(result => result.output).find(item => item.type === "chunk" && item.isEntry);
assert(bundle?.type === "chunk", "UI fixture bundle was not generated.");
const css = (await readFile(join(root, "src", "app", "globals.css"), "utf8")).replace('@import "tailwindcss";', "");
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ headless: true });
const report = { liveRequests: 0, cases: [], screenshots: [], dummySecretsOnly: true };

async function verifyGeometry(page, label) {
  const geometry = await page.evaluate(() => ({ viewport: window.innerWidth, width: document.documentElement.scrollWidth, overflow: [...document.querySelectorAll("button, input, select, h1, h2, code")].filter(element => {
    const bounds = element.getBoundingClientRect();
    return bounds.width > 0 && (bounds.left < -1 || bounds.right > window.innerWidth + 1 || element.scrollWidth > element.clientWidth + 1);
  }).map(element => element.tagName) }));
  assert(geometry.width <= geometry.viewport + 1, `${label}: page has horizontal overflow.`);
  assert.deepEqual(geometry.overflow, [], `${label}: control or text overflows.`);
  report.cases.push({ label, ...geometry });
  const screenshot = join(output, `${label}.png`);
  await page.screenshot({ path: screenshot, fullPage: true });
  report.screenshots.push(screenshot);
}

async function render(page, mode) {
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="fixture-root"></div></body></html>`);
  await page.evaluate(mode => { window.__MFA_FIXTURE_MODE__ = mode; window.__MFA_VERIFY_ATTEMPTS__ = 0; }, mode);
  await page.addScriptTag({ content: bundle.code });
  await page.getByRole("heading", { level: 1 }).waitFor();
}

try {
  for (const viewport of [{ label: "desktop", width: 1280, height: 800 }, { label: "mobile", width: 390, height: 844 }, { label: "narrow", width: 320, height: 740 }]) {
    const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } });
    const page = await context.newPage();
    const failures = [];
    page.on("pageerror", error => failures.push(error.message));
    await page.route("**/*", route => {
      if (route.request().url() === "http://mfa-ui.test/") return route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html><body></body></html>" });
      report.liveRequests += 1;
      return route.abort();
    });
    await page.goto("http://mfa-ui.test/");

    await render(page, "setup");
    await verifyGeometry(page, `${viewport.label}-setup`);
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    await page.getByRole("button", { name: "Confirm authenticator" }).waitFor();
    await verifyGeometry(page, `${viewport.label}-setup-qr`);
    const darkPixels = await page.evaluate(async () => {
      const svg = document.querySelector(".mfa-qr svg");
      const picture = new Image();
      const loaded = new Promise((resolve, reject) => { picture.onload = resolve; picture.onerror = () => reject(new Error("Authenticator QR could not be rendered.")); });
      picture.src = `data:image/svg+xml;base64,${btoa(new XMLSerializer().serializeToString(svg))}`;
      await loaded;
      const canvas = document.createElement("canvas"); canvas.width = 216; canvas.height = 216;
      const drawing = canvas.getContext("2d"); drawing.drawImage(picture, 0, 0, 216, 216);
      const pixels = drawing.getImageData(0, 0, 216, 216).data;
      let dark = 0;
      for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 80 && pixels[index + 1] < 80 && pixels[index + 2] < 80 && pixels[index + 3] > 0) dark += 1;
      return dark;
    });
    assert(darkPixels > 1000, "Authenticator QR is blank.");
    await page.locator(".mfa-manual-key summary").click();
    await verifyGeometry(page, `${viewport.label}-manual-key`);
    await page.getByLabel("6-digit code").fill("12ab34");
    await page.getByRole("button", { name: "Confirm authenticator" }).click();
    assert.equal(await page.evaluate(() => window.__MFA_VERIFY_ATTEMPTS__), 0, "Malformed code was submitted.");
    await page.getByLabel("6-digit code").fill("123456");
    await page.getByRole("button", { name: "Confirm authenticator" }).click();
    await page.getByRole("alert").waitFor();
    await verifyGeometry(page, `${viewport.label}-code-error`);

    await render(page, "challenge-two");
    assert.equal(await page.getByRole("combobox", { name: "Authenticator" }).count(), 1);
    await verifyGeometry(page, `${viewport.label}-challenge`);

    await render(page, "manage");
    assert.equal(await page.getByRole("button", { name: /^Remove/ }).count(), 0, "Removal of last authenticator is offered.");
    await verifyGeometry(page, `${viewport.label}-manage-one`);

    await render(page, "manage-two");
    assert.equal(await page.getByRole("button", { name: /^Remove/ }).count(), 2);
    await verifyGeometry(page, `${viewport.label}-manage-two`);

    await render(page, "setup-error");
    await page.getByRole("button", { name: "Set up authenticator" }).click();
    await page.getByRole("alert").waitFor();
    await verifyGeometry(page, `${viewport.label}-setup-unavailable`);
    assert.deepEqual(failures, [], "Browser raised an unexpected UI error.");
    assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0, "Fixture stored authenticator data.");
    await context.close();
  }
  assert.equal(report.liveRequests, 0, "UI fixture attempted a network request.");
  await writeFile(join(output, "verification.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ casesPassed: report.cases.length, screenshots: report.screenshots.length, liveRequests: report.liveRequests, evidence: output }));
} finally {
  await browser.close();
}
