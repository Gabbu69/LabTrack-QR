import { createClient } from "@supabase/supabase-js";

const required = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_SECRET_KEY"];
const missing = required.filter((key) => !process.env[key] || /REPLACE_ME|YOUR_PROJECT/.test(process.env[key]));
if (missing.length) {
  console.error(`Configure .env.local first. Missing: ${missing.join(", ")}`);
  process.exit(1);
}

const options = { auth: { autoRefreshToken: false, persistSession: false } };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const admin = createClient(url, process.env.SUPABASE_SECRET_KEY, options);
const anonymous = createClient(url, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, options);

try {
  const { error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  if (authError) throw new Error(`Auth/server key: ${authError.message}`);
  console.log("PASS Auth service and server key");

  for (const table of ["profiles", "tools", "transactions", "transaction_items"]) {
    const { error, count } = await admin.from(table).select("id", { head: true, count: "exact" });
    if (error) throw new Error(`${table}: ${error.message}`);
    const { error: publicError } = await anonymous.from(table).select("id").limit(1);
    if (publicError?.code !== "42501") throw new Error(`${table}: expected anonymous access to be denied`);
    console.log(`PASS ${table}: ${count} rows; anonymous access denied`);
  }

  const { data: bucket, error: storageError } = await admin.storage.getBucket("profile-photos");
  if (storageError) throw new Error(`Storage: ${storageError.message}`);
  if (bucket.public || Number(bucket.file_size_limit) !== 2097152) {
    throw new Error("Profile photos must use a private bucket with a 2 MB limit.");
  }
  console.log("PASS private profile-photo storage");
  console.log("Database connection checks passed. Run npm run db:test for SQL workflow and RLS tests.");
} catch (error) {
  console.error(`Database check failed: ${error.message}`);
  process.exitCode = 1;
}
