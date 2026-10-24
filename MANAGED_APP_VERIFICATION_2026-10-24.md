# LabTrack QR: current local verification

24 October 2026, Asia/Manila. This record supersedes the earlier simplification checkpoint.

## Delivered

- Active project: `G:\LabTrack - QR\app`. Source, Git history, private configuration and project outputs moved with per-file SHA-256 verification. Dependencies are installed directly on G: and the production server runs from G:.
- Shorter login and task labels. No account step counter or public registration. Help is a circle question mark after sign-in; the guide uses short expandable topics.
- Custodian-managed student/staff accounts, temporary passwords, first-use password replacement and real authenticator enrollment. Initial custodian setup requires an owner-issued, expiring invitation bound to the named email.
- Public Supabase signup disabled on the configured backend. Operational sessions require verified authenticator assurance; sample accounts remain isolated in their labeled sample workspace.
- Profile pictures saved in private storage; Course / Program replaces the visible group-number field.
- Logout confirmation, inventory status filters, filtered inventory CSV, QR-label and outstanding-loan shortcuts.
- All 20 original sample tools preserved. The sample inventory is separate from operational records.

## Results

| Check | Result | Evidence and limit |
| --- | --- | --- |
| Move integrity | PASS | 2,271 copied files verified by SHA-256; no essential transfer failures. Before/after Git status matched. Transfer receipts: `G:\LabTrack-Move-20261024`. |
| Original-source removal | PASS | 2,270 files removed only after matching destination hashes. Changed original `.git/index` and unverified generated caches retained on C:. The active G: checkout is complete. |
| Dependency location | PASS | G: `node_modules` is an ordinary directory; comparison against the working dependency source returned no differences. |
| ESLint | PASS | Final source, scripts and tests passed. |
| Unit tests | PASS | 339 tests in 35 files. |
| Production build and TypeScript | PASS | Next.js production build completed on Node 24 using the G: checkout and dependencies. |
| Public surfaces, navigation and guide | PASS | 12 applicable laptop/mobile checks; four intentional device-specific skips. Public help is absent, guide access is protected, help opens by request, and logout supports cancel/confirm. |
| Role workflows and reports | PASS | Seven browser checks cover responsive role pages, refresh, logout, inventory CSV and transaction reports. Tested widths include 320, 390, 768 and 1366 pixels. |
| Real managed-account flow | PASS | A disposable operational custodian created a student through the UI. The student linked an authenticator and replaced the temporary password. Student account-management access was denied. |
| Real authenticator security | PASS | Actual Supabase password sign-in, TOTP enrollment and AAL2 access. AAL1 portal/export/database access and incorrect codes were rejected. Verified backup replacement and last-factor protection passed. |
| Real profile persistence | PASS | Private-storage profile photo and Course / Program survived refresh. |
| Custodian setup | PASS | Owner-issued invitation created the intended custodian; invitation replay could not replace the existing password. |
| Test cleanup and preservation | PASS | Disposable custodian/student/photo fixtures removed. Existing profile/tool/transaction/item counts unchanged. Original sample-tool fingerprint retained in the transfer receipts. |
| Visual review | PASS | Desktop login plus mobile guide/logout reviewed. Final review also corrected modal centering and reserved space beside the help button. Screenshots: ignored `output/playwright/final-20261024/`. |
| Whitespace | PASS | `git diff --check`. |
| Git push / Vercel publication | NOT RUN | This local revision has not been published. The hosted signup policy change above is already applied. |
| Physical phone authenticator, camera, printed QR and USB scanner | NOT RUN | Automated browser/TOTP checks do not establish physical-device acceptance. |
| Borrow/return mutations on shared operational inventory | NOT RUN | Shared operational records were preserved during this revision. |

No permanent custodian identity or password was invented for the owner. Prepare the named custodian using `CUSTODIAN_ACCOUNT_SETUP.md`.
