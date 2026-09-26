# Release verification

Date: 2026-09-26. Backend: Gabs Project `tsusogeqjduyahoskteb`. See AUDIT_REPORT.md for findings and test steps; CLIENT_GUIDE.md provides the client walkthrough without passwords.

## Confirmed checks

- Node 24.10.0: lint, TypeScript, 61 unit tests and production build passed. Full npm audit reported zero vulnerabilities.
- Disposable PostgreSQL 17: all nine migrations applied; checkout, complete/partial/damaged return, missing/recovery, reset, account restrictions, scope isolation, 1,205-row totals/pagination, profile deletion and two-connection checkout race passed.
- Gabs migration history was inspected before missing additive changes. Nine versions are recorded. Shared counts stayed at 20 tools, 15 profiles, 3 transactions and 5 items. Initial schema and inventory reset were not rerun.
- All three requested existing demo accounts signed in. Only their Auth passwords were synchronized to the privately configured demo password; inventory was not reset.
- Local HTTP smoke passed: seven anonymous JSON 401 responses, three role dashboards, denied operations, input/CSRF rejection, scoped CSV and revoked password-completion RPC.
- All 11 final local browser tests passed: public pages and major role pages at 320/390/768/1366 pixels, typed checkout/return review without writes, duplicate scan, CSV download, refresh/logout and guide keyboard/review behavior.
- Initial five-second local navigation failures were resolved with explicit network-navigation waits. Reproduced inventory overflow was fixed by containing a hidden accessibility label inside its table scroll container. No failed assertions were suppressed.
- The launcher reads **Help & user guide**. The guide uses **USER GUIDE**, workflow/review wording and a book icon.
- Scanned 20 compiled browser artifacts for configured private credentials: no matches. Deployment dry-run excluded environment files, SQL, reports and test artifacts.
- Vercel uses Node 24.x, five hosted configuration variables are synchronized, and the GitHub repository is connected.
- Updated Preview is Ready and passed all three-role HTTP checks: https://labtrack-ivhi5rcqm-edgardo-gabriel-paclibars-projects.vercel.app
- All four final browser suites passed against that exact Preview, including native CSV download/logout and all four requested widths. The earlier protected-download timeout was a test-authentication issue; the documented Vercel bypass cookie fixed it without changing app authorization.
- GitHub Node 24 checks passed for the app and guide changes: https://github.com/Gabbu69/LabTrack-QR/actions/runs/36248267751
- Main-branch Node 24 CI and Vercel deployment passed: https://github.com/Gabbu69/LabTrack-QR/actions/runs/36249038725 (commit `6f24017`).
- Production public/instructor/student browser suites passed, and the custodian suite passed on an isolated rerun after a slow network request. This covers all four requested viewport widths, typed scanner review, native CSV download, login, refresh and logout. Initial transport timeouts/resets are recorded as environment failures rather than hidden.
- Exact production HTTP smoke passed for all seven anonymous APIs and all three demo roles after the transient transport failures. Final read-only count check again returned 20 tools, 15 profiles, 3 transactions and 5 items.

## Release tracking

- Local login: http://localhost:3000/login (production build).
- Verified source Preview: https://labtrack-ivhi5rcqm-edgardo-gabriel-paclibars-projects.vercel.app
- Production alias: https://labtrack-qr.vercel.app (updated and tested).
- Tested production deployment: `dpl_28n9kQDAGsTwFxobeWcrdfgd6F5c`, https://labtrack-iy3q0dy01-edgardo-gabriel-paclibars-projects.vercel.app, built from main after the verified Preview promotion.
- Previous production retained for rollback: `dpl_91uuEpQuhSFQ9WHQZkXn3r7tMEXB`, https://labtrack-9c8qmwk6f-edgardo-gabriel-paclibars-projects.vercel.app
- Repository: https://github.com/Gabbu69/LabTrack-QR

## Verification boundaries

Shared smoke tests preserve records. Destructive/reset/concurrency checks ran only in disposable PostgreSQL. That cluster emulates Supabase database schemas, not hosted Auth, email or Storage HTTP. Full disposable-stack browser mutations, email receipt, physical camera, USB scanner, printed QR labels and real mobile devices remain unverified. CSV batching is complete for stable matching data but is not an immutable multi-query snapshot. No exhaustive security/load/accessibility certification is claimed.

Rollback keeps the security migrations in place. The retained old application predates the new server password-completion flow; assess account-management compatibility before using it. Prefer a forward application fix over reverting database protection.

Preview automation uses Vercel's existing protected automation access, including the supported cookie for native downloads. Protection is not disabled. See [Vercel automation documentation](https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation).
