# Sign-in and password recovery

Routine sign-in uses the custodian-provided email address, the user's password,
and Cloudflare Turnstile. It opens Dashboard directly, or Change password when a
temporary password must be replaced. It does not ask for an authenticator code.

Forgot password uses the email address, the current six-digit code from a linked
authenticator, a new matching password, and Turnstile. Successful recovery revokes
provider sessions and returns to Sign in. It does not sign the browser in.

Users can link a recovery authenticator from **Profile → Recovery authenticator**.
Existing linked authenticators continue to work. Managing an existing device
requires its code; everyday sign-in does not. An unlinked account or lost-device
case needs private identity verification by the tool custodian/deployment owner.
The normal custodian password reset remains available; no shared setup key is used.

## Deployment configuration

Use a dedicated Cloudflare Turnstile widget in Managed mode, with
`labtrack-qr.vercel.app` as an allowed hostname and pre-clearance disabled.

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: public widget identifier.
- `TURNSTILE_SECRET_KEY`: server-only verification secret.
- `TURNSTILE_HOSTNAMES`: exact comma-separated hostnames accepted by Siteverify.

The server requires successful Siteverify plus the expected hostname and action
(`login` or `password_reset`). Missing configuration, timeout, invalid tokens and
replayed tokens fail closed. Production must use real keys. Development browser
trials may use Cloudflare's official test keys with localhost allowed, but test
keys must never be deployed to production.

## Database and rollout

Apply `20261027010000_turnstile_sessions.sql` before deploying the application.
The migration adds a private session-grant table and service-only attestation RPC.
Only the server records a grant after both Turnstile and password verification.
Grants bind the provider session ID and user ID, expire within eight hours, and
disappear when their provider session is removed. Direct database access still
enforces role, operational/demo scope, approval, and mandatory password changes.
The app also enforces its existing 30-minute idle and eight-hour absolute limits.

Existing provider AAL2 and email-verification grants remain compatible during
rollout. Authenticator device-management and recovery-code controls retain their
existing verification requirements. Turnstile is a bot check; routine sign-in no
longer provides an authenticator second factor.

Rollback the application first if needed. The matching SQL rollback is in
`supabase/rollbacks/20261027010000_turnstile_sessions.sql`. Never reset the database
or re-seed client accounts for this migration.

The private client manual created before this change describes the old daily
authenticator step. Give clients the updated instructions above until that private
PDF is revised; do not publish its account credentials.

## Verification

Run lint, TypeScript, unit tests, the isolated PostgreSQL suite (including the
rollback/reapply trial), the production build and the dependency audit. Browser
trials should cover successful sign-in without an authenticator prompt, rejection
without Turnstile, temporary-password change, recovery setup and forgot password.
Use disposable accounts and avoid logging secrets, codes, or saved browser state.

Cloudflare's [server validation documentation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/)
defines token verification, single use, expiry, action and hostname checks.
