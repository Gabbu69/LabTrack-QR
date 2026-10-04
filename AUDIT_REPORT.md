# LabTrack QR client readiness audit

Assessment date: **4 October 2026**. Scope: the existing three-role, single-laboratory thesis application, intended for a defense and small supervised pilot using a phone camera and laptop. Implementation reviewed and tested: `6849a0fd54bfb5b529d390425318732835b76e14`. Backend selected by the owner: Gabs Project (`tsusogeqjduyahoskteb`). No passwords, tokens, authenticator setup secrets or server keys are included here.

**Current decision: implementation and compatible Preview checks passed; pilot acceptance remains pending.** The two reproduced return defects are fixed and pass disposable PostgreSQL regressions. Both reviewed live migrations are installed; the compatible Preview passed three-role HTTP/browser, actual QR download decoding, repeated sign-in, scoped report and disposable operational MFA checks. Production tracking is recorded in [VERIFICATION.md](VERIFICATION.md). Full disposable Supabase browser workflows, the client's actual devices and a hosted recovery exercise remain separate acceptance gates.

## Findings and changes

| Finding | Change and verified behavior | Evidence boundary |
| --- | --- | --- |
| An old return selection could close a newer loan of the same tool | `/api/return` requires `itemId` with `toolToken`; SQL matches the exact item, tool, borrower and scope. Missing IDs fail validation; stale custody fails with HTTP 409 and reload guidance. No token-only fallback remains. | Route unit tests and isolated SQL reproduce the old-selection/reborrow case and verify the newer loan is preserved. |
| Simultaneous returns could leave a completed transaction marked partial | Return and missing RPC implementations lock affected parent transactions, then tools and items, in sorted order. They revalidate custody after acquiring locks and recalculate status while the parents remain locked. | Independent PostgreSQL connections test distinct returns, duplicate returns, same/different-item return-versus-missing and reversed multi-parent selections. |
| Reconciliation state could carry notes into another borrower | Changing borrowers and successful returns clear notes and selections. Already-missing tools remain visible with another missing action disabled; physical returns still recover them. | Component regressions cover notes, selection isolation, pending duplicates and missing recovery. |
| Inventory status choices could suggest invalid custody transitions | Inventory editing limits choices to valid states and explains that borrower custody is resolved through Checkout/Return. Damaged tools remain unavailable or archived. | Component tests; existing database custody protections remain in place. |
| QR download selected the branding SVG | Download uses a direct reference to the QR SVG and includes a printing quiet zone. Student and tool SVG downloads remain available. Image upload guidance specifies JPEG, PNG or WebP. | Both generated and actual hosted native student/tool SVG downloads decode correctly. Physical printing/scanning remains pending. |
| CSV return dates used the parent completion date | Each row now uses that item's `returned_at`, retaining the existing columns and matching printable-report semantics. | Partial and staggered-return export regressions pass. Hosted filtered CSV/A4 comparison confirms the same transaction/custody items. |
| Successful sign-ins consumed the demonstration allowance | Successful password authentication clears its atomic attempt counter. Successful MFA clears only the separate verification counter after fresh matching AAL2 claims. Authenticator management remains throttled. | Unit/SQL checks cover failure cooldown, concurrent limiting, counter separation and service-role-only reset access. Six actual successful sign-ins within 15 minutes and disposable hosted operational MFA passed. |
| Shared demo identities could be disrupted through account controls | Seven canonical seeded identities, identified with trusted demo scope, cannot be changed, reset or disabled through app controls/server actions. Newly created demo staff retain the temporary-password workflow. | Allowlist, action and UI regressions pass. Direct provider-level changes remain possible with publicly shared credentials. |
| Browser/HTTP checks could overlook an error screen | Checks use the current error-page text and assert the expected content for the relevant route and role. | Test assertions updated; fresh hosted results are tracked separately. |

The new migrations are `20261003010000_harden_return_reconciliation.sql` and `20261003020000_reset_successful_login_attempts.sql`. They replace/add functions while preserving records, existing grants, scope restrictions and operational MFA. Both passed isolated migration/restore checks and were applied live together after a verified private encrypted snapshot. Reinspection confirms 13 migration versions and unchanged shared counts.

## Automated verification

