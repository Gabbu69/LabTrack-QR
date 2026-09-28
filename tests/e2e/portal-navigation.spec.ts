import { expect as baseExpect, test } from "@playwright/test";

const expect = baseExpect.configure({ timeout: 30_000 });

test.use({ trace: "off", screenshot: "off" }); // Demo login fields must not enter browser artifacts.

for (const [role, destination] of [
  ["student", "/my-qr"],
  ["instructor", "/tools"],
  ["custodian", "/tools"],
] as const) {
  test(`${role} can use the mobile side menu`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "Mobile layout check");
    test.setTimeout(120_000);
    await page.goto(`/login?demo=${role}`);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    const opener = page.getByRole("button", { name: "Open menu" });
    const drawer = page.getByRole("dialog", { name: "Navigation menu" });
    await expect(opener).toBeVisible();
    await expect(page.locator(".portal-sidebar")).toBeHidden();
    await opener.click();
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Dashboard", exact: true })).toHaveAttribute("aria-current", "page");

    await drawer.locator(`a[href="${destination}"]`).click();
    await expect(page).toHaveURL(destination);
    await expect(drawer).toBeHidden();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

    await opener.click();
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(opener).toBeFocused();
    await opener.click();
    await drawer.getByRole("button", { name: "Log Out" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
}

test("desktop sidebar stays visible across pages", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "laptop", "Desktop layout check");
  test.setTimeout(120_000);
  await page.goto("/login?demo=custodian");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const sidebar = page.locator(".portal-sidebar");
  await expect(sidebar).toBeVisible();
  await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  await sidebar.getByRole("link", { name: "Tool Inventory" }).click();
  await expect(page).toHaveURL("/tools");
  await expect(sidebar).toBeVisible();
});
