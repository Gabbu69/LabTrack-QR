import { describe, expect, it } from "vitest";
import { normalizeAssetPrefix, formatAssetCode } from "@/lib/asset-code";
import { canAccessRoute } from "@/lib/authorization";
import { toCsv } from "@/lib/csv";
import { calculateDashboardMetrics } from "@/lib/dashboard";
import { parseQrPayload, studentQrPayload, toolQrPayload } from "@/lib/qr";
import { registrationSchema } from "@/lib/validation";
import { appendUniqueScan, deriveTransactionStatus } from "@/lib/workflow";

const token = "123e4567-e89b-42d3-a456-426614174000";

describe("registration validation", () => {
  const valid = { email: "leader@example.edu", password: "password1", fullName: "Juan Dela Cruz", studentId: "2026-001", yearSection: "2-AMT-A", groupNumber: "3", contactNumber: "09171234567" };
  it("accepts complete student details and normalizes email", () => { expect(registrationSchema.parse({ ...valid, email: " LEADER@EXAMPLE.EDU " }).email).toBe("leader@example.edu"); });
  it("rejects missing identity details", () => { expect(registrationSchema.safeParse({ ...valid, studentId: "" }).success).toBe(false); });
});

describe("role matrix", () => {
  it("allows only custodians to mutate through guided workflows", () => { expect(canAccessRoute("custodian", "/borrow")).toBe(true); expect(canAccessRoute("instructor", "/borrow")).toBe(false); expect(canAccessRoute("student", "/borrow")).toBe(false); });
  it("allows staff inventory visibility but keeps student QR private to students", () => { expect(canAccessRoute("instructor", "/tools")).toBe(true); expect(canAccessRoute("student", "/tools")).toBe(false); expect(canAccessRoute("student", "/my-qr")).toBe(true); });
});

describe("QR payloads", () => {
  it("round-trips opaque student and tool tokens", () => { expect(parseQrPayload(studentQrPayload(token))).toEqual({ kind: "student", token }); expect(parseQrPayload(toolQrPayload(token))).toEqual({ kind: "tool", token }); });
  it("rejects names, IDs, malformed UUIDs, and trailing content", () => { expect(parseQrPayload("Juan Dela Cruz")).toBeNull(); expect(parseQrPayload("LTQR1:T:DM-001")).toBeNull(); expect(parseQrPayload(`${toolQrPayload(token)} extra`)).toBeNull(); });
});

describe("asset-code generation", () => {
  it("normalizes a prefix and pads sequences", () => { expect(normalizeAssetPrefix("dm-tool")).toBe("DMTOOL"); expect(formatAssetCode("dm", 5)).toBe("DM-005"); expect(formatAssetCode("dm", 1000)).toBe("DM-1000"); });
  it("rejects unsafe prefixes and invalid sequences", () => { expect(() => formatAssetCode("!", 1)).toThrow(); expect(() => formatAssetCode("DM", 0)).toThrow(); });
});

describe("scan and status transitions", () => {
  it("rejects a duplicate token", () => { const first = { token, code: "DM-001" }; expect(() => appendUniqueScan([first], first)).toThrow("Duplicate scan"); });
  it("derives complete, partial, missing, and borrowed states", () => { expect(deriveTransactionStatus(["returned","returned"])).toBe("returned"); expect(deriveTransactionStatus(["returned","borrowed"])).toBe("partial"); expect(deriveTransactionStatus(["returned","missing"])).toBe("incomplete"); expect(deriveTransactionStatus(["borrowed"])).toBe("borrowed"); });
});

describe("CSV", () => { it("escapes commas, quotes, and line breaks", () => { expect(toCsv(["Name","Note"], [["Dela Cruz, Juan", "He said \"ok\"\nnext"]])).toBe("Name,Note\r\n\"Dela Cruz, Juan\",\"He said \"\"ok\"\"\nnext\""); }); });

describe("dashboard metrics", () => { it("derives counts and excludes archived tools", () => { const metrics = calculateDashboardMetrics([{ status: "available" },{ status: "borrowed" },{ status: "missing" },{ status: "unavailable" },{ status: "archived" }], [{ status: "borrowed" },{ status: "partial" },{ status: "returned" }]); expect(metrics).toEqual({ total: 4, available: 1, borrowed: 1, missing: 1, activeTransactions: 2 }); }); });
