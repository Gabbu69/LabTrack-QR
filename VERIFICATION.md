# Verification Report

Date: 2026-09-19

## Verified in this update

- Dedicated Supabase project: **LabTrack QR** (`pcbfmmtescndhrlarrsm`). All six checked-in migrations are present in its migration history.
- `npm run verify` passed: ESLint, TypeScript, **13 unit tests**, and the Next.js production build.
- The three checked-in SQL test files ran against the live database through the Supabase SQL connector inside rolled-back transactions. The nine authorization assertions and four profile-lifecycle assertions passed. The integration script passed its checkout, partial-return, missing-item, late-recovery, scope-isolation, and database demo-reset checks.
- The profile lifecycle regression confirms that deleting an unused student or instructor Auth account removes its profile. The migration also makes the server role's table grants explicit.
- `npm run test:smoke` passed against a production server and the live database: anonymous visitors redirect to login; custodian, instructor, and student sign-ins issue session cookies and render their role dashboards; an instructor cannot check out tools; QR/code resolution, checkout, duplicate-checkout rejection, custody lookup, return, and CSV export work. A completed demo transaction is retained as verification history.
- Seven fictional demo accounts and twenty demo tools are present. The three principal role accounts were tested through the running application's login form endpoint. Passwords and private environment files are excluded from Git.

## Remaining setup blocker

`SUPABASE_SECRET_KEY` is not configured in this workspace. The Supabase dashboard still requires sign-in, and the connector used here does not expose that private server key. Consequently:

- `npm run db:check` correctly stops with `Missing: SUPABASE_SECRET_KEY`.
- Staff-account creation, staff password administration, operational bootstrap, and the full application demo-reset/reseed flow are not verified and require that key.
- The SQL demo-reset function is verified; that does **not** verify the Auth administration and reseeding performed by the application reset endpoint.

To finish, configure the dedicated project's server-only key as `SUPABASE_SECRET_KEY` in `.env.local` and in the hosting environment. Keep `DEMO_ACCOUNT_PASSWORD` configured for demo reset, then run `npm run db:check` and the authenticated release tests. Never commit either secret.

## Advisor result

The current security advisor reports one warning: **Leaked Password Protection Disabled**. No database-policy findings were returned. See [Supabase password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Not verified in this update

- Full authenticated browser workflows, staff temporary-password changes, public student registration/approval, private photo uploads, and simultaneous two-session checkout.
- Supabase CLI `db lint` and `test db`. The SQL test files were executed through the connector instead.
- Vercel deployment and production redirect URLs. Pushing to GitHub does not establish that hosting variables are configured or that a deployment succeeds.
- Physical Android/laptop cameras, USB scanners, printed QR labels, glare/low-light scanning, and camera cleanup on actual devices.

Earlier public-browser and layout checks were recorded on 2026-09-04; they were not rerun in this database update. A passing build or HTTP smoke test is not evidence for the unverified items above.
