# Web App Audit Report

Date: 26 September 2026. Application: LabTrack QR, three-role laboratory MVP. Backend: owner-selected Gabs Project (`tsusogeqjduyahoskteb`). Scope: source, server actions, seven API routes, Supabase SQL/RLS/storage policies, scanner state, major pages, deployment configuration and dependencies. Passwords and server keys are deliberately absent from this report.

Status labels: **Fixed** means implemented with the evidence stated below; **Recommended** is future work; **Unverified** means the named behavior was not demonstrated. A unit or SQL result does not establish a browser, hosted Auth, physical-device or email result. Release URLs and final browser results are recorded in VERIFICATION.md.

## Critical Issues

**C1 — Mandatory password-change bypass — Fixed.** Locations: `src/lib/access-policy.ts:5` (`accessFailure`), `src/lib/auth.ts:20` (`requireProfile`), `src/lib/api.ts:7` (`apiRoute`), `supabase/migrations/20260926010000_enforce_password_change.sql:22` (`private.require_custodian`) and lines 35–36 (completion RPC privileges). Before: a temporary-password account could bypass the page layout by calling APIs/RPCs, and the authenticated completion RPC could clear the restriction without evidence of an Auth password update. Evidence: pre-migration live function inspection confirmed callable completion and no temporary-password guard; isolated regressions exercise the bypass paths. Impact: a shared or temporary credential could access protected records and mutate inventory. Remediation: shared server guards, database helper/RLS/storage checks, revoked public/private completion entrypoints, and a trusted server-only completion path after successful Supabase Auth update. Live demo callers now receive SQLSTATE 42501 from the legacy RPC.

**C2 — Concurrent reset/change could clear the restriction prematurely — Fixed.** Locations: `src/lib/password-operation.ts:6` (`performPasswordUpdate`), `src/app/actions/auth.ts:52` (`changePasswordAction`), `src/app/actions/operations.ts:70` (`resetPasswordAction`), migration `20260926030000_serialize_password_operations.sql:2`. Reproduction: interleave a custodian reset and the account's own password change between the profile write and Auth update; a version-only check could observe and clear the newer restriction. Impact: temporary credentials could briefly remain unrestricted or a failed final profile write could leave that state. Remediation: database compare-and-set lease, mandatory restriction before Auth, and operation-ID ownership on completion/cleanup. Evidence: unit tests hold one Auth request open and prove a second request cannot invoke Auth; native PostgreSQL assertions reject a second lease and a foreign completion. Only successful Auth permits clearing the flag. Interrupted-process recovery is documented in SETUP.md.

## High Priority Issues

**H1 — Redirect/HTML failures at JSON API boundaries — Fixed.** `src/lib/api.ts:7`, all `src/app/api/**/route.ts`, `src/lib/json-request.ts`. Reproduce an anonymous, expired or wrong-role request to an API and attempt JSON parsing. Impact: misleading scan failures, broken recovery, status ambiguity. APIs now return JSON 401 for missing sessions, 403 for account/role restrictions, 400 for invalid input, 409 for conflicts and 503 for backend failures; successful payload shapes are retained. Access/API tests cover all seven account states, and the HTTP smoke checks exercise all seven anonymous endpoints.

**H2 — Fetched-row caps produced incomplete searches, history, CSV and totals — Fixed.** `src/lib/query-filters.ts:1`, `src/lib/records.ts:7,23,36`, `src/app/(portal)/tools/page.tsx`, `history/page.tsx`, `borrowed/page.tsx`, `src/app/api/custody/route.ts`, `src/app/api/reports/transactions.csv/route.ts:8`, migration `20260926020000_dashboard_summary.sql:2`. Reproduce with matching records beyond the first fetched page or >1,000 tools. Impact: missing custody/report entries and incorrect dashboard totals. Filters now run in SQL before 50-row paging; totals use an invoker aggregate RPC and RLS. CSV fetches transactions in 250-row batches and items in 500-row batches, with stable transaction-ID cursors and an export-start boundary. A disappearing earlier match no longer shifts the next page. Evidence: 1,205-tool PostgreSQL fixture; 5,105-transaction/6,312-item CSV fixture; a mutation-between-batches regression that failed before the cursor fix and passes afterward. Export remains non-snapshot across concurrent field updates; see Remaining Risks.

