/** Real production Next UI; only the anonymous signup HTTP contract is mocked. No persistence/provider proof. */
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),root=resolve(import.meta.dirname,'..');
const base='http://127.0.0.1:3112',dist=process.argv.includes('--product-build')?'outputs/product-build':'.next';
for(const filename of ['.env','.env.local','.env.production','.env.production.local'])if(existsSync(resolve(root,filename)))throw new Error('Refusing dotenv fallback; remove test-worktree environment files without copying real values');
if(!existsSync(resolve(root,dist,'BUILD_ID')))throw new Error('A completed CI/production build is required before this UI test');
const output=resolve(root,'outputs/verification');mkdirSync(output,{recursive:true});
const env={};for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','COMSPEC','ComSpec','PATHEXT','APPDATA','LOCALAPPDATA'])if(process.env[key])env[key]=process.env[key];
Object.assign(env,{DATABASE_URL:'postgresql://audit:audit@127.0.0.1:1/inst_acessor_audit',DIRECT_URL:'postgresql://audit:audit@127.0.0.1:1/inst_acessor_audit',AUTH_URL:base,NEXTAUTH_URL:base,NEXTAUTH_SECRET:'synthetic-landing-ui-only-secret',TOKEN_ENCRYPTION_KEY:'synthetic-landing-ui-only-key',ADMIN_EMAIL:'admin@audit.invalid',NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1',PUBLISHING_WORKER_ENABLED:'false',__NEXT_PROCESSED_ENV:'true',NODE_OPTIONS:`--require "${resolve(root,'bench/offline-network.cjs').replaceAll('\\','/')}"`});
if(dist!=='.next')env.NEXT_OUTPUT_DIR=dist;
for(const key of Object.keys(process.env))delete process.env[key];Object.assign(process.env,env);
await import('./offline-network.cjs');
const evidence={scope:'Real Next production landing; signup response contract mocked, no database persistence or actual email/WhatsApp delivery',results:[],failure:null,cleanupErrors:[]};
const persist=()=>writeFileSync(resolve(output,'launch-iphone-results.json'),JSON.stringify(evidence,null,2));
let server,browser,serverLog='';
try{
 await new Promise((res,rej)=>{const probe=createServer();probe.once('error',rej);probe.listen(3112,'127.0.0.1',()=>probe.close(res));});
 server=spawn(process.execPath,[resolve(require.resolve('next/package.json'),'../dist/bin/next'),'start','--hostname','127.0.0.1','--port','3112'],{cwd:root,env,windowsHide:true});
 server.stdout.on('data',chunk=>serverLog+=chunk);server.stderr.on('data',chunk=>serverLog+=chunk);server.once('error',error=>{evidence.failure='Server process could not start: '+error.message;});
 let ready=false;for(let i=0;i<60;i++){if(evidence.failure||server.exitCode!==null)throw new Error('Owned local server failed before readiness');if(serverLog.includes('Ready')){ready=true;break;}await new Promise(res=>setTimeout(res,1000));}assert.ok(ready,'Local production server readiness timed out');
 if(process.platform==='win32')process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/55819/AppData/Local/ms-playwright';
 const {chromium,expect:baseExpect}=await import('@playwright/test');const expect=baseExpect.configure({timeout:15000});browser=await chromium.launch({headless:true});evidence.browserVersion=browser.version();
 for(const [width,height] of [[375,667],[390,844],[430,932]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errors=[],consoleErrors=[],expectedNetworkErrors=[],blocked=[],submissions=[];let responseStatus=200;
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===base&&url.pathname==='/api/launch-waitlist'){
    assert.equal(req.method(),'POST');submissions.push(req.postDataJSON());
    return route.fulfill({status:responseStatus,json:responseStatus===200?{ok:true,message:'Synthetic contract fixture; no persistence'}:{error:'Synthetic unavailable response'}});
   }
   if(url.origin===base||url.protocol==='data:'||url.protocol==='blob:')return route.continue();
   blocked.push(url.origin);return route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'){if(responseStatus===503&&/^Failed to load resource.*503/.test(message.text()))expectedNetworkErrors.push('intentional mocked 503');else consoleErrors.push(message.text());}});
  const response=await page.goto(base);expect(response.status()).toBe(200);expect((await context.cookies()).some(cookie=>cookie.name.includes('session-token'))).toBe(false);
  const cards=page.locator('#planos .lnd-plan-card');await expect(cards).toHaveCount(3);
  const form=page.locator('.lnd-waitlist-form'),name=page.locator('#waitlist-name'),email=page.locator('#waitlist-email'),phone=page.locator('#waitlist-whatsapp'),planInput=slug=>page.locator(`input[name=planSlug][value=${slug}]`);
  const emailConsent=page.locator('input[name=emailConsent]'),whatsappConsent=page.locator('input[name=whatsappConsent]');
  await expect(emailConsent).not.toBeChecked();await expect(whatsappConsent).not.toBeChecked();
  for(const [slug,label] of [['semanal','Semanal'],['mensal','mensal'],['anual','Anual']]){
   await expect(cards.locator('.lnd-plan-name').filter({hasText:new RegExp('^'+label+'$')})).toBeVisible();
   await page.getByRole('link',{name:'Entrar na lista de espera — '+label,exact:true}).click();await expect(planInput(slug)).toBeChecked();await expect(name).toBeFocused();
  }
  await expect(phone).toHaveAttribute('type','tel');await expect(phone).toHaveAttribute('inputmode','tel');expect(await phone.evaluate(input=>parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
  const noOverflow=async label=>{const observed=await page.evaluate(()=>({page:document.documentElement.scrollWidth>innerWidth+1,form:(()=>{const box=document.querySelector('.lnd-waitlist-form').getBoundingClientRect();return box.right>innerWidth+1||box.left< -1;})(),feedback:(()=>{const box=document.querySelector('.lnd-waitlist-feedback')?.getBoundingClientRect();return box?box.right>innerWidth+1||box.left< -1:false;})()}));expect(observed).toEqual({page:false,form:false,feedback:false});await page.screenshot({path:resolve(output,`launch-iphone-${width}-${label}.png`),fullPage:true});};
  await noOverflow('form');await name.fill('Pessoa de teste');await email.fill('fixture@audit.invalid');await phone.fill('+55 (11) 99999-9999');
  const submit=form.getByRole('button',{name:'Quero entrar na lista de espera',exact:true});
  await submit.click();await expect(form.locator('.lnd-waitlist-error')).toContainText('Escolha pelo menos um canal');expect(submissions.length).toBe(0);await noOverflow('consent-error');
  await emailConsent.check();await phone.fill('(20) 99999-9999');await submit.click();await expect(form.locator('.lnd-waitlist-error')).toContainText('DDD');expect(submissions.length).toBe(0);
  await phone.fill('+55 (11) 99999-9999');await submit.click();const done=page.getByRole('heading',{name:'Cadastro recebido!'});await expect(done).toBeVisible();await expect(done).toBeFocused();
  expect(submissions).toHaveLength(1);expect(submissions[0]).toEqual({name:'Pessoa de teste',email:'fixture@audit.invalid',whatsapp:'+5511999999999',planSlug:'anual',emailConsent:true,whatsappConsent:false,source:'landing-plan',website:''});
  await noOverflow('success');await page.getByRole('button',{name:'Cadastrar outra pessoa'}).click();await expect(name).toBeFocused();await expect(emailConsent).not.toBeChecked();await expect(whatsappConsent).not.toBeChecked();
  responseStatus=503;await name.fill('Outra pessoa fictícia');await email.fill('second@audit.invalid');await phone.fill('+55 21 98888-7777');await planInput('semanal').check({force:true});await whatsappConsent.check();await submit.click();await expect(form.getByRole('alert')).toContainText('Não foi possível registrar agora');await expect(page.getByRole('heading',{name:'Cadastro recebido!'})).toHaveCount(0);expect(submissions).toHaveLength(2);expect(submissions[1].source).toBe('landing');await noOverflow('server-error');
  expect(errors).toEqual([]);expect(consoleErrors).toEqual([]);
  evidence.results.push({width,height,passed:true,mobileEmulation:true,signup:'MOCK contract only; no persistence',submittedContracts:submissions.length,checks:['three plans and CTA autofill/focus','unchecked independent consents','tel input minimum16px','invalid consent/phone never submitted','normalized accepted payload','503 without success','page/form/feedback overflow','no page/console errors'],blockedOrigins:blocked});persist();await context.close();
 }
 console.log('Launch landing UI contract completed; no signup persistence or delivery tested.');
}catch(error){evidence.failure=error instanceof Error?error.message:String(error);persist();throw error;}finally{
 try{await browser?.close();}catch{evidence.cleanupErrors.push('Browser cleanup failed');}
 try{if(server){server.kill();await new Promise(res=>{if(server.exitCode!==null)return res();server.once('exit',res);setTimeout(res,5000);});}}catch{evidence.cleanupErrors.push('Owned server cleanup failed');}
 writeFileSync(resolve(output,'launch-iphone-server.log'),serverLog);persist();
 if(!evidence.failure&&evidence.cleanupErrors.length)throw new Error('Launch UI cleanup failed');
}
