# Product

<!-- impeccable:product-schema 1 -->

## Platform

Responsive browser application deployed on Vercel. Daily users open the site, sign in, and operate it without command-line or server administration.

## Stack

Next.js 16 App Router, React 19, TypeScript, Tailwind CSS, Supabase PostgreSQL/Auth/Storage, and Node.js 24.x. Dependencies and the lockfile are pinned in source control.

## Users

- Student Mechanic Leaders register, wait for custodian approval, maintain a profile and personal QR, and review their current and past borrowing records.
- Tool Custodians are the principal operators. They approve students, create staff accounts, manage physical tool assets, print QR labels, process borrowing and returns, record missing tools, and export reports.
- Laboratory Instructors have same-scope read-only access to inventory, borrower information, transactions, and tool history.

## Product Purpose

LabTrack QR is a focused thesis MVP for one aviation-training laboratory. It gives each physical tool and approved student leader an opaque QR identity so a custodian can create an accountable checkout, reconcile returns, and see current inventory state through a guided browser workflow.

Success means a nontechnical student can demonstrate the complete flow over HTTPS: sign in, identify a borrower, scan one or more individually coded tools, confirm checkout, reconcile a complete or partial return, explicitly record a missing item, and inspect the resulting history.

## Operating Context

- The pilot covers one laboratory and exactly three roles.
- Each physical asset is its own record and QR label. Quantity is only a batch-creation input.
- Custodians can scan with an Android or laptop camera, a USB keyboard-wedge scanner, an uploaded QR image, or typed code.
- Student self-registration creates a pending student profile; a custodian must approve it before the student can borrow.
- Staff accounts and password resets use custodian-issued temporary passwords because custom SMTP is outside the MVP.
- Preview and production share one backend, while visibly marked demo accounts and records remain isolated by data scope.

## Capabilities and Constraints

- Roles are fixed to Student Mechanic Leader, Tool Custodian, and Laboratory Instructor.
- The MVP includes authentication, protected role-aware pages, profiles and private photos, tool batch creation, immutable asset codes, on-demand QR labels, guided borrow and return workflows, transaction history, dashboard metrics, user management, and protected CSV export.
- Borrowing is atomic: every scanned tool must be unique, available, and in the borrower's data scope.
- Unscanned return items remain outstanding. Marking an item missing is a separate explicit custodian action.
- A returned item may be recorded as damaged and moved to unavailable status. A later scan may resolve a missing item while retaining its original missing timestamp.
- Used records are archived or deactivated rather than erased. Only an unused mistaken tool record may be hard-deleted.
- Demo data is isolated with `data_scope=demo`, resettable by a custodian, and excluded from operational accounts and reports.
- No mobile application, offline mode, due dates, fines, calibration, AI recognition, facial recognition, multi-laboratory support, enterprise audit system, SMTP workflow, or aviation-airworthiness claim is included.

## Brand Commitments

- Product name: LabTrack QR.
- Description: QR-Based Laboratory Tool Tracking and Borrowing Management System.
- Voice: concise, calm, direct, and understandable to nontechnical students.
- Visual direction: a bright tool-control station with white and silver surfaces, navy structure, cobalt actions, yellow warnings, square industrial controls, condensed display headings, readable body copy, and icon-plus-text statuses. It must not become a dark cockpit, neon QR-tech interface, or generic dashboard-card grid.

## Security and Evidence Boundaries

- Supabase Auth establishes identity; database-backed authorization and RLS enforce role, approval, and data-scope access on every read and write path.
- Student-controlled metadata cannot assign a staff role, approval, QR token, or data scope.
- QR payloads contain only versioned opaque tokens and never names, student IDs, emails, credentials, or raw Auth IDs.
- Profile photos live in a private bucket with short-lived signed URLs.
- Secret-key operations are server-only and never use a `NEXT_PUBLIC_*` variable.
- Demo content is fictional demonstration data, not thesis research evidence or an institutional record.
- Local checks, hosted deployment, and physical-device acceptance are reported separately and never inferred from one another.

## Product Principles

1. Make the next operational action unmistakable.
2. Track individual physical assets, not ambiguous quantities.
3. Preserve outstanding, returned, damaged, and missing states as separate facts.
4. Keep QR identification separate from authentication and authorization.
5. Keep demo and operational records visibly and technically isolated.

## Accessibility & Inclusion

Meet WCAG 2.2 AA with visible focus, full keyboard and scanner operation, at least 44px touch targets, plain-language recovery, icon-plus-text statuses, reduced-motion support, and responsive acceptance at 1366x768 and 390px width. English is the application and record language.
