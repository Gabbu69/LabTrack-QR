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
  const spotlight = page.locator(".guide-spotlight");
  const target = page.locator(".guide-target");
  const firstTarget = await target.evaluate((element) => element.outerHTML);
  async function expectSpotlight() {
    await expect(spotlight).toBeVisible();
    await expect(target).toHaveCount(1);
    await expect.poll(async () => {
      const light = await spotlight.boundingBox();
      const control = await target.boundingBox();
      return Boolean(light && control && Math.abs(light.x - (control.x - 6)) < 1 && Math.abs(light.y - (control.y - 6)) < 1 && Math.abs(light.width - (control.width + 12)) < 1);
    }).toBe(true);
    await expect(spotlight).toHaveCSS("pointer-events", "none");
    expect(await spotlight.evaluate((element) => getComputedStyle(element).boxShadow)).toContain("9999px");
  }
  await expectSpotlight();
  await page.getByRole("button", { name: "Next step" }).click();
  await expect(page.getByText(/Step 2 of/)).toBeVisible();
  await expectSpotlight();
  expect(await target.evaluate((element) => element.outerHTML)).not.toBe(firstTarget);
  await page.getByRole("button", { name: "Previous step" }).click();
  await expect(page.getByText(/Step 1 of/)).toBeVisible();
  await expectSpotlight();
  expect(await target.evaluate((element) => element.outerHTML)).toBe(firstTarget);
  const guide = page.getByRole("region", { name: "Page guide" });
  const box = await guide.boundingBox();
  const viewport = page.viewportSize()!;
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
  expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  await page.getByRole("button", { name: "Close guide", exact: true }).last().click();
  await expect(spotlight).toHaveCount(0);
  await expect(target).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Need assistance? Open the user guide.")).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Help and page guide" })).toBeVisible();
});

test("workflow instructions save review progress separately for each role", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Help and page guide" }).click();
  await page.getByRole("link", { name: "Complete user guide" }).click();
  await expect(page).toHaveURL(/\/guide$/);
  await expect(page.getByRole("heading", { name: "USER GUIDE", exact: true })).toBeVisible();
  const progress = page.getByRole("region", { name: "Guide progress" });
  await expect(progress).toContainText("0 / 5 reviewed");
  await page.getByRole("button", { name: "Mark as reviewed", exact: true }).first().click();
  await expect(progress).toContainText("1 / 5 reviewed");
  await page.reload();
  await expect(progress).toContainText("1 / 5 reviewed");
  await page.getByRole("radio", { name: "Tool custodian", exact: true }).check();
  await expect(progress).toContainText("0 / 8 reviewed");
  await expect(page.getByRole("heading", { name: "Complete a checkout" })).toBeVisible();
  await page.getByRole("radio", { name: "Instructor", exact: true }).check();
  await expect(progress).toContainText("0 / 3 reviewed");
  await page.getByRole("radio", { name: "Student", exact: true }).check();
  await expect(progress).toContainText("1 / 5 reviewed");
  await page.getByRole("button", { name: /Reviewed.*undo/ }).click();
  await expect(progress).toContainText("0 / 5 reviewed");
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
