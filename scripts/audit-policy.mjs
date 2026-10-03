// A single, reviewed development-only exception. Runtime findings always fail.
const approvedAdvisory = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";
const approvedPackages = new Set(["braces", "micromatch", "fast-glob", "@next/eslint-plugin-next", "eslint-config-next"]);

export function assessAudit(report, lock, allowDevelopmentException = false) {
  const invalid = () => { throw new Error("Dependency audit did not return a valid report."); };
  const object = value => value !== null && typeof value === "object" && !Array.isArray(value);
  const severities = ["info", "low", "moderate", "high", "critical"];
  if (!object(report) || report.error || report.auditReportVersion !== 2 || !object(report.metadata)
    || !object(report.metadata.vulnerabilities) || !object(report.vulnerabilities) || !object(lock?.packages)) invalid();
  const vulnerabilities = report.vulnerabilities;
  const counts = report.metadata.vulnerabilities;
  const actualCounts = Object.fromEntries(severities.map(severity => [severity, 0]));
  for (const [name, finding] of Object.entries(vulnerabilities)) {
    if (!object(finding) || finding.name !== name || !severities.includes(finding.severity)
      || !Array.isArray(finding.nodes) || !finding.nodes.length || finding.nodes.some(node => typeof node !== "string" || !node)
      || !Array.isArray(finding.via) || !finding.via.length
      || finding.via.some(via => typeof via === "string" ? !via : !object(via) || typeof via.url !== "string" || !severities.includes(via.severity))) invalid();
    actualCounts[finding.severity]++;
  }
  for (const severity of [...severities, "total"]) {
    const expected = severity === "total" ? Object.keys(vulnerabilities).length : actualCounts[severity];
    if (!Number.isSafeInteger(counts[severity]) || counts[severity] < 0 || counts[severity] !== expected) invalid();
  }
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
  return { blocked, exceptions, counts };
}
