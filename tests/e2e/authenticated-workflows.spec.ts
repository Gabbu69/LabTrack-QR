import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const demoPassword = process.env.E2E_DEMO_PASSWORD;
const demoCustodianEmail = process.env.E2E_DEMO_CUSTODIAN_EMAIL ?? "custodian.demo@labtrackqr2026.com";
const demoInstructorEmail = process.env.E2E_DEMO_INSTRUCTOR_EMAIL ?? "instructor.demo@labtrackqr2026.com";
const demoStudentEmail = process.env.E2E_DEMO_STUDENT_EMAIL ?? "jordan.demo@labtrackqr2026.com";
const operationalCustodianEmail = process.env.E2E_OPERATIONAL_CUSTODIAN_EMAIL;
const operationalCustodianPassword = process.env.E2E_OPERATIONAL_CUSTODIAN_PASSWORD;

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/(dashboard|change-password)/);
}

async function resetDemo(page: Page) {
  await page.goto("/dashboard");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Reset demo" }).click();
  await expect(page.getByRole("button", { name: "Reset demo" })).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByText("TOTAL TOOLS")).toBeVisible();
  await expect(page.locator(".metric").filter({ hasText: "TOTAL TOOLS" }).locator("strong")).toHaveText("20");
}

test.describe("authenticated release workflows", () => {
  test.beforeEach(async ({}, testInfo) => {
    test.skip(testInfo.project.name !== "laptop", "Run mutating release workflows once on the laptop project.");
    test.skip(!demoPassword, "Set E2E_DEMO_PASSWORD to run live authenticated workflows.");
  });

  test("demo reset is repeatable and custodian can borrow, return, and export", async ({ page }) => {
    await login(page, demoCustodianEmail, demoPassword!);
    await resetDemo(page);
    await resetDemo(page);

    await page.goto("/borrow");
    await page.getByRole("textbox", { name: /USB scanner or typed Student ID/i }).fill("DEMO-2026-04");
    await page.getByRole("button", { name: "Use code" }).click();
    await expect(page.getByText("Blake Williams")).toBeVisible();
    await page.getByRole("textbox", { name: /USB scanner or typed asset code/i }).fill("DMM-002");
    await page.getByRole("button", { name: "Use code" }).click();
    await expect(page.getByText("DMM-002")).toBeVisible();
    await page.getByRole("button", { name: "Confirm checkout (1)" }).click();
    await expect(page.getByText(/Checkout complete/)).toBeVisible();

    await page.goto("/return");
    await page.getByRole("textbox", { name: /USB scanner or typed Student ID/i }).fill("DEMO-2026-04");
    await page.getByRole("button", { name: "Use code" }).click();
    await expect(page.getByText(/1 outstanding/)).toBeVisible();
    await page.getByRole("textbox", { name: /USB scanner or typed asset code/i }).fill("DMM-002");
    await page.getByRole("button", { name: "Use code" }).click();
    await page.getByRole("button", { name: "Confirm return (1)" }).click();
    await expect(page.getByText("Complete return: 1 tools accepted.")).toBeVisible();

    await page.goto("/history");
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("link", { name: "Export CSV" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^labtrack-history-\d{4}-\d{2}-\d{2}\.csv$/);
    const path = await download.path();
    expect(path).not.toBeNull();
    const csv = await readFile(path!, "utf8");
    expect(csv).toContain("Transaction ID,Borrower,Student ID");
  });

  test("temporary-password staff account is forced to change its password", async ({ page }) => {
    const stamp = Date.now();
    const email = `e2e.instructor.${stamp}@labtrackqr2026.com`;
    const temporaryPassword = `Temporary-${stamp}!`;
    const privatePassword = `Private-${stamp}!`;

    await login(page, demoCustodianEmail, demoPassword!);
    await resetDemo(page);
    await page.goto("/users");
    await page.getByText("Create a staff account", { exact: true }).click();
    await page.getByLabel("Full name").fill("E2E Laboratory Instructor");
    await page.getByLabel("Email").fill(email);
    await page.getByLabel("Role").selectOption("instructor");
    await page.getByLabel("One-time temporary password").fill(temporaryPassword);
    await page.getByRole("button", { name: "Create staff account" }).click();
    await expect(page.getByText("Staff account created.", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: "Log Out" }).click();

    await login(page, email, temporaryPassword);
    await expect(page).toHaveURL(/\/change-password/);
    await page.getByLabel("New password").fill(privatePassword);
    await page.getByLabel("Confirm password").fill(privatePassword);
    await page.getByRole("button", { name: "Save password and continue" }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("LABORATORY STATUS")).toBeVisible();

    await page.getByRole("button", { name: "Log Out" }).click();
    await login(page, demoCustodianEmail, demoPassword!);
    await resetDemo(page);
  });

  test("instructor and student direct-route authorization is enforced", async ({ page }) => {
    await login(page, demoInstructorEmail, demoPassword!);
    await expect(page.getByText("LABORATORY STATUS")).toBeVisible();
    await page.goto("/borrow");
    await expect(page).toHaveURL(/\/dashboard\?error=/);
    await page.getByRole("button", { name: "Log Out" }).click();

    await login(page, demoStudentEmail, demoPassword!);
    await expect(page.getByRole("heading", { name: /WELCOME, JORDAN MITCHELL/ })).toBeVisible();
    await page.goto("/my-qr");
    await expect(page.getByText("PERSONAL BORROWER QR")).toBeVisible();
    await page.goto("/tools");
    await expect(page).toHaveURL(/\/dashboard\?error=/);
  });

  test("student registration requires custodian approval", async ({ page }) => {
    test.skip(!operationalCustodianEmail || !operationalCustodianPassword, "Set operational custodian credentials for approval testing.");
    const stamp = Date.now();
    const email = `e2e.student.${stamp}@labtrackqr2026.com`;
    const password = `Student-${stamp}!`;

    await page.goto("/register");
    await page.getByLabel("Full name").fill("E2E Student Mechanic");
    await page.getByLabel("Student ID").fill(`E2E-${stamp}`);
    await page.getByLabel("Year / Section").fill("2nd Year / AMT-A");
    await page.getByLabel("Group number").fill("Group E2E");
    await page.getByLabel("Contact number").fill("09170000000");
    await page.getByLabel("Email address").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Submit registration" }).click();
    await expect(page).toHaveURL(/\/login\?message=/);

    await login(page, operationalCustodianEmail!, operationalCustodianPassword!);
    await page.goto("/users");
    const row = page.locator("article.user-row").filter({ hasText: email });
    await expect(row).toBeVisible();
    await row.getByRole("button", { name: "Approve / activate" }).click();
    await expect(page.getByText("Account status updated.")).toBeVisible();
    await page.getByRole("button", { name: "Log Out" }).click();

    await login(page, email, password);
    await expect(page.getByRole("heading", { name: /WELCOME, E2E STUDENT MECHANIC/ })).toBeVisible();
  });
});
