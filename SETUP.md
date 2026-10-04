# Setup and Deployment

Use Node **24.x**. Daily users need only the hosted website and their prepared account.

On this Windows laptop, use `powershell -ExecutionPolicy Bypass -File scripts/windows-workspace.ps1 -Mode dev` from the source checkout. The helper copies current source and the private local environment to the separate D: workspace, uses Node 24 and D: cache/temp folders, and installs from the lockfile if it changed. Restart the helper after editing source so the mirror receives changes. Use `-Mode verify` for local checks or `-Mode sync` to refresh the mirror without starting the app. Edit source in the original checkout: obsolete files in the mirror's source directories are removed, including committed deletions. The helper rejects redirected destination paths. This avoids building on the nearly full C: drive; it does not repair or delete the original C: dependency folder.

## Existing backend

Use the owner-selected **Gabs Project**, `tsusogeqjduyahoskteb`. Do not create or reset a replacement backend. Copy `.env.example` to `.env.local`, supplying matching URL, publishable key, server secret and the privately supplied demo password. Keep the server secret out of `NEXT_PUBLIC_*` variables. Environment files are excluded from Git and deployment uploads.

Student registration creates a pending student profile. The live project used automatic email confirmation when inspected on September 26, 2026; **custodian approval is still required**. If email confirmation is enabled later, students must also confirm their email. Retain custodian-managed password resets.

Inspect live migration history before applying changes. Initial setup is only for an empty, separate development database. Validate migrations with `npm run test:db` first; apply only missing additive migrations to Gabs. The CLI requires a separate Supabase management login; a publishable project key is not a management token.

```powershell
npx supabase@2.75.0 login
npx supabase@2.75.0 link --project-ref tsusogeqjduyahoskteb
npx supabase@2.75.0 migration list
```

Review pending SQL before using `npm run db:push`. Record applied versions and retain the previous deployment. `npm run db:check` is read-only. Never run destructive fixtures, reset scripts, or linked mutation tests against the shared backend.

## Authenticator 2FA rollout

This version implements mandatory TOTP 2FA for operational accounts. Shared demo accounts are exempt only through their trusted database scope and cannot enroll personal authenticators. This code does not prove that the hosted release or provider settings have been updated.

1. Inspect the selected project's migration history and pending changes using a compatible CLI (`npx supabase@2.75.0 db push --linked --dry-run`) or the trusted Management API. Review SQL before applying it.
2. Confirm the login-protection prerequisite `20260930010000_login_protection.sql` is applied and Supabase Auth allows TOTP enrollment and verification. Keep a trusted deployment-owner management connection available throughout rollout.
3. Deploy and test a Preview of the new application. Use a disposable, non-demo account to test initial enrollment, subsequent login, rejected codes, backup enrollment and access before verification. Do not enroll the shared demo users.
4. Promote the tested application and confirm Production is Ready with the new MFA screens before applying `20261002010000_require_mfa.sql`. Older deployments lose password-only operational access as soon as this migration is applied. Never replace an established backend with `schema.sql` or reset it.
5. Apply the reviewed MFA migration transactionally, record its version, and verify direct database AAL1 denial plus the complete hosted MFA flow. Check actual authenticator devices before thesis evaluation. Local mock tests and isolated SQL assertions do not substitute for this provider/device check.

Schedule the MFA migration and application as a coordinated release. Older deployments sharing the backend will immediately lose password-only operational access when the migration is applied, even if they have no MFA screen. Inform real users about enrollment and keep the trusted owner management connection available throughout rollout.

Users sign in with their password, set up or verify a six-digit authenticator code, and then complete any required private-password change. The code normally changes every 30 seconds; it is not sent by email or SMS. The Authenticator page supports verified backup devices and will not remove the last verified factor. Password attempts, MFA verification and device management use independent five-attempt, 15-minute limits. Pending student approval and disabled-account restrictions still apply after MFA.

## Local verification

```powershell
npm ci
npm run verify
npm run test:db
npm audit
npm start
```

Open <http://localhost:3000/login>. `test:db` creates a new loopback-only PostgreSQL cluster with a random password, applies all migrations, runs assertions and simultaneous checkout, then stops it. It ignores external database URLs. It emulates Supabase auth/storage database schemas; it does not emulate GoTrue, Storage HTTP or email delivery.

In a second terminal, run shared-safe checks:

