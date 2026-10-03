import { describe, expect, it } from "vitest";
// @ts-expect-error Shared plain-JavaScript policy also runs without a build in CI.
import { assessAudit } from "../../scripts/audit-policy.mjs";

function fixture() {
  return {
    report: { metadata: { vulnerabilities: { high: 1 } }, vulnerabilities: { braces: { severity: "high", nodes: ["node_modules/braces"], via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm", name: "braces", severity: "high" }] } } },
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
    expect(assessAudit(critical.report, critical.lock, true).blocked).toEqual(["braces"]);
  });
  it("fails when the registry audit is unavailable", () => {
    expect(() => assessAudit({ error: { code: "ENETUNREACH" } }, {}, true)).toThrow("valid report");
  });
});
