# LabTrack QR simplification verification

Historical checkpoint. See [the current managed-app verification](./MANAGED_APP_VERIFICATION_2026-10-24.md) for the final G: location, managed-account flow, shorter guide and latest results.

Date: 24 October 2026 (Asia/Manila).

## Delivered locally

- Task-led custodian and instructor dashboards; Borrow tools, Return tools, and Manage inventory are prominent for the custodian.
- Consistent Inter typography, restrained AISAT blue, readable headings, responsive cards, and simpler login language.
- Explicit password and authenticator steps, first-use QR/manual-key instructions, same-phone setup help, code-location help, and accurate authentication-control explanations.
- Inventory status shortcuts, search that preserves status/category, Clear filters, result counts, and a real filtered CSV export across all matching pages.
- Dashboard shortcuts for labels, missing tools, active loans, reports, inventory export, and the user guide.
- Guide opens with the signed-in user's role and returns to the dashboard. Help remains available on demand.
- Editable everyday instructions: `SIMPLE_USER_GUIDE.md`.

The additions use existing dependencies and services. No schema migration is required for this revision. Authenticator TOTP remains the selected sign-in method (`EMAIL_OTP_ENABLED=false` in the verified local configuration). Shared database-scoped demo accounts are explicitly labeled and remain exempt from personal authenticator enrollment.

## Verification results

| Check | Result | Evidence / practical limit |
| --- | --- | --- |
| ESLint | PASS | Final source passed `npm run lint`. |
| TypeScript | PASS | Standalone check passed; final production build also completed TypeScript. |
| Unit tests | PASS | 326 tests in 32 files. The 16 added export tests cover access, pagination, filters, failed batches, and CSV formula protection. The 8 authenticator UI tests were rerun after the last help-attribute update and passed. |
| Production build | PASS | Final `next build` completed and includes `/api/reports/inventory.csv` and the role-aware `/guide`. |
| Real Supabase TOTP | PASS | Disposable operational staff account on the configured `tsusogeqjduyahoskteb` backend; actual password sign-in, enrollment, code verification, and subsequent sign-in through the local production application. |
| Authentication restrictions | PASS | Direct AAL1 database RPC/inventory access denied; password-only portal/session and inventory export denied; valid TOTP grants AAL2; incorrect code rejected. |
| Authenticator replacement | PASS | Verified backup enrollment, original-device removal, and last-device removal protection. |
| Real inventory export | PASS | Verified operational staff can download a private/no-store CSV; missing-status demo download through the actual UI matches visible asset codes and keeps QR tokens out of the CSV. |
| Fixture cleanup | PASS | Disposable Auth/profile removed. Existing profile/tool/transaction/item counts unchanged after each authenticator trial. |
| Responsive role workflows | PASS | Custodian, instructor, and student read-only workflows, refresh, logout, and relevant screens checked at 320, 390, 768, and 1366 pixels. Role-specific guide and return link passed for all roles. |
| Desktop/browser guidance | PASS | 11 laptop checks passed in the broader final run. The remaining registration-help check passed after its explanation was corrected. This covers the 12 applicable laptop checks; 3 mobile-only checks are intentionally skipped in that project. |
| Mobile menu/public forms | PASS | 6 applicable mobile checks passed: all 3 role menus, login layout, registration fields, and anonymous protected-route refresh. The desktop-only sidebar check is intentionally skipped. |
| Source whitespace | PASS | `git diff --check`. |
| Physical phone authenticator / camera / printed QR / USB hardware | NOT RUN | Automated TOTP and browser checks do not establish device ergonomics or hardware acceptance. |
| Tool borrowing/return mutations on shared operational records | NOT RUN | This revision adds no borrowing/return mutation logic; the hosted shared records were preserved. Existing unit coverage ran. |
| GitHub push / Vercel deployment of this revision | NOT RUN | Changes are in the local checkout; this report does not claim a production release. |

## Reproducing the checks

Build and tests ran in `D:\CodexBuilds\LabTrack-audit-20261003` with Node 24.22.1, copied from the editable `app` checkout using `scripts/windows-workspace.ps1 -Mode sync`. This avoids placing build output on the nearly full C: drive.

The application is served at `http://localhost:3000/login` using the production build. Use `localhost` for the local production-mode browser checks so Secure cookies work with the test client's loopback handling. The initial `127.0.0.1` API-context trial returned 401; the `localhost` trial completed successfully without weakening cookie security.

Commands used include:

```text
npm run lint
npm run typecheck
npm test -- --maxWorkers=1
npm run build
node --env-file=.env.local scripts/verify-mfa-hosted.mjs http://localhost:3000
```

The MFA verifier requires its explicit disposable-account and database-gate flags. It does not enroll an existing account, store setup secrets, or change real laboratory inventory. Browser checks use the existing `audit-readonly`, `portal-navigation`, `public-surfaces`, and `guide` suites against the running local server.

The earlier browser run found a 320px scanner-card overflow, an ambiguous password test locator, and stale Create account help. These were corrected and the affected checks passed. Desktop and mobile dashboard/login/inventory screenshots were inspected separately from the automated layout assertions.

No client acceptance, adviser approval, email-inbox verification, or production publication is implied by this report.

## Real custodian account setup addition

The owner requested the Thesis Scheduler's coordinator-style real sign-in flow with Custodian as the LabTrack role. The current scheduler source was inspected; LabTrack now has an owner-issued, email-bound `/setup-custodian` invitation, followed by the existing password → real authenticator enrollment/challenge → operational dashboard sequence.

- PASS: 11 new invitation/setup unit tests plus 78 existing login/MFA action/UI regression tests.
- PASS: lint and final production build with TypeScript; source/build-mirror byte comparison and whitespace checks.
- PASS: actual private setup form created a disposable operational custodian on the configured Supabase backend. The owner-chosen test password worked; replay could not replace it. Password-only direct database and portal access failed, real TOTP succeeded, invalid codes failed, backup replacement and last-factor protection passed.
- PASS: disposable account removed and original profile/tool/transaction/item counts restored. No existing client's account was enrolled or reset.
- PASS: setup form rendered at 320, 390, and 1366 pixels without document overflow; screenshots at 390 and 1366 were inspected. Invalid links display no account-creation form; the page uses no-referrer and private/no-store headers.
- Corrected during the real trial: Auth may create the profile before staff metadata is available. Setup now assigns the approved role/scope to the newly returned Auth ID, matching the existing staff bootstrap workflow. It never assigns a role to an existing account through an invitation.
- PENDING USER INPUT: the permanent custodian account's full name and email. No permanent invitation or owner account is claimed as created without those details. The password will be chosen by its owner in the app.
- NOT RUN: physical-phone enrollment and publication of this revision to GitHub/Vercel.

See `CUSTODIAN_ACCOUNT_SETUP.md` and `scripts/create-custodian-invitation.mjs` for private link preparation. Setup links expire after one hour and do not send an email automatically.