**H3 — Repeated/stale scanner work could affect the next borrower — Fixed.** `src/components/scanner/borrow-flow.tsx:12`, `return-flow.tsx:15`, `qr-scanner.tsx:7`. Reproduce a slow lookup, repeated decoder callback, borrower change or component unmount while work is pending. Impact: duplicates or an old result entering a new review. A synchronous in-flight gate, latest callback reference, scan generation invalidation and disabled controls prevent overlapping submissions and stale callbacks. Tests reproduce pending duplicates, callback replacement, disabling and unmount; PostgreSQL concurrent checkout proves one open custody record.

**H4 — Upload checks trusted filenames/content types — Fixed.** `src/lib/profile-photo.ts:4`, `src/app/actions/auth.ts:63`, `src/components/scanner/qr-scanner.tsx:7`. Reproduce a disguised/non-image or oversized image upload. Impact: invalid stored media, large decode cost and poor feedback. Profile photos now undergo actual Sharp decoding, JPEG/PNG/WebP validation, 2 MB/25 MP limits, orientation correction, 512-pixel resize and WebP re-encoding. QR images accept bounded 5 MB JPEG/PNG/WebP. Failed profile writes clean up new uploads; successful replacements clean up old paths. Decoder tests pass; full hosted Storage upload/cleanup remains unverified.

## Medium Priority Issues

**M1 — Database errors appeared as empty results or missing records — Fixed.** `src/lib/auth.ts:9`, `src/lib/records.ts:23,36`, portal pages, `src/app/api/scan/resolve/route.ts:10`, `src/app/error.tsx`. Reproduce a rejected/failed query. Impact: users could treat unavailable data as no custody or no inventory. Query errors now produce a readable retry/sign-in boundary or JSON error; empty successful queries remain distinct. Failed report batches return JSON 503 rather than a partial successful CSV. Failure-path unit tests cover this behavior.

**M2 — Search punctuation and wildcard ambiguity — Fixed.** `src/lib/query-filters.ts:12` (`containsPattern`), `src/app/api/scan/resolve/route.ts:10`. Reproduce literal `%`, `_`, quotes or punctuation in search and duplicate Student ID matches. Impact: unintended matches or wrong borrower selection. PostgREST filter values are quoted/escaped, typed IDs match literally, ambiguous students require personal QR. Direct live read-only tests confirm the punctuation cases; unit tests validate escaping.

**M3 — Date filters used inconsistent calendar boundaries — Fixed.** `src/lib/query-filters.ts:17` (`manilaDateRange`) and `:42` (`formatLabDate`). Reproduce records close to midnight UTC versus Philippine local midnight, including invalid dates and an inverted range. Impact: daily reports include/exclude the wrong records. Filters use Asia/Manila start-inclusive and next-day-exclusive boundaries; invalid input is rejected. Date/pagination unit tests pass.

**M4 — Reproduced small-screen overflow — Fixed in source; browser confirmation recorded in VERIFICATION.md.** `src/app/globals.css:80,205,336`. Evidence: 320-pixel login had 320-pixel document width against 305-pixel client width; at 768 pixels the authentication grid forced 860 pixels. Impact: horizontal scrolling and obscured controls. Removed the body's fixed minimum width and stack the authentication columns below 900 pixels; pagination wraps. A later browser run reproduced 507-pixel inventory overflow at 320/390 pixels: the absolutely positioned screen-reader table heading escaped the static scroll container. Positioning `.table-wrap` relatively contains it; the in-app browser then measured equal document/client widths (305 pixels with scrollbar). The audit browser suite checks major routes at 320, 390, 768 and 1366 pixels.

**M5 — Profile deletion trigger could retain orphaned rows — Fixed, upstream work preserved.** `supabase/migrations/20260919092338_complete_database_workflows.sql:4` (`private.guard_last_custodian`). Reproduce deleting a permitted non-custodian Auth fixture; a BEFORE DELETE return of NEW is null and suppresses deletion. Impact: stale profile records. Return OLD for permitted deletes, retain the final-active-custodian guard and explicit service-role grants. Isolated deletion assertion passes; the missing additive migration was applied to Gabs after history inspection.

## Low Priority Issues

**L1 — Setup/verification drift and unsafe shared smoke instructions — Fixed.** `SETUP.md`, `VERIFICATION.md`, `README.md`, `scripts/smoke-app.mjs`, mutating E2E entrypoints. Evidence: inherited documents referenced another backend, old email confirmation settings and mutation smoke against shared demo inventory. Remediation: document selected Gabs settings, separate read-only smoke from isolated mutation tests, enforce shared-URL rejection and keep demo-reset usage explicit.

