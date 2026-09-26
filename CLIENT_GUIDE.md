# LabTrack QR client guide

Open [LabTrack QR](https://labtrack-qr.vercel.app/login). Use the password provided privately by the deployment owner. These addresses are LabTrack sign-in accounts, not Gmail inboxes.

| Role | Demo login | What to try |
| --- | --- | --- |
| Tool custodian | custodian.demo@labtrackqr2026.com | Inventory, student lookup, checkout and return review, user management, CSV export |
| Instructor | instructor.demo@labtrackqr2026.com | Read-only inventory, borrowers, history and reports |
| Student | jordan.demo@labtrackqr2026.com | Personal QR, borrowed tools, own history and profile |

1. Start with the **custodian** account. Check Dashboard, Tool Inventory and History. Open **Help & user guide** or [the training guide](https://labtrack-qr.vercel.app/guide) for each control's explanation.
2. In Borrow, type student ID **DEMO-2026-01** and choose **Use code**. Scan or type an available asset code such as **DMM-002**. Review the borrower and selected tool carefully. **Confirm checkout** creates a real demo transaction.
3. In Return, identify the same student and scan their borrowed asset. Select its return condition, review the summary and confirm. For a partial return, select only tools physically received. Mark an item missing only after checking; the recovery workflow handles later returns.
4. Open History, apply filters and choose **Export CSV**. Page numbers show 50 records at a time; export includes all matching records.
5. Log out and use **student** to see that student's personal QR and history. Log out again and use **instructor** to try monitoring without checkout or account-administration permissions.

Demo records are separate from operational records, but all demo users share this demonstration inventory. Avoid **Reset demo** during another person's demonstration: it replaces demo inventory/history. The account password does not require a reset to retrieve or use.

For real use, students register with their own details and wait for custodian approval. Custodians manage password resets; temporary passwords must be changed before operational access. Camera access requires HTTPS or localhost, and the camera, USB scanner and printed labels should be tried on the client's intended devices.
