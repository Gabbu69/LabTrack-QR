# Setup and Deployment

This setup is performed once by the developer or deployment owner. Afterward, daily users only open the production website and sign in.

## 1. Prerequisites

- Node.js 24.x
- A Supabase account with one free-project slot available
- A Vercel account

Do not reuse, pause, or delete an unrelated Supabase project merely to make room. Confirm the project screen still shows **$0/month** before creating the dedicated project.

## 2. Connect Supabase

The existing **LabTrack QR** project is `pcbfmmtescndhrlarrsm` (Singapore). Its schema is applied. Restore this project from the Supabase dashboard if it is paused; wait for **Active / Healthy** before running SQL or signing in.

1. Copy `.env.example` to `.env.local`. The public URL and publishable key already identify the dedicated project.
2. Set `SUPABASE_SECRET_KEY` to this project's server-only secret from **Project Settings → API Keys**. Never commit `.env.local` or put the secret in a `NEXT_PUBLIC_` variable.
3. Install dependencies using `npm ci` (Node.js 24.x).
4. Link this project before applying future migrations:

   ```powershell
   npx supabase@2.116.0 login
   npx supabase@2.116.0 link --project-ref pcbfmmtescndhrlarrsm
   npm run db:push
   ```

5. Run database checks and generate current types:

   ```powershell
   npm run db:lint
   npm run db:test
   npm run db:types
   ```

The migration creates explicit table grants, RLS policies, atomic borrow/return functions, scope constraints, and the private `profile-photos` bucket.

`npm run db:check` checks Auth, server-key access, table permissions, and private photo storage without changing records. `npm run db:test` runs rollback-only SQL tests. The generated types belong in `src/types/database.ts`, which is the file used by the app.

For a different Supabase project, change `SUPABASE_PROJECT_REF`, the URL, and both keys together. The Vercel configuration helper checks that the URL matches the selected project reference.

## 3. Bootstrap accounts and demo data

Seven fictional demo accounts and twenty tools have already been created in the dedicated project. Their password is provided privately, never stored in Git. Set `DEMO_ACCOUNT_PASSWORD` in `.env.local` to that password if using the demo reset feature.

To create operational staff accounts, use private, unique one-time passwords in `.env.local`, then run:

```powershell
npm run bootstrap:staff
npm run seed:demo
```

The first command creates one operational custodian and instructor. The second creates one demo account per staff role, five fictional students, twenty fictional physical assets, and completed/active/incomplete examples. Staff must change their temporary password after first sign-in.

After bootstrap succeeds, remove the `BOOTSTRAP_*` values from local and hosted environments. Keep `DEMO_ACCOUNT_PASSWORD` only if the defense reset button is required.

**Email confirmation:** public student registration uses Supabase Auth. With email confirmation enabled, students must confirm their email before signing in; custodian approval is also required. For an isolated classroom pilot, the project owner may choose automatic confirmation in Supabase Auth settings. Demo accounts are already confirmed.

## 4. Verify locally

```powershell
npm ci
npm run db:check
npm run verify
npm run test:smoke
npx playwright install chromium
npm run test:e2e
```

`npm run test:smoke` starts the production build, signs in the three demo roles, checks authorization, and borrows/returns `DMM-002` using `DEMO-2026-01`. It uses `E2E_DEMO_PASSWORD` or `DEMO_ACCOUNT_PASSWORD`, leaves a completed demo transaction in history, and never resets operational data. Ensure that `DMM-002` is available. Browser tests require Playwright Chromium; authenticated browser tests additionally require the documented `E2E_*` environment variables.

For normal use, run `npm run dev` and open `http://localhost:3000`, or run `npm run build` then `npm start`. A GitHub push alone does not host the app or configure Vercel environment variables.

Run the camera checks over HTTPS or `localhost`; ordinary HTTP on another device will not receive camera permission.

## 5. Deploy a Vercel preview

1. Import the repository as a new Vercel project.
2. Keep the detected Next.js settings and Node 24.x runtime.
3. Add the environment values from `.env.local` to Preview and Production. Never create a `NEXT_PUBLIC_SUPABASE_SECRET_KEY` variable.
4. Deploy Preview first.
5. Add the exact preview and eventual production URLs to Supabase Authentication URL Configuration. Use the exact `/login` destination where a redirect path is requested.
6. Exercise registration approval, staff temporary-password change, tool creation, label printing, checkout, complete and partial return, explicit missing, late recovery, CSV export, direct protected-route refresh, and sign-out over the Preview HTTPS URL.
7. Promote that verified deployment to Production. Re-run the same smoke workflow on the exact production deployment URL before sharing the alias.

## 6. Daily-use handoff

Give users only the production `vercel.app` link and their prepared account. Custodians handle approvals and password resets from User Management. No local server or command-line use is required for students, custodians, or instructors.

## Troubleshooting

- **Supabase is not configured:** confirm the URL and publishable key are present in the current environment, then restart the dev server or redeploy.
- **Camera denied:** use the explicit Start camera button again after granting browser permission, or use USB scanner, typed code, or QR-image upload.
- **Tool rejected at checkout:** confirm it is in the same data scope, available, serviceable, not archived, and not already scanned.
- **Cannot deactivate custodian:** the current and last active custodian are intentionally protected.
