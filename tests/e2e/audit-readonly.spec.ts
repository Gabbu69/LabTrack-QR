import { test, expect as baseExpect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
// Network-backed navigation also runs on the owner's 4 GB development machine.
const expect=baseExpect.configure({timeout:30000});
const password = process.env.DEMO_ACCOUNT_PASSWORD;
const widths = [320,390,768,1366];
test.use({trace:'off'}); // Authenticated traces can contain credentials and cookies.
test.beforeEach(async ({page,baseURL})=>{
 const secret=process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
 if(secret && baseURL && new URL(baseURL).hostname.endsWith('.vercel.app')) {
  // Vercel's supported cookie covers native downloads as well as page requests.
  // APIRequestContext shares the browser context's cookie jar; no token in URLs.
  await page.request.get(baseURL,{headers:{'x-vercel-protection-bypass':secret,'x-vercel-set-bypass-cookie':'true'}});
 }
});
async function fit(page: Page, label: string) {
  const overflow = await page.evaluate(() => ({ scroll:document.documentElement.scrollWidth, client:document.documentElement.clientWidth }));
  expect.soft(overflow.scroll, `${label}: document overflow`).toBeLessThanOrEqual(overflow.client);
  await expect(page.getByRole('heading', {name:'This page could not load',exact:true})).toHaveCount(0);
}
async function expectedContent(page: Page, role: string, path: string) {
 const headings: Record<string,string> = {'/tools':'TOOL INVENTORY','/tools/labels':'TOOL QR LABELS','/borrow':'BORROW TOOLS','/return':'PROCESS RETURN','/scan':'CHOOSE A WORKFLOW','/profile':'PERSONAL PROFILE','/borrowed':'BORROWED TOOLS','/my-qr':'MY PERSONAL QR'};
 if(path==='/history') await expect(page.getByRole('heading',{name:role==='student'?'BORROWING HISTORY':'HISTORY & REPORTS',exact:true})).toBeVisible();
 else if(path==='/users') await expect(page.getByRole('heading',{name:role==='custodian'?'USER MANAGEMENT':'STUDENT RECORDS',exact:true})).toBeVisible();
 else if(path==='/dashboard') await expect(page.getByRole('heading',{name:role==='student'?/^Welcome, /:role==='custodian'?'Tool crib dashboard':'Laboratory status',level:1})).toBeVisible();
 else await expect(page.getByRole('heading',{name:headings[path],exact:true})).toBeVisible();
}
async function login(page: Page,email:string) {
  await page.goto('/login'); await page.getByLabel('Email address').fill(email);await page.getByLabel('Password',{exact:true}).fill(password!);
  await page.getByRole('button',{name:'Sign in',exact:true}).click(); await expect(page).toHaveURL(/\/dashboard$/,{timeout:30000});await expect(page.locator('h1')).toBeVisible();
}
test('public pages fit 320, 390, 768 and 1366 pixels', async ({page})=>{
 test.setTimeout(180000);
 for(const path of ['/login','/register','/guide']){await page.goto(path);await expect(page.locator('h1').first()).toBeVisible();await expect(page.getByRole('button',{name:'Help and page guide'})).toHaveText('Help & user guide');if(path==='/guide')await expect(page.getByRole('heading',{name:'USER GUIDE',exact:true})).toBeVisible();for(const width of widths){await page.setViewportSize({width,height:900});await fit(page,`${path} ${width}`);}}
});
for(const [role,email,paths] of [
 ['custodian','custodian.demo@labtrackqr2026.com',['/dashboard','/tools','/tools/labels','/history','/borrow','/return','/scan','/users','/profile']],
 ['instructor','instructor.demo@labtrackqr2026.com',['/dashboard','/tools','/history','/users','/profile']],
 ['student','jordan.demo@labtrackqr2026.com',['/dashboard','/borrowed','/my-qr','/history','/profile']]
] as const) test(`${role} read-only responsive workflows, refresh and logout`, async({page},info)=>{
 test.skip(!password,'Set DEMO_ACCOUNT_PASSWORD to run authorized read-only checks.');test.setTimeout(360000);
 await login(page,email);await page.reload();await expect(page).toHaveURL(/\/dashboard$/);
 for(const path of paths){await page.goto(path);await expectedContent(page,role,path);for(const width of widths){await page.setViewportSize({width,height:900});await fit(page,`${role} ${path} ${width}`);}}
 await page.goto('/change-password');await expect(page.getByRole('heading',{name:'Shared demonstration account',exact:true})).toBeVisible();await expect(page.getByLabel('New password',{exact:true})).toHaveCount(0);
 if(role==='student') {
  await page.goto('/my-qr');const qrDownload=page.waitForEvent('download');await page.getByRole('button',{name:'Download SVG',exact:true}).click();const qr=await qrDownload;
  expect(qr.suggestedFilename()).toMatch(/-qr\.svg$/);const qrPath=await qr.path();expect(qrPath).not.toBeNull();const svg=await readFile(qrPath!,'utf8');expect(svg).toContain('<svg');expect(svg).toContain('shape-rendering="crispEdges"');expect(svg).not.toContain('mark-aircraft');
 }
 if(role==='custodian'){
  await page.goto('/tools');await page.getByRole('link',{name:/DMM-001/}).first().click();await expect(page.getByRole('heading',{name:'TOOL USAGE HISTORY'})).toBeVisible();
  for(const width of widths){await page.setViewportSize({width,height:900});await fit(page,`tool details ${width}`);}
  await page.goto('/borrow');await page.getByRole('textbox',{name:/USB scanner or typed Student ID/}).fill('DEMO-2026-01');await page.getByRole('button',{name:'Use code'}).click();await expect(page.getByText('Jordan Mitchell')).toBeVisible();
  await page.getByRole('textbox',{name:/USB scanner or typed asset code/}).fill('DMM-002');await page.getByRole('button',{name:'Use code'}).click();await expect(page.getByRole('button',{name:'Confirm checkout (1)'})).toBeEnabled();
  await page.getByRole('textbox',{name:/USB scanner or typed asset code/}).fill('DMM-002');await page.getByRole('button',{name:'Use code'}).click();await expect(page.getByRole('button',{name:'Confirm checkout (1)'})).toBeEnabled();
  await page.getByRole('button',{name:'Change',exact:true}).click();await expect(page.getByRole('button',{name:'Confirm checkout (0)'})).toBeDisabled();
  await page.goto('/return');await page.getByRole('textbox',{name:/USB scanner or typed Student ID/}).fill('DEMO-2026-02');await page.getByRole('button',{name:'Use code'}).click();await expect(page.getByText(/2 outstanding/)).toBeVisible();
  await page.getByRole('textbox',{name:/USB scanner or typed asset code/}).fill('TRQ-001');await page.getByRole('button',{name:'Use code'}).click();await expect(page.getByRole('button',{name:'Confirm return (1)'})).toBeEnabled();
  await page.goto('/history');const download=page.waitForEvent('download');await page.getByRole('link',{name:'Export CSV'}).click();expect((await download).suggestedFilename()).toMatch(/labtrack-history/);
 } else {await page.goto('/borrow');await expect(page).toHaveURL(/\/dashboard\?error=/);}
 await page.goto('/dashboard');await page.setViewportSize({width:1366,height:900});await page.screenshot({path:info.outputPath(`${role}-desktop.png`),fullPage:true});
 await page.setViewportSize({width:320,height:900});await page.screenshot({path:info.outputPath(`${role}-mobile.png`),fullPage:true});
 await page.getByRole('button',{name:'Open menu'}).click();
 await page.getByRole('dialog',{name:'Navigation menu'}).getByRole('button',{name:'Log Out'}).click();await expect(page).toHaveURL(/\/login/);await page.goto('/tools');await expect(page).toHaveURL(/\/login/);
});
