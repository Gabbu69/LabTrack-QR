# LabTrack QR client acceptance — defense and supervised pilot

Target: one laboratory, three roles, phone camera and laptop. Complete this record with the client before entering real pilot records. Check a box only after the stated behavior was observed on the recorded deployment. Automated browser viewports do not establish actual phone camera behavior.

## Record privately

| Field | Client/owner entry |
| --- | --- |
| Date, tested source commit and exact deployment | Pending |
| Client phone model, OS and browser | Pending |
| Client laptop and browser | Pending |
| Responsible owner and alternate | Pending |
| Private backup location and last recovery exercise | Pending |
| Evaluator and supervised pilot participants | Pending; follow adviser-approved consent procedure |

## Device and workflow checks

- [ ] All three roles can sign in, refresh, navigate and log out. Student and instructor attempts to perform custodian operations are denied.
- [ ] A personal student can register, follow the actual configured email-confirmation behavior, enroll an authenticator, wait for approval and access only their own records after approval.
- [ ] Temporary staff verify an authenticator and replace their temporary password before laboratory access. A password reset retains authenticator protection.
- [ ] Add and verify a backup authenticator. Confirm the owner can follow the lost-device recovery procedure without disabling MFA globally.
- [ ] Phone camera permission works over HTTPS; student and printed tool QR labels resolve correctly in the intended lighting.
- [ ] Downloaded student/tool SVGs print and scan correctly. JPEG/PNG/WebP image upload and typed codes work when camera permission is denied.
- [ ] Checkout identifies the correct approved student and physical tools; repeated scans do not add duplicate entries.
- [ ] Partial return leaves unreceived tools outstanding. Complete return closes the loan. Damaged return keeps the tool unavailable.
- [ ] Mark one borrowed tool missing with a note, then recover it through Return. Already-missing items cannot be marked missing again.
- [ ] Two custodians cannot return stale custody or leave a fully returned loan marked partial. Perform this only with approved disposable fixtures.
- [ ] Changing borrowers clears previous notes and selections. A connection interruption gives useful feedback; history/custody can be checked before retrying.
- [ ] Session expiry leads back to sign-in. Protected records remain inaccessible after logout.
- [ ] Filtered CSV and A4 report agree with the visible history and item return dates. Labels and every report page are readable on A4.
- [ ] Evaluation worksheet is blank until participant observations are collected.

## Recovery and release gate

- [ ] Owner and alternate access are confirmed privately.
- [ ] Backup includes the required database/Auth configuration and private photo bytes, with matching migration versions and source commit.
- [ ] A documented recovery exercise on a disposable target checks records, QR identifiers, Auth/MFA and photos; record limitations and recovery time.
- [ ] Full browser mutations passed on a separate disposable Supabase backend. Shared demonstration review and isolated SQL tests are recorded separately.

**Pilot decision:** Pending. Any unchecked workflow, device, disposable-backend or recovery requirement remains an acceptance gap. Record the reason and responsible person; do not convert a pending observation into a passing result.
