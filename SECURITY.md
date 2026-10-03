# Security behavior

- Students access their own borrowing records and QR identity. Instructors have authorized read access to inventory and students. Only active custodians can manage accounts, inventory, checkout, returns, and demo resets. Mandatory password changes and disabled accounts remain blocked at server and database boundaries.
- Database access uses Supabase structured queries and typed RPC arguments. Existing row-level policies enforce ownership and scope. Secret-key access is in a `server-only` module; only the publishable key belongs in `NEXT_PUBLIC_*`. Environment files remain ignored by Git.
- Login accepts five attempts per normalized email address per fixed 15-minute window. All attempts count, including successful attempts, so concurrent requests cannot bypass the limit. Counters are atomic in PostgreSQL, use keyed hashes instead of email addresses, and cannot be read or altered by anonymous or authenticated database roles. A limiter failure prevents login.
- Operational accounts must verify a six-digit TOTP authenticator code after their password, including before changing a temporary password. Supabase handles factor enrollment, secrets, challenges and code verification; LabTrack accepts protected access only with verified provider claims at `aal2`. Server pages/actions/APIs and database RLS, storage policies and operational RPCs enforce this gate. Own-profile identity reads remain available for setup, but cannot authorize laboratory access.
- MFA verification and authenticator management have separate per-user five-attempt, fixed 15-minute counters, independent of password login. Accepted attempts also count; limiter failures fail closed. A verified session is required to add a backup to an account that already has an active factor, and to remove a device. The last verified authenticator cannot be removed through the app.
- App sessions expire after 30 minutes without an application request or eight hours after login. Prefetch requests and `/api/session` checks do not extend inactivity. The signed cookie is bound to the verified Supabase user and session ID. Every protected page, action, and API validates it. Visible portal tabs check expiration every 30 seconds and when refocused.
- Authentication and session cookies use `HttpOnly`, `SameSite=Lax`, and `Secure` in production. Local development allows HTTP. The app deliberately has no browser Supabase auth client; a future client-side Auth integration must account for this architecture.
- Existing sessions must sign in again after this update. Rotating `SUPABASE_SECRET_KEY` also invalidates signed application sessions. Never expose or log this key, tokens, or passwords.

## Installation and verification

Inspect live migration history and review pending SQL with a compatible CLI (`npx supabase@2.75.0 db push --linked --dry-run`) or the trusted Management API. Apply the login-protection prerequisite `20260930010000_login_protection.sql` first. Confirm TOTP enrollment and verification are enabled, test a Preview, then make the verified application available in Production before applying `20261002010000_require_mfa.sql` transactionally. Verify the live database gate and hosted MFA afterward. See SETUP.md for the coordinated sequence.

Coordinate the MFA migration with the application release. It immediately denies password-only operational access for every deployment sharing that database, including an older production release without an MFA screen. Keep the trusted owner management connection available and communicate the enrollment requirement before rollout.

Run `npm run verify` and `npm run test:db`. The latter creates a disposable local database and checks SQL permissions, role isolation, borrowing workflows, limiter boundaries, and `aal1` versus `aal2` enforcement without modifying hosted records. Its JWT fixtures test database authorization, not the real Supabase TOTP service. Hosted migration/deployment and enrollment/login with a disposable account and real authenticator must be verified separately.

## Boundaries

The additional login limiter and signed idle timeout protect LabTrack's server endpoints. They do not replace Supabase Auth's own rate limits, JWT lifetime, refresh-token revocation, or session settings for direct Supabase clients. Keep those provider controls enabled. An already issued access token can remain valid until its provider expiration even after sign-out; database RLS remains essential. The app timeout measures server requests, not typing or mouse movement on an otherwise idle page.

The per-account limit can temporarily delay a legitimate user targeted by repeated attempts. No permanent lockout is introduced. Production deployments can add trusted edge/IP limits or CAPTCHA for password spraying across many addresses. Never trust arbitrary forwarded-IP headers for this purpose.

Public demo accounts are intentionally shared. Their database-controlled `data_scope='demo'` is the only MFA exemption; editable user metadata and email addresses cannot grant it. The app prevents personal authenticator enrollment on shared demos. Keep demo data isolated from operational records and disable demo access for a private-only deployment.

## Authenticator recovery

Users can add and verify another authenticator while signed in with their existing factor. Setup QR codes and manual secrets are credentials: do not log, publish or include them in screenshots or support messages. They are unrelated to student and tool QR identifiers.

Use a verified backup authenticator if a device is lost. Password reset or custodian approval does not bypass MFA, and the app does not implement recovery codes or a custodian MFA-reset control. Without a usable factor, the deployment owner must verify identity through an approved out-of-band process before using trusted Supabase administration to recover the account. Revoke affected provider sessions, remove only the lost account's factors when justified, and require new enrollment. Do not disable MFA globally or change an operational account to demo as a recovery shortcut.

## Real email registration

Enable **Confirm email** in the hosted Supabase Auth provider settings before testing inbox ownership. An email marked confirmed by automatic confirmation is not evidence that its owner received a message. Configure an approved SMTP provider when required for non-team recipients. A user must enter their own password and follow the delivered confirmation link; never collect that password or link in support chat. Email confirmation does not grant custodian approval: new student profiles must still remain pending.

Use `node --env-file=.env.local scripts/verify-registration.mjs <email>` to inspect only the requested account's confirmation and role/status, without printing keys, tokens, or other users' details.
