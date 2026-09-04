import { createClient } from "@supabase/supabase-js";

const demoUsers = [
  { key: "custodian", email: "custodian.demo@labtrack.test", fullName: "Alex Morgan", role: "custodian" },
  { key: "instructor", email: "instructor.demo@labtrack.test", fullName: "Dr. Casey Reyes", role: "instructor" },
  { key: "student1", email: "jordan.demo@labtrack.test", fullName: "Jordan Mitchell", role: "student", studentId: "DEMO-2026-01", yearSection: "2nd Year / AMT-A", groupNumber: "Group 1" },
  { key: "student2", email: "riley.demo@labtrack.test", fullName: "Riley Patel", role: "student", studentId: "DEMO-2026-02", yearSection: "2nd Year / AMT-A", groupNumber: "Group 2" },
  { key: "student3", email: "taylor.demo@labtrack.test", fullName: "Taylor Chen", role: "student", studentId: "DEMO-2026-03", yearSection: "2nd Year / AMT-B", groupNumber: "Group 3" },
  { key: "student4", email: "blake.demo@labtrack.test", fullName: "Blake Williams", role: "student", studentId: "DEMO-2026-04", yearSection: "3rd Year / AMT-A", groupNumber: "Group 4" },
  { key: "student5", email: "morgan.demo@labtrack.test", fullName: "Morgan Casey", role: "student", studentId: "DEMO-2026-05", yearSection: "3rd Year / AMT-B", groupNumber: "Group 5" },
];

const toolGroups = [
  ["DMM", "Digital Multimeter", "Measuring & Inspection", 5],
  ["SDR", "Phillips Screwdriver", "Hand Tools", 5],
  ["TRQ", "Torque Wrench", "Measuring & Inspection", 4],
  ["PLR", "Combination Pliers", "Hand Tools", 3],
  ["CRP", "Wire Crimper", "Electrical Tools", 3],
];

export async function resetDemoDataFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL; const secret = process.env.SUPABASE_SECRET_KEY; const password = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!url || !secret || !password || password.length < 10) throw new Error("Supabase variables and DEMO_ACCOUNT_PASSWORD (10+ characters) are required.");
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });

  const { data: oldProfiles, error: oldProfileError } = await admin.from("profiles").select("id").eq("data_scope", "demo");
  if (oldProfileError) throw oldProfileError;
  const oldIds = (oldProfiles ?? []).map((profile) => profile.id);
  const { data: oldTransactions } = await admin.from("transactions").select("id").eq("data_scope", "demo");
  const oldTransactionIds = (oldTransactions ?? []).map((transaction) => transaction.id);
  if (oldTransactionIds.length) await checked(admin.from("transaction_items").delete().in("transaction_id", oldTransactionIds));
  await checked(admin.from("transactions").delete().eq("data_scope", "demo"));
  await checked(admin.from("tools").delete().eq("data_scope", "demo"));
  for (const id of oldIds) { const { error } = await admin.auth.admin.deleteUser(id); if (error) throw error; }

  const ids = {};
  for (const user of demoUsers) {
    const metadata = user.role === "student" ? { full_name: user.fullName, student_id: user.studentId, year_section: user.yearSection, group_number: user.groupNumber, contact_number: "09170000000" } : { full_name: user.fullName };
    const { data, error } = await admin.auth.admin.createUser({ email: user.email, password, email_confirm: true, user_metadata: metadata, app_metadata: { labtrack_staff_role: user.role === "student" ? undefined : user.role, labtrack_data_scope: "demo" } });
    if (error || !data.user) throw error ?? new Error(`Could not create ${user.key}`); ids[user.key] = data.user.id;
    if (user.role === "student") await checked(admin.from("profiles").update({ status: "active", data_scope: "demo" }).eq("id", data.user.id));
  }

  const tools = []; let offset = 0;
  for (const [prefix, name, category, quantity] of toolGroups) {
    const batchId = crypto.randomUUID();
    for (let number = 1; number <= quantity; number += 1) { tools.push({ id: crypto.randomUUID(), asset_code: `${prefix}-${String(number).padStart(3, "0")}`, tool_name: name, description: "Fictional defense demonstration asset", category, condition: "good", status: "available", creation_batch_id: batchId, data_scope: "demo", created_by: ids.custodian, created_at: new Date(Date.now() - (offset++ * 3600000)).toISOString() }); }
  }
  await checked(admin.from("tools").insert(tools));
  const byCode = new Map(tools.map((tool) => [tool.asset_code, tool]));
  const now = Date.now();
  const completed = await insertTransaction(admin, ids, "student1", new Date(now - 7 * 86400000).toISOString(), "returned", new Date(now - 6 * 86400000).toISOString(), ["DMM-001", "SDR-001"], "returned", byCode);
  const active = await insertTransaction(admin, ids, "student2", new Date(now - 5 * 3600000).toISOString(), "borrowed", null, ["TRQ-001", "PLR-001"], "borrowed", byCode);
  const incomplete = await insertTransaction(admin, ids, "student3", new Date(now - 2 * 86400000).toISOString(), "incomplete", null, ["CRP-001"], "missing", byCode);
  await checked(admin.from("tools").update({ status: "borrowed" }).in("asset_code", active.codes));
  await checked(admin.from("tools").update({ status: "missing" }).in("asset_code", incomplete.codes));
  return { accounts: demoUsers.map(({ email, role }) => ({ email, role })), tools: tools.length, transactions: [completed.id, active.id, incomplete.id] };
}

async function insertTransaction(admin, ids, studentKey, borrowedAt, status, completedAt, codes, itemStatus, byCode) {
  const student = demoUsers.find((user) => user.key === studentKey); const id = crypto.randomUUID();
  await checked(admin.from("transactions").insert({ id, borrower_id: ids[studentKey], processed_by: ids.custodian, borrower_name_snapshot: student.fullName, borrower_student_id_snapshot: student.studentId, borrower_year_section_snapshot: student.yearSection, borrower_group_snapshot: student.groupNumber, borrowed_at: borrowedAt, completed_at: completedAt, status, data_scope: "demo" }));
  const items = codes.map((code) => { const tool = byCode.get(code); const returned = itemStatus === "returned"; const missing = itemStatus === "missing"; return { transaction_id: id, tool_id: tool.id, tool_name_snapshot: tool.tool_name, asset_code_snapshot: tool.asset_code, item_status: itemStatus, issue_condition: "good", return_condition: returned ? "good" : null, return_note: returned ? "Returned complete during demonstration" : null, returned_by: returned ? ids.custodian : null, returned_at: returned ? completedAt : null, missing_at: missing ? new Date(Date.now() - 86400000).toISOString() : null, missing_note: missing ? "Fictional missing-item scenario for defense demonstration" : null }; });
  await checked(admin.from("transaction_items").insert(items)); return { id, codes };
}

async function checked(promise) { const { error } = await promise; if (error) throw error; }
