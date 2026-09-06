import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY", "BOOTSTRAP_CUSTODIAN_EMAIL", "BOOTSTRAP_CUSTODIAN_PASSWORD", "BOOTSTRAP_INSTRUCTOR_EMAIL", "BOOTSTRAP_INSTRUCTOR_PASSWORD"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) { process.stderr.write(`Missing environment variables: ${missing.join(", ")}\n`); process.exit(1); }

const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
const staff = [
  { email: process.env.BOOTSTRAP_CUSTODIAN_EMAIL, password: process.env.BOOTSTRAP_CUSTODIAN_PASSWORD, fullName: process.env.BOOTSTRAP_CUSTODIAN_NAME || "Lead Tool Custodian", role: "custodian" },
  { email: process.env.BOOTSTRAP_INSTRUCTOR_EMAIL, password: process.env.BOOTSTRAP_INSTRUCTOR_PASSWORD, fullName: process.env.BOOTSTRAP_INSTRUCTOR_NAME || "Laboratory Instructor", role: "instructor" },
];

for (const account of staff) {
  if (account.password.length < 10) throw new Error(`${account.role} bootstrap password must be at least 10 characters.`);
  const { data, error } = await admin.auth.admin.createUser({ email: account.email, password: account.password, email_confirm: true, user_metadata: { full_name: account.fullName }, app_metadata: { labtrack_staff_role: account.role, labtrack_data_scope: "operational" } });
  if (error) { process.stderr.write(`${account.role}: ${error.message}\n`); process.exitCode = 1; }
  else {
    const { error: profileError } = await admin.from("profiles").update({ full_name: account.fullName, role: account.role, status: "active", student_id: null, data_scope: "operational", must_change_password: true }).eq("id", data.user.id);
    if (profileError) throw profileError;
    process.stdout.write(`${account.role} created: ${data.user.email}\n`);
  }
}
