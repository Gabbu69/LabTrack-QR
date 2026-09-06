export const controlHelp: [RegExp, string][] = [
  [/^sign in$/i, "Enter your email and password, then sign in. New students can register below; a custodian approves borrowing access."],
  [/register|submit registration/i, "Enter your own student details. Registration creates a pending account for the custodian to review."],
  [/log out/i, "End your session before leaving this device, especially at a shared laboratory counter."],
  [/confirm checkout/i, "Check the student and every physical tool in the list. This records the handoff and makes those tools unavailable to other borrowers."],
  [/confirm return/i, "Accept only the physical tools you scanned. Check their condition first. Anything unscanned remains outstanding."],
  [/mark selected missing|explicitly mark missing/i, "Select only tools confirmed missing and enter where they were last seen. This keeps custody open until the tools are recovered."],
  [/reset demo/i, "Restore the fictional demonstration records. This removes current demo transactions; operational records are kept separate."],
  [/approve|activate/i, "Verify the student's identity before approving. An active student can be selected for borrowing."],
  [/^disable$/i, "Prevent this person from using the app. Their borrowing history stays on record and outstanding tools still need to be returned."],
  [/reset password|^set$/i, "Give this user a new one-time password privately. They must change it after signing in."],
  [/create.*staff/i, "Create an account only for an authorized custodian or instructor. Give them the temporary password privately."],
  [/save password/i, "Use at least 10 characters with a letter and a number. Enter the same password twice to finish the required password change."],
  [/create assets|add a tool batch/i, "Count the actual tools and enter their name, condition and code prefix. Each unit gets its own permanent asset code and QR label."],
  [/print/i, "Open the print dialog, check the label size, and print at 100% scale. Attach each label to the matching physical tool and test a scan."],
  [/delete/i, "Delete only a mistaken tool record that has never been issued. Archive tools with history instead."],
  [/save.*profile|update.*profile/i, "Check your identity and contact details before saving. Use your own student ID."],
  [/save.*tool|update.*tool|save changes/i, "Save the edited record. Use the return workflow to reconcile issued or missing tools."],
  [/export.*csv/i, "Download the transactions matching your current filters as a spreadsheet-compatible CSV report."],
  [/^filter$|apply filters/i, "Apply the search text, status and date selections to narrow the records shown."],
  [/clear|reset filters/i, "Remove the current search selections and show the full list available to your account."],
  [/start camera/i, "Allow camera access when prompted, then hold one QR label steady inside the frame. A USB scanner or typed code also works."],
  [/stop camera/i, "Release the camera when scanning is finished. You can still use a USB scanner or enter a code."],
  [/upload|image|photo/i, "Choose a clear image from this device. For scanning, the full QR code must be visible; profile photos must be JPG, PNG or WebP up to 2 MB."],
  [/use code/i, "Scan into or type in the code field, then check the matching student or tool before continuing."],
  [/^remove /i, "Remove this item from the current scan list. No stored transaction is changed."],
  [/^change$|start again/i, "Clear the current selection and identify the correct student before scanning tools."],
  [/^menu$/i, "Open the navigation menu to move between the pages available to your role."],
];

const destinations: Record<string, string> = {
  "/dashboard": "Check available tools, active borrowing and missing items before starting counter work.",
  "/borrow": "Identify the approved student, scan each physical tool, then review and confirm the checkout.",
  "/return": "Identify the student, scan the tools physically returned, and record their condition. Handle missing items separately.",
  "/tools": "Find physical tools, inspect their status and open individual records. Custodians can add assets and print labels.",
  "/tools/labels": "Choose the correct batch or assets and print their individual QR labels.",
  "/history": "Review borrowing records and filter by student, date or status. Export the matching records when a report is needed.",
  "/users": "Review students and account status. Custodians can approve students and manage staff access.",
  "/profile": "Keep your identity, contact details and profile photo current.",
  "/my-qr": "Show your personal borrower QR to the custodian. It identifies your record and is not a password.",
  "/borrowed": "Check the tools still assigned to you and bring every physical tool back to the custodian.",
  "/scan": "Choose a borrowing or return workflow before scanning. QR codes identify records; the custodian confirms each transaction.",
  "/login": "Sign in with your assigned account. Students who do not have an account can register.",
  "/register": "Complete your student details, then wait for the custodian to approve borrowing access.",
  "/change-password": "Replace your temporary password with one only you know before continuing.",
};

export function describeControl(label: string, href?: string | null) {
  if (href?.startsWith("/tools/") && !href.startsWith("/tools/labels")) return "Open this physical tool's details, QR label and issue history. Check its asset code against the actual tool.";
  const match = controlHelp.find(([pattern]) => pattern.test(label));
  if (match) return match[1];
  if (href) {
    const destination = destinations[href.split("?")[0]];
    if (destination) return destination;
  }
  return `Review the information beside ${label || "this control"} before using it. Required fields must be completed before the action becomes available.`;
}

export function describePage(path: string) {
  return destinations[path] ?? (path.startsWith("/tools/") ? "Inspect this tool's label, condition and history before editing its record." : "Choose a control to see what it does and what to check before using it.");
}
