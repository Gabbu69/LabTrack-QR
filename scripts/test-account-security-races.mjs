import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";

async function connect(connection, userId, role = "authenticated") {
  const client = new pg.Client(connection);
  await client.connect();
  await client.query("set statement_timeout='15000ms'; set lock_timeout='12000ms'");
  if (userId) {
    await client.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claims',$2,false)", [userId, JSON.stringify({ sub: userId, aal: "aal2" })]);
  }
  if (role) await client.query(`set role ${role}`);
  return client;
}

async function waitForLock(admin, client) {
  const pid = (await client.query("select pg_backend_pid() as pid")).rows[0].pid;
  return async () => {
    const deadline = Date.now() + 8_000;
    while (Date.now() < deadline) {
      await admin.query("select pg_stat_clear_snapshot()");
      const { rows } = await admin.query("select exists (select 1 from pg_stat_activity where pid=$1 and state='active' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0) as waiting", [pid]);
      if (rows[0].waiting) return;
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.fail("The competing account update must reach a real database lock before release");
  };
}

async function race(admin, connection, firstActor, secondActor, first, second, role = "authenticated") {
  const clients = await Promise.all([connect(connection, firstActor, role), connect(connection, secondActor, role)]);
  let outcome;
  try {
    const waiting = await waitForLock(admin, clients[1]);
    await Promise.all(clients.map(client => client.query("begin")));
    await clients[0].query(first.sql, first.values);
    outcome = clients[1].query(second.sql, second.values).then(
      result => ({ result }), error => ({ error }),
    );
    await waiting();
    await clients[0].query("commit");
    const result = await outcome;
    await clients[1].query(result.error ? "rollback" : "commit");
    return result;
  } finally {
    await Promise.all(clients.map(client => client.query("rollback")));
    await outcome;
    await Promise.all(clients.map(client => client.end()));
  }
}

// Called only by test-database.mjs in its fresh disposable loopback cluster.
export async function verifyAccountSecurityRaces(admin, connection) {
  assert.equal(connection.host, "127.0.0.1", "Account security race tests must stay in the isolated loopback database");
  const ids = [randomUUID(), randomUUID()];
  for (const [index, id] of ids.entries()) {
    await admin.query("insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data) values($1,$2,$3::jsonb,$4::jsonb)",
      [id, `account-race-${index}-${id}@test.invalid`, JSON.stringify({ full_name: `Account Race ${index}` }), JSON.stringify({ labtrack_staff_role: "custodian" })]);
  }
  await admin.query("update public.profiles set must_change_password=false where id=any($1::uuid[])", [ids]);
  const deactivate = id => ({ sql: "select public.set_profile_status($1,'disabled')", values: [id] });
  const rpcRace = await race(admin, connection, ids[0], ids[1], deactivate(ids[1]), deactivate(ids[0]));
  assert.equal(rpcRace.error?.code, "42501", "The waiting actor must be reauthorized after another custodian disables it");
  let active = (await admin.query("select count(*)::integer as count from public.profiles where id=any($1::uuid[]) and status='active'", [ids])).rows[0].count;
  assert.equal(active, 1);
  console.log("PASS: concurrent custodians cannot disable each other; actor permissions are rechecked after the scope lock");

  await admin.query("update public.profiles set status='active' where id=any($1::uuid[])", [ids]);
  const directDeactivate = id => ({ sql: "update public.profiles set status='disabled' where id=$1", values: [id] });
  const triggerRace = await race(admin, connection, null, null, directDeactivate(ids[1]), directDeactivate(ids[0]), null);
  assert.equal(triggerRace.error?.code, "23514", "The trigger must retain the final active custodian even for trusted direct updates");
  active = (await admin.query("select count(*)::integer as count from public.profiles where id=any($1::uuid[]) and status='active'", [ids])).rows[0].count;
  assert.equal(active, 1);
  await assert.rejects(admin.query("update public.profiles set data_scope='demo' where id=$1", [ids[0]]), error => error.code === "23514");
  await assert.rejects(admin.query("delete from public.profiles where id=$1", [ids[0]]), error => error.code === "23514");
  console.log("PASS: concurrent direct deactivation, scope moves and deletion preserve the last active custodian");

  const operation = randomUUID();
  const acquire = lease => ({ sql: "update public.profiles set mfa_operation_id=$2 where id=$1 and mfa_operation_id is null returning id", values: [ids[0], lease] });
  const leaseRace = await race(admin, connection, null, null, acquire(operation), acquire(randomUUID()), "service_role");
  assert.equal(leaseRace.error, undefined);
  assert.equal(leaseRace.result.rowCount, 0, "Only one server instance may acquire a user's factor-operation lease");
  assert.equal((await admin.query("select mfa_operation_id from public.profiles where id=$1", [ids[0]])).rows[0].mfa_operation_id, operation);
  const staleRelease = await admin.query("update public.profiles set mfa_operation_id=null where id=$1 and mfa_operation_id=$2 returning id", [ids[0], randomUUID()]);
  assert.equal(staleRelease.rowCount, 0);
  const actor = await connect(connection, ids[0]);
  try {
    await assert.rejects(actor.query("update public.profiles set mfa_operation_id=null where id=$1", [ids[0]]), error => error.code === "42501");
  } finally { await actor.end(); }
  await admin.query("update public.profiles set mfa_operation_id=null where id=$1 and mfa_operation_id=$2", [ids[0], operation]);
  console.log("PASS: factor-operation leases admit one server writer, reject stale cleanup and cannot be changed by an authenticated user");
}
