import { expect, test } from "@playwright/test";

test("page guide explains a control without submitting or navigating", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Help and page guide" }).click();
  await page.getByRole("button", { name: "Explain a control", exact: true }).click();
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("region", { name: "Page guide" })).toContainText("New students can register below");
  await expect(page).toHaveURL(/\/login$/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("region", { name: "Page guide" })).not.toBeVisible();
  await page.getByRole("link", { name: /register an account/i }).click();
  await expect(page).toHaveURL(/\/register/);
});

test("page tour supports next, back, skip and persistent dismissal", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Help and page guide" }).click();
  await page.getByRole("button", { name: "Start page tour" }).click();
  await expect(page.getByText(/Step 1 of/)).toBeVisible();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText(/Step 2 of/)).toBeVisible();
  await page.getByRole("button", { name: "Previous step" }).click();
  await expect(page.getByText(/Step 1 of/)).toBeVisible();
  const guide = page.getByRole("region", { name: "Page guide" });
  const box = await guide.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  await page.getByRole("button", { name: "Close guide", exact: true }).last().click();
  await page.reload();
  await expect(page.getByText("New here? Follow the page guide.")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Help and page guide" })).toBeVisible();
});
