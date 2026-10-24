import { expect, test } from "@playwright/test";

test.use({ trace: "off", screenshot: "off" });
test("help is a question-mark circle at the top right and opens only after login", async ({ page }) => {
  test.skip(!process.env.DEMO_ACCOUNT_PASSWORD, "Private sample-account credentials are required.");
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Help and user guide", exact: true })).toHaveCount(0);
  await page.getByLabel("Email address", { exact: true }).fill("custodian.demo@labtrackqr2026.com");
  await page.getByLabel("Password", { exact: true }).fill(process.env.DEMO_ACCOUNT_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
  const help = page.getByRole("button", { name: "Help and user guide", exact: true });
  await expect(help).toBeVisible(); await expect(help).toHaveText("");
  const box = await help.boundingBox(); const viewport = page.viewportSize()!;
  expect(box!.y).toBeLessThan(30); expect(box!.x).toBeGreaterThan(viewport.width - 90);
  await help.click();
  const dialog = page.getByRole("dialog", { name: "Help & user guide", exact: true });
  await expect(dialog).toBeVisible();
  await page.keyboard.press("Escape"); await expect(dialog).not.toBeVisible(); await expect(help).toBeFocused();
  await help.click(); await page.getByRole("link", { name: "Open user guide", exact: true }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByText("Create an account", { exact: true })).toBeVisible();
  await expect(page.getByText("Borrow tools", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to dashboard", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
});
