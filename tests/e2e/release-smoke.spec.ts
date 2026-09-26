import { expect as baseExpect, test, type Page } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
const expect = baseExpect.configure({ timeout: 30000 });
// Mutation suites are opt-in and fail closed for the shared Gabs backend.
const isolated = process.env.E2E_ISOLATED_DATABASE === "true" && !!process.env.NEXT_PUBLIC_SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL.includes("tsusogeqjduyahoskteb");
test.beforeEach(() => { test.skip(!isolated, "Mutations require disposable fixtures on an isolated backend."); });
const demoPassword = process.env.DEMO_ACCOUNT_PASSWORD;
const admin = process.env.SUPABASE_SECRET_KEY ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY, {auth:{persistSession:false,autoRefreshToken:false}}) : null;
async function login(page:Page,email:string,password:string){await page.goto('/login');await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill(password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await expect(page).toHaveURL(/\/(dashboard|change-password)/);}
test.beforeEach(async({},info)=>{test.skip(info.project.name!=='laptop'||!demoPassword||!admin,'Opt-in live smoke checks.');});
test('existing demo inventory supports checkout, return, refresh and CSV export',async({page})=>{
  test.setTimeout(240000);
  await login(page,'custodian.demo@labtrackqr2026.com',demoPassword!);
  await page.reload();await expect(page).toHaveURL(/\/dashboard/);
  const {data:tool,error}=await admin!.from('tools').select('asset_code').eq('data_scope','demo').eq('status','available').eq('condition','good').order('asset_code').limit(1).single();expect(error).toBeNull();
  await page.goto('/borrow');await page.getByRole('textbox',{name:/USB scanner or typed Student ID/i}).fill('DEMO-2026-04');await page.getByRole('button',{name:'Use code'}).click();await expect(page.getByText('Blake Williams')).toBeVisible();
  await page.getByRole('textbox',{name:/USB scanner or typed asset code/i}).fill(tool!.asset_code);await page.getByRole('button',{name:'Use code'}).click();await page.getByRole('button',{name:'Confirm checkout (1)'}).click();await expect(page.getByText(/Checkout complete/)).toBeVisible();
  await page.goto('/return');await page.getByRole('textbox',{name:/USB scanner or typed Student ID/i}).fill('DEMO-2026-04');await page.getByRole('button',{name:'Use code'}).click();await page.getByRole('textbox',{name:/USB scanner or typed asset code/i}).fill(tool!.asset_code);await page.getByRole('button',{name:'Use code'}).click();await page.getByRole('button',{name:'Confirm return (1)'}).click();await expect(page.getByText('Complete return: 1 tools accepted.')).toBeVisible();
  await page.goto('/history');const downloadPromise=page.waitForEvent('download');await page.getByRole('link',{name:'Export CSV'}).click();const download=await downloadPromise;expect(download.suggestedFilename()).toMatch(/labtrack-history-.*\.csv/);
  await page.getByRole('button',{name:'Log Out'}).click();await expect(page).toHaveURL(/\/login/);await page.goto('/tools');await expect(page).toHaveURL(/\/login/);
});
test('temporary staff must change password before accessing the portal',async({page})=>{
  test.setTimeout(240000);const suffix=Date.now();const email=`release.${suffix}@labtrackqr2026.com`;const temporary=`Test-${randomBytes(12).toString('hex')}9!`;const changed=`New-${randomBytes(12).toString('hex')}9!`;let id:string|undefined;
  try {
    await login(page,'custodian.demo@labtrackqr2026.com',demoPassword!);await page.goto('/users');await page.getByText('Create a staff account',{exact:true}).click();await page.getByLabel('Full name').fill('Release Test Instructor');await page.getByLabel('Email',{exact:true}).fill(email);await page.getByRole('combobox',{name:/^Role/}).selectOption('instructor');await page.getByLabel('One-time temporary password').fill(temporary);await page.getByRole('button',{name:'Create staff account',exact:true}).click();await expect(page.getByText('Staff account created.',{exact:false})).toBeVisible();
    const result=await admin!.from('profiles').select('id').eq('email',email).single();id=result.data?.id;expect(id).toBeTruthy();
    await page.getByRole('button',{name:'Log Out'}).click();await login(page,email,temporary);await expect(page).toHaveURL(/\/change-password/);await page.getByLabel('New password').fill(changed);await page.getByLabel('Confirm password').fill(changed);await page.getByRole('button',{name:'Save password and continue'}).click();await expect(page).toHaveURL(/\/dashboard/);await page.goto('/borrow');await expect(page).toHaveURL(/\/dashboard\?error=/);await page.getByRole('button',{name:'Log Out'}).click();
  } finally {if(id){const {error}=await admin!.auth.admin.deleteUser(id);expect(error).toBeNull();}}
});

