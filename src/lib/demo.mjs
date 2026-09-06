import { createClient } from "@supabase/supabase-js";

const demoUsers = [
  { key: "custodian", email: "custodian.demo@labtrackqr2026.com", fullName: "Alex Morgan", role: "custodian" },
  { key: "instructor", email: "instructor.demo@labtrackqr2026.com", fullName: "Dr. Casey Reyes", role: "instructor" },
  { key: "student1", email: "jordan.demo@labtrackqr2026.com", fullName: "Jordan Mitchell", role: "student", studentId: "DEMO-2026-01", yearSection: "2nd Year / AMT-A", groupNumber: "Group 1" },
  { key: "student2", email: "riley.demo@labtrackqr2026.com", fullName: "Riley Patel", role: "student", studentId: "DEMO-2026-02", yearSection: "2nd Year / AMT-A", groupNumber: "Group 2" },
  { key: "student3", email: "taylor.demo@labtrackqr2026.com", fullName: "Taylor Chen", role: "student", studentId: "DEMO-2026-03", yearSection: "2nd Year / AMT-B", groupNumber: "Group 3" },
  { key: "student4", email: "blake.demo@labtrackqr2026.com", fullName: "Blake Williams", role: "student", studentId: "DEMO-2026-04", yearSection: "3rd Year / AMT-A", groupNumber: "Group 4" },
  { key: "student5", email: "morgan.demo@labtrackqr2026.com", fullName: "Morgan Casey", role: "student", studentId: "DEMO-2026-05", yearSection: "3rd Year / AMT-B", groupNumber: "Group 5" },
];

const toolGroups = [
  ["DMM", "Digital Multimeter", "Measuring & Inspection", 5],
  ["SDR", "Phillips Screwdriver", "Hand Tools", 5],
  ["TRQ", "Torque Wrench", "Measuring & Inspection", 4],
  ["PLR", "Combination Pliers", "Hand Tools", 3],
  ["CRP", "Wire Crimper", "Electrical Tools", 3],
];

export async function resetDemoDataFromEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY;
  const password = process.env.DEMO_ACCOUNT_PASSWORD;
  if (!url || !publishableKey || !secret || !password || password.length < 10) {
    throw new Error("Supabase variables and DEMO_ACCOUNT_PASSWORD (10+ characters) are required.");
  }
  const admin = createClient(url, secret, { auth: { autoRefreshToken: false, persistSession: false } });
  const { ids, surplusIds } = await ensureDemoUsers(admin, password);
  const operator = createClient(url, publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInError } = await operator.auth.signInWithPassword({ email: demoUsers[0].email, password });
  if (signInError) throw signInError;
  await checked(operator.rpc("reset_demo_records"));

  for (const id of surplusIds) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) throw error;
  }

  const tools = [];
  for (const [prefix, name, category, quantity] of toolGroups) {
    const { data, error } = await operator.rpc("create_tool_batch", {
      p_tool_name: name,
      p_description: "Fictional defense demonstration asset",
      p_category: category,
      p_quantity: quantity,
      p_code_prefix: prefix,
      p_condition: "good",
    });
    if (error) throw error;
    tools.push(...(data ?? []));
  }
  const byCode = new Map(tools.map((tool) => [tool.asset_code, tool]));
  const now = Date.now();
  const completed = await insertTransaction(admin, ids, "student1", new Date(now - 7 * 86400000).toISOString(), "returned", new Date(now - 6 * 86400000).toISOString(), ["DMM-001", "SDR-001"], "returned", byCode);
  const active = await insertTransaction(admin, ids, "student2", new Date(now - 5 * 3600000).toISOString(), "borrowed", null, ["TRQ-001", "PLR-001"], "borrowed", byCode);
  const incomplete = await insertTransaction(admin, ids, "student3", new Date(now - 2 * 86400000).toISOString(), "incomplete", null, ["CRP-001"], "missing", byCode);
  await checked(admin.from("tools").update({ status: "borrowed" }).eq("data_scope", "demo").in("asset_code", active.codes));
  await checked(admin.from("tools").update({ status: "missing" }).eq("data_scope", "demo").in("asset_code", incomplete.codes));
  await operator.auth.signOut();
  return { accounts: demoUsers.map(({ email, role }) => ({ email, role })), tools: tools.length, transactions: [completed.id, active.id, incomplete.id] };
}

