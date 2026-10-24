# Forgot password with authenticator OTP

25 October 2026, Asia/Manila. Active checkout: `G:\LabTrack - QR\app`. Local production-mode application: `http://localhost:3000`.

## User flow

On Sign in, choose **Forgot password?**. Enter the email, current authenticator code, new password and confirmation. Press **Reset password**, then sign in with the new password and authenticator. The old password and email inbox are not required. The authenticator and saved recovery code remain linked.

The page has four labeled inputs, password visibility controls, one submit button and a back link. It retains only the email and code in component memory after errors. It does not write passwords or OTPs to browser storage.

## Security behavior

- Only an existing operational profile with a verified TOTP factor can reset. Disabled profiles, shared sample accounts and users without a verified authenticator are denied. Unknown emails never create accounts. Identity/code failures return the same message.
- Anonymous attempts have separate HMAC-keyed email and network-hint buckets, using the existing persistent limiter. The account limit always applies even if a network hint changes. No email or network identifier is stored in plaintext by this limiter.
- The provider requires an authenticated session to verify a TOTP factor. The server generates and redeems a recovery token into an isolated, non-persistent server client. This API does not send an email. Neither the recovery token nor its session is sent to the browser.
- Only a successful provider challenge with fresh claims matching the profile and AAL2 permits the password operation. The verified factor must belong to the intended user. No reset session is turned into an application session.
- The per-user MFA lease covers verification and mutation; a fresh profile reload precedes the existing password compare-and-set lease. Concurrent security updates and account disables fail closed.
- Recently used reset OTPs are recorded as server-secret HMAC proofs, never plaintext or unkeyed six-digit-code hashes. Proofs are consumed before password mutation and prevent reset replay for three minutes. Partial failure does not restore a proof.
- Verified ownership clears old MFA verification failures; successful password reset clears old password-login failures so the user can sign in again. Reset-attempt counters remain limited. The isolated provider client signs out globally after success and locally after failure.
- Password resets retain existing authenticators, profile permissions and recovery-code hashes. There is no new dependency, paid service or database migration.

## Verification

| Check | Result |
| --- | --- |
| Targeted security/form checks | PASS: 40 tests cover eligibility, owned verified factors, wrong OTP, mismatched identity/session/assurance, proof consumption/replay, concurrent disable, fresh password lease, attempt limits, validation, input retention and token privacy. |
| Full unit suite | PASS: 398 tests in 41 files on the final source. |
| Production build and TypeScript | PASS on Node 24; includes `/forgot-password`. |
| ESLint and whitespace | PASS. |
| Provider capability trial | PASS: disposable account's real TOTP authorized a new password through an isolated recovery session; authenticator preserved and fixture removed. |
| Real public browser flow | PASS: reached via Forgot password? without an app session; incorrect OTP left the old password unchanged and portal access denied. |
| Real password change | PASS: current TOTP changed the password without the old password or inbox. Old password rejected; new password accepted. |
| Session isolation | PASS: no provider/application auth cookies appeared in the reset browser; portal API remained unauthenticated after reset. |
| MFA and recovery preservation | PASS: exact factor IDs and saved recovery hash unchanged; new password alone could not call the protected database RPC. |
| Reset replay | PASS: the same reset code could not change the password a second time. |
| Normal sign-in after reset | PASS: new password plus the existing authenticator reached the dashboard. |
| Responsive presentation | PASS: 390-pixel mobile overflow check; desktop and mobile screenshots visually reviewed. |
| Fixture cleanup | PASS: temporary accounts removed; original profile/tool/transaction/item counts unchanged. |
| Physical phone interaction | NOT RUN; real provider verification used computed TOTP for disposable fixtures. |
| Git push / Vercel publication | NOT RUN; source and running application updated locally. |

The existing `scripts/verify-mfa-hosted.mjs` includes `MFA_FORGOT_PASSWORD_WORKFLOWS=true`, alongside the explicit disposable-account and database-gate flags. Run this separately from lost-authenticator recovery trials. Screenshots are in the ignored `output/playwright/forgot-password-{mobile,desktop}.png` files and contain no entered credentials.

Provider API references: [server-side recovery token generation](https://supabase.com/docs/reference/javascript/auth-admin-generatelink), [token verification](https://supabase.com/docs/reference/javascript/auth-verifyotp), [actual authenticator challenge and verification](https://supabase.com/docs/reference/javascript/auth-mfa-challengeandverify).