**L2 — Deployment input hygiene — Fixed.** `.env.example`, `.vercelignore`, `scripts/configure-vercel.mjs`, `.github/workflows/ci.yml`. Removed an example key from a different project, excluded local secrets/tests/SQL/docs from deployments, and added repeatable Node 24 CI. Actual demo password and server/bootstrap credentials are not report or source content. Pinned dependency audit returned zero vulnerabilities at the time tested; this is not a guarantee against future advisories.

**L3 — Very large exports and category suggestions — Recommended.** `src/app/api/reports/transactions.csv/route.ts:8` retains the final CSV in server memory to avoid returning success after a failed later batch. Inventory category suggestions derive from the visible page. At larger-than-MVP scale, use an asynchronous export job with an immutable snapshot and a separate bounded category query. Current bounded database requests do not imply bounded total output memory.

## Bugs Fixed

C1–C2 and H1–H4 close verified access, concurrency, scanner and completeness defects. M1–M5 address misleading failures, literal search, dates, responsive layout and deletion behavior. Additional changes add a busy-state cleanup path for demo reset, confirmation/pending feedback for unused-tool deletion, no-store JSON failures and cross-origin mutation rejection. The existing visual design and guided instructions are preserved. Per the owner's correction, the launcher reads Help & user guide, the guide heading reads USER GUIDE, the gamepad icon is replaced by a book, and sections use workflow/review wording.

## Security Improvements

