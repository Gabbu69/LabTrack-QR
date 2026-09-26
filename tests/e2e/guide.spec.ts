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
  await expect(page.getByText("New here? Learn one move at a time.")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Help and page guide" })).toBeVisible();
});

test("training missions save learning progress separately for each role", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Help and page guide" }).click();
  await page.getByRole("link", { name: "All training missions" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("heading", { name: "HOW TO PLAY", exact: true })).toBeVisible();
  const progress = page.getByRole("region", { name: "Learning progress" });
  await expect(progress).toContainText("0 / 5 learned");
  await page.getByRole("button", { name: "I learned this", exact: true }).first().click();
  await expect(progress).toContainText("1 / 5 learned");
  await page.reload();
  await expect(progress).toContainText("1 / 5 learned");
  await page.getByRole("radio", { name: "Tool custodian", exact: true }).check();
  await expect(progress).toContainText("0 / 8 learned");
  await expect(page.getByRole("heading", { name: "Complete a checkout" })).toBeVisible();
  await page.getByRole("radio", { name: "Instructor", exact: true }).check();
  await expect(progress).toContainText("0 / 3 learned");
  await page.getByRole("radio", { name: "Student", exact: true }).check();
  await expect(progress).toContainText("1 / 5 learned");
  await page.getByRole("button", { name: /Learned.*undo/ }).click();
  await expect(progress).toContainText("0 / 5 learned");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
});

test("explanation mode blocks keyboard submission and link navigation", async ({ page }) => {
  await page.goto("/register");
  let submissions = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "POST" && url.origin === new URL(page.url()).origin && url.pathname === "/register") submissions++;
  });
  await page.getByRole("button", { name: "Help and page guide" }).click();
  await page.getByRole("button", { name: "Explain a control", exact: true }).click();
  await page.getByRole("button", { name: "Submit registration", exact: true }).press("Enter");
  const guide = page.getByRole("region", { name: "Page guide" });
  await expect(guide).toContainText("Creates a pending student account");
  await page.getByRole("link", { name: "Back to sign in", exact: true }).click();
  await expect(guide).toContainText("Opens the linked page");
  await expect(page).toHaveURL(/\/register$/);
  expect(submissions).toBe(0);
  await page.keyboard.press("Escape");
  await page.getByRole("link", { name: "Back to sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
