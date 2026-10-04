# LabTrack QR release verification

Checkpoint: **4 October 2026**. Implementation tested: `6849a0fd54bfb5b529d390425318732835b76e14`. Owner-selected backend: Gabs Project (`tsusogeqjduyahoskteb`). [AUDIT_REPORT.md](AUDIT_REPORT.md) explains the findings; [CLIENT_ACCEPTANCE.md](CLIENT_ACCEPTANCE.md) records the client/device and recovery gates.

**Source, automated checks and the compatible Preview passed. Live migrations are applied; Production release tracking is being completed. Pilot acceptance remains pending.** A passing local test or CI run does not prove that the target database has the migrations or that Production serves the compatible application.

## Confirmed implementation checks

- Node **24.19.0**: 244 tests in 23 files, TypeScript, lint and production build passed. Commands used the established D: workspace/cache/temp directories and ran sequentially. Local generated audit output produced one lint warning with no errors; CI passed.
- Disposable PostgreSQL: all **13 migrations**, borrowing/return/missing workflows, role and scope restrictions, operational AAL1/AAL2 restrictions, login-counter reset/grants and concurrent checkout passed.
- Deterministic return races passed: simultaneous returns of different items complete their parent; duplicate returns conflict; stale selections after reborrowing preserve the later loan; return-versus-missing maintains valid state and history; reversed multi-parent payloads serialize without a partial batch or deadlock.
- Exact custody route checks pass: missing `itemId` yields HTTP 400 before the RPC; the reviewed ID is sent as `item_id`; stale SQL conflicts yield HTTP 409 with reload instructions.
- Component checks pass for borrower note/selection isolation, pending duplicate submissions, disabled already-missing actions and physical recovery through Return.
- Downloaded student and tool QR SVGs decode correctly in automated image regressions. Partial/staggered CSV dates use each item's `returned_at`. This does not establish printed-label or physical camera readability.
- Successful password/MFA counter reset, failed-attempt cooldown, concurrent limiting, separate MFA management counters and protections for the seven seeded demo identities pass unit/SQL regressions.
- Disposable database restore checks passed using fictional data. Full hosted Auth/MFA/photo recovery remains unverified.
- Production dependency audit: **zero findings**. Full audit: five high-severity package entries covered by the existing development-only exception, `GHSA-vfj7-8cjw-p6xm`.
- Compiled browser artifacts: 25 scanned with zero configured private-credential matches.
- Fresh GitHub Node 24 checks passed for the implementation commit: [CI run 37182629784](https://github.com/Gabbu69/LabTrack-QR/actions/runs/37182629784).

## Hosted backend preservation checkpoint

| Item | Confirmed pre-release state |
| --- | --- |
| Shared records | 16 profiles, 20 tools, 3 transactions, 5 items |
| Migration history | 13 versions, through `20261003020000_reset_successful_login_attempts` |
| New return reconciliation migration | `20261003010000_harden_return_reconciliation` — applied after verified snapshot |
| Successful login reset migration | `20261003020000_reset_successful_login_attempts` — applied in the same transaction |
| Authenticator configuration | TOTP enabled |
| Email configuration | Automatic confirmation enabled; SMTP absent; inbox ownership unproven |
| Pre-release snapshot | 42 tables plus metadata/configuration; encrypted; checksum and decrypt/readback verified |
| Private profile-photo objects | Zero at snapshot time |
| Provider backups/PITR | No backup entries returned; PITR disabled |
| Full hosted recovery exercise | Not performed |

The encrypted snapshot's private location and decryption requirements belong in the owner handoff. Source reports do not contain credentials or backup contents. Do not rerun initial schema, demo seeding or reset commands against client records.

## Release tracking — pending completion

| Release evidence | Status |
| --- | --- |
| Repository | [Gabbu69/LabTrack-QR](https://github.com/Gabbu69/LabTrack-QR) |
| Implementation review | [PR #1](https://github.com/Gabbu69/LabTrack-QR/pull/1); draft at this checkpoint |
| Implementation commit | `6849a0fd54bfb5b529d390425318732835b76e14` |
| Preview exact URL/deployment/source commit | [Verified Preview](https://labtrack-7d4gtrnnx-edgardo-gabriel-paclibars-projects.vercel.app), `dpl_3iXA8EsEHsstt9xLK2yt3LqsQ61h`, implementation `6849a0f`; 96 application/config/public source files hash-match the tested checkout |
| Preview HTTP and three-role browser checks | Passed all seven anonymous API denials, three role dashboards/access checks, four browser suites across 320/390/768/1366 pixels, scanner review, native downloads, refresh and logout |
| Preview hosted password/MFA checks | Six successful password sign-ins within 15 minutes passed. Disposable operational account passed initial/subsequent MFA, AAL1 rejection, AAL2 access, invalid-code rejection, verified backup/device replacement and last-factor guard; deleted afterward with shared counts unchanged |
| Filtered CSV/A4/native QR download checks | Actual hosted student and tool SVG downloads decode correctly. Filtered CSV/A4 share the same transaction and custody items. Generated PDF layout inspection is recorded separately |
| Additive live migration application | Both new versions applied and re-inspected; shared counts unchanged at 16/20/3/5 |
| Main release commit and CI | Pending |
| Production alias | [labtrack-qr.vercel.app](https://labtrack-qr.vercel.app); new implementation not yet verified there |
| Exact Production deployment/source commit | Pending |
| Production route/role/download/report checks | Pending |
| Compatible rollback build | Retain tested Preview `dpl_3iXA8EsEHsstt9xLK2yt3LqsQ61h`; verify target environment configuration before restoration. Earlier token-only builds are incompatible with the protected return contract |

Record each hosted result against its exact URL, source commit and migration state. A Ready deployment, a passing GitHub check and a working alias are separate claims. Native downloads from a protected Preview must use the existing authorized automation access; the app's role restrictions must remain effective.

Vercel initially refused both Git and CLI Preview builds because the project was paused. The project was resumed on its existing free plan using the documented project-resume operation; the subsequent compatible Preview reached Ready. No paid upgrade or additional service was added. See [Vercel project management](https://vercel.com/docs/projects/managing-projects).

## Acceptance boundaries

| Gate | Status and required evidence |
| --- | --- |
| Complete browser mutations on a separate Supabase backend | **Blocked:** no disposable backend is available. Run registration/approval, operational MFA, temporary staff passwords, photo upload, checkout, partial/complete/damaged returns, missing recovery and role restrictions before marking this gate passed. |
| Client phone and laptop | **Pending:** record models/browsers and observe HTTPS camera permission, printed labels, repeated scans, denied-camera fallback, interrupted connection, refresh, session expiry and logout. |
| Owner/alternate and recovery | **Pending:** privately confirm ownership, backup location and a disposable recovery exercise covering database records, QR identifiers, Auth/MFA and photo bytes. Decrypt/readback and fictional SQL restore are narrower evidence. |
| Participant evaluation | **Pending:** keep the worksheet blank until observations are collected; record the tested deployment and adviser-approved process. |
| Pilot decision | **Pending:** requires integrity fixes, passing automation, complete disposable operational workflows and completed client-device/recovery gates. |

Shared smoke preserves records; destructive/reset/concurrency checks use disposable fixtures. Read-only hosted checks cannot demonstrate every mutating workflow. Current email settings cannot demonstrate delivery or inbox ownership. Viewport automation cannot establish physical camera/scanner/authenticator behavior. CSV uses stable cursors but is not a single immutable snapshot across concurrent updates. No exhaustive security, load or accessibility certification is claimed.

## Handoff and historical results

Follow [CLIENT_GUIDE.md](CLIENT_GUIDE.md), [DEFENSE_WALKTHROUGH.md](DEFENSE_WALKTHROUGH.md), [BACKUP_HANDOFF.md](BACKUP_HANDOFF.md) and [SETUP.md](SETUP.md). A compatible rollback must retain exact-item return payloads, login-reset support and existing MFA/password protections. Prefer a forward fix over weakening database guards.

This checkpoint supersedes the September 26 verification report. Earlier local/hosted results and deployment URLs remain historical evidence for those releases; their lower test/migration counts and then-current dependency results are not claims about this implementation. Fill the pending release entries with observed results before presenting this document as a completed hosted release.
