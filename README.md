# LabTrack QR

LabTrack QR is a functional tool-tracking application for one aviation-training laboratory. It identifies approved Student Mechanic Leaders and individual physical tools with opaque QR codes, then guides a Tool Custodian through checkout and return reconciliation.

The application uses Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, and Vercel. Runtime dependencies are pinned in `package-lock.json`.

## Included workflows

- Custodian-created student and staff accounts, recovery authenticator QR setup, one-use recovery code, profile photos, personal QR, current custody, and history
- Password plus Cloudflare Turnstile for sign-in; authenticator-based forgot password; public sign-up is disabled
- Custodian dashboard, user management, temporary-password staff creation/reset, batch asset creation, individual tool QR labels, guided borrow, guided return, explicit missing-item handling, and CSV export
- Instructor read-only inventory, borrower, transaction, and tool-history monitoring
- A separate sample workspace with the 20 preserved sample tools and practice records
- The operational custodian inventory includes 300 explicitly described dummy tools for practice; see [the additive import record](./SAMPLE_TOOL_IMPORT_2026-10-25.md). Replace these placeholders with actual equipment records before physical inventory acceptance.

## Working location

The active project is `G:\LabTrack - QR\app`. Run `scripts/windows-workspace.ps1 -Mode dev` for development or `-Mode start` after a build. The helper keeps temporary files and the npm cache on G: and uses Node 24. The verified move record is in `G:\LabTrack-Move-20261024`.

## Start here

For the simplified interface and everyday instructions, read [the simple user guide](./SIMPLE_USER_GUIDE.md). The current interface prioritizes Borrow tools, Return tools, and Manage inventory, with status shortcuts and a filtered inventory CSV download. Personal accounts use password plus Turnstile for sign-in and a linked authenticator for forgot password. See [current sign-in and recovery](./TURNSTILE_AND_RECOVERY.md).

For a real custodian account, use [private custodian setup](./CUSTODIAN_ACCOUNT_SETUP.md): the project owner prepares a link for the named email, the custodian chooses a password, and sign-in uses password plus Turnstile; a recovery authenticator can be linked from Profile.

See [authenticator and recovery verification](./AUTHENTICATOR_RECOVERY_VERIFICATION_2026-10-24.md) for the current QR setup, one-use recovery, real-service trials and publication boundary.

Forgotten passwords can be reset from Sign in using the linked authenticator code. See [OTP password-reset verification](./PASSWORD_RESET_VERIFICATION_2026-10-25.md) for the real-service checks and access restrictions.

1. Follow [SETUP.md](./SETUP.md) once to connect Supabase and Vercel.
2. Use [DEFENSE_WALKTHROUGH.md](./DEFENSE_WALKTHROUGH.md) for the thesis demonstration.
3. Read [the current local verification](./MANAGED_APP_VERIFICATION_2026-10-24.md) for the verified move to G:, managed accounts, real authenticator trials and publication boundary. [The 13 October app audit](./FINAL_AUDIT_2026-10-13.md) and [VERIFICATION.md](./VERIFICATION.md) preserve earlier release checkpoints.
4. After signing in, press the circle question mark at the top right. The user guide has short, expandable topics for your role.

Local development requires Node 24: run `npm ci` and `npm run dev` after copying `.env.example` to `.env.local`. Use `npm run db:check` for a read-only live connection check, `npm run test:db` for disposable PostgreSQL workflow/RLS/concurrency tests, and `npm run verify` for static checks and the production build. See [SETUP.md](./SETUP.md) for read-only hosted smoke commands. Mutating smoke tests are blocked against the shared Gabs backend.

Read [the 9 October client readiness record](./CLIENT_READINESS_2026-10-09.md) for current delivery checks and pending acceptance, [AUDIT_REPORT.md](./AUDIT_REPORT.md) for the earlier audit, and [CLIENT_GUIDE.md](./CLIENT_GUIDE.md) for the client walkthrough. Demo passwords are delivered privately and are never committed.

See [CLIENT_DELIVERY.md](./CLIENT_DELIVERY.md) for the proposed PHP 10,000 scope, November rehearsal/handoff dates, milestone payments, training and 30-day support terms. Generated client PDF/DOCX files and dated check evidence are kept under the ignored `output/` directory. Physical-device, real-inbox and client/pilot acceptance are recorded separately from automated checks.

## Security model

QR codes identify a student or tool record; they never authenticate or authorize a person. Every protected page and HTTP handler performs a server-side role check, and PostgreSQL RLS enforces record scope. Student-controlled signup metadata cannot create staff, approve an account, choose a data scope, or set a QR token. The Supabase secret key is server-only.

This is educational inventory software, not an aviation airworthiness, calibration, or regulatory-compliance system.
