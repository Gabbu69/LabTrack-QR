import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "@playwright/test";

const base = new URL(process.argv[2] || "http://localhost:3000");
const output = "output/playwright/thesis-release";
await mkdir(output, { recursive: true }); await mkdir("output/pdf", { recursive: true });
const browser = await chromium.launch({ ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) });
try {
  for (const [role, email, expectedCount] of [["custodian", "custodian.demo@labtrackqr2026.com", 3], ["instructor", "instructor.demo@labtrackqr2026.com", 3], ["student", "jordan.demo@labtrackqr2026.com", 1]]) {
    const context = await browser.newContext(); const page = await context.newPage(); page.setDefaultTimeout(45000);
    if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET && base.hostname.endsWith(".vercel.app")) await context.request.get(base.href, { headers: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" } });
    await page.goto(new URL("/login", base).href); await page.getByLabel("Email address").fill(email); await page.getByLabel("Password", { exact: true }).fill(process.env.DEMO_ACCOUNT_PASSWORD);
    await page.getByRole("button", { name: "Sign in", exact: true }).click(); await page.waitForURL("**/dashboard");
    await page.goto(new URL("/history", base).href); await page.getByRole("link", { name: "Print A4 report", exact: true }).click(); await page.waitForURL("**/history/print");
    assert.equal(await page.locator(".report-transaction").count(), expectedCount, `${role}: all permitted transactions`);
    assert.match(await page.locator(".report-heading").innerText(), /DEMO RECORDS/);
    if (role === "student") { assert(!await page.locator(".lab-history-report").innerText().then(text => /Riley Patel|Taylor Chen/.test(text)), "Other students stay absent"); }
    for (const width of [320, 390, 768, 1366]) {
      await page.setViewportSize({ width, height: 900 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `${role}: ${width}px report fits`);
    }
    if (role === "custodian") {
      await page.screenshot({ path: `${output}/report-desktop.png`, fullPage: true });
      await page.pdf({ path: "output/pdf/LabTrack-Demo-Borrowing-Report.pdf", format: "A4", preferCSSPageSize: true, printBackground: true });
      await page.goto(new URL("/history/print?q=Jordan&status=returned", base).href);
      assert.equal(await page.locator(".report-transaction").count(), 1, "Report filters are applied");
      assert.match(await page.getByRole("link", { name: "Back to history" }).getAttribute("href"), /q=Jordan/);
    }
    await page.goto(new URL("/history/print?q=NO-MATCH-FIXTURE", base).href); await page.getByText("No transactions match these filters.", { exact: true }).waitFor();
    await page.goto(new URL("/history/print?from=2026-02-30", base).href); await page.getByText("Enter a valid calendar date.", { exact: true }).waitFor();
    console.log(`PASS ${role}: complete scoped report, filters, invalid/empty states and four screen widths`);
    await context.close();
  }
  const context = await browser.newContext(); const page = await context.newPage();
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET && base.hostname.endsWith(".vercel.app")) await context.request.get(base.href, { headers: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET, "x-vercel-set-bypass-cookie": "true" } });
  await page.goto(new URL("/guide", base).href); await page.getByRole("link", { name: "Open printable worksheet", exact: true }).click(); await page.waitForURL("**/thesis-evaluation.html");
  assert.equal(await page.locator("input,textarea").count(), 0, "Worksheet does not collect submitted personal information");
  for (const width of [320, 390, 768, 1366]) {
    await page.setViewportSize({ width, height: 900 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), `Worksheet fits ${width}px`);
  }
  await page.pdf({ path: "output/pdf/LabTrack-Thesis-Evaluation-Worksheet.pdf", format: "A4", preferCSSPageSize: true, printBackground: true });
  await page.emulateMedia({ media: "print" }); await page.screenshot({ path: `${output}/worksheet-print.png`, fullPage: true });
  console.log("PASS: guide worksheet link, blank two-part evaluation form and responsive layout");
  await context.close();
} finally { await browser.close(); }
