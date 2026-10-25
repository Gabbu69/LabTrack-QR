import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium,webkit,firefox,devices} from 'playwright';
const base=process.argv[2]??process.env.PLAYWRIGHT_BASE_URL??'http://localhost:3100';const engineName=process.argv[3]??'chromium';const label=process.argv[4]??'local';assert(['http://localhost:3100','https://labtrack-qr.vercel.app'].includes(base));
const engine={chromium,webkit,firefox}[engineName];assert(engine);assert(/^[a-z0-9-]+$/.test(label));assert(process.env.DEMO_ACCOUNT_PASSWORD,'Private demo credential is required');await mkdir('output/responsive-qa',{recursive:true});
const sizes=[{width:320,height:700},{width:375,height:812},{width:390,height:844},{width:414,height:896},{width:768,height:1024},{width:844,height:390},{width:1024,height:768},{width:1366,height:900}];
const result={base,engine:engineName,checks:[],failures:[],errors:[],requestFailures:[]};
const browser=await engine.launch();
try{
 for(const [role,email,paths]of [
  ['student','jordan.demo@labtrackqr2026.com',['/dashboard','/history','/borrowed','/my-qr','/profile']],
  ['instructor','instructor.demo@labtrackqr2026.com',['/dashboard','/history','/tools','/scan','/users','/profile']],
  ['custodian','custodian.demo@labtrackqr2026.com',['/dashboard','/history','/tools','/tools/labels','/borrow','/return','/scan','/users','/profile']]
 ]){
  const device=engineName==='webkit'?devices['iPhone 13']:engineName==='chromium'?devices['Pixel 7']:devices['Desktop Firefox'];
  const context=await browser.newContext({...device,viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>result.errors.push({role,path:new URL(page.url()).pathname,message:e.message}));
  page.on('requestfailed',request=>result.requestFailures.push({role,path:new URL(page.url()).pathname,url:request.url(),reason:request.failure()?.errorText,prefetch:request.headers()['next-router-prefetch']==='1'}));
  await page.goto(base+'/login');await page.getByLabel('Email address',{exact:true}).fill(email);await page.getByLabel('Password',{exact:true}).fill(process.env.DEMO_ACCOUNT_PASSWORD);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL('**/dashboard');
  async function fit(path,state){
   const issues=await page.evaluate(()=>{
    const bad=[];const root=document.documentElement;if(root.scrollWidth>root.clientWidth+1)bad.push({reason:'document overflow',width:root.scrollWidth,available:root.clientWidth});
    for(const control of document.querySelectorAll('form input, form select, form textarea')){
     const r=control.getBoundingClientRect();if(!r.width||!r.height||control.closest('details:not([open])'))continue;
     const parent=control.closest('.filter-bar,.form-grid,.form-stack,.manual-scan')??control.closest('form');if(!parent)continue;const p=parent.getBoundingClientRect();
     if(r.left<p.left-1||r.right>p.right+1)bad.push({reason:'control outside form',name:control.name,width:r.width,available:p.width});
     const card=control.closest('.content-card');if(card){const c=card.getBoundingClientRect();if(r.left<c.left-1||r.right>c.right+1)bad.push({reason:'control clipped by card',name:control.name,width:r.width,available:c.width});}
    }
    for(const el of document.querySelectorAll('.date-input-shell')){const r=el.getBoundingClientRect();const f=el.querySelector('input');const c=f.getBoundingClientRect();if(c.left<r.left||c.right>r.right+1)bad.push({reason:'date outside wrapper'});}
    if(document.querySelector('.single-form-card h1')?.textContent?.toLowerCase().includes('could not load'))bad.push({reason:'page error'});
    return bad;
   });
   const entry={role,path,state,...page.viewportSize()};result.checks.push(entry);if(issues.length)result.failures.push({...entry,issues});
  }
  for(const path of paths){
   // Let same-origin prefetches finish before deliberately replacing the whole
   // document. WebKit reports interrupted loads as access-control exceptions.
   await page.waitForLoadState('networkidle');
   await page.goto(base+path);await page.locator('h1').first().waitFor();
   if(path==='/tools'&&role==='custodian')await page.locator('#add-tools').evaluate(el=>el.open=true);
   if(path==='/users'&&role==='custodian'){
    await page.locator('details.content-card').evaluateAll(nodes=>nodes.forEach(el=>el.open=true));
    const reset=page.locator('details.inline-disclosure').first();if(await reset.count())await reset.evaluate(el=>el.open=true);
   }
   for(const size of sizes){await page.setViewportSize(size);await fit(path,'default');
    if(path==='/history'){
     if(role==='student'&&size.width===390)await page.screenshot({path:`output/responsive-qa/${label}-${engineName}-history-empty.png`,fullPage:true});
     await page.getByLabel('From',{exact:true}).fill('2020-01-01');await page.getByLabel('To',{exact:true}).fill('2030-12-31');await fit(path,'populated dates');
     if(role==='student'&&size.width===390)await page.screenshot({path:`output/responsive-qa/${label}-${engineName}-history-filled.png`,fullPage:true});
     await page.getByLabel('From',{exact:true}).fill('');await page.getByLabel('To',{exact:true}).fill('');
    }
   }
   if(path==='/history'){
    await page.setViewportSize({width:390,height:844});await page.getByLabel('From',{exact:true}).fill('2020-01-01');await page.getByLabel('To',{exact:true}).fill('2030-12-31');await page.waitForLoadState('networkidle');await page.getByRole('button',{name:'Apply',exact:true}).click();await page.waitForURL(url=>url.searchParams.get('from')==='2020-01-01'&&url.searchParams.get('to')==='2030-12-31');
    await page.getByRole('heading',{name:role==='student'?'BORROWING HISTORY':'HISTORY & REPORTS',exact:true}).waitFor();
    assert.equal(await page.getByLabel('From',{exact:true}).inputValue(),'2020-01-01');assert.equal(await page.getByLabel('To',{exact:true}).inputValue(),'2030-12-31');
    for(const name of ['Export CSV','Print A4 report']){const href=await page.getByRole('link',{name,exact:true}).getAttribute('href');assert(href.includes('from=2020-01-01')&&href.includes('to=2030-12-31'));const response=await context.request.get(base+href);assert.equal(response.status(),200,name+' response');}
    result.checks.push({role,path,state:'Apply retains dates and passes filters to working CSV and A4 report'});
    await page.evaluate(()=>{const nodes=[document.body,...document.body.querySelectorAll('*')];const sizes=nodes.map(el=>parseFloat(getComputedStyle(el).fontSize)*2);nodes.forEach((el,i)=>{if(el instanceof HTMLElement)el.style.fontSize=sizes[i]+'px';});});await fit(path,'200% text');
   }
  }
  await page.waitForLoadState('networkidle');await context.close();console.log('PASS: completed '+role+' '+engineName+' responsive checks');
 }
}finally{await browser.close();await writeFile(`output/responsive-qa/${label}-${engineName}.json`,JSON.stringify(result,null,2));}
console.log(JSON.stringify({engine:engineName,checks:result.checks.length,failures:result.failures,errors:result.errors},null,2));assert.deepEqual(result.failures,[]);assert.deepEqual(result.errors,[]);
