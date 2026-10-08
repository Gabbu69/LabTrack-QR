# LabTrack QR client guide

Open [the Complete User Guide](https://labtrack-qr.vercel.app/guide), choose a role, and select **Use demo account**. The sign-in page fills the demo email and password; press **Sign in** to continue. These addresses are LabTrack sign-in accounts, not Gmail inboxes. **Use my own account** returns to the regular personal sign-in form, where your browser may offer saved credentials.

| Role | Demo login | What to try |
| --- | --- | --- |
| Tool custodian | custodian.demo@labtrackqr2026.com | Inventory, student lookup, checkout and return review, user management, CSV export |
| Instructor | instructor.demo@labtrackqr2026.com | Read-only inventory, borrowers, history and reports |
| Student | jordan.demo@labtrackqr2026.com | Personal QR, borrowed tools, own history and profile |

1. Start with the **custodian** account. Check Dashboard, Tool Inventory and History. Open **Help & user guide** or [the training guide](https://labtrack-qr.vercel.app/guide) for each control's explanation.
2. In Borrow, type student ID **DEMO-2026-01** and choose **Use code**. Scan or type an available asset code such as **DMM-002**. Review the borrower and selected tool carefully. **Confirm checkout** creates a real demo transaction.
3. In Return, identify the same student and scan their borrowed asset. Select its return condition, review the summary and confirm. For a partial return, select only tools physically received. Mark an item missing only after checking; the recovery workflow handles later returns.
4. Open History, apply filters and choose **Export CSV** or **Print A4 report**. Page numbers show 50 records at a time; both reports include all matching records. The CSV's Date Returned belongs to each individual tool, so partial returns and returns on different days remain clear.
5. Log out and use **student** to see that student's personal QR and history. Log out again and use **instructor** to try monitoring without checkout or account-administration permissions.

Demo records are separate from operational records, but all demo users share this demonstration inventory. Avoid **Reset demo** during another person's demonstration: it replaces demo inventory/history. Shared seeded accounts keep their demonstration password; the app prevents changing, resetting or disabling these accounts. The deployment owner handles credential recovery if the guide's sign-in stops working. Newly created demonstration staff can still change their temporary passwords.

## Personal accounts for the supervised pilot

Personal accounts currently use authenticator verification. On first sign-in, set up an authenticator, scan its setup QR inside your authenticator app, and confirm its current code. The optional email-code flow below requires the owner to complete [email sender setup and hosted verification](./EMAIL_OTP_SETUP.md) and enable `EMAIL_OTP_ENABLED=true`; until then, use your authenticator.

1. Students register with their own details and a real Gmail or school inbox they can access. Follow any provider confirmation instructions shown by the app. Custodian approval remains required.
2. New personal accounts verify a six-digit code sent to their inbox after the password is accepted. Check spam if needed; use **Resend email code** after 60 seconds. Codes expire after 10 minutes. Accounts that already enrolled an authenticator keep using the current code from that app.
3. Staff given a temporary password verify their sign-in code, then choose their own private password. Students awaiting approval see a pending account message until a custodian approves them.
4. Email-verified users may add an authenticator from Profile. Scan its setup QR inside an authenticator app and confirm its code; subsequent sign-ins then require the authenticator. Keep the QR and manual key private. Add a verified backup device before replacing a phone. Custodian password resets do not remove an existing authenticator; contact the deployment owner if every authenticator is lost.
5. Students can view their own custody and history; instructors monitor records; custodians approve users and perform borrowing and returns.

## QR scanning and safe reconciliation

Camera access requires HTTPS or localhost. Press the camera button only when ready to scan. If permission is denied or lighting is poor, use typed Student ID/asset codes or upload a JPEG, PNG or WebP QR image. SVG downloads are printable QR artwork; convert them to a supported image before uploading to the scanner.

Review the borrower and physical tools before confirming. Already-missing tools remain visible and can be returned when found, but cannot be marked missing again. If custody changed while the page was open, reload the borrower's custody and rescan. After an interrupted connection, check current custody/history before retrying a confirmation.

Use [CLIENT_ACCEPTANCE.md](./CLIENT_ACCEPTANCE.md) on the client's actual phone and laptop before entering real pilot records. Record observations on the blank worksheet linked from the user guide; do not fill in participant results before evaluation.
