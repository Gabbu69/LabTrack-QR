# LabTrack QR app audit — 13 October 2026

**Status: application fixes published and verified in production.** Implementation commit `a3558d93cd6eece86733cd8011810ca725787178` was published to GitHub main, deployed to the existing Vercel project, and verified after applying the reviewed migration. Supporting audit updates can advance the repository commit without changing the verified application implementation.

The owner selected **authenticator-app two-factor authentication** on 13 October. Personal accounts must verify an authenticator; shared database-scoped demonstration accounts are exempt. Keep `EMAIL_OTP_ENABLED` unset or `false`. Email SMTP/inbox delivery is outside the selected login requirements.

## Defects resolved in this source

| Trigger | Resulting behavior | Verification |
| --- | --- | --- |
| Two requests remove different devices when only two verified authenticators remain | Enrollment, verification and removal share one server-controlled lease per personal account. A competing request is refused; removal rereads the factors while holding the lease and retains the final verified device. | MFA action/lease tests and independent PostgreSQL connections test exclusive acquisition, ownership of cleanup, setup exceptions and authenticated write denial. |
| Two custodians concurrently disable each other | Changes serialize for the data scope and recheck the actor's authorization after waiting. The last active custodian remains available. The trigger also protects trusted updates, scope moves and deletion. | The original failure was reproduced in an isolated database; the new RPC and direct-update race regressions pass. |
| Another custodian returns a different tool while a return page is open | After an accepted return, the page reads current custody to report the outstanding count. A failed follow-up read preserves the accepted return and tells the operator to identify the borrower again. | Return component regressions pass for concurrent custody changes and interrupted refresh. |
| A review list or missing selection exceeds the service's 100-item maximum | Checkout, return and missing selection use the same 100-item batch limit. Users can remove a selection, confirm the batch and continue with the remaining tools. | Workflow boundary regressions cover confirmation, replacement and remaining missing selections. API validation gives a useful limit message. |
| The same QR image is selected after a transient scan failure | The input clears after capturing the file, so the image can be selected again. Existing debounce and in-flight protections remain effective. | Image retry, pending-scan and disabled-scanner regressions pass. |
| Browser mutation checks assume personal sign-in skips MFA | Test helpers follow authenticator setup/challenge and then the temporary-password or dashboard route. Personal-account traces and screenshots are disabled. | TypeScript passes. Shared-backend protections remain in place; this does not claim the protected mutation suites were run. |

The new lease has no automatic expiry that could steal an active provider operation. [SETUP.md](SETUP.md) describes recovery of a confirmed interrupted operation and the required migration order.

## Final source checks

The clean Node 24 build mirror at `D:\CodexBuilds\LabTrack-audit-20261003` was synchronized from this source. Commands ran sequentially; detailed command logs and exit codes are in its ignored `output/audit-20261013/` directory.

| Check | Current result |
| --- | --- |
| `npm run lint` | Passed, no warnings |
| `npm run typecheck` | Passed |
| `npm test -- --maxWorkers=1` | **310 tests passed in 31 files** |
| `npm run test:db` | Passed with all 15 source migrations applied to a fresh loopback PostgreSQL cluster |
| Checkout/return/missing and authorization SQL | Complete, partial, damaged, missing/recovery, disabled/pending, role/scope, temporary-password, storage and direct MFA restrictions passed |
| Concurrent database operations | Checkout, exact/stale return, multi-item return/missing, custodian changes, factor leases and login limiting passed |
| Fictional database restore | Checksummed rows, QR/custody, routines and access rules restored and compared successfully |
| `npm run build` | Production build passed |
| `npm run audit:security` | Passed: zero production findings; one previously reviewed development advisory affects five lint-tooling package entries |
| Compiled browser artifacts | 28 files scanned, with no configured private-value matches |
| `git diff --check` | Passed |

See [DEPENDENCY_AUDIT.md](DEPENDENCY_AUDIT.md) for the existing development-only exception. The original C: dependency tree is incomplete; the validated D: mirror supplies build/test dependencies. This does not change the source lockfile or deploy dependencies.

## Current hosted evidence

