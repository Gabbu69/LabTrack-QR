import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { GuideRole } from "@/lib/guide-missions";

type HelpTopic = { title: string; href: string; steps: string[] };
const shared: HelpTopic[] = [
  { title: "Profile & photo", href: "/profile", steps: ["Update your details or choose a picture.", "Press Save profile."] },
  { title: "Authenticator & sign-out", href: "/profile", steps: ["Use the current six-digit code when signing in.", "Add a backup under Manage authenticators before changing phones.", "To leave, press Log Out → Yes, log out."] },
];
const topics: Record<GuideRole, HelpTopic[]> = {
  custodian: [
    { title: "Borrow tools", href: "/borrow", steps: ["Scan the student QR or enter their Student ID.", "Scan each tool, then check the list.", "Press Confirm checkout."] },
    { title: "Return tools", href: "/return", steps: ["Identify the student.", "Scan received tools and check their condition.", "Press Confirm return. Unscanned tools stay outstanding."] },
    { title: "Tools & QR labels", href: "/tools", steps: ["Use Add tools to save equipment.", "Print labels and match each code to its tool.", "Use status filters to find available or missing tools."] },
    { title: "Create an account", href: "/users", steps: ["Choose Create a student account or Create a staff account.", "Enter their details and a temporary password.", "Give the password privately. They will link an authenticator and choose a new password."] },
    { title: "Reports", href: "/history", steps: ["Search or filter the records.", "Choose Print A4 report or Export CSV."] },
    ...shared,
  ],
  student: [
    { title: "Borrow & return", href: "/my-qr", steps: ["Show My QR to the custodian.", "Check your Borrowed Tools list.", "Return the tools to the custodian."] },
    { title: "Borrowing history", href: "/history", steps: ["Open a record to see its tools and return status."] },
    ...shared,
  ],
  instructor: [
    { title: "Check tools & students", href: "/tools", steps: ["Review tool availability and student records.", "Ask the custodian to make account or inventory changes."] },
    { title: "Reports", href: "/history", steps: ["Filter borrowing records.", "Print the report or export CSV."] },
    ...shared,
  ],
};

export function MissionGuide({ initialRole = "student" }: { initialRole?: GuideRole; signedIn?: boolean }) {
  return <main className="simple-guide">
    <Link className="back-link" href="/dashboard"><ArrowLeft aria-hidden="true" />Back to dashboard</Link>
    <h1>User guide</h1><p>Choose a topic.</p>
    <div className="simple-guide-topics">{topics[initialRole].map(topic => <details key={topic.title}>
      <summary>{topic.title}</summary>
      <ol>{topic.steps.map(step => <li key={step}>{step}</li>)}</ol>
      <Link className="text-link" href={topic.href}>Open page</Link>
    </details>)}</div>
  </main>;
}
