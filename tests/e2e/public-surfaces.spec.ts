import { expect, test } from "@playwright/test";

test("login is usable without horizontal overflow", async ({ page }) => {
  await page.goto("/login"); await expect(page.getByRole("heading", { name: /sign in to the tool crib/i })).toBeVisible(); await expect(page.getByRole("link", { name: /register an account/i })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth); expect(overflow).toBe(false);
});

test("student registration exposes the required fields", async ({ page }) => {
  await page.goto("/register"); await expect(page.getByRole("heading", { name: /student registration/i })).toBeVisible(); for (const name of ["Full name","Student ID","Year / Section","Group number","Contact number","Email address","Password"]) await expect(page.getByLabel(name, { exact: false })).toBeVisible();
});

test("a protected direct refresh returns to login when unauthenticated", async ({ page }) => {
  await page.goto("/tools"); await expect(page).toHaveURL(/\/login/); await expect(page.getByRole("heading", { name: /sign in to the tool crib/i })).toBeVisible();
});
