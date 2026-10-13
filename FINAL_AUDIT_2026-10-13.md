# LabTrack QR app audit — 13 October 2026

**Status: source fixes verified locally; publishing and the new live migration are pending.** The hosted application still serves `84784b886139a0f5e69381077622b84cb2fed19e`. The evidence below distinguishes that existing release from the newly reviewed source.

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

- GitHub main currently matches baseline `84784b8`; its recorded [CI run](https://github.com/Gabbu69/LabTrack-QR/actions/runs/37806130617) succeeded. GitHub deployment `6940557647` records a successful Production release for that same SHA.
- Fresh read-only HTTP checks passed anonymous/expired-session JSON denial and all three role dashboards, API restrictions, session checks and scoped CSV.
- Fresh live browser checks: **seven passed**. Public pages fit widths 320/390/768/1366; custodian/instructor/student navigation, permitted controls, refresh and logout passed; CSV and A4 reports agreed on filtered assets and each item's return date for all three roles. Desktop and mobile role screenshots were inspected.
- A fresh disposable operational staff trial passed direct password-only database denial, authenticator enrollment, mandatory private-password change before protected records, later sign-in, invalid-code rejection, verified backup replacement and the last-device guard. The fixture was deleted and original profile/tool/transaction/item counts were preserved. This provider lifecycle validates the existing hosted release; the new operation lease is separately covered by the local unit and database race tests until released.
- Live database reads passed Auth connectivity, anonymous denial on the four main tables and private profile-photo storage with a 2 MB limit. Counts observed: 18 profiles, 20 tools, three transactions and five items.
- All 14 existing live migrations are recorded. A compatible CLI using an isolated local config linked to Gabs and successfully dry-ran the current source. **Only `20261013010000_serialize_account_security.sql` would be applied.** No live migration was applied in this audit.

The seven browser passes describe the baseline hosted application. They do not prove that the new source fixes are deployed.

## Release work still required

1. Approve publication of the reviewed source to `Gabbu69/LabTrack-QR`, the additive migration to Gabs, and the existing Vercel production project. The new authenticator actions require the migration before deployment.
2. Take and verify a fresh private pre-migration checkpoint, apply only `20261013010000_serialize_account_security.sql`, and confirm installed versions. It adds a nullable operation lease and replaces two private routines; it does not reset records or seed demonstrations.
3. Publish the reviewed commit, confirm its GitHub checks and deployment source SHA, and verify the new application at its exact deployment URL and production alias.
4. Repeat role/API/report checks and the disposable hosted authenticator lifecycle on the released version, including temporary-password enforcement. Remove only the audit fixture and confirm original counts are preserved.

Source archives are rebuilt from the saved source commit before client release. Their manifests record the source commit, working-copy state and per-file hashes; live environment files, dependencies, provider/browser state and private backups are excluded. The existing client documents remain dated 9 October and retain their proposed, unsigned terms.

## Client/device acceptance

[CLIENT_ACCEPTANCE.md](CLIENT_ACCEPTANCE.md) remains the record for actual printed labels, phone camera/image/typed fallback, a witnessed checkout/return demonstration, personal-device authenticator use, training and handoff. Those observations must be recorded by the client; automated browser widths do not establish physical-device acceptance. Real laboratory rollout additionally needs named ownership and a complete hosted database/Auth/photo recovery exercise.

The mutation browser suites remain restricted to a separate disposable Supabase backend. This machine has no connected Docker runtime or isolated hosted backend configured for them. Existing SQL, component and read-only hosted checks are separate evidence; unexecuted operational mutation or recovery checks are not marked as passed.
