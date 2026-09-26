import EmbeddedPostgres from "embedded-postgres";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createServer } from "node:net";
import assert from "node:assert/strict";
import pg from "pg";

// No environment-supplied database URL is accepted: destructive tests stay local.
const port = await new Promise((resolve, reject) => {
  const server = createServer(); server.once("error", reject);
  server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); });
});
const directory = await mkdtemp(join(tmpdir(), "labtrack-audit-db-"));
const password = randomBytes(24).toString("hex");
const database = new EmbeddedPostgres({ databaseDir: directory, port, user: "postgres", password,
  persistent: true, initdbFlags: ["--encoding=UTF8"],
  postgresFlags: ["-c", "listen_addresses=127.0.0.1"], onLog: () => {}, onError: () => {} });
const connection = { host: "127.0.0.1", port, user: "postgres", password, database: "postgres" };
let client;
try {
  await database.initialise(); await database.start();
  client = new pg.Client(connection); await client.connect();
  await client.query(await readFile(new URL("../tests/database/bootstrap.sql", import.meta.url), "utf8"));
  await client.query("set search_path = public, extensions;");
  for (const file of (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter((file) => file.endsWith(".sql")).sort()) {
    await client.query(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    console.log(`Applied ${file} to isolated PostgreSQL`);
  }
  // The Supabase CLI uses pgTAP for its result envelope. The embedded cluster
  // lacks that optional extension; keep every native SQL assertion and remove
  // only the four reporting statements, which do not perform assertions.
  const workflows = (await readFile(new URL("../supabase/tests/workflows.integration.sql", import.meta.url), "utf8"))
    .replace(/^create extension if not exists pgtap with schema extensions;\r?$/m, "")
    .replace(/^select plan\(1\);\r?$/m, "")
    .replace(/^select pass\('borrow, partial return, missing, recovery, scope isolation, and demo reset workflows'\);\r?$/m, "")
    .replace(/^select \* from finish\(\);\r?$/m, "");
  await client.query(workflows);
  console.log("PASS: complete/partial/damaged/missing/recovery/reset workflows and role isolation");
  await client.query(await readFile(new URL("../supabase/tests/audit.integration.sql", import.meta.url), "utf8"));
  console.log("PASS: temporary-password, disabled/pending, storage, metadata, pagination and aggregate regressions");

  // Committed fixtures are confined to this newly created disposable cluster.
  await client.query(`insert into auth.users (id,email,raw_user_meta_data,raw_app_meta_data) values
    ('a0000000-0000-4000-8000-000000000001','race-custodian@test.invalid','{"full_name":"Race Custodian"}','{"labtrack_staff_role":"custodian","labtrack_data_scope":"demo"}'),
    ('a0000000-0000-4000-8000-000000000002','race-student@test.invalid','{"full_name":"Race Student","student_id":"RACE-1"}','{"labtrack_data_scope":"demo"}');
    update public.profiles set status='active', must_change_password=false where id::text like 'a0000000-%';
    insert into public.tools(asset_code,tool_name,category,creation_batch_id,data_scope,created_by)
    values('RACE-001','Race Tool','Testing',gen_random_uuid(),'demo','a0000000-0000-4000-8000-000000000001');`);
  const tokens = (await client.query(`select p.qr_token as borrower, t.qr_token as tool from public.profiles p cross join public.tools t where p.id='a0000000-0000-4000-8000-000000000002' and t.asset_code='RACE-001'`)).rows[0];
  const attempts = await Promise.all([0, 1].map(async () => {
    const racer = new pg.Client(connection); await racer.connect();
    try {
      await racer.query("select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',false); set role authenticated;");
      await racer.query("select public.borrow_tools($1, $2::uuid[])", [tokens.borrower, [tokens.tool]]);
      return "success";
    } catch (error) { assert.equal(error.code, "P0001"); return "conflict"; }
    finally { await racer.end(); }
  }));
  assert.deepEqual(attempts.sort(), ["conflict", "success"]);
  assert.equal((await client.query("select count(*)::integer as count from public.transaction_items where item_status='borrowed'")).rows[0].count, 1);
  console.log("PASS: simultaneous checkout creates exactly one open custody record");
} finally {
  await client?.end(); await database.stop();
}
