import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({ matches: [] as Record<string, unknown>[], lookupError: false, tools: [] as Record<string, unknown>[], eq: vi.fn(), ilike: vi.fn(), items: vi.fn(), transactions: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthContext: async () => ({ profile: { role: "custodian", status: "active", must_change_password: false, data_scope: "demo" }, aal: "aal1" }) }));
vi.mock("@/lib/records", () => ({ outstandingTransactions: state.transactions, transactionItems: state.items }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ from: state.from }) }));
import { GET } from "@/app/api/custody/route";

const token = "01000000-0000-4000-8000-000000000003";
beforeEach(() => {
  vi.clearAllMocks();
  state.lookupError = false;
  state.matches = [{ id: "borrower", qr_token: token, full_name: "Test Borrower", student_id: "ST-1", status: "active", year_section: "1-A", group_number: null }];
  state.tools = [{ id: "tool", qr_token: "tool-token" }];
  state.transactions.mockResolvedValue([{ id: "tx", borrowed_at: "2026-10-01T00:00:00Z" }]);
  state.items.mockResolvedValue([{ id: "loan", transaction_id: "tx", tool_id: "tool", asset_code_snapshot: "TOOL-1", tool_name_snapshot: "Tool", item_status: "missing", issue_condition: "good" }]);
  state.from.mockImplementation(() => {
    const query = { select: () => query, eq: state.eq, ilike: state.ilike,
      limit: async () => ({ data: state.matches, error: state.lookupError ? { message: "private" } : null }),
      in: async () => ({ data: state.tools, error: null }) };
    state.eq.mockReturnValue(query); state.ilike.mockReturnValue(query);
    return query;
  });
});
const request = (query: string) => new NextRequest(`https://labtrack.test/api/custody?${query}`);

it("returns borrower identity and exact outstanding custody together", async () => {
  const response = await GET(request("value=ST-1"));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(await response.json()).toMatchObject({ student: { token, fullName: "Test Borrower" }, items: [{ itemId: "loan", transactionId: "tx", itemStatus: "missing", toolToken: "tool-token" }] });
});
it("continues to support token refreshes and personal student QR payloads", async () => {
  await GET(request(`token=${token}`));
  expect(state.eq).toHaveBeenCalledWith("qr_token", token);
  state.eq.mockClear();
  expect((await GET(request(`value=${encodeURIComponent(`LTQR1:S:${token}`)}`))).status).toBe(200);
  expect(state.eq).toHaveBeenCalledWith("qr_token", token);
});
it("escapes wildcard characters in typed IDs", async () => {
  await GET(request(`value=${encodeURIComponent("ST%_\\1")}`));
  expect(state.ilike).toHaveBeenCalledWith("student_id", "ST\\%\\_\\\\1");
});
it("rejects ambiguous identities, wrong QR types, and incomplete tool reads", async () => {
  state.matches.push({ ...state.matches[0], id: "other" });
  expect((await GET(request("value=ST-1"))).status).toBe(409);
  expect(state.transactions).not.toHaveBeenCalled();
  expect((await GET(request(`value=${encodeURIComponent(`LTQR1:T:${token}`)}`))).status).toBe(400);
  state.matches.pop(); state.tools = [];
  expect((await GET(request("value=ST-1"))).status).toBe(503);
});
it("handles empty custody and lookup failures without returning partial success", async () => {
  state.transactions.mockResolvedValue([]);
  expect(await (await GET(request("value=ST-1"))).json()).toMatchObject({ student: { token }, items: [] });
  state.lookupError = true;
  expect((await GET(request("value=ST-1"))).status).toBe(503);
  expect((await GET(request("value="))).status).toBe(400);
});
