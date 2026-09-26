import { describe, expect, it } from "vitest";
import { containsPattern, manilaDateRange, pageHref, pageNumber, parseHistoryFilters } from "@/lib/query-filters";

describe("report date filters", () => {
  it("includes the full Philippine day across UTC boundaries", () => {
    expect(manilaDateRange("2026-09-26", "2026-09-26")).toEqual({ from: "2026-09-25T16:00:00.000Z", until: "2026-09-26T16:00:00.000Z" });
  });
  it.each(["2026-02-30", "yesterday", "2026-13-01"])("rejects invalid date %s", (value) => { expect(() => manilaDateRange(value)).toThrow(); });
  it("rejects a reversed range", () => { expect(() => manilaDateRange("2026-09-27", "2026-09-26")).toThrow(/From/); });
  it("rejects unsupported status and unbounded search", () => {
    expect(() => parseHistoryFilters({ status: "unknown" })).toThrow();
    expect(() => parseHistoryFilters({ q: "x".repeat(121) })).toThrow();
  });
});
describe("pagination and safe search", () => {
  it.each(["0", "-1", "1.5", "Infinity", "abc", "999999999999"])("bounds page %s", (value) => { expect(pageNumber(value)).toBe(1); });
  it("keeps active filters while moving pages", () => { expect(pageHref("/history", { q: "Riley & Co", status: "active", page: "2", error: "old" }, 3)).toBe("/history?q=Riley+%26+Co&status=active&page=3"); });
  it("quotes punctuation instead of allowing another filter expression", () => {
    expect(containsPattern('x",status.eq.available')).toBe('"%x\\",status.eq.available%"');
    expect(containsPattern("100%_done")).toContain("\\\\%");
  });
});
