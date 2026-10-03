# Dependency audit decision - October 3, 2026

Next.js and its matching ESLint configuration are pinned to 16.3.8. The lockfile also updates affected brace-expansion and undici versions. The production dependency audit must report no high or critical findings.

One advisory remains without an available patched braces release: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm), stack exhaustion from deeply nested glob patterns. The installed braces 3.0.3 is used only by development lint tooling through micromatch, fast-glob, @next/eslint-plugin-next and eslint-config-next. These five affected package entries describe one underlying advisory. Application code does not pass user input to these development packages.

The release accepts this specific development tooling risk. Keep lint input limited to trusted project files. Recheck this exception whenever updating dependencies and remove it when an upstream patch or compatible dependency replacement is available. A suggested downgrade to an old Next.js lint configuration is not appropriate for this Next.js 16 project.

`npm run audit:security` runs both production and full registry audits. It fails on all high/critical production findings, any other high/critical advisory, non-development nodes, a changed braces version, malformed audit output or registry failure. It reports the remaining exception visibly; it does not claim the full audit is clean. Unit checks cover the failure boundaries.
