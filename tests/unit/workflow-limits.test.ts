// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { createElement } from "react";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({ request: vi.fn(), scan: undefined as undefined | ((value: string) => Promise<void>) }));
vi.mock("@/lib/json-request", () => ({ jsonRequest: fixture.request }));
// Exercise the production batch boundary with a small fixture to keep DOM work
// bounded; the same shared constant configures the API and both workflow views.
vi.mock("@/lib/workflow", () => ({ WORKFLOW_ITEM_LIMIT: 2 }));
vi.mock("@/components/scanner/qr-scanner", () => ({ QrScanner: ({ onScan }: { onScan: (value: string) => Promise<void> }) => {
  fixture.scan = onScan;
  return null;
} }));
import { BorrowFlow } from "@/components/scanner/borrow-flow";
import { ReturnFlow } from "@/components/scanner/return-flow";

const custody = Array.from({ length: 3 }, (_, index) => ({
  itemId: `item-${index}`, transactionId: "loan", toolToken: `token-${index}`, assetCode: `TOOL-${index}`,
  toolName: `Tool ${index}`, itemStatus: "borrowed", issueCondition: "good", borrowedAt: "2026-10-01T00:00:00Z", missingAt: null,
}));
beforeEach(() => {
  fixture.scan = undefined;
  fixture.request.mockReset().mockImplementation(async (url: string, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    if (url === "/api/scan/resolve") return body.kind === "student"
      ? { kind: "student", token: "borrower", fullName: "Batch Borrower", studentId: "BATCH-1", status: "active" }
      : { kind: "tool", token: `token-${body.value}`, assetCode: `TOOL-${body.value}`, toolName: `Tool ${body.value}`, status: "available", condition: "good" };
    if (url.startsWith("/api/custody")) return { items: custody };
    if (url === "/api/borrow") return { transactionId: "accepted-batch" };
    if (url === "/api/return") return { returnedCount: 2 };
    if (url === "/api/missing") return { updatedCount: 2 };
    throw new Error(`Unexpected request ${url}`);
  });
});
afterEach(cleanup);
async function scan(value: string) { await act(async () => { await fixture.scan!(value); }); }

for (const [name, Component, endpoint, payloadField] of [
  ["checkout", BorrowFlow, "/api/borrow", "toolTokens"],
  ["return", ReturnFlow, "/api/return", "returnedItems"],
] as const) {
  it(`keeps a ${name} within the batch limit and allows replacement before confirmation`, async () => {
    render(createElement(Component));
    await scan("student");
    for (let index = 0; index < 2; index++) await scan(String(index));
    await scan("2");
    expect(screen.getByRole("alert")).toHaveTextContent("Confirm this batch of 2 tools before scanning more.");
    expect(screen.getByRole("button", { name: `Confirm ${name} (2)` })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Remove TOOL-0" }));
    await scan("2");
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: `Confirm ${name} (2)` })); });
    const calls = fixture.request.mock.calls.filter(([url]) => url === endpoint);
    expect(calls).toHaveLength(1);
    const submitted = JSON.parse(String(calls[0][1].body))[payloadField];
    expect(submitted).toHaveLength(2);
    expect(name === "checkout" ? submitted : submitted.map((item: { toolToken: string }) => item.toolToken)).toContain("token-2");
  });
}

it("limits missing selections, allows deselection, and leaves the next batch available", async () => {
  render(createElement(ReturnFlow));
  await scan("student");
  screen.getByText("Explicitly mark missing").closest("details")!.open = true;
  const choices = screen.getAllByRole("checkbox");
  for (const choice of choices.slice(0, 2)) fireEvent.click(choice);
  expect(choices[2]).toBeDisabled();
  expect(choices[0]).toBeEnabled();
  fireEvent.click(choices[0]);
  expect(choices[2]).toBeEnabled();
  fireEvent.click(choices[2]);
  fireEvent.change(screen.getByLabelText("Missing item note"), { target: { value: "Confirmed missing during count" } });
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mark selected missing" })); });
  const body = JSON.parse(String(fixture.request.mock.calls.find(([url]) => url === "/api/missing")![1].body));
  expect(body.itemIds).toHaveLength(2);
  expect(body.itemIds).toContain("item-2");
  expect(body.itemIds).not.toContain("item-0");
  expect(within(screen.getByText("TOOL-0").closest("label")!).getByRole("checkbox")).toBeEnabled();
});
