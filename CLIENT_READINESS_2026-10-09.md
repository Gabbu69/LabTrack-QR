# LabTrack QR delivery readiness — 9 October 2026

The implemented scope supports a proposed PHP 10,000 thesis software, setup, guide, training and limited-support package for one laboratory. This is a scope judgment, not a market-price survey or a promise of defense approval. Client demonstration, physical-device checks and signed handoff remain pending.

## Source and production evidence

- Source baseline: `84784b886139a0f5e69381077622b84cb2fed19e`. GitHub main and local HEAD matched when checked on 9 October. The working copy now contains the delivery corrections and documents described below; they have no new commit or deployed release.
- Production: <https://labtrack-qr.vercel.app>. GitHub records successful Vercel deployment `6940557647` for the baseline above; exact deployment: <https://labtrack-a7wlken3a-edgardo-gabriel-paclibars-projects.vercel.app>.
- [Baseline GitHub CI, run 37806130617](https://github.com/Gabbu69/LabTrack-QR/actions/runs/37806130617) passed. [Recorded Vercel deployment](https://vercel.com/edgardo-gabriel-paclibars-projects/labtrack-qr/FsZu4o2WKkdj8aQ9z9MzXRhVQZ8E) succeeded. Those records refer to the baseline, not these unpublished working-copy changes.
- No source push, hosting change, shared-demo reset, client-data mutation, payment or client acceptance was performed for this delivery.

## Small corrections completed locally

1. After an accepted return, use the existing custody endpoint to read the current outstanding count. A regression reproduced another custodian returning a different tool while the page was open. On refresh failure, preserve the accepted-return success and ask the user to reload; never ask them to repeat that return. Both regressions pass.
2. Correct registration instructions to **Create account**, align the personal sign-in instructions with the screen actually shown, and retain the requirement for enrolled authenticators.
3. Update disposable-fixture operational browser checks for current enrollment/email verification and pending approval. Private fixture TOTP codes are generated in memory; email testing requires a dedicated Mailpit inbox. Keep traces/screenshots disabled in these personal-account mutation checks.
4. Add hosted read-only comparisons of CSV and A4 report rows, filters, individual return dates and student record scope.

Modules and API contracts are retained. No new business module or hosting feature was added.

## Feature assessment

Each result below identifies the evidence boundary. A pass in isolated fixtures does not sign off a client phone or a real laboratory pilot.

| Agreed feature | Result | Evidence and remaining acceptance |
| --- | --- | --- |
| Custodian, instructor and student permissions | Passed | Isolated database/RLS tests and all three hosted demo role navigation/restriction checks. Personal-client verification remains pending. |
| Student registration and approval | Passed in isolated fixtures; pending on client account | Database signup metadata, pending/disabled boundaries and approval restrictions pass. Hosted personal registration/approval mutation suite requires a disposable backend. |
| Individually identified tools and label preparation | Passed for source/hosted display; pending on printed phone test | Hosted inventory/label controls and fictional asset selections reviewed. Actual printed labels on the client's phone remain pending. |
| Two-tool checkout | Passed in isolated fixtures; pending in client demonstration | Workflow and simultaneous-checkout database tests pass. Hosted read-only checkout selection was reviewed without submitting it. |
| Partial and complete return | Passed in isolated fixtures; pending in client demonstration | Database reconciliation/concurrency and local UI regressions pass. Hosted return selection reviewed without submitting it. |
| Damaged tools and reissue restrictions | Passed in isolated fixtures; pending in client demonstration | Condition, unavailable-state and permission tests pass. |
| Explicit missing and recovery | Passed in isolated fixtures; pending in client demonstration | Same-item conflicts, outstanding custody and recovered missing history tests pass. |
| CSV and A4 report agreement | Passed on hosted fictional records | Three role tests compare unfiltered, returned/Jordan and no-match results, item counts, individual return dates and student scope. |
| Actual phone camera, QR-image upload and typed-code fallback | Pending client acceptance | Source/browser controls reviewed; desktop responsive checks do not establish actual phone/printed-label behavior. |
| Personal sign-in and recovery | Pending client acceptance | Hosted registration page showed authenticator-default configuration on 9 October. No new personal-account or lost-device acceptance is claimed. |
| Optional email-code sign-in | Pending if enabled; otherwise not applicable | No consenting tester inbox delivery, hosted sender/migration acceptance or actual inbox verification was completed. Existing authenticator factors must stay required. |
| Backup/restore | Passed for isolated logical fixture; full hosted recovery pending | Checksummed fictional database restored to a second local cluster, including rows, QR/custody, routines and access restrictions. This does not prove hosted Auth configuration or private photo restoration. |

No failed product check remains in the completed checks below. Pending checks are not recorded as passed.

## Verification completed

- Lint, TypeScript checking, **291 unit tests across 29 files**, production build and dependency audit policy passed against the working source in the validated Node 24 D: build mirror. Final lint/type checks include the new report and sign-in fixture helpers. Final lint reported one warning in an older mirror-only `output/audit/browser.config.ts`, outside the source handoff. An attempt in the primary checkout found a missing `eslint-plugin-react` dependency; the existing lockfile-backed mirror was used without changing application dependencies.
- Isolated PostgreSQL tests applied all migrations and passed complete/partial/damaged/missing/recovery/reset, authorization, storage, login limits, OTP session binding, concurrency and fictional logical-restore checks.
- **Four hosted read-only browser tests passed**: public pages at widths 320/390/768/1366 and custodian/instructor/student role navigation, refresh/logout, restrictions and read-only controls.
- **Three hosted CSV/A4 tests passed**, one per role, using fictional shared demo records.
- Live database read-only check passed server/Auth connectivity, tables (18 profiles, 20 tools, 3 transactions, 5 transaction items at observation), anonymous-access denial and the private 2 MB photo bucket configuration. Counts are a dated observation, not a capacity or pilot claim.
- **Five hosted operational mutation tests skipped** because the configured shared backend is protected and no isolated operational backend was supplied. No real inbox, approval mutation, client-data reset or shared-demo transaction was used to bypass that protection.
- Production dependency audit: zero findings. Full dependency audit: five high development-only findings in the reviewed `GHSA-vfj7-8cjw-p6xm` dependency chain; see `DEPENDENCY_AUDIT.md`. Passing the audit policy does not mean every development dependency is advisory-free.
- `git diff --check` passed. Detailed local command logs are in ignored `output/readiness-20261009/`.

## Client documents and package

- `output/pdf/LabTrack-QR-Client-Guide.pdf` and `output/doc/LabTrack-QR-Client-Guide.docx`: **five A4 pages**, current fictional hosted screenshots, role/access/setup, checkout/return/missing, seven-minute defense, fallback, troubleshooting, ownership and blank acceptance fields.
- `output/pdf/LabTrack-QR-Payment-and-Service-Proposal.pdf` and matching `output/doc/…docx`: **one A4 page**, PHP 10,000 total, 40/40/20 milestones, service limits, schedule, payment acknowledgment and blank signatures.
- Each actual DOCX was exported through Microsoft Word, then rasterized with the bundled document renderer/Poppler. All six final pages were visually inspected after the final revision. The unchanged two-page existing blank evaluation worksheet was also visually checked; no participant results were inserted.
- `output/handoff/LabTrack-QR-Client-Documents.zip` collects the four documents plus the blank worksheet. `output/handoff/LabTrack-QR-Source-For-Final-Handoff.zip` is a sanitized working-source package prepared for release after the confirmed final balance. Its source is unpublished; do not describe it as the current production commit.
- Source packages omit live environment files, credentials, dependencies, provider state, browser session state and private backups. Source/setup files, fictional screenshot assets and per-file SHA-256 manifest are included. Both ZIPs are verified against their internal manifests, with external ZIP digests recorded separately.

## Proposed service terms and unfinished appointments

Payments: PHP 4,000 when scope/schedule/support are agreed, PHP 4,000 after the client observes the agreed working demonstration, and PHP 2,000 on accepted final handoff. Release the source copy after the balance is confirmed. GCash/bank recipient details are private. Record actual amounts, dates, references and balances, then acknowledge each payment in writing.

Include one **60-minute training/rehearsal**, one consolidated minor guide/presentation correction round before handoff, and **30 calendar days of agreed-feature bug fixes** from actual accepted handoff. Training has not yet been held. New modules, major adviser changes, manuscript work and continuing maintenance need separate quotes. Provider charges are separate. Current hosting remains managed through developer provider accounts; name the owner/alternate and agree duration privately.

Proposed rehearsal **13 November 2026**; proposed accepted handoff **17 November 2026**; intended thesis use around **20 November onward**. If accepted on 17 November, proposed support ends **17 December 2026**. Adjust to the actual accepted date.

The remaining client acceptance includes actual personal sign-in, printed labels/phone/image/typed-code checks, witnessed two-tool checkout and partial/full/damaged/missing recovery, report agreement, completed training and confirmed source/setup receipt. Publish and recheck the local corrections before representing them as live. A real laboratory launch requires a separate pilot, named ownership/onboarding and a demonstrated complete database/Auth/photo backup/restore procedure.
