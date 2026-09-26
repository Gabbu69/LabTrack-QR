import { expect, test } from "@playwright/test";
test.use({ trace: "off", screenshot: "off" }); // Filled demo credentials should not enter test artifacts.
test.beforeEach(async ({ page, baseURL }) => {
  const secret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (secret && baseURL && new URL(baseURL).hostname.endsWith(".vercel.app")) {
    await page.request.get(baseURL, { headers: { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" } });
  }
});
for (const [role, label, email] of [
  ["student", "Student", "jordan.demo@labtrackqr2026.com"],
  ["instructor", "Instructor", "instructor.demo@labtrackqr2026.com"],
  ["custodian", "Tool custodian", "custodian.demo@labtrackqr2026.com"],
]) test(`${role} demo guide fills login and waits for explicit sign in`, async ({ page }) => {
  test.setTimeout(90000);
  await page.goto("/guide");
  await page.getByRole("radio", { name: label, exact: true }).check();
  await page.getByRole("link", { name: "Use demo account", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/login\\?demo=${role}$`));
  await expect(page.getByLabel("Email address", { exact: true })).toHaveValue(email);
  expect(await page.getByLabel("Password", { exact: true }).evaluate((input: HTMLInputElement) => input.value.length >= 10)).toBe(true);
  await expect(page.getByText(/Press Sign in to try the app/)).toBeVisible();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 30000 });
});
test("unknown demo role leaves personal login empty", async ({ page }) => {
  await page.goto("/login?demo=admin");
  await expect(page.getByText(/Demo access is temporarily unavailable/)).toBeVisible();
  await expect(page.getByLabel("Email address", { exact: true })).toBeEmpty();
  await expect(page.getByLabel("Password", { exact: true })).toBeEmpty();
});
