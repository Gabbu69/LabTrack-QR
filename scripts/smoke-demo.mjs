import { createClient } from '@supabase/supabase-js';
import assert from 'node:assert/strict';
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
assert(url && key && process.env.DEMO_ACCOUNT_PASSWORD, 'Configure the public backend and demo password.');
for (const [role, email] of [['custodian','custodian.demo@labtrackqr2026.com'],['instructor','instructor.demo@labtrackqr2026.com'],['student','jordan.demo@labtrackqr2026.com']]) {
  const client = createClient(url, key, options);
  const { data, error } = await client.auth.signInWithPassword({ email, password: process.env.DEMO_ACCOUNT_PASSWORD });
  assert(!error && data.user, `${role}: demo sign-in failed`);
  const profile = await client.from('profiles').select('role,status,data_scope,must_change_password').eq('id',data.user.id).single();
  assert(!profile.error); assert.equal(profile.data.role,role); assert.equal(profile.data.status,'active'); assert.equal(profile.data.data_scope,'demo'); assert.equal(profile.data.must_change_password,false);
  const otherScope = await client.from('transactions').select('id').eq('data_scope','operational'); assert(!otherScope.error); assert.equal(otherScope.data.length,0);
  if (role === 'student') {
    const others = await client.from('transactions').select('id').neq('borrower_id',data.user.id); assert(!others.error); assert.equal(others.data.length,0);
    const inventory = await client.from('tools').select('id'); assert(!inventory.error); assert.equal(inventory.data.length,0);
  } else {
    const tools = await client.from('tools').select('id,asset_code,tool_name'); assert(!tools.error);
    for (const q of ['Meter','%', '_', 'a,b)', '"quoted"']) {
      const escaped = q.replace(/[\\%_]/g,'\\$&'); const pattern = '"%' + escaped.replace(/\\/g,'\\\\').replace(/"/g,'\\"') + '%"';
      const result = await client.from('tools').select('id').or(`tool_name.ilike.${pattern},asset_code.ilike.${pattern}`); assert(!result.error,`Literal filter rejected: ${q}`);
      const expected=tools.data.filter(t=>`${t.tool_name}`.toLowerCase().includes(q.toLowerCase()) || t.asset_code.toLowerCase().includes(q.toLowerCase())).map(t=>t.id).sort();
      assert.deepEqual(result.data.map(t=>t.id).sort(), expected);
    }
  }
  await client.auth.signOut(); console.log(`PASS ${role}: configured demo password, active profile, scope isolation, permitted reads`);
}
const anonymous = createClient(url,key,options); const rows = await anonymous.from('tools').select('id'); assert(rows.error || rows.data.length===0); console.log('PASS anonymous: inventory is not exposed');
