import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { Profile } from "@/types/app";

const state = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getAuthContext: async () => ({ profile: { role: "custodian", status: "active", must_change_password: false, data_scope: "demo" } as Profile, aal: "aal1" }) }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc: state.rpc }) }));
import { POST } from "@/app/api/return/route";

const borrowerToken = "01000000-0000-4000-8000-000000000003";
const item = { itemId: "11000000-0000-4000-8000-000000000001", toolToken: "21000000-0000-4000-8000-000000000001", condition: "good", note: "", unavailable: false };
const request = (returnedItems: unknown[]) => new NextRequest("https://labtrack.test/api/return", { method: "POST", headers: { origin: "https://labtrack.test", "Content-Type": "application/json" }, body: JSON.stringify({ borrowerToken, returnedItems }) });
beforeEach(() => { state.rpc.mockReset(); state.rpc.mockResolvedValue({ data: 1, error: null }); });

describe("exact custody return boundary", () => {
  it("rejects older token-only requests before any database mutation", async () => {
    const oldItem = Object.fromEntries(Object.entries(item).filter(([key]) => key !== "itemId"));
    const response = await POST(request([oldItem]));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: expect.stringContaining("Reload") });
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("passes the reviewed item ID to the RPC without guessing custody", async () => {
    const response = await POST(request([item]));
    expect(response.status).toBe(200);
    expect(state.rpc).toHaveBeenCalledWith("return_tools", { p_borrower_token: borrowerToken, p_returned_items: [{ item_id: item.itemId, tool_token: item.toolToken, condition: "good", note: "", unavailable: false }] });
    expect(await response.json()).toEqual({ returnedCount: 1 });
  });
  it("rejects duplicate item IDs even when paired with different tool tokens", async () => {
    const response = await POST(request([item, { ...item, toolToken: "21000000-0000-4000-8000-000000000002" }]));
    expect(response.status).toBe(400); expect(state.rpc).not.toHaveBeenCalled();
  });
  it("asks the custodian to reload stale custody with HTTP 409", async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "private SQL details" } });
    const response = await POST(request([item]));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "Return could not be completed. Reload the borrower's custody and check the condition of each tool." });
  });
});
