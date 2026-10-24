export type GuideRole = "student" | "custodian" | "instructor";

const pageSteps: Record<string, string[]> = {
  "/dashboard": ["Choose a task.", "Check tool availability and outstanding loans."],
  "/borrow": ["Identify the student.", "Scan each tool.", "Review and confirm checkout."],
  "/return": ["Identify the student.", "Scan received tools and check their condition.", "Confirm the return. Unscanned tools stay outstanding."],
  "/tools": ["Search or choose a status.", "Open a tool for details.", "Custodians can add tools and print labels."],
  "/tools/labels": ["Match each label to its tool.", "Print at 100% scale and test a scan."],
  "/users": ["Choose a student or staff account.", "Enter their details and a temporary password.", "Give the password privately."],
  "/profile": ["Update your details or choose a picture.", "Press Save profile.", "Add a backup under Manage authenticators before changing phones."],
  "/history": ["Search or filter the records.", "Open a record for details.", "Print the report or export CSV."],
  "/my-qr": ["Show this QR to the custodian when borrowing or returning tools."],
  "/borrowed": ["Check your outstanding tools.", "Return them to the custodian."],
  "/scan": ["Choose Borrow tools or Return tools.", "Use the camera, USB scanner, or a typed code."],
};

export function pageMission(path: string): string[] {
  return pageSteps[path] ?? ["Check the details.", "Review before saving."];
}
