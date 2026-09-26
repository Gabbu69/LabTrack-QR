# Setup and Deployment

Use Node **24.x**. Daily users need only the hosted website and their prepared account.

## Existing backend

Use the owner-selected **Gabs Project**, `tsusogeqjduyahoskteb`. Do not create or reset a replacement backend. Copy `.env.example` to `.env.local`, supplying matching URL, publishable key, server secret and the privately supplied demo password. Keep the server secret out of `NEXT_PUBLIC_*` variables. Environment files are excluded from Git and deployment uploads.

Student registration creates a pending student profile. The live project used automatic email confirmation when inspected on September 26, 2026; **custodian approval is still required**. If email confirmation is enabled later, students must also confirm their email. Retain custodian-managed password resets.

Inspect live migration history before applying changes. Initial setup is only for an empty, separate development database. Validate migrations with `npm run test:db` first; apply only missing additive migrations to Gabs. The CLI requires a separate Supabase management login; a publishable project key is not a management token.

```powershell
npx supabase@2.116.0 login
npx supabase@2.116.0 link --project-ref tsusogeqjduyahoskteb
npx supabase@2.116.0 migration list
```

Review pending SQL before using `npm run db:push`. Record applied versions and retain the previous deployment. `npm run db:check` is read-only. Never run destructive fixtures, reset scripts, or linked mutation tests against the shared backend.

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

## Account administration and recovery

Custodians approve students and create/reset staff accounts through User Management. Temporary credentials require a private password before operational APIs, RPCs, inventory or photo access become available. Remove `BOOTSTRAP_*` variables after one-time staff provisioning. Do not bootstrap or seed again on an established project.

Password operations hold a server-only per-account lease while updating Supabase Auth. If a server process is killed mid-operation, access remains restricted. The deployment owner must first confirm no password operation remains active, inspect that account's Auth state, and then clear **only its `password_operation_id`** through a trusted management connection. Keep `must_change_password=true`; let the user complete another verified password change. Never clear all leases or clear the mandatory-change flag as a shortcut.

Camera access needs HTTPS or localhost. If denied, use the labeled typed-code, USB scanner or image-upload alternatives. Hardware behavior must be checked on the intended client devices.
