import { describe, expect, it } from "vitest";
// @ts-expect-error Shared plain-JavaScript policy also runs without a build in CI.
import { assessAudit } from "../../scripts/audit-policy.mjs";

function fixture() {
  return {
    report: { auditReportVersion: 2, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } }, vulnerabilities: { braces: { name: "braces", severity: "high", nodes: ["node_modules/braces"], via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm", name: "braces", severity: "high" }] } } },
    lock: { packages: { "node_modules/braces": { dev: true, version: "3.0.3" } } },
  };
}
describe("dependency audit exception", () => {
  it("permits only the reviewed development advisory", () => {
    const { report, lock } = fixture();
    expect(assessAudit(report, lock, true).exceptions).toEqual(["braces"]);
    expect(assessAudit(report, lock, false).blocked).toEqual(["braces"]);
  });
  it("blocks a runtime dependency, a new advisory, or critical severity", () => {
    const runtime = fixture(); runtime.lock.packages["node_modules/braces"].dev = false;
    expect(assessAudit(runtime.report, runtime.lock, true).blocked).toEqual(["braces"]);
    const changed = fixture(); changed.report.vulnerabilities.braces.via[0].url = "https://github.com/advisories/new";
    expect(assessAudit(changed.report, changed.lock, true).blocked).toEqual(["braces"]);
    const critical = fixture(); critical.report.vulnerabilities.braces.severity = "critical";
    critical.report.metadata.vulnerabilities.high = 0; critical.report.metadata.vulnerabilities.critical = 1;
    expect(assessAudit(critical.report, critical.lock, true).blocked).toEqual(["braces"]);
  });
  it("fails when the registry audit is unavailable", () => {
    expect(() => assessAudit({ error: { code: "ENETUNREACH" } }, {}, true)).toThrow("valid report");
  });
  it("rejects missing summaries, invalid severities and inconsistent registry counts", () => {
    const { lock } = fixture();
    expect(() => assessAudit({ metadata: {}, vulnerabilities: {} }, lock, true)).toThrow("valid report");
    const severity = fixture(); severity.report.vulnerabilities.braces.severity = "unknown";
    expect(() => assessAudit(severity.report, severity.lock, true)).toThrow("valid report");
    const counts = fixture(); counts.report.metadata.vulnerabilities.high = 0;
    expect(() => assessAudit(counts.report, counts.lock, true)).toThrow("valid report");
    const missing = fixture(); missing.report.vulnerabilities = {} as typeof missing.report.vulnerabilities;
    expect(() => assessAudit(missing.report, missing.lock, true)).toThrow("valid report");
  });
});
