import { expect, test } from "@playwright/test";

test("professional login has no step labels, registration link, or logged-in help", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in to LabTrack", exact: true })).toBeVisible();
  await expect(page.getByText(/step 1 of 2/i)).toHaveCount(0);
  await expect(page.getByRole("link", { name: /register an account/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Help and user guide", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
test("public registration directs the person to their custodian", async ({ page }) => {
  await page.goto("/register"); await expect(page).toHaveURL(/\/login\?message=/);
  await expect(page.getByText(/Accounts are created by the tool custodian/)).toBeVisible();
});
test("guide and protected routes require sign-in", async ({ page }) => {
  for (const path of ["/guide", "/tools", "/users", "/profile"]) {
    await page.goto(path); await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Help and user guide", exact: true })).toHaveCount(0);
  }
});
