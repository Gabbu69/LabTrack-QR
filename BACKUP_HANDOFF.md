# LabTrack QR backup and handoff

The trusted project owner performs backups and recovery. Custodian CSV export and A4 reports are useful records, but they cannot restore the application, Auth accounts, QR identifiers, permissions or photos by themselves.

## Handoff record

| Item | Owner records privately |
| --- | --- |
| GitHub repository | https://github.com/Gabbu69/LabTrack-QR |
| Production URL | https://labtrack-qr.vercel.app |
| Supabase project | Gabs Project, `tsusogeqjduyahoskteb` |
| Owner/admin access | Named owner and alternate; keep credentials in an approved password manager |
| Last verified commit/deployment | Record after each release |
| Backup location and retention | Private encrypted storage; one additional copy where feasible |
| Last restore trial | Date, disposable target, checks and result |

## Backup checklist

- [ ] Capture a trusted database backup using the selected Supabase plan's supported backup/export process. Include application tables and required functions, policies and Auth data using Supabase's documented migration/restore procedure; a public-table CSV is insufficient.
- [ ] Record the schema migration versions and Git commit that match the backup.
- [ ] Back up private `profile-photos` file contents separately, preserving their object paths. Database backups include Storage metadata, not the file bytes.
- [ ] Record the Storage bucket's privacy setting, 2 MB limit and allowed image types.
- [ ] Record Vercel variable **names** and provider configuration. Store actual keys privately; never include them in Git, reports or browser screenshots.
- [ ] Record Auth Site URL, redirect URLs, email-confirmation/SMTP settings and TOTP enrollment/verification settings.
- [ ] Verify that each backup can be opened, record its SHA-256 checksum and keep it private. Auth hashes, identifiers and contact details are sensitive.
- [ ] Take a backup before migrations or significant maintenance and after the accepted thesis evaluation dataset is finalized. Choose a routine schedule based on actual laboratory usage; no paid backup service is assumed.

## Restore trial

Use a disposable project or local target owned by the deployment owner. Never practice recovery by overwriting the shared Gabs database.

1. Record original fixture counts and preserve the backup. Restore according to the official Supabase procedure, including required roles/functions/policies. Apply only migrations appropriate for that backup version.
2. Restore photo bytes to their original object paths and confirm the bucket remains private.
3. Compare profile, tool, transaction and item counts; verify immutable asset/QR identifiers, borrowing references, conditions and missing notes.
4. Test one approved student, instructor and custodian. Check role/scope isolation, temporary-password rules and authenticator behavior. Restored database data does not establish hosted Auth or email recovery.
5. Try one disposable checkout and return, report/CSV generation and authorized photo retrieval. Confirm anonymous access stays denied.
6. Record the result, limitations and recovery time. Remove the disposable target when it is no longer needed.

`npm run test:db` includes a bounded logical backup/restore of fictional fixtures into a second local database, with a SHA-256 check and full-row, QR, custody/history, SQL-function and access-rule comparisons. It accepts no hosted connection string. This is a fixture recovery regression, not a full Supabase backup. It does not verify recovery of real Supabase Auth, MFA secrets or photo bytes; the owner must complete those parts on a suitable disposable hosted target.

## Authenticator recovery

Encourage real users to verify a backup authenticator before replacing a phone. A password reset does not remove MFA. When all factors are lost, the trusted owner verifies identity through the laboratory's approved process, revokes affected sessions and recovers only that user's factors through Supabase administration. Require new enrollment. Keep the documented owner access available during rollout.

## Shared demonstration account recovery

The seven seeded demonstration identities are shared evaluation accounts. App controls prevent their password change, reset and deactivation; new disposable demonstration staff remain able to replace temporary passwords. These controls prevent accidental disruption within LabTrack. Publicly shared Auth credentials can still be changed through provider endpoints, so check the three advertised sign-ins before evaluation.

If sign-in fails, the trusted owner verifies that the affected identity has the expected email, role and database demo scope, then resets only that Auth account's password to the privately configured demonstration password and clears its temporary-password restriction through the approved trusted procedure. Revoke affected sessions as needed and retest the guide. Do not seed/reset inventory as a credential repair, relabel an operational account as demo, or expose secrets in the handoff report.

Complete [CLIENT_ACCEPTANCE.md](./CLIENT_ACCEPTANCE.md) with named owner/alternate access and the actual recovery evidence before operational pilot entry.

References: [Supabase backups](https://supabase.com/docs/guides/platform/backups), [restore to a new project](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore), [MFA](https://supabase.com/docs/guides/auth/auth-mfa).
