# Email OTP setup for LabTrack QR

The October 8 change adds password + inbox-code verification for personal accounts without an existing authenticator. Email verification is disabled by default: `EMAIL_OTP_ENABLED=true` is required on the server after the hosted migration, SMTP setup, and actual inbox delivery have been verified. Until then, personal accounts use the existing authenticator sign-in and enrollment flow. Existing verified authenticator accounts retain their authenticator requirement. Shared demo accounts remain exempt through their database scope.

## Connect a sender privately

For a small supervised thesis demo, use a dedicated Gmail account as the sender. Each student uses their own inbox to receive codes; students do not need to configure SMTP or Google App Passwords.

1. Sign in to the Gmail account that will send LabTrack messages.
2. Enable Google 2-Step Verification for that sender account.
3. Open [Google App Passwords](https://myaccount.google.com/apppasswords) and create one named `LabTrack QR SMTP`. If this option is unavailable, check Google's restrictions or use a supported transactional SMTP provider.
4. Open [Gabs Project SMTP settings](https://supabase.com/dashboard/project/tsusogeqjduyahoskteb/auth/smtp) and enable custom SMTP. Enter these fields:

| Supabase field | Value |
| --- | --- |
| Sender email | The dedicated Gmail address |
| Sender name | `LabTrack QR` |
| Host | `smtp.gmail.com` |
| Port | `587` (TLS/STARTTLS) |
| Username | The full dedicated Gmail address |
| Password | The sender's Google App Password, entered directly in Supabase |
| Minimum interval per user | `60` seconds |

Save the settings. Keep both the Google password and App Password out of chat, source files, screenshots, and Git. No Gmail credentials belong in Vercel or the application `.env` file: Supabase sends the emails.

Supabase's default sender only delivers to project-team addresses. Custom SMTP is required for arbitrary student Gmail inboxes. Gmail is suitable for a small demo; a broader deployment should use an appropriate transactional sender and verified sending domain.

## Configure the code email

In Supabase Authentication → Email Templates → Magic Link, set the subject to `Your LabTrack QR verification code` and paste the contents of [supabase/templates/email-otp.html](./supabase/templates/email-otp.html) into the body. Keep `{{ .Token }}` intact: Supabase replaces it with the code. The template deliberately contains no sign-in link.

In the Email provider settings, set OTP length to `6` and OTP expiration to `600` seconds. Keep the resend interval at least `60` seconds. Preserve the existing email-confirmation setting while releasing this change. The inspected Gabs project currently automatically confirms signup at the provider; LabTrack's new OTP gate verifies inbox possession before portal access. If provider confirmation is enabled later, that confirmation occurs before password sign-in and the app's email-code step.

Local Supabase receives these template and expiry settings from `supabase/config.toml`. Editing that file does not change hosted settings. Review Auth email rate limits for the intended pilot size; keep delivery within the sender's limits.

## Coordinated application/database release

1. Run lint, TypeScript, unit tests, the isolated database tests, the production build, and `node scripts/verify-mfa-ui.mjs` under Node 24.
2. Verify the selected project is `tsusogeqjduyahoskteb`, inspect migration history, and take a verified private backup. Review and dry-run the additive migration `20261008010000_email_otp_sessions.sql` before applying it. Do not reset the project or rerun demo seed scripts.
3. Apply the reviewed migration, confirm its service-role-only attestation permission and current-session verification RPC, then deploy a Preview of this application. Keep `EMAIL_OTP_ENABLED` unset or `false` in Production. The new application needs the migration before personal email verification can work.
4. Configure SMTP, the Magic Link template, and the Email OTP settings. Validate delivery to a consenting tester's inbox through the application. The tester enters the received code in LabTrack; they do not disclose it in chat.
5. Set `EMAIL_OTP_ENABLED=true` for Preview, redeploy, and check new registration, later password sign-in, wrong/expired/reused codes, resend cooldown, direct password-only API/RLS denial, verified access, pending approval, disabled accounts, existing authenticator sign-in, and demo sign-in. Enable the flag in Production and redeploy only after the hosted flow passes, then repeat on Production. The application can be released with the flag disabled while retaining authenticator protection.

Registration with an automatically confirmed provider session proceeds directly to the email-code screen after establishing password proof. Otherwise the app follows the provider's email-confirmation requirement and asks the user to sign in afterward. Email verification never approves a student or grants staff permissions.

## Security contract

Supabase's native email OTP is a passwordless sign-in mechanism and does not issue AAL2 tokens. LabTrack combines it with its signed, password-established browser session. After the provider accepts the code, only the application server can record an attestation for the resulting provider session. The database checks that both password and email sessions belong to the same user and still exist. Expiry cannot exceed the original eight-hour application session; later sign-ins must verify again. No plaintext OTP is stored or logged by LabTrack.

The application, API wrappers, and database RLS use the same attestation. User metadata and signed send timestamps do not grant access. An existing verified provider factor prevents email fallback, including at the database level. Email verification is less resistant to phishing and email-account compromise than authenticator MFA; do not describe it as Supabase AAL2 or Google account 2-Step Verification.

Sources: [Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp), [Supabase email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless), [Google App Passwords](https://support.google.com/accounts/answer/185833), [Google SMTP settings](https://support.google.com/mail/answer/7104828).
