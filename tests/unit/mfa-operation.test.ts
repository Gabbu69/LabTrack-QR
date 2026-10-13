import { beforeEach, describe, expect, it, vi } from "vitest";
import { serializeMfaOperation } from "@/lib/mfa-operation";

type Row = { id: string; data_scope: string; status: string; must_change_password: boolean; mfa_operation_id: string | null };
const state = vi.hoisted(() => ({ rows: [] as Row[], failure: null as { message: string } | null }));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({
  update: (changes: Partial<Row>) => {
    const predicates: ((row: Row) => boolean)[] = [];
    const query = {
      eq: (key: keyof Row, value: unknown) => { predicates.push(row => row[key] === value); return query; },
      neq: (key: keyof Row, value: unknown) => { predicates.push(row => row[key] !== value); return query; },
      is: (key: keyof Row, value: unknown) => { predicates.push(row => row[key] === value); return query; },
      select: () => query,
      maybeSingle: async () => {
        if (state.failure) return { data: null, error: state.failure };
        const row = state.rows.find(row => predicates.every(predicate => predicate(row)));
        if (!row) return { data: null, error: null };
        Object.assign(row, changes);
        return { data: { id: row.id }, error: null };
      },
    };
    return query;
  },
}) }) }));

beforeEach(() => {
  state.failure = null;
  state.rows = ["first", "second"].map(id => ({ id, data_scope: "operational", status: "active", must_change_password: false, mfa_operation_id: null }));
});

describe("exclusive authenticator provider operations", () => {
  it("allows pending students and temporary-password users to complete initial MFA", async () => {
    state.rows[0].status = "pending";
    state.rows[0].must_change_password = true;
    const mutation = vi.fn(async () => ({ message: "Initial factor verified" }));
    expect(await serializeMfaOperation("first", mutation)).toEqual({ message: "Initial factor verified" });
    expect(mutation).toHaveBeenCalledOnce();
  });

  it("rechecks private-password completion when acquiring a device-removal lease", async () => {
    state.rows[0].must_change_password = true;
    const mutation = vi.fn(async () => ({}));
    expect((await serializeMfaOperation("first", mutation, { requirePrivatePassword: true })).error).toBeTruthy();
    expect(mutation).not.toHaveBeenCalled();
    expect(state.rows[0].mfa_operation_id).toBeNull();
  });

  it("allows one in-flight removal and forces the next request to reread the remaining factor", async () => {
    let release!: () => void;
    const factors = new Set(["phone", "backup"]);
    const first = serializeMfaOperation("first", async () => {
      if (factors.size < 2) return { error: "Keep the last factor." };
      await new Promise<void>(resolve => { release = resolve; });
      factors.delete("phone");
      return {};
    });
    await vi.waitFor(() => expect(state.rows[0].mfa_operation_id).not.toBeNull());
    const competingRemoval = vi.fn(async () => { factors.delete("backup"); return {}; });
    expect((await serializeMfaOperation("first", competingRemoval)).error).toContain("in progress");
    expect(competingRemoval).not.toHaveBeenCalled();
    release();
    expect(await first).toEqual({});
    expect([...factors]).toEqual(["backup"]);
    expect(state.rows[0].mfa_operation_id).toBeNull();
    expect(await serializeMfaOperation("first", async () => factors.size < 2 ? { error: "Keep the last factor." } : {}))
      .toEqual({ error: "Keep the last factor." });
  });

  it("keeps another user's factor operations independent", async () => {
    state.rows[0].mfa_operation_id = "existing-operation";
    const mutation = vi.fn(async () => ({ message: "Verified" }));
    expect(await serializeMfaOperation("second", mutation)).toEqual({ message: "Verified" });
    expect(mutation).toHaveBeenCalledOnce();
    expect(state.rows[0].mfa_operation_id).toBe("existing-operation");
  });

  it("never steals an interrupted lease or invokes the provider", async () => {
    state.rows[0].mfa_operation_id = "interrupted-operation";
    const mutation = vi.fn(async () => ({}));
    expect((await serializeMfaOperation("first", mutation)).error).toContain("deployment owner");
    expect(mutation).not.toHaveBeenCalled();
    expect(state.rows[0].mfa_operation_id).toBe("interrupted-operation");
  });

  it("releases its lease when the settled provider request rejects", async () => {
    await expect(serializeMfaOperation("first", async () => { throw new Error("Provider unavailable"); }))
      .rejects.toThrow("Provider unavailable");
    expect(state.rows[0].mfa_operation_id).toBeNull();
    expect(await serializeMfaOperation("first", async () => ({}))).toEqual({});
  });

  it("cannot clear a different operation's lease", async () => {
    await serializeMfaOperation("first", async () => {
      state.rows[0].mfa_operation_id = "different-operation";
      return {};
    });
    expect(state.rows[0].mfa_operation_id).toBe("different-operation");
  });

  it.each([
    { status: "disabled" }, { data_scope: "demo" }, { id: "unknown" },
  ])("rejects an ineligible or missing profile before provider access %#", async changes => {
    Object.assign(state.rows[0], changes);
    const mutation = vi.fn(async () => ({}));
    expect((await serializeMfaOperation("first", mutation)).error).toBeTruthy();
    expect(mutation).not.toHaveBeenCalled();
  });

  it("fails closed when the lease store is unavailable", async () => {
    state.failure = { message: "Private database detail" };
    const mutation = vi.fn(async () => ({}));
    const result = await serializeMfaOperation("first", mutation);
    expect(result.error).toContain("temporarily unavailable");
    expect(JSON.stringify(result)).not.toContain("Private database");
    expect(mutation).not.toHaveBeenCalled();
  });
});