async function ensureDemoUsers(admin, password) {
  const { data: profileData, error: profileError } = await admin.from("profiles").select("id,email,data_scope");
  if (profileError) throw profileError;
  const profilesById = new Map((profileData ?? []).map((profile) => [profile.id, profile]));
  const demoProfileIds = new Set((profileData ?? []).filter((profile) => profile.data_scope === "demo").map((profile) => profile.id));
  const authUsers = await listAllAuthUsers(admin);
  const usersByEmail = new Map(authUsers.map((user) => [user.email?.toLowerCase(), user]));
  const desiredEmails = new Set(demoUsers.map((user) => user.email.toLowerCase()));
  const ids = {};

  for (const user of demoUsers) {
    const email = user.email.toLowerCase();
    const metadata = user.role === "student"
      ? { full_name: user.fullName, student_id: user.studentId, year_section: user.yearSection, group_number: user.groupNumber, contact_number: "09170000000" }
      : { full_name: user.fullName };
    const appMetadata = user.role === "student"
      ? { labtrack_data_scope: "demo" }
      : { labtrack_staff_role: user.role, labtrack_data_scope: "demo" };
    const existing = usersByEmail.get(email);
    const existingProfile = existing ? profilesById.get(existing.id) : null;
    if (existing && (!existingProfile || existingProfile.data_scope !== "demo")) {
      throw new Error(`Refusing to replace non-demo account ${email}.`);
    }

    let authUser = existing;
    if (authUser) {
      const { data, error } = await admin.auth.admin.updateUserById(authUser.id, {
        password,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: appMetadata,
      });
      if (error || !data.user) throw error ?? new Error(`Could not update ${user.key}`);
      authUser = data.user;
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: appMetadata,
      });
      if (error || !data.user) throw error ?? new Error(`Could not create ${user.key}`);
      authUser = data.user;
    }

    ids[user.key] = authUser.id;
    await checked(admin.from("profiles").upsert({
      id: authUser.id,
      email,
      full_name: user.fullName,
      role: user.role,
      status: "active",
      student_id: user.role === "student" ? user.studentId : null,
      year_section: user.role === "student" ? user.yearSection : null,
      group_number: user.role === "student" ? user.groupNumber : null,
      contact_number: user.role === "student" ? "09170000000" : null,
      photo_path: null,
      must_change_password: false,
      data_scope: "demo",
    }, { onConflict: "id" }));
  }

  const surplusIds = authUsers
    .filter((user) => demoProfileIds.has(user.id) && !desiredEmails.has(user.email?.toLowerCase() ?? ""))
    .map((user) => user.id);
  return { ids, surplusIds };
}

async function listAllAuthUsers(admin) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function insertTransaction(admin, ids, studentKey, borrowedAt, status, completedAt, codes, itemStatus, byCode) {
  const student = demoUsers.find((user) => user.key === studentKey); const id = crypto.randomUUID();
  await checked(admin.from("transactions").insert({ id, borrower_id: ids[studentKey], processed_by: ids.custodian, borrower_name_snapshot: student.fullName, borrower_student_id_snapshot: student.studentId, borrower_year_section_snapshot: student.yearSection, borrower_group_snapshot: student.groupNumber, borrowed_at: borrowedAt, completed_at: completedAt, status, data_scope: "demo" }));
  const items = codes.map((code) => { const tool = byCode.get(code); const returned = itemStatus === "returned"; const missing = itemStatus === "missing"; return { transaction_id: id, tool_id: tool.id, tool_name_snapshot: tool.tool_name, asset_code_snapshot: tool.asset_code, item_status: itemStatus, issue_condition: "good", return_condition: returned ? "good" : null, return_note: returned ? "Returned complete during demonstration" : null, returned_by: returned ? ids.custodian : null, returned_at: returned ? completedAt : null, missing_at: missing ? new Date(Date.now() - 86400000).toISOString() : null, missing_note: missing ? "Fictional missing-item scenario for defense demonstration" : null }; });
  await checked(admin.from("transaction_items").insert(items)); return { id, codes };
}

async function checked(promise) { const { error } = await promise; if (error) throw error; }
