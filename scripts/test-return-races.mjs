import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import pg from "pg";

const custodianId = "a0000000-0000-4000-8000-000000000001";
const studentId = "a0000000-0000-4000-8000-000000000002";

async function actorClient(connection) {
  const client = new pg.Client(connection);
  await client.connect();
  await client.query("select set_config('request.jwt.claim.sub',$1,false);", [custodianId]);
  await client.query("set role authenticated; set statement_timeout='15000ms'; set lock_timeout='12000ms';");
  return client;
}

// A real database lock forms the barrier. No timing sleep determines which
// statement starts first, and both requests must be waiting before release.
async function queuedRace(admin, connection, transactionId, operations) {
  const racers = await Promise.all(operations.map(() => actorClient(connection)));
  const attempts = [];
  try {
    await admin.query("begin");
    await admin.query("select id from public.transactions where id=$1 for update", [transactionId]);
    for (let index = 0; index < racers.length; index++) {
      const pid = (await racers[index].query("select pg_backend_pid() as pid")).rows[0].pid;
      attempts.push(racers[index].query(operations[index].sql, operations[index].values)
        .then(result => ({ status: "success", result }), error => ({ status: "conflict", error })));
      const deadline = Date.now() + 8_000;
      let waiting = false;
      while (Date.now() < deadline) {
        // Statistics snapshots are otherwise cached for this barrier transaction;
        // the second connection would incorrectly appear idle throughout the poll.
        await admin.query("select pg_stat_clear_snapshot()");
        waiting = (await admin.query("select exists (select 1 from pg_stat_activity where pid=$1 and state='active' and wait_event_type='Lock' and cardinality(pg_blocking_pids(pid))>0) as waiting", [pid])).rows[0].waiting;
        if (waiting) break;
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      assert.ok(waiting, `Custody mutation ${index + 1} must reach the parent-lock barrier`);
    }
    await admin.query("commit");
    return await Promise.all(attempts);
  } finally {
    await admin.query("rollback");
    await Promise.all(attempts);
    await Promise.all(racers.map(client => client.end()));
  }
}

export async function verifyReturnRaces(admin, connection) {
  // test-database.mjs creates these identities only in its fresh loopback cluster.
  const prefix = `RT${randomBytes(4).toString("hex").toUpperCase()}`;
  await admin.query(`insert into public.tools(asset_code,tool_name,category,creation_batch_id,data_scope,created_by)
    select $1 || '-' || lpad(n::text,3,'0'),'Return Race Tool ' || n,'Testing',gen_random_uuid(),'demo',$2
    from generate_series(1,4) n`, [prefix, custodianId]);
  const borrower = (await admin.query("select qr_token from public.profiles where id=$1", [studentId])).rows[0].qr_token;
  const tools = (await admin.query("select id,qr_token from public.tools where asset_code like $1 order by asset_code", [`${prefix}-%`])).rows;
  const actor = await actorClient(connection);
  const checkout = async (indexes) => {
    const transactionId = (await actor.query("select public.borrow_tools($1,$2::uuid[]) as id", [borrower, indexes.map(index => tools[index].qr_token)])).rows[0].id;
    const items = (await admin.query("select id,tool_id,item_status from public.transaction_items where transaction_id=$1 order by asset_code_snapshot", [transactionId])).rows;
    return { transactionId, items };
  };
  const payload = item => ({ item_id: item.id, tool_token: tools.find(tool => tool.id === item.tool_id).qr_token, condition: "good", note: "Race verification", unavailable: false });
  const returnOperation = items => ({ sql: "select public.return_tools($1,$2::jsonb) as count", values: [borrower, JSON.stringify(items.map(payload))] });
  const missingOperation = items => ({ sql: "select public.mark_items_missing($1::uuid[],$2) as count", values: [items.map(item => item.id), "Race verification missing"] });
  const returnItems = async items => { const operation = returnOperation(items); return actor.query(operation.sql, operation.values); };
  const assertParent = async (transactionId, status) => {
    const parent = (await admin.query("select status,completed_at from public.transactions where id=$1", [transactionId])).rows[0];
    assert.equal(parent.status, status);
    assert.equal(parent.completed_at !== null, status === "returned");
  };
  const assertSuccess = outcome => { assert.equal(outcome.status, "success", outcome.error?.message); assert.equal(outcome.result.rows[0].count, 1); };
  const assertConflict = outcome => { assert.equal(outcome.status, "conflict"); assert.equal(outcome.error.code, "P0001"); };
  try {
    const split = await checkout([0, 1]);
    const splitOutcomes = await queuedRace(admin, connection, split.transactionId, split.items.map(item => returnOperation([item])));
    splitOutcomes.forEach(assertSuccess);
    await assertParent(split.transactionId, "returned");
    assert.equal((await admin.query("select count(*)::integer as count from public.transaction_items where transaction_id=$1 and item_status='returned'", [split.transactionId])).rows[0].count, 2);
    console.log("PASS: queued simultaneous returns of different items close their common transaction");

    const duplicate = await checkout([0]);
    const duplicateOutcomes = await queuedRace(admin, connection, duplicate.transactionId, [returnOperation(duplicate.items), returnOperation(duplicate.items)]);
    assertSuccess(duplicateOutcomes[0]); assertConflict(duplicateOutcomes[1]);
    await assertParent(duplicate.transactionId, "returned");
    const originalTime = (await admin.query("select returned_at from public.transaction_items where id=$1", [duplicate.items[0].id])).rows[0].returned_at;
    const reloan = await checkout([0]);
    const stale = returnOperation(duplicate.items);
    await assert.rejects(actor.query(stale.sql, stale.values), error => error.code === "P0001");
    await assertParent(reloan.transactionId, "borrowed");
    assert.equal((await admin.query("select status from public.tools where id=$1", [tools[0].id])).rows[0].status, "borrowed");
    assert.deepEqual((await admin.query("select returned_at from public.transaction_items where id=$1", [duplicate.items[0].id])).rows[0].returned_at, originalTime);
    await returnItems(reloan.items);
    console.log("PASS: duplicate return conflicts and an old selection cannot close a later loan");

    const mixed = await checkout([0, 1]);
    const mixedOutcomes = await queuedRace(admin, connection, mixed.transactionId, [returnOperation([mixed.items[0]]), missingOperation([mixed.items[1]])]);
    mixedOutcomes.forEach(assertSuccess);
    await assertParent(mixed.transactionId, "incomplete");
    assert.equal((await admin.query("select status from public.tools where id=$1", [mixed.items[1].tool_id])).rows[0].status, "missing");
    await returnItems([mixed.items[1]]);
    await assertParent(mixed.transactionId, "returned");
    console.log("PASS: concurrent return and missing on different items retain incomplete custody until recovery");

    const returnFirst = await checkout([2]);
    const returnFirstOutcomes = await queuedRace(admin, connection, returnFirst.transactionId, [returnOperation(returnFirst.items), missingOperation(returnFirst.items)]);
    assertSuccess(returnFirstOutcomes[0]); assertConflict(returnFirstOutcomes[1]);
    await assertParent(returnFirst.transactionId, "returned");
    assert.equal((await admin.query("select status from public.tools where id=$1", [tools[2].id])).rows[0].status, "available");

    const missingFirst = await checkout([3]);
    const missingFirstOutcomes = await queuedRace(admin, connection, missingFirst.transactionId, [missingOperation(missingFirst.items), returnOperation(missingFirst.items)]);
    missingFirstOutcomes.forEach(assertSuccess);
    await assertParent(missingFirst.transactionId, "returned");
    const recovered = (await admin.query("select item_status,missing_at,missing_note from public.transaction_items where id=$1", [missingFirst.items[0].id])).rows[0];
    assert.equal(recovered.item_status, "returned"); assert.ok(recovered.missing_at); assert.equal(recovered.missing_note, "Race verification missing");
    console.log("PASS: same-item return/missing conflicts preserve tool status and recovered missing history");

    // Both requests span the same parents in opposite payload order. Sorted
    // parent locks must produce one atomic winner, without a deadlock.
    const first = await checkout([0]);
    const second = await checkout([1]);
    const crossOutcomes = await queuedRace(admin, connection, [first.transactionId, second.transactionId].sort()[0], [returnOperation([...first.items, ...second.items]), returnOperation([...second.items, ...first.items])]);
    assert.equal(crossOutcomes[0].status, "success", crossOutcomes[0].error?.message);
    assert.equal(crossOutcomes[0].result.rows[0].count, 2);
    assertConflict(crossOutcomes[1]);
    await assertParent(first.transactionId, "returned"); await assertParent(second.transactionId, "returned");
    console.log("PASS: opposite multi-transaction selections serialize without deadlock or partial batch writes");
  } finally {
    await actor.end();
  }
}
