import { createClient } from "@supabase/supabase-js";

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) throw new Error("Provide the account email to verify.");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const settingsResponse = await fetch(`${url}/auth/v1/settings`, {
  headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
  signal: AbortSignal.timeout(15000),
});
if (!settingsResponse.ok) throw new Error("Could not verify email confirmation settings.");
const settings = await settingsResponse.json();
if (typeof settings.mailer_autoconfirm !== "boolean") throw new Error("Email confirmation setting was not returned by Auth.");
console.log(JSON.stringify({ emailConfirmationRequired: settings.mailer_autoconfirm === false }));
let user;
for (let page = 1; ; page++) {
  const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
  if (error) throw new Error("Account lookup failed.");
  user = data.users.find((candidate) => candidate.email?.toLowerCase() === email);
  if (user || data.users.length < 100) break;
}
if (!user) {
  console.log(JSON.stringify({ registered: false }));
} else {
  const { data, error } = await admin.from("profiles").select("role,status,must_change_password").eq("id", user.id).maybeSingle();
  if (error) throw new Error("Profile lookup failed.");
  console.log(JSON.stringify({ registered: true, emailConfirmed: Boolean(user.email_confirmed_at), profile: data }));
}
