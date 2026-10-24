import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

// Owner-side, additive sample import. Never resets accounts, tools or history.
// node --env-file=.env.local scripts/add-sample-tools.mjs [--apply]
const apply = process.argv.includes("--apply");
const scope = "operational";
const email = "custodian@labtrack.local";
const prefix = "SAMPLE26"; // Reserved for this repeatable sample import.
const catalog = [
  ["Combination Wrench", "Hand Tools"],
  ["Socket Wrench", "Hand Tools"],
  ["Adjustable Wrench", "Hand Tools"],
  ["Flathead Screwdriver", "Hand Tools"],
  ["Phillips Screwdriver", "Hand Tools"],
  ["Allen Key Set", "Hand Tools"],
  ["Torx Key Set", "Hand Tools"],
  ["Long Nose Pliers", "Hand Tools"],
  ["Side Cutting Pliers", "Hand Tools"],
  ["Locking Pliers", "Hand Tools"],
  ["Ball Peen Hammer", "Hand Tools"],
  ["Rubber Mallet", "Hand Tools"],
  ["Digital Caliper", "Measuring & Inspection"],
  ["Micrometer", "Measuring & Inspection"],
  ["Feeler Gauge", "Measuring & Inspection"],
  ["Steel Rule", "Measuring & Inspection"],
  ["Depth Gauge", "Measuring & Inspection"],
  ["Digital Multimeter", "Measuring & Inspection"],
  ["Inspection Mirror", "Measuring & Inspection"],
  ["Magnetic Pickup Tool", "Measuring & Inspection"],
  ["Wire Stripper", "Electrical Tools"],
  ["Wire Crimper", "Electrical Tools"],
  ["Soldering Iron", "Electrical Tools"],
  ["Test Lead Set", "Electrical Tools"],
  ["Rivet Gun", "Aircraft Maintenance"],
  ["Safety Wire Pliers", "Aircraft Maintenance"],
  ["Deburring Tool", "Aircraft Maintenance"],
  ["Bench Vise", "Workshop Equipment"],
  ["C Clamp", "Workshop Equipment"],
  ["Electric Drill", "Workshop Equipment"],
];
assert.equal(catalog.length, 30);
assert.equal(new Set(catalog.map(([name]) => name)).size, 30);
assert.equal(process.env.NEXT_PUBLIC_SUPABASE_URL, "https://tsusogeqjduyahoskteb.supabase.co", "Unexpected database target");
assert(process.env.SUPABASE_SECRET_KEY, "Owner credentials are required");
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });

async function rows(table) {
  const result = [];
  for (let offset = 0; offset < 100000; offset += 500) {
    const { data, error } = await admin.from(table).select("*").order("id").range(offset, offset + 499);
    if (error) throw new Error(`Cannot read ${table}: ${error.message}`);
    result.push(...data);
    if (data.length < 500) return result;
  }
  throw new Error("Unexpected dataset size; import stopped.");
}
function hash(data) {
  const normalized = [...data].sort((a, b) => a.id.localeCompare(b.id)).map(row => Object.fromEntries(Object.keys(row).sort().map(key => [key, row[key]])));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}
const { data: actor, error: actorError } = await admin.from("profiles").select("id,role,status,data_scope").eq("email", email).maybeSingle();
assert.equal(actorError, null);
assert(actor?.role === "custodian" && actor.status === "active" && actor.data_scope === scope, "The intended active operational custodian is required");
const before = {};
for (const table of ["tools", "profiles", "transactions", "transaction_items"]) before[table] = await rows(table);
const byCode = new Map(before.tools.filter(tool => tool.data_scope === scope).map(tool => [tool.asset_code, tool]));
const batchId = randomUUID();
const expected = catalog.flatMap(([tool_name, category], kind) => Array.from({ length: 10 }, (_, unit) => ({
  asset_code: `${prefix}-${String(kind * 10 + unit + 1).padStart(3, "0")}`,
  tool_name, category, description: "Sample tool for testing.",
})));
const additions = [];
for (const candidate of expected) {
  const existing = byCode.get(candidate.asset_code);
  if (existing) {
    assert.equal(existing.tool_name, candidate.tool_name, `Reserved sample code conflict: ${candidate.asset_code}`);
    assert.equal(existing.category, candidate.category, `Reserved sample category conflict: ${candidate.asset_code}`);
  } else additions.push({ ...candidate, id: randomUUID(), creation_batch_id: batchId, created_by: actor.id, data_scope: scope, condition: "good", status: "available" });
}
const plan = { scope, custodian: email, existingTools: before.tools.length, originalSampleTools: before.tools.filter(tool => tool.data_scope === "demo").length, kinds: catalog.length, unitsPerKind: 10, additions: additions.length, alreadyPresent: expected.length - additions.length };
console.log(JSON.stringify({ mode: apply ? "apply" : "preview", ...plan }));
if (!apply) process.exit(0);

const directory = resolve("output/private/sample-tools-2026-10-25");
await mkdir(directory, { recursive: true });
const receiptPath = resolve(directory, `${Date.now()}-${batchId}.json`);
const beforeChecks = Object.fromEntries(Object.entries(before).map(([table, data]) => [table, { count: data.length, sha256: hash(data) }]));
const receipt = { ...plan, batchId, createdAt: new Date().toISOString(), before: beforeChecks, insertedIds: additions.map(tool => tool.id), assetCodes: additions.map(tool => tool.asset_code), applied: false, verified: false };
await writeFile(receiptPath, JSON.stringify(receipt, null, 2));
if (additions.length) {
  // A single multi-row statement is atomic. Database defaults assign unique QR tokens.
  const { error } = await admin.from("tools").insert(additions);
  if (error) throw new Error(`No sample batch was accepted: ${error.message}`);
}
receipt.applied = true;
await writeFile(receiptPath, JSON.stringify(receipt, null, 2));
const after = {};
for (const table of ["tools", "profiles", "transactions", "transaction_items"]) after[table] = await rows(table);
const originalIds = new Set(before.tools.map(tool => tool.id));
assert.equal(hash(after.tools.filter(tool => originalIds.has(tool.id))), beforeChecks.tools.sha256, "An existing tool changed during import");
for (const table of ["profiles", "transactions", "transaction_items"]) assert.equal(hash(after[table]), beforeChecks[table].sha256, `${table} changed during import`);
assert.equal(after.tools.length, before.tools.length + additions.length);
const imported = after.tools.filter(tool => tool.data_scope === scope && expected.some(candidate => candidate.asset_code === tool.asset_code));
assert.equal(imported.length, 300);
assert.equal(new Set(imported.map(tool => tool.qr_token)).size, 300);
assert(imported.every(tool => /^[0-9a-f-]{36}$/.test(tool.qr_token)));
assert.equal(new Set(after.tools.map(tool => tool.qr_token)).size, after.tools.length, "QR tokens must remain unique across all tools");
receipt.verified = true;
receipt.after = { totalTools: after.tools.length, operationalTools: after.tools.filter(tool => tool.data_scope === scope).length, originalToolsUnchanged: true, accountsAndHistoryUnchanged: true, importedQrTokensUnique: true };
await writeFile(receiptPath, JSON.stringify(receipt, null, 2));
console.log(JSON.stringify({ ...receipt.after, added: additions.length, receiptPath }));
