# Setup and Deployment

This setup is performed once by the developer or deployment owner. Afterward, daily users only open the production website and sign in.

## 1. Prerequisites

- Node.js 24.x
- A Supabase account with one free-project slot available
- A Vercel account

Do not reuse, pause, or delete an unrelated Supabase project merely to make room. Confirm the project screen still shows **$0/month** before creating the dedicated project.

## 2. Create Supabase

1. Create a dedicated project named `labtrack-qr` in the Singapore region.
2. In Authentication settings, enable email/password and enable automatic email confirmation for this pilot.
3. Copy `.env.example` to `.env.local` and replace every placeholder. The publishable key may be public; `SUPABASE_SECRET_KEY` must remain server-only.
4. Link and apply the checked-in schema:

   ```powershell
   npx supabase@2.116.0 login
   npx supabase@2.116.0 link --project-ref YOUR_PROJECT_REF
   npx supabase@2.116.0 db push
   ```

5. Run database checks and generate current types:

   ```powershell
   npx supabase@2.116.0 db lint --linked
   npx supabase@2.116.0 test db --linked
   npx supabase@2.116.0 gen types typescript --linked --schema public | Set-Content src/types/database.generated.ts
   ```

The migration creates explicit table grants, RLS policies, atomic borrow/return functions, scope constraints, and the private `profile-photos` bucket.

## 3. Bootstrap accounts and demo data

Use private, unique one-time passwords in `.env.local`, then run:

```powershell
npm run bootstrap:staff
npm run seed:demo
```

The first command creates one operational custodian and instructor. The second creates one demo account per staff role, five fictional students, twenty fictional physical assets, and completed/active/incomplete examples. Staff must change their temporary password after first sign-in.

After bootstrap succeeds, remove the `BOOTSTRAP_*` values from local and hosted environments. Keep `DEMO_ACCOUNT_PASSWORD` only if the defense reset button is required.

## 4. Verify locally

```powershell
npm install
npm run verify
npm run test:e2e
```

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
