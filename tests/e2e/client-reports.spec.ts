import { expect, test } from "@playwright/test";
import { formatLabDate } from "../../src/lib/query-filters";

test.use({ trace: "off", screenshot: "off" });

function csvRows(text: string) {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  const value = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < value.length; i++) {
    const char = value[i];
    if (char === '"') {
      if (quoted && value[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (!quoted && char === ",") { row.push(cell); cell = ""; }
    else if (!quoted && (char === "\r" || char === "\n")) {
      if (char === "\r" && value[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += char;
  }
  if (row.length || cell) { row.push(cell); rows.push(row); }
  return rows;
}

for (const [role, email] of [
  ["custodian", "custodian.demo@labtrackqr2026.com"],
  ["instructor", "instructor.demo@labtrackqr2026.com"],
  ["student", "jordan.demo@labtrackqr2026.com"],
]) test(`${role} CSV and A4 agree on filtered assets and each item return date`, async ({ page }) => {
  test.skip(!process.env.DEMO_ACCOUNT_PASSWORD, "Use the privately configured shared demo sign-in.");
  test.setTimeout(180_000);
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(process.env.DEMO_ACCOUNT_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30_000 });
  for (const query of ["", "?q=Jordan&status=returned", "?q=NO-MATCH-FIXTURE"]) {
    const response = await page.request.get(`/api/reports/transactions.csv${query}`);
    expect(response.ok()).toBe(true);
    const [headers, ...rows] = csvRows(await response.text());
    expect(headers).toHaveLength(15);
    await page.goto(`/history/print${query}`);
    await expect(page.locator(".report-heading")).toContainText("DEMO RECORDS");
    await expect(page.locator(".report-transaction")).toHaveCount(new Set(rows.map(row => row[0])).size);
    await expect(page.locator(".report-transaction tbody tr")).toHaveCount(rows.length);
    if (!rows.length) await expect(page.getByText("No transactions match these filters.", { exact: true })).toBeVisible();
    for (const row of rows) {
      expect(row).toHaveLength(15);
      const transaction = page.locator(".report-transaction").filter({ has: page.getByRole("heading", { name: row[1], exact: true }) }).filter({ hasText: row[2] }).filter({ hasText: `Borrowed: ${formatLabDate(row[4])}` });
      await expect(transaction).toHaveCount(1);
      const item = transaction.locator("tbody tr").filter({ has: page.getByText(row[7], { exact: true }) });
      await expect(item).toHaveCount(1);
      await expect(item.locator("td").nth(1)).toHaveText(row[9]);
      await expect(item.locator("td").nth(2)).toContainText(row[5] ? formatLabDate(row[5]) : "—");
      await expect(item.locator("td").nth(2)).toContainText(row[11] || "—");
    }
    if (role === "student") {
      expect(rows.every(row => row[2] === "DEMO-2026-01")).toBe(true);
      await expect(page.locator(".lab-history-report")).not.toContainText("Riley Patel");
    }
  }
});
