# Thesis Defense Walkthrough

Allow about six minutes. Before the presentation, run the demo reset once, print at least two sample tool labels, and open the student QR on a second phone.

## 1. Introduce the system (30 seconds)

Open the production link and sign in as the demo custodian. Point out the persistent yellow **DEMO MODE** banner and explain that fictional records are isolated from operational records.

State the scope clearly: one aviation-training laboratory, individual tool custody, three roles, and QR-assisted identification. Do not describe it as airworthiness, calibration, or regulatory-compliance software.

## 2. Inventory and QR labels (45 seconds)

Open **Tool Inventory**. Explain that quantity is a batch input only: entering five creates five physical rows and five immutable labels. Add a small batch, then show the A4 label sheet and one individual SVG download.

## 3. Student approval and QR (45 seconds)

Open **User Management** and show a pending Student Mechanic Leader. Approve the account. On the student phone, open **My QR**. Explain that the QR contains only an opaque token and does not log anyone in.

## 4. Borrow tools (90 seconds)

Open **Borrow Tools**:

1. Scan the student QR or enter the fictional Student ID.
2. Scan two printed tool labels.
3. Show duplicate/unavailable protection if time permits.
4. Review the student and both physical assets.
5. Confirm checkout once.

Return to the dashboard and point out the changed Available, Borrowed, and Active Transactions counts.

## 5. Reconcile a return (90 seconds)

Open **Process Return** and scan the same student. Scan only one of the two tools and confirm. Explain that this is a **partial return**: the unscanned tool stays outstanding automatically.

Scan the second tool and confirm to complete the return. If demonstrating damage, choose Damaged and Keep unavailable before confirming.

## 6. Missing and late recovery (60 seconds)

Use the prepared incomplete demo transaction. Identify the borrower, expand **Explicitly mark missing**, select the confirmed missing tool, enter a note, and confirm. Explain that missing is never inferred from an unscanned partial return.

Then scan that missing tool in Return. The item returns normally while its original missing timestamp remains in history.

## 7. Instructor and reports (45 seconds)

Sign in as the demo instructor. Show the read-only dashboard, inventory, student directory, transaction details, and tool history. Export the filtered CSV. End by stating that instructors cannot mutate records and operational users cannot see demo records.

## Recovery plan

If a camera is unreliable under defense-room lighting, switch to QR-image upload, a USB scanner, or typed fictional codes. These are first-class supported paths, not emergency database workarounds.
