export type GuideRole = "student" | "custodian" | "instructor";
export type Mission = { title: string; href: string; steps: string[]; success: string };

const helpMission: Mission = {
  title: "Learn the controls", href: "/login",
  steps: ["Press Help & user guide at the bottom of any page.", "Choose Start page tour for a step-by-step walkthrough, or Explain a control and tap any button or field.", "Read what it does and how to use it. Close the guide when you are ready to perform the action."],
  success: "You can ask for help on any page. The guide never checks out a tool or submits a form for you.",
};

export const missions: Record<GuideRole, Mission[]> = {
  student: [helpMission, {
    title: "Create your player account", href: "/register",
    steps: ["Press Register an account on the sign-in page.", "Enter your full name, student ID, year/section, group, phone number and email. Choose a password with at least 8 characters.", "Press Submit registration once. Check your inbox for the confirmation link, then ask the custodian to approve your account."],
    success: "Your email is confirmed and your account is Active. A Pending account is waiting for approval.",
  }, {
    title: "Sign in and get your QR", href: "/my-qr",
    steps: ["Enter your email and password, then press Sign in.", "If asked to change a temporary password, enter the new password twice and press Save password and continue.", "Press Show my QR or My QR. Show this screen to the custodian when borrowing or returning tools."],
    success: "Your personal QR is visible. Keep your password private; the QR only identifies your record.",
  }, {
    title: "Borrow and bring everything back", href: "/borrowed",
    steps: ["Let the custodian scan your QR and each physical tool before handing the tools to you.", "Open My borrowed tools to check what is assigned to you.", "Bring the tools to the custodian for return. Check that returned tools leave your outstanding list."],
    success: "No tools remain outstanding after the custodian accepts a complete return.",
  }, {
    title: "Save your profile and sign out", href: "/profile",
    steps: ["Open Profile, update your details and optionally choose a JPG, PNG or WebP photo up to 2 MB.", "Press Save profile and wait for the success message.", "Press Log Out before leaving a shared device."],
    success: "Your details are saved and the sign-in page appears after Log Out.",
  }],
  custodian: [helpMission, {
    title: "Unlock a student account", href: "/users",
    steps: ["Sign in with your prepared custodian account and open User Management.", "Find the student and verify their name, student ID and section.", "Press Approve / activate. Use Disable only to suspend access; it does not erase borrowing history."],
    success: "The student shows Active and can be selected for checkout.",
  }, {
    title: "Add tools and print labels", href: "/tools",
    steps: ["Open Tool Inventory and press Add a tool batch.", "Enter the tool name, category, quantity, condition and a code prefix such as DMM. Quantity means physical units.", "Press Create assets & labels. Press Print A4 sheet, use 100% scale, and attach each QR to its matching asset code."],
    success: "Every physical tool has its own code and QR label. Test one label before printing more.",
  }, {
    title: "Complete a checkout", href: "/borrow",
    steps: ["Press Borrow Tools. Scan the student's QR, or enter their Student ID and press Use code.", "Check the student's name. Scan each physical tool, or type its asset code and press Use code.", "Use Remove to fix a mistaken scan. Review the list and press Confirm checkout. Hand over the tools only after Checkout complete appears."],
    success: "The tools are recorded as Borrowed and appear in the student's custody list.",
  }, {
    title: "Accept a return", href: "/return",
    steps: ["Press Process Return and identify the student.", "Scan only the tools physically returned. Choose Good, Fair or Damaged and add a note when needed. Keep unavailable prevents reissue.", "Press Confirm return. Any unscanned tools stay outstanding; you may finish a partial return."],
    success: "Accepted tools update immediately. A complete return has no outstanding tools.",
  }, {
    title: "Handle a missing or recovered tool", href: "/return",
    steps: ["In Process Return, identify the student and open Explicitly mark missing.", "Tick only tools confirmed missing, write where and when they were last seen, then press Mark selected missing.", "If a tool is found later, scan it through Process Return and confirm its condition normally."],
    success: "The record preserves the missing incident even after a recovered tool is returned.",
  }, {
    title: "Manage staff and reports", href: "/users",
    steps: ["Open Create a staff account. Enter name, email, role and a one-time password of at least 10 characters; press Create staff account.", "To help a locked-out user, open Reset password, enter a one-time password and press Set. Give it to that person privately.", "Open History, choose filters and press Apply. Press Export CSV to download matching records."],
    success: "Staff change temporary passwords on sign-in. The report contains the records matching your filters.",
  }, {
    title: "Practice in the demo area", href: "/dashboard",
    steps: ["Use a prepared demo account and check that the demo banner is visible.", "Practice checkout and return with the fictional students and labelled demo tools.", "Use Reset demo only when you want to restart the fictional scenario. Your current demo transactions will be replaced."],
    success: "Demo records stay separate from the real laboratory's records.",
  }],
  instructor: [helpMission, {
    title: "Inspect the laboratory", href: "/dashboard",
    steps: ["Sign in with your instructor account and change your temporary password if asked.", "Read Available, Borrowed and Missing on the dashboard.", "Press View Inventory, then open an asset code to see its condition and history."],
    success: "You can inspect records. Checkout, return and account changes are performed by custodians.",
  }, {
    title: "Find a record and export it", href: "/history",
    steps: ["Press View History. Search a borrower or student ID and choose status/date filters.", "Press Apply, then tap a borrowing row to expand the tool details.", "Press Export CSV for the matching records, then Log Out when finished."],
    success: "The downloaded report matches the records you filtered.",
  }],
};

export function pageMission(path: string): string[] {
  if (path === "/login") return ["Enter your email and password.", "Press Sign in, or Register an account if you are a new student.", "Confirm your email and wait for approval if asked."];
  if (path === "/register") return ["Fill in all seven fields with your own details.", "Press Submit registration once.", "Confirm your email, then ask the custodian to approve your account."];
  const mission = missions.custodian.find((item) => item.href === path) ?? missions.student.find((item) => item.href === path);
  return mission?.steps ?? ["Choose Explain a control.", "Tap the button or field you want to learn.", "Close the guide and perform the action when ready."];
}
