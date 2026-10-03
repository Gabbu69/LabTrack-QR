import assert from 'node:assert/strict';
import {createServerClient} from '@supabase/ssr';
const base=process.argv[2] ?? process.env.SMOKE_BASE_URL ?? 'http://localhost:3000';
const protectionHeaders=process.env.VERCEL_AUTOMATION_BYPASS_SECRET && new URL(base).hostname.endsWith('.vercel.app') ? {'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET} : {};
const routes=[['POST','/api/borrow'],['POST','/api/return'],['POST','/api/missing'],['POST','/api/demo/reset'],['POST','/api/scan/resolve'],['GET','/api/custody'],['GET','/api/reports/transactions.csv']];
async function request(method,path,cookie='',body={}) { return fetch(base+path,{method,headers:{...protectionHeaders,cookie,origin:new URL(base).origin,...(method==='POST'?{'Content-Type':'application/json'}:{})},...(method==='POST'?{body:JSON.stringify(body)}:{}),redirect:'manual'}); }
for(const [method,path] of routes){const r=await request(method,path); assert.equal(r.status,401,path);assert.match(r.headers.get('content-type'),/application\/json/);}
console.log('PASS anonymous/expired-session API boundary: 7 JSON 401 responses');
for(const [role,email] of [['custodian','custodian.demo@labtrackqr2026.com'],['instructor','instructor.demo@labtrackqr2026.com'],['student','jordan.demo@labtrackqr2026.com']]){
 const cookies=new Map(); const s=createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,{cookies:{getAll:()=>[...cookies].map(([name,value])=>({name,value})),setAll:list=>list.forEach(c=>cookies.set(c.name,c.value))}});
 const loginPage=await fetch(base+'/login',{headers:protectionHeaders});
 const action=(await loginPage.text()).match(/name="(\$ACTION_ID_[^"]+)"/);
 assert(action, 'Login server action is rendered');
 const form=new FormData(); form.set(action[1],''); form.set('email',email); form.set('password',process.env.DEMO_ACCOUNT_PASSWORD);
 const login=await fetch(base+'/login',{method:'POST',headers:{...protectionHeaders,origin:new URL(base).origin},body:form,redirect:'manual'});
 assert.equal(login.status,303,`${role}: sign-in response`); assert.equal(login.headers.get('location'),'/dashboard',`${role}: sign-in failed`);
 for(const entry of login.headers.getSetCookie()){const pair=entry.split(';')[0]; const split=pair.indexOf('=');cookies.set(pair.slice(0,split),decodeURIComponent(pair.slice(split+1)));}
 assert(cookies.has('labtrack-session'),'Signed application session is issued');
 const sessionHeader=login.headers.getSetCookie().find(value=>value.startsWith('labtrack-session='));
 assert.match(sessionHeader,/HttpOnly/i); assert.match(sessionHeader,/SameSite=lax/i);
 if(new URL(base).protocol==='https:') assert.match(sessionHeader,/Secure/i);
 const cookie=[...cookies].map(([k,v])=>`${k}=${encodeURIComponent(v)}`).join('; ');
 const dashboard=await request('GET','/dashboard',cookie);assert.equal(dashboard.status,200,`${role} dashboard`);const html=await dashboard.text();assert(!html.includes('We could not load this page'),`${role} dashboard fallback`);
 for(const [method,path] of routes.filter(([method,path])=>method==='POST' && path!=='/api/demo/reset')){const r=await request(method,path,cookie);assert.equal(r.status,role==='custodian'?400:403,`${role} ${path}`);assert.match(r.headers.get('content-type'),/application\/json/);}
 if(role!=='custodian'){const reset=await request('POST','/api/demo/reset',cookie);assert.equal(reset.status,403);}
 if(role==='custodian'){
  const scan=await request('POST','/api/scan/resolve',cookie,{kind:'student',value:'DEMO-2026-01'});assert.equal(scan.status,200);const borrower=await scan.json();assert.equal(borrower.fullName,'Jordan Mitchell');
  const custody=await request('GET','/api/custody?token='+borrower.token,cookie);assert.equal(custody.status,200);assert(Array.isArray((await custody.json()).items));
  const csrf=await fetch(base+'/api/borrow',{method:'POST',headers:{...protectionHeaders,cookie,origin:'https://unrelated.invalid','Content-Type':'application/json'},body:'{}'});assert.equal(csrf.status,403);
 }
 const csv=await request('GET','/api/reports/transactions.csv',cookie);assert.equal(csv.status,200);assert.match(csv.headers.get('content-type'),/text\/csv/);const text=await csv.text();assert.match(text,/Transaction ID,Borrower,Student ID/);if(role==='student'){assert(!text.includes('Riley Patel'));assert(!text.includes('Taylor Chen'));}
 const invalid=await request('GET','/api/reports/transactions.csv?from=2026-02-30',cookie);assert.equal(invalid.status,400);
 const denied=await s.rpc('complete_password_change');assert.equal(denied.error?.code,'42501');
 const sessionCheck=await request('GET','/api/session',cookie);assert.equal(sessionCheck.status,204);
 assert(!sessionCheck.headers.getSetCookie().some(value=>value.startsWith('labtrack-session=')),'Background checks must not renew app sessions');
 const tamperedCookie=[...cookies].map(([k,v])=>`${k}=${encodeURIComponent(k==='labtrack-session'?v+'x':v)}`).join('; ');
 const tampered=await request('GET','/api/session',tamperedCookie);assert.equal(tampered.status,401,'Tampered app sessions must fail');
 console.log(`PASS ${role}: dashboard, API roles, JSON failures, CSV, legacy password RPC denied`);
 await s.auth.signOut({scope:'local'});
}
console.log(`Read-only HTTP smoke passed: ${base}`);
