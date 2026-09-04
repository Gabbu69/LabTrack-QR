# LabTrack QR

LabTrack QR is a focused thesis MVP for one aviation-training laboratory. It identifies approved Student Mechanic Leaders and individual physical tools with opaque QR codes, then guides a Tool Custodian through checkout and return reconciliation.

The application uses Next.js 16, React 19, TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, and Vercel. Runtime dependencies are pinned in `package-lock.json`.

## Included workflows

- Student registration, custodian approval, login, profile photo, personal QR, current custody, and personal history
- Custodian dashboard, user management, temporary-password staff creation/reset, batch asset creation, individual tool QR labels, guided borrow, guided return, explicit missing-item handling, and CSV export
- Instructor read-only inventory, borrower, transaction, and tool-history monitoring
- Isolated fictional demo accounts, 20 physical tools, representative transactions, and custodian-only demo reset

## Start here

1. Follow [SETUP.md](./SETUP.md) once to connect Supabase and Vercel.
2. Use [DEFENSE_WALKTHROUGH.md](./DEFENSE_WALKTHROUGH.md) for the thesis demonstration.
3. Read [VERIFICATION.md](./VERIFICATION.md) for what has and has not been directly verified.

Local development uses `npm install` and `npm run dev`. The complete local static verifier is `npm run verify`.

## Security model

QR codes identify a student or tool record; they never authenticate or authorize a person. Every protected page and HTTP handler performs a server-side role check, and PostgreSQL RLS enforces record scope. Student-controlled signup metadata cannot create staff, approve an account, choose a data scope, or set a QR token. The Supabase secret key is server-only.

This is educational inventory software, not an aviation airworthiness, calibration, or regulatory-compliance system.
