import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import sharp from "sharp";

test.use({ trace: "off", screenshot: "off" });
test.beforeEach(async ({ page }) => {
  test.skip(!process.env.DEMO_ACCOUNT_PASSWORD, "Private shared demo sign-in is required for read-only checks.");
  await page.goto("/login");
  await page.getByLabel("Email address", { exact: true }).fill("custodian.demo@labtrackqr2026.com");
  await page.getByLabel("Password", { exact: true }).fill(process.env.DEMO_ACCOUNT_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
});

test("searches retain the document, filters and browser history; dismissal does not refetch records", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/tools");
  await page.getByRole("heading", { name: "Tool inventory", exact: true }).waitFor();
  await page.evaluate(() => { Object.assign(window, { performanceDocument: "retained" }); });
  await page.getByRole("textbox", { name: "Search inventory", exact: true }).fill("DMM");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/\/tools\?q=DMM$/);
  await expect(page.locator("tbody tr").first()).toContainText("DMM");
  expect(await page.evaluate(() => (window as unknown as { performanceDocument?: string }).performanceDocument)).toBe("retained");
  await page.getByRole("link", { name: "Clear filters", exact: true }).click();
  await expect(page).toHaveURL(/\/tools$/);
  await expect(page.getByRole("textbox", { name: "Search inventory", exact: true })).toHaveValue("");
  await page.goBack();
  await expect(page.getByRole("textbox", { name: "Search inventory", exact: true })).toHaveValue("DMM");

  await page.goto("/history");
  await page.getByRole("heading", { name: "HISTORY & REPORTS", exact: true }).waitFor();
  await page.evaluate(() => { Object.assign(window, { performanceDocument: "history" }); });
  await page.getByRole("textbox", { name: "Search history", exact: true }).fill("Jordan");
  await page.getByRole("combobox", { name: "Filter by transaction status", exact: true }).selectOption("returned");
  await page.getByRole("button", { name: "Apply", exact: true }).click();
  await expect(page).toHaveURL(/q=Jordan&status=returned/);
  await expect(page.getByRole("link", { name: "Export CSV", exact: true })).toHaveAttribute("href", /q=Jordan&status=returned/);
  expect(await page.evaluate(() => (window as unknown as { performanceDocument?: string }).performanceDocument)).toBe("history");

  await page.goto("/users?message=Performance+check&page=1");
  await page.getByRole("heading", { name: "USER MANAGEMENT", exact: true }).waitFor();
  const requests: string[] = [];
  page.on("request", request => { if (request.url().includes("/users")) requests.push(request.url()); });
  await page.getByRole("button", { name: "Dismiss notification", exact: true }).click();
  await expect(page).toHaveURL(/\/users\?page=1$/);
  await expect(page.getByText("Performance check", { exact: true })).toHaveCount(0);
  expect(requests).toEqual([]);
});

test("typed scanning stays light and image scanning loads the decoder on demand", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/borrow");
  await page.getByRole("textbox", { name: /USB scanner or typed Student ID/ }).fill("DEMO-2026-01");
  await page.getByRole("button", { name: "Use code", exact: true }).click();
  await expect(page.getByText("Jordan Mitchell", { exact: true })).toBeVisible();
  // Resource names are hashed. Check their downloaded source for the actual
  // decoder entry point rather than baking a particular build hash into tests.
  const jsUrls = await page.evaluate(() => performance.getEntriesByType("resource").map(entry => entry.name).filter(url => url.includes("/_next/static/") && url.endsWith(".js")));
  for (const url of jsUrls) {
    const source = await (await page.request.get(url)).text();
    expect(source, "decoder implementation must not be in typed-scan downloads").not.toContain("prototype.decodeFromConstraints");
  }
  const toolResponse = await page.request.post("/api/scan/resolve", { data: { value: "DMM-002", kind: "tool" } });
  expect(toolResponse.ok()).toBe(true);
  const tool = await toolResponse.json();
  // Exercise the actual exported label. A separately generated QR can use
  // different error correction and rasterization from the app's own labels.
  const labelPage = await page.context().newPage();
  let svg: Buffer;
  try {
    await labelPage.goto(`/tools/${tool.id}`);
    const downloadPromise = labelPage.waitForEvent("download");
    await labelPage.getByRole("button", { name: "Download SVG", exact: true }).click();
    const download = await downloadPromise;
    svg = await readFile((await download.path())!);
  } finally { await labelPage.close(); }
  const png = await sharp(svg).png().toBuffer();
  await page.getByLabel("Upload QR image", { exact: true }).setInputFiles({ name: "tool-qr.png", mimeType: "image/png", buffer: png });
  await expect(page.getByRole("button", { name: "Confirm checkout (1)", exact: true })).toBeEnabled({ timeout: 30_000 });
  await page.getByRole("button", { name: "Remove DMM-002", exact: true }).click();
  await expect(page.getByRole("button", { name: "Confirm checkout (0)", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Change", exact: true }).click();
  await expect(page.getByRole("textbox", { name: /USB scanner or typed Student ID/ })).toBeVisible();
});