Shared guards cover pages, server actions and APIs. Database checks also protect direct authenticated access. Student-controlled metadata cannot grant staff, active status or demo scope; tests verify this. Student history remains owner-scoped; demo and operational records remain separate. Temporary/disabled users cannot read protected inventory/photos. Security headers deny framing, prevent MIME sniffing, restrict camera to self and disable microphone/geolocation. Uploads are decoded and normalized. Secrets stay in ignored local files and server-only Vercel variables. Password update sequencing follows the [Supabase password update contract](https://supabase.com/docs/guides/auth/passwords).

## Performance Improvements

Inventory/history queries filter before pagination with exact counts and stable ordering; page links preserve filters. Custody and CSV reads fetch all matching rows in bounded batches. Dashboard totals aggregate inside PostgreSQL instead of summing capped client rows. Supporting scope/date/item indexes are additive. No production load benchmark was performed; latency and memory measurements at institutional scale remain unverified.

## UI/UX Improvements

Numbered 50-record pages, explicit retry/sign-in feedback, accessible scanner labels/status messages, pending submit controls, safe decoder lifecycle and responsive authentication layout improve the existing workflows. The public user guide and per-role review progress remain available. Browser checks cover refresh, logout, typed scanning and export without mutating shared inventory. Physical accessibility and assistive-technology certification are not claimed.

## Code Quality Improvements

Centralized access policy, JSON boundary, query/date helpers, complete item retrieval, password-operation serialization and real image normalization replace divergent logic. Existing uncommitted work and newer origin/main commits were preserved; merge conflicts were resolved around the selected Gabs project. The generated Next cache was rebuilt after a Windows/OneDrive cache error; generated files were not source edits. Node 24 is the verification/runtime target. A separate reviewer identified C2 and the CSV cursor issue; both received reproducing regressions before release.

## Recommended New Features

Keep the three-role MVP. Prioritize an audit trail for privileged account/inventory changes, scheduled backups with a restore drill, deployment/error monitoring, an immutable export job for large datasets, and an account-recovery runbook. Consider barcode hardware certification and label templates after real-device trials. Multi-laboratory tenancy, additional roles, procurement, predictive analytics and calibration/airworthiness features require separate requirements and should not be implied by this release.

## Tests Added

| Test / purpose | Steps | Expected outcome | Actual result / boundary |
| --- | --- | --- | --- |
| Access/API role matrix | Simulate anonymous, pending, disabled, temporary, student, instructor, custodian profiles through guards/handlers | 401/403/allowed only as appropriate; JSON failures | Passed in Node 24 unit suite |
| Password actions and lease race | Reject input/Auth; hold one Auth update open and invoke another; verify operation ownership | No early flag clearing, one Auth update, restriction retained on failure | Passed unit and native SQL assertions; real hosted GoTrue concurrency not executed |
| Session proxy | Exercise refresh/login routing boundaries with mocked Supabase session behavior | Safe redirect/cookie behavior | Passed unit suite |
| Query/date/pagination | Literal punctuation, invalid dates, Philippine midnight, page/filter links | Exact safe filters and 50-row pages | Passed unit suite; literal search also passed live read-only |
| Large CSV / failed batch / moving matches | Export 5,105 transactions and 6,312 item rows; fail a later batch; remove an earlier matching row between batches | All rows + header; 503 on failure; no offset skipping | Passed all four export regressions |
| Image/request validation | Decode valid images, reject invalid/oversized types; simulate non-JSON/network errors | Normalized WebP or readable failure | Passed unit suite; hosted Storage UI upload not executed |
| Scanner lifecycle | Repeat callback while pending; replace borrower callback; disable/unmount | One request; current callback only; stopped stale work | Passed unit suite; physical scanner unverified |
| Isolated workflow SQL | Provision fictional roles/assets; create/approve profiles; CRUD tools; checkout, full/partial/damaged return, missing/recovery, reset | Correct state transitions; role/scope isolation | Passed on disposable PostgreSQL 17 with all nine migrations; Supabase HTTP services not emulated |
| Isolated capacity and RLS | Insert 1,205 tools, query last page/search/aggregate; use temporary, pending, disabled and other-student contexts | Complete totals, correct page, denied unauthorized reads/writes/storage | Passed; direct client completion privileges revoked |
| Concurrent checkout | Two independent PostgreSQL connections borrow same available tool | Exactly one success and one conflict; one open item | Passed |
| Shared Supabase smoke | Sign in three demo roles; query own/scoped data; forbidden writes/legacy RPC; punctuation lookup | Working demo credentials; no data leakage | Passed, no inventory/reset mutation |
| Shared HTTP smoke | Seven anonymous API calls; three dashboards; wrong-role/input/CSRF errors; own CSV; invalid date | JSON 401/403/400; usable dashboards and safe report | Local/Preview/Production results in VERIFICATION.md |
| Browser responsive/read-only | Public + major role routes at 320/390/768/1366, refresh/logout, typed lookup/review, duplicate scan, CSV | No document overflow, readable pages, correct navigation | Final measured results in VERIFICATION.md |
| Guided UI and public pages | Tour next/back/escape; control explanation blocks submission; persisted role training; registration labels | Existing help design works with keyboard and navigation | Final measured results in VERIFICATION.md |
| Static/build/dependencies | ESLint, TypeScript, 61 unit tests, production build, npm audit under Node 24 | All commands exit 0; zero reported vulnerabilities | Passed; clean-cache build resolves generated-file failure |

## Remaining Risks

- Physical camera, USB scanner, real printed QR readability and Android/iOS behavior need client-device testing. Browser simulation is separate evidence.
- End-to-end hosted registration approval, password reset/change, profile upload and tool/return mutations were not run against the shared project. Their SQL/action units and isolated database workflows were tested. A full disposable Supabase stack was not available; email receipt and Storage HTTP integration remain unverified.
- Dashboard/report views reflect live data. CSV uses stable cursors and excludes later-created transactions, but concurrent updates to status/details across batches are not one database snapshot. Very large exports may exceed server memory/time limits.
- A killed password process leaves a fail-closed lease needing verified owner recovery. No automatic timeout can steal an active lease.
- No automated rate-limit/load or external penetration test, formal accessibility audit, backup restore drill or dependency licensing review was completed.
- Migration history was inspected before additive live changes. Initial schema/reset commands were never rerun on Gabs. Shared counts remained 20 tools, 15 profiles, 3 transactions and 5 items after all nine migrations. The three requested existing demo Auth passwords were synchronized to the privately configured demo password and sign-in verified; inventory was not reset.

## Next Steps

1. **Critical fixes:** deploy only after required migration and automated access/concurrency checks pass; retain the previous Vercel deployment.
2. **Stability and security:** complete a full disposable Supabase Auth/Storage browser test and restore drill; add error monitoring and validate interrupted-password recovery.
3. **UI/UX:** perform real-device camera/USB/printing and assistive-technology trials using the client guide.
4. **Performance:** measure institutional data volume and export memory; add snapshot export jobs when warranted.
5. **Features/upgrades:** assess the recommended audit log and backup operations first; keep the present three-role scope until separately approved.
