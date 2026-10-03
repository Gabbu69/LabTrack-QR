import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { assessAudit } from "./audit-policy.mjs";

const lock = JSON.parse(await readFile(new URL("../package-lock.json", import.meta.url), "utf8"));
if (!process.env.npm_execpath) throw new Error("Run this check with npm run audit:security.");
for (const [label, flags, allowException] of [["Production", ["--omit=dev"], false], ["Full", [], true]]) {
  const result = spawnSync(process.execPath, [process.env.npm_execpath, "audit", "--json", ...flags], { encoding: "utf8", timeout: 120000, maxBuffer: 10 * 1024 * 1024 });
  if (result.error || ![0, 1].includes(result.status)) throw new Error(`${label} audit could not complete.`);
  let report;
  try { report = JSON.parse(result.stdout); } catch { throw new Error(`${label} audit returned invalid JSON.`); }
  const assessment = assessAudit(report, lock, allowException);
  console.log(`${label} audit: ${JSON.stringify(assessment.counts)}`);
  if (assessment.exceptions.length) console.log(`Reviewed development-only exception GHSA-vfj7-8cjw-p6xm: ${assessment.exceptions.join(", ")}. See DEPENDENCY_AUDIT.md.`);
  if (assessment.blocked.length) throw new Error(`${label} audit blocked: ${assessment.blocked.join(", ")}`);
}