```powershell
node --env-file=.env.local scripts/smoke-demo.mjs
node --env-file=.env.local scripts/smoke-http.mjs
npx playwright install chromium
$env:PLAYWRIGHT_BASE_URL='http://localhost:3000'
node --env-file=.env.local node_modules/@playwright/test/cli.js test audit-readonly public-surfaces guide --workers=1
```

For an exact hosted deployment, set `SMOKE_BASE_URL` and `PLAYWRIGHT_BASE_URL` to its HTTPS URL. Demo credentials are loaded from the ignored environment file. Authenticated audit traces are disabled to avoid saving passwords/cookies.

`npm run test:smoke` and the mutating E2E suites require `E2E_ISOLATED_DATABASE=true` and reject the shared Gabs URL. Run them only on a separately provisioned disposable Supabase project with disposable accounts. `seed:demo` and the app's Reset demo control **replace demo records**; neither is a credential-retrieval command. Do not run them merely to test a login.

## Vercel and GitHub

Use the existing `labtrack-qr` project, Node 24, and Next.js defaults. Set the five keys named in `scripts/configure-vercel.mjs` for Preview and Production; set `NEXT_PUBLIC_SITE_URL=https://labtrack-qr.vercel.app` for hosted releases. The helper sends values over stdin and checks the selected Gabs backend. Bootstrap credentials are not deployment inputs.

1. Validate locally and on an isolated database.
2. Apply and verify missing additive live migrations.
3. Deploy a Preview and test its exact URL with read-only checks.
4. Promote the verified Preview and repeat production smoke checks.
5. Push the reviewed source to GitHub and verify the Node 24 workflow.

GitHub Actions runs lint, TypeScript, unit tests, isolated PostgreSQL tests, the production build and dependency audit without project credentials. A GitHub push alone does not configure hosting or Supabase.

History now offers **Print A4 report** with the current filters and all matching records. Students receive only their own permitted records. The guide links to a blank printable thesis evaluation worksheet; methodology and participant results must be approved and collected separately. See `THESIS_EVALUATION.md`, `BACKUP_HANDOFF.md` and `DEPENDENCY_AUDIT.md` for evaluation, recovery and the narrowly documented development dependency exception. The isolated database test also restores a checksummed fictional logical backup into a second local database.

## October 4 readiness migration compatibility

The readiness application requires both `20261003010000_harden_return_reconciliation.sql` and `20261003020000_reset_successful_login_attempts.sql`. Inspect migration history and take a verified private backup before applying them. The first migration rejects old token-only return selections; the second supplies the service-role-only successful-login counter reset. A Preview of the new application cannot complete login until that reset RPC exists.

Prepare the compatible Preview build, then coordinate the reviewed migrations and verification before production promotion. Existing old return screens must reload after release. Preserve the database guards and roll back only to a build that sends exact item IDs and supports the installed limiter RPC; do not restore an unsafe token-only return function as a workaround. Complete `CLIENT_ACCEPTANCE.md` before entering real pilot records.

## Account administration and recovery

Custodians approve students and create/reset staff accounts through User Management. For operational accounts, temporary credentials require authenticator verification followed by a private password before operational APIs, RPCs, inventory or photo access become available. Demo accounts keep the private-password requirement without personal MFA. Remove `BOOTSTRAP_*` variables after one-time staff provisioning. Do not bootstrap or seed again on an established project.

Add and verify a backup authenticator before a device is lost. A password reset does not remove the second-factor requirement. There are no app recovery codes or custodian MFA-reset controls. If every factor is unavailable, the deployment owner must verify the person's identity out of band, recover only that account through trusted Supabase administration, revoke affected sessions and require fresh enrollment. Never disclose setup QR codes or manual secrets, disable MFA globally, or relabel real users as demos to restore access.

Password operations hold a server-only per-account lease while updating Supabase Auth. If a server process is killed mid-operation, access remains restricted. The deployment owner must first confirm no password operation remains active, inspect that account's Auth state, and then clear **only its `password_operation_id`** through a trusted management connection. Keep `must_change_password=true`; let the user complete another verified password change. Never clear all leases or clear the mandatory-change flag as a shortcut.

Camera access needs HTTPS or localhost. If denied, use the labeled typed-code, USB scanner or image-upload alternatives. Hardware behavior must be checked on the intended client devices.
