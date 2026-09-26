import { redirect } from "next/navigation";
import { Pagination } from "@/components/ui/pagination";
import { PAGE_SIZE, pageNumber, pageHref, type SearchParams } from "@/lib/query-filters";
import { ShieldCheck, UserPlus, Users } from "lucide-react";
import { createStaffAction, resetPasswordAction, setProfileStatusAction } from "@/app/actions/operations";
import { Notice } from "@/components/feedback/notice";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { requireStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/app";

export const metadata = { title: "Users" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const actor = await requireStaff(); const query = await searchParams; const supabase = await createClient();
  const page = pageNumber(query.page);
  let request = supabase.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false }).order("id"); if (actor.role === "instructor") request = request.eq("role", "student");
  const { data, error, count } = await request.range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (error) throw new Error("User records could not be loaded. Please try again.");
  const pages = Math.max(1, Math.ceil((count ?? 0) / PAGE_SIZE));
  if (page > pages) redirect(pageHref("/users", query, pages));
  const profiles = (data ?? []) as Profile[];
  return <div className="page-wrap"><PageHeader eyebrow="PEOPLE & ACCESS" title={actor.role === "custodian" ? "USER MANAGEMENT" : "STUDENT RECORDS"} description={actor.role === "custodian" ? "Approve students, manage account access, and create staff with temporary passwords." : "Read-only directory of student mechanic leaders in your data scope."} /><Notice error={query.error} message={query.message} />
    {actor.role === "custodian" && <details className="content-card disclosure"><summary><UserPlus aria-hidden="true" /><span><strong>Create a staff account</strong><small>Custodian or instructor; email is auto-confirmed for this pilot.</small></span></summary><form action={createStaffAction} className="form-grid padded-form"><label className="field"><span>Full name</span><input name="full_name" required /></label><label className="field"><span>Email</span><input name="email" type="email" required /></label><label className="field"><span>Role</span><select name="role"><option value="instructor">Laboratory Instructor</option><option value="custodian">Tool Custodian</option></select></label><label className="field"><span>One-time temporary password</span><input name="temporary_password" type="text" minLength={10} maxLength={128} required autoComplete="off" /></label><div className="form-footer full"><span><ShieldCheck aria-hidden="true" />The staff member must change this password after sign-in.</span><SubmitButton>Create staff account</SubmitButton></div></form></details>}
    <section className="content-card">{profiles.length === 0 ? <div className="empty-state"><Users aria-hidden="true" /><h2>No users found</h2><p>Student registrations and staff accounts appear here.</p></div> : <div className="user-list">{profiles.map((person) => <article className="user-row" key={person.id}><div className="avatar">{initials(person.full_name)}</div><div className="user-identity"><strong>{person.full_name}</strong><small>{person.email}</small><small>{person.student_id ? `${person.student_id} · ${person.year_section ?? "No section"} · Group ${person.group_number ?? "—"}` : "Staff account"}</small></div><div className="chip-row"><StatusBadge value={person.role} /><StatusBadge value={person.status} /></div>{actor.role === "custodian" && <div className="user-actions">{person.status !== "active" && <form action={setProfileStatusAction}><input type="hidden" name="profile_id" value={person.id} /><input type="hidden" name="status" value="active" /><button className="button button-small button-primary" type="submit">Approve / activate</button></form>}{person.status === "active" && person.id !== actor.id && <form action={setProfileStatusAction}><input type="hidden" name="profile_id" value={person.id} /><input type="hidden" name="status" value="disabled" /><button className="button button-small button-secondary" type="submit">Disable</button></form>}<details className="inline-disclosure"><summary>Reset password</summary><form action={resetPasswordAction}><input type="hidden" name="profile_id" value={person.id} /><input aria-label={`Temporary password for ${person.full_name}`} name="temporary_password" type="text" minLength={10} maxLength={128} placeholder="Temporary password" required /><button className="button button-small button-secondary" type="submit">Set</button></form></details></div>}</article>)}</div>}
    </section><Pagination path="/users" params={query} page={page} count={count ?? 0} />
  </div>;
}

function initials(name: string) { return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "US"; }
