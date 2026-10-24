# Authenticator and recovery verification

24 October 2026, Asia/Manila. Active source and production-mode local server: `G:\LabTrack - QR\app`.

## User flow

1. Sign in with the custodian-provided account.
2. First use: scan the QR with an authenticator, enter its six-digit code, then create and download the recovery code.
3. Confirm the recovery code was saved and continue. Temporary-password accounts then choose a private password.
4. Later sign-ins require the password and current authenticator code.
5. Lost phone: choose **Use recovery code**, enter the password and saved code, then sign in and link a new authenticator.

The recovery code is single-use. Creating a replacement invalidates the previous code. Codes are generated with 128 bits of randomness, bound to the user ID and stored only as SHA-256 hashes in server-managed authentication metadata. No extra service, dependency or schema migration was added. Supabase's existing TOTP challenge/verification remains the gate for operational portal and database access.

Code generation, consumption and factor removal use the existing durable per-user security lease. Recovery requires a fresh password check in an isolated client and a matching saved code. Consumption precedes factor removal; partial failure does not restore a consumed code. Recovery itself never grants AAL2 or portal access. Password-only access remains denied until the replacement authenticator is verified. Successful recovery clears the management-attempt counter so legitimate replacement is immediately available. Failed attempts remain limited.

## Verified

| Check | Result |
| --- | --- |
| Production build and TypeScript | PASS on Node 24 from G:; includes protected `/recovery-code`. |
| Unit checks | PASS: all 365 tests in 37 files on the final source, including 84 affected authentication and UI checks. |
| Lint and whitespace | PASS. |
| Real initial enrollment | PASS: actual password sign-in, provider QR enrollment, TOTP verification, recovery-code creation/save and AAL2 portal access. |
| Real account management | PASS: owner-issued invitation created an operational custodian; replay could not change its password. Only a verified custodian created the test student, who enrolled an authenticator, saved recovery and changed the temporary password. |
| Access restrictions | PASS: direct AAL1 database RPC and inventory, portal APIs and CSV access denied. Incorrect TOTP rejected. |
| Recovery download and storage | PASS: actual text download contains the code; provider metadata contains its hash only. |
| Incorrect recovery/password | PASS: rejected without consuming the saved code or removing factors. The UI preserves the long code in memory for password retries. |
| Successful recovery | PASS: code consumed, lost factors removed, sign-in required, password-only API access denied, replacement QR/TOTP required. |
| One-use and replacement | PASS: replacement generates a new recovery code; replay of the consumed code is rejected. |
| Responsive presentation | PASS: recovery layout fits 390 pixels; save checkbox and download/continue controls visually reviewed. Screenshot masks the real temporary recovery code. |
| Cleanup and preservation | PASS: all disposable accounts/picture fixtures removed; original profile/tool/transaction/item counts unchanged. One interrupted network cleanup was subsequently removed by its exact fixture ID and verified. |
| Physical phone scan / Google or Microsoft app interaction | NOT RUN. Provider-backed automated TOTP verification does not establish physical-device acceptance. |
| Git push / Vercel publication | NOT RUN. This revision runs locally. |

Evidence uses `scripts/verify-mfa-hosted.mjs` with disposable-account, database-gate and recovery-workflow flags. The managed-account/invitation run also verified public signup remains disabled, role restrictions, profile persistence, logout confirmation and student first-use password replacement. The final recovery run completed successfully after those checks.

The initial setup-code screen was moved to its own protected page to survive the authentication cookie refresh. Browser checks also caught form reset behavior after an incorrect password; the recovery input now remains in component memory and is never written to browser storage.

## Custodian setup

An owner-issued setup link was prepared for **Tool Custodian**, sign-in address **custodian@labtrack.local**, at `output/private/custodian-setup-link.json`. The link expires after one hour and cannot replace an existing account. The user must choose the password and link their own authenticator. The address is an application sign-in name and has no mailbox. No password or phone factor was invented for the user.

Official provider references: [TOTP enrollment and sign-in](https://supabase.com/docs/guides/auth/auth-mfa/totp), [server-side factor removal](https://supabase.com/docs/reference/javascript/auth-admin-deletefactor). Recovery described here is the application's single-use replacement mechanism layered on those provider APIs.
