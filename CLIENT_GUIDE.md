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

1. Students register with their own details. Follow the confirmation message shown by the app: email confirmation is conditional on the owner's current setup. Custodian approval remains required. Automatic email confirmation does not establish ownership of an inbox.
2. Sign in with your personal password, then set up an authenticator on your phone. Scan the setup QR inside your authenticator app and enter the current six-digit code. Keep the setup QR and manual key private. Later sign-ins ask for a current code.
3. Staff given a temporary password complete authenticator verification, then choose their own private password. Students awaiting approval see a pending account message until a custodian approves them.
4. Add and verify a backup authenticator before replacing or losing your phone. Custodian password resets do not remove two-factor protection. If every authenticator is lost, contact the deployment owner for identity-verified recovery.
5. Students can view their own custody and history; instructors monitor records; custodians approve users and perform borrowing and returns.

## QR scanning and safe reconciliation

Camera access requires HTTPS or localhost. Press the camera button only when ready to scan. If permission is denied or lighting is poor, use typed Student ID/asset codes or upload a JPEG, PNG or WebP QR image. SVG downloads are printable QR artwork; convert them to a supported image before uploading to the scanner.

Review the borrower and physical tools before confirming. Already-missing tools remain visible and can be returned when found, but cannot be marked missing again. If custody changed while the page was open, reload the borrower's custody and rescan. After an interrupted connection, check current custody/history before retrying a confirmation.

Use [CLIENT_ACCEPTANCE.md](./CLIENT_ACCEPTANCE.md) on the client's actual phone and laptop before entering real pilot records. Record observations on the blank worksheet linked from the user guide; do not fill in participant results before evaluation.