Checks ran sequentially with **Node 24.19.0**, using the established D: workspace, cache and temporary directories. Fresh GitHub CI for the implementation commit also passed: [run 37182629784](https://github.com/Gabbu69/LabTrack-QR/actions/runs/37182629784).

| Check | Result |
| --- | --- |
| Unit/component/route suite | **244 tests in 23 files passed** |
| TypeScript | Passed |
| ESLint | Passed; local generated audit output produced one warning, with no lint errors; CI passed |
| Production build | Passed |
| Disposable PostgreSQL | All **13 migrations**, workflow/RLS/MFA checks, checkout race and new return/missing race cases passed |
| Disposable restore | Fictional database backup/restore verification passed |
| Production dependency audit | **Zero findings** |
| Full dependency audit | Five high-severity package entries remain under the documented development-only exception for `GHSA-vfj7-8cjw-p6xm`; this is not a zero-finding full audit |
| Compiled browser credential scan | 25 artifacts scanned; zero configured private-credential matches |

The database fixture tests authorization and transaction behavior. It does not emulate hosted Supabase Auth, email delivery, Storage HTTP or a real phone authenticator. Existing shared operational/demo records were not used as mutation fixtures.

## Backend and recovery evidence

Live pre-release inspection reported **16 profiles, 20 tools, 3 transactions and 5 items**, with 11 existing migration versions through `20261002010000`. None of the existing transactions exhibited the reproduced incomplete-status defect. These counts are a preservation checkpoint, not a concurrency test on client records.

A private encrypted snapshot captured 42 database tables plus schema/configuration metadata. There were zero profile-photo objects to download. Checksum and decrypt/readback verification passed. The snapshot is protected for the creating Windows user; that protection and the private location must be included in the owner handoff. This is **not** a full hosted restore exercise. Provider backup inspection returned no backup entries and PITR was not enabled.

TOTP remains enabled. Email automatic confirmation remains configured; SMTP is absent. An automatically confirmed address does not prove inbox ownership. The client guide explains this limitation and retains custodian approval as a separate requirement.

## Remaining acceptance gates

- **Production verification pending:** compatible Preview, live migration inspection and hosted role/QR/report/MFA checks passed. Verify the exact Production commit and repeat its route/access checks before recording release completion. Old token-only requests fail safely; retain a rollback application that supports the protected database contract.
- **Full disposable Supabase browser mutations blocked:** no separate disposable backend is available. Student registration/approval, operational authenticator setup, temporary staff passwords, photo upload, borrowing, returns and missing recovery need the isolated acceptance journey. Shared read-only review and isolated SQL do not satisfy it.
- **Actual client phone/laptop pending:** HTTPS camera permission, printed labels, repeated scans, denied-camera fallback, interrupted connection, refresh, expiry and logout must be observed on the recorded devices.
- **Owner recovery pending:** record the responsible owner, alternate, private backup location and a disposable recovery exercise covering records, Auth/MFA and photo files before real pilot records are entered.
- Reports reflect live data. Stable export cursors prevent offset skipping, but concurrent updates across export batches are not an immutable database snapshot. Large exports still retain the final CSV in server memory.
- No exhaustive penetration, institutional load or formal accessibility certification is claimed.

## Client handoff

Use [CLIENT_GUIDE.md](CLIENT_GUIDE.md) for authenticator setup, temporary-password changes, approval, scanning and A4 reports; [DEFENSE_WALKTHROUGH.md](DEFENSE_WALKTHROUGH.md) for the short defense sequence; [BACKUP_HANDOFF.md](BACKUP_HANDOFF.md) for recovery and shared-demo credential ownership; and [CLIENT_ACCEPTANCE.md](CLIENT_ACCEPTANCE.md) to record observations and the pilot decision. The evaluation worksheet must remain blank until participant observations are collected.

## Historical evidence

This report supersedes the September 26 audit as the current readiness assessment. Earlier fixes for mandatory-password enforcement, password-operation serialization, JSON errors, complete pagination/report reads, scanner lifecycle, image validation and database scope isolation remain part of the application and are exercised by the current regression suite. Earlier test counts, dependency results, migration counts and deployment URLs describe their original checkpoints; they do not establish this release's hosted acceptance.
