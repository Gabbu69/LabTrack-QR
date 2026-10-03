import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import pg from "pg";

// Called only by the isolated database test. No hosted connection is accepted.
export async function verifyFixtureRestore(source, connection, directory) {
  assert.equal(connection.host, "127.0.0.1");
  assert.equal(connection.database, "postgres");
  const names = ["auth.users", "public.profiles", "private.asset_code_counters", "public.tools", "public.transactions", "public.transaction_items", "private.login_attempts", "storage.buckets", "storage.objects"];
  const rows = {};
  for (const name of names) rows[name] = (await source.query(`select * from ${name}`)).rows;
  const serialize = value => JSON.stringify(value);
  const body = serialize({ format: "labtrack-fictional-fixture-v1", rows });
  const checksum = createHash("sha256").update(body).digest("hex");
  const file = join(directory, "fictional-fixture-backup.json");
  await writeFile(file, body, { mode: 0o600 });
  const saved = await readFile(file, "utf8");
  assert.equal(createHash("sha256").update(saved).digest("hex"), checksum);
  await source.query("create database labtrack_restore_trial");
  const restored = new pg.Client({ ...connection, database: "labtrack_restore_trial" });
  try {
    await restored.connect();
    const bootstrap = (await readFile(new URL("../tests/database/bootstrap.sql", import.meta.url), "utf8"))
      .replace(/^create role [^;]+;\r?$/gm, "");
    await restored.query(bootstrap);
    await restored.query("set search_path = public, extensions");
    for (const migration of (await readdir(new URL("../supabase/migrations/", import.meta.url))).filter(name => name.endsWith(".sql")).sort()) {
      await restored.query(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
    }
    await restored.query("begin; set local session_replication_role = replica");
    for (const name of [...names].reverse()) await restored.query(`delete from ${name}`);
    for (const [name, records] of Object.entries(JSON.parse(saved).rows)) {
      for (const record of records) {
        const columns = Object.keys(record);
        const quoted = columns.map(column => `"${column.replaceAll('"', '""')}"`).join(",");
        const values = columns.map(column => {
          const value = record[column];
          return value && typeof value === "object" && !Array.isArray(value) ? JSON.stringify(value) : value;
        });
        await restored.query(`insert into ${name} (${quoted}) values (${columns.map((_, i) => `$${i + 1}`).join(",")})`, values);
      }
    }
    await restored.query("commit");
    for (const name of names) {
      const actual = (await restored.query(`select * from ${name}`)).rows;
      assert.deepEqual(actual.map(serialize).sort(), rows[name].map(serialize).sort(), `${name}: all columns, identities and custody values survive`);
    }
    await restored.query("select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000002',false); set role authenticated");
    const own = (await restored.query("select id from public.profiles")).rows;
    assert.equal(own.length, 1, "Student retains own-profile isolation after restore");
    assert.equal(own[0].id, "a0000000-0000-4000-8000-000000000002");
    assert.equal((await restored.query("select count(*)::int as count from public.transaction_items")).rows[0].count, 1);
    await restored.query("reset role; select set_config('request.jwt.claim.sub','',false); set role anon");
    await assert.rejects(restored.query("select count(*)::int as count from public.tools"), { code: "42501" }, "Anonymous inventory access stays denied");
    await restored.query("reset role; select set_config('request.jwt.claim.sub','a0000000-0000-4000-8000-000000000001',false); set role authenticated");
    const summary = (await restored.query("select public.dashboard_summary() as data")).rows[0].data;
    assert.equal(summary.metrics.borrowed, 1, "Restored functions agree with open custody");
    console.log("PASS: checksummed fictional backup restored to a second local database; all rows/QR/custody, functions and student/anonymous access verified");
  } finally {
    await restored.end();
    await source.query("drop database if exists labtrack_restore_trial");
  }
}
