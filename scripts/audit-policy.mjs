// A single, reviewed development-only exception. Runtime findings always fail.
const approvedAdvisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const approvedPackages = new Set(["braces", "micromatch", "fast-glob", "@next/eslint-plugin-next", "eslint-config-next"]);

export function assessAudit(report, lock, allowDevelopmentException = false) {
  if (report.error || !report.metadata || !report.vulnerabilities) throw new Error("Dependency audit did not return a valid report.");
  const vulnerabilities = report.vulnerabilities;
  function excepted(name, visited = new Set()) {
    const finding = vulnerabilities[name];
    if (!finding || visited.has(name) || !approvedPackages.has(name) || finding.severity !== "high") return false;
    if (!finding.nodes?.length || finding.nodes.some(node => lock.packages?.[node]?.dev !== true)) return false;
    if (name === "braces" && finding.nodes.some(node => lock.packages[node].version !== "3.0.3")) return false;
    const next = new Set(visited).add(name);
    return finding.via?.length > 0 && finding.via.every(via => typeof via === "string"
      ? excepted(via, next)
      : via.url === approvedAdvisory && via.name === "braces" && via.severity === "high");
  }
  const blocked = [], exceptions = [];
  for (const [name, finding] of Object.entries(vulnerabilities)) {
    if (!["high", "critical"].includes(finding.severity)) continue;
    if (allowDevelopmentException && excepted(name)) exceptions.push(name);
    else blocked.push(name);
  }
  return { blocked, exceptions, counts: report.metadata.vulnerabilities };
}
