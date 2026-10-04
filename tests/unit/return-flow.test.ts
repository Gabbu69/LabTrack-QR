// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const requests = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock("@/lib/json-request", () => ({ jsonRequest: requests.send }));
vi.mock("@/components/scanner/qr-scanner", () => ({ QrScanner: ({ expected, onScan, disabled }: { expected: "student" | "tool"; onScan: (value: string) => void; disabled: boolean }) => createElement("div", {},
  ...(expected === "student" ? ["A", "B"] : ["1", "2", "3"]).map((value) => createElement("button", { key: value, disabled, onClick: () => onScan(value) }, `Scan ${expected} ${value}`))) }));
import { ReturnFlow } from "@/components/scanner/return-flow";

const item = (value: string, itemStatus: "borrowed" | "missing" = "borrowed", borrower = "A") => ({ itemId: `loan-${borrower}-${value}`, transactionId: `tx-${borrower}`, toolToken: `token-${value}`, assetCode: `TOOL-${value}`, toolName: `Tool ${value}`, itemStatus, issueCondition: "good", borrowedAt: "2026-10-01T00:00:00Z", missingAt: itemStatus === "missing" ? "2026-10-02T00:00:00Z" : null });
let custody: ReturnType<typeof item>[];
let returnResult: () => Promise<unknown>;
beforeEach(() => {
  custody = [item("1"), item("2"), item("3", "missing")];
  returnResult = async () => ({ returnedCount: 1 });
  requests.send.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url === "/api/scan/resolve") return body.kind === "student"
      ? { kind: "student", token: `student-${body.value}`, fullName: `Borrower ${body.value}`, studentId: `ST-${body.value}`, yearSection: null, groupNumber: null, status: "active" }
      : { kind: "tool", token: `token-${body.value}`, assetCode: `TOOL-${body.value}`, toolName: `Tool ${body.value}`, condition: "good", status: "borrowed" };
    if (url.startsWith("/api/custody")) return { items: url.includes("student-B") ? [item("1", "borrowed", "B"), item("2", "borrowed", "B")] : custody };
    if (url === "/api/return") return returnResult();
    if (url === "/api/missing") return {};
    throw new Error(`Unexpected URL ${url}`);
  });
});
afterEach(cleanup);
async function click(name: string) { await act(async () => { fireEvent.click(screen.getByRole("button", { name })); }); }
function openMissing() { const summary = screen.getByText("Explicitly mark missing"); summary.closest("details")!.open = true; }
function missingChoice(code: string) { const label = screen.getByText(code).closest("label")!; return within(label).getByRole("checkbox"); }
function payload(url: string) { return JSON.parse(String(requests.send.mock.calls.find(([path]) => path === url)![1].body)); }

it("submits the exact reviewed custody item with its tool token and blocks duplicate pending returns", async () => {
  let finish!: (result: unknown) => void;
  returnResult = () => new Promise((resolve) => { finish = resolve; });
  render(createElement(ReturnFlow));
  await click("Scan student A"); await click("Scan tool 1");
  const confirm = screen.getByRole("button", { name: "Confirm return (1)" });
  await act(async () => { fireEvent.click(confirm); fireEvent.click(confirm); });
  expect(requests.send.mock.calls.filter(([url]) => url === "/api/return")).toHaveLength(1);
  expect(payload("/api/return")).toEqual({ borrowerToken: "student-A", returnedItems: [{ itemId: "loan-A-1", toolToken: "token-1", condition: "good", note: "", unavailable: false }] });
  await act(async () => { finish({ returnedCount: 1 }); });
  expect(screen.getByRole("status")).toHaveTextContent("Partial return: 1 accepted; 2 remain outstanding.");
});

it("clears missing selections and notes when changing borrowers", async () => {
  render(createElement(ReturnFlow)); await click("Scan student A"); openMissing();
  fireEvent.click(missingChoice("TOOL-2")); fireEvent.change(screen.getByLabelText("Missing item note"), { target: { value: "Borrower A note" } });
  await click("Change"); await click("Scan student B"); openMissing();
  expect(screen.getByLabelText("Missing item note")).toHaveValue("");
  expect(missingChoice("TOOL-2")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Mark selected missing" })).toBeDisabled();
});

it("clears reconciliation notes and selections after a partial return before identifying the next borrower", async () => {
  render(createElement(ReturnFlow)); await click("Scan student A"); openMissing();
  fireEvent.click(missingChoice("TOOL-2")); fireEvent.change(screen.getByLabelText("Missing item note"), { target: { value: "Earlier borrower note" } });
  await click("Scan tool 1"); await click("Confirm return (1)"); await click("Scan student B"); openMissing();
  expect(screen.getByLabelText("Missing item note")).toHaveValue("");
  expect(missingChoice("TOOL-2")).not.toBeChecked();
  expect(screen.getByRole("button", { name: "Confirm return (0)" })).toBeDisabled();
});

it("keeps missing tools visible with marking disabled while allowing their physical return", async () => {
  render(createElement(ReturnFlow)); await click("Scan student A"); openMissing();
  expect(missingChoice("TOOL-3")).toBeDisabled(); expect(missingChoice("TOOL-2")).toBeEnabled();
  await click("Scan tool 3"); await click("Confirm return (1)");
  expect(payload("/api/return").returnedItems[0]).toMatchObject({ itemId: "loan-A-3", toolToken: "token-3" });
});

it("disables a newly marked missing item and clears its missing note", async () => {
  render(createElement(ReturnFlow)); await click("Scan student A"); openMissing();
  fireEvent.click(missingChoice("TOOL-2")); fireEvent.change(screen.getByLabelText("Missing item note"), { target: { value: "Last seen in laboratory" } });
  await click("Mark selected missing");
  expect(payload("/api/missing")).toEqual({ itemIds: ["loan-A-2"], note: "Last seen in laboratory" });
  expect(missingChoice("TOOL-2")).toBeDisabled(); expect(missingChoice("TOOL-2")).not.toBeChecked();
  expect(screen.getByLabelText("Missing item note")).toHaveValue("");
});

it("shows stale-selection errors without reporting success or abandoning the reviewed loan", async () => {
  returnResult = async () => { throw new Error("Custody changed. Reload custody before returning tools."); };
  render(createElement(ReturnFlow)); await click("Scan student A"); await click("Scan tool 1"); await click("Confirm return (1)");
  expect(screen.getByRole("alert")).toHaveTextContent("Reload custody");
  expect(screen.getByText("Borrower A")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Confirm return (1)" })).toBeEnabled();
  expect(screen.queryByRole("status")).not.toBeInTheDocument();
});