The target remains the existing [LabTrack production site](https://labtrack-qr.vercel.app), GitHub repository `Gabbu69/LabTrack-QR`, and Gabs Supabase project `tsusogeqjduyahoskteb`.

- Implementation commit `a3558d9` passed [GitHub CI run 38400285306](https://github.com/Gabbu69/LabTrack-QR/actions/runs/38400285306). GitHub deployment `7038945745` records a successful Production release for that same SHA.
- Vercel deployment `dpl_EkTka7LGHF7LPc4suJu6tsZuQHGe` is READY at [its exact URL](https://labtrack-2fe584w85-edgardo-gabriel-paclibars-projects.vercel.app). Authenticated deployment metadata confirms project `prj_wx6igIRE93H6eIk8BdZQ6pQWqURP`, source SHA `a3558d9`, branch `main`, and the production alias. Authenticated checks on that exact deployment returned login HTTP 200 and anonymous session HTTP 401.
- Fresh read-only HTTP checks passed anonymous/expired-session JSON denial and all three role dashboards, API restrictions, session checks and scoped CSV.
- Fresh live browser checks: **seven passed**. Public pages fit widths 320/390/768/1366; custodian/instructor/student navigation, permitted controls, refresh and logout passed; CSV and A4 reports agreed on filtered assets and each item's return date for all three roles. Desktop and mobile role screenshots were inspected.
- A fresh disposable operational staff trial passed direct password-only database denial, authenticator enrollment, mandatory private-password change before protected records, later sign-in, invalid-code rejection, verified backup replacement and the last-device guard. It was repeated successfully on the new production application, exercising the new operation lease. Each fixture was deleted and original profile/tool/transaction/item counts were preserved.
- Live database reads passed Auth connectivity, anonymous denial on the four main tables and private profile-photo storage with a 2 MB limit. Counts observed: 18 profiles, 20 tools, three transactions and five items.
- A compatible CLI using an isolated local config linked to Gabs and successfully dry-ran the current source. **Only `20261013010000_serialize_account_security.sql` was pending.** After explicit owner approval and a verified private checkpoint, that single migration was applied; the live ledger now contains all 15 source versions. The new column is readable, with no abandoned operation leases on the preserved profiles.

The seven role/report browser checks and HTTP smoke were repeated after the implementation release, and all passed. Pre-release checks are recorded separately in ignored logs.

## Completed release work

1. The owner explicitly approved source publication, the additive migration and the existing production release.
2. A fresh read-only checkpoint was encrypted with Windows DPAPI CurrentUser and verified by decrypt/readback in memory before migration. It includes the four main tables, Auth admin metadata, photo bucket/object data and the 14 baseline migration sources. It is a scoped migration checkpoint; it omits Auth password hashes/MFA secrets and is not a complete hosted recovery backup. Private files remain outside Git and handoff archives.
3. Only `20261013010000_serialize_account_security.sql` was applied. It adds a nullable operation lease and replaces two private routines. Records and demonstration inventory were preserved.
4. The reviewed implementation was published, CI and deployment source/alias verified, and the released role/API/report and authenticator checks passed. Disposable account cleanup and original record counts were confirmed.

Source archives are rebuilt from the saved source commit before client release. Their manifests record the source commit, working-copy state and per-file hashes; live environment files, dependencies, provider/browser state and private backups are excluded. The existing client documents remain dated 9 October and retain their proposed, unsigned terms.

A bounded data-integrity read found two active demo instructor profiles that are not retrievable through the Auth admin API. There are no unmatched operational profiles or custodians, and all three advertised demo sign-ins passed. The precise provider/schema cause is unverified; those historical records were preserved rather than repaired during this release. Review them privately before any later demonstration-data cleanup.

## Client/device acceptance

[CLIENT_ACCEPTANCE.md](CLIENT_ACCEPTANCE.md) remains the record for actual printed labels, phone camera/image/typed fallback, a witnessed checkout/return demonstration, personal-device authenticator use, training and handoff. Those observations must be recorded by the client; automated browser widths do not establish physical-device acceptance. Real laboratory rollout additionally needs named ownership and a complete hosted database/Auth/photo recovery exercise.

The mutation browser suites remain restricted to a separate disposable Supabase backend. This machine has no connected Docker runtime or isolated hosted backend configured for them. Existing SQL, component and read-only hosted checks are separate evidence; unexecuted operational mutation or recovery checks are not marked as passed.
