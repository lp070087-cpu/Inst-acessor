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
 for(const [width,height] of [[320,640],[375,667],[390,844],[430,932]]){
  const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true,deviceScaleFactor:1});
  const errors=[],consoleErrors=[],expectedNetworkErrors=[],blocked=[],submissions=[];let responseStatus=200;
  await context.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin===base&&url.pathname==='/api/launch-waitlist'){
    assert.equal(req.method(),'POST');submissions.push(req.postDataJSON());
    return route.fulfill({status:responseStatus,json:responseStatus===200?{ok:true,message:'Synthetic contract fixture; no persistence'}:{error:'Synthetic error response'}});
   }
   if(url.origin===base||url.protocol==='data:'||url.protocol==='blob:')return route.continue();
   blocked.push(url.origin);return route.abort();
  });
  const page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'){if(responseStatus!==200&&/^Failed to load resource.*(503|429)/.test(message.text()))expectedNetworkErrors.push('intentional mocked '+responseStatus);else consoleErrors.push(message.text());}});
  const response=await page.goto(base);expect(response.status()).toBe(200);expect((await context.cookies()).some(cookie=>cookie.name.includes('session-token'))).toBe(false);
  const cards=page.locator('#planos .lnd-plan-card');await expect(cards).toHaveCount(3);
  // No inline waitlist section/form on the landing anymore.
  await expect(page.locator('#lista-de-espera')).toHaveCount(0);await expect(page.locator('.lnd-waitlist-form, .lnd-waitlist-section')).toHaveCount(0);
  const dialog=page.getByRole('dialog');await expect(dialog).toHaveCount(0);
  const name=page.locator('#waitlist-name'),email=page.locator('#waitlist-email'),phone=page.locator('#waitlist-whatsapp'),planInput=slug=>page.locator(`input[name=planSlug][value=${slug}]`);
  const emailConsent=page.locator('input[name=emailConsent]'),whatsappConsent=page.locator('input[name=whatsappConsent]'),privacy=page.locator('#waitlist-privacy');
  const stepTitle=page.locator('#waitlist-step-title'),next=dialog.getByRole('button',{name:'Continuar',exact:true}),back=dialog.getByRole('button',{name:'Voltar',exact:true}),send=dialog.getByRole('button',{name:'Entrar na lista',exact:true});
  const successHeading=page.getByRole('heading',{name:'Você está na lista!'});
  const noOverflow=async label=>{const observed=await page.evaluate(()=>{const out=el=>{if(!el)return false;const box=el.getBoundingClientRect();return box.right>innerWidth+1||box.left< -1;};const dlg=document.querySelector('[role=dialog]');return {page:document.documentElement.scrollWidth>innerWidth+1,dialog:out(dlg),dialogInner:dlg?dlg.scrollWidth>dlg.clientWidth+1:false,feedback:out(document.querySelector('.lnd-wl-feedback'))};});expect(observed).toEqual({page:false,dialog:false,dialogInner:false,feedback:false});await page.screenshot({path:resolve(output,`launch-iphone-${width}-${label}.png`)});};
  const closeMethods=['escape','button','overlay'];
  for(const [index,[slug,label]] of [['semanal','Semanal'],['mensal','mensal'],['anual','Anual']].entries()){
   await expect(cards.locator('.lnd-plan-name').filter({hasText:new RegExp('^'+label+'$')})).toBeVisible();
   const trigger=page.getByRole('link',{name:'Entrar na lista de espera — '+label,exact:true});await trigger.click();
   await expect(dialog).toBeVisible();await expect(dialog).toHaveAttribute('aria-modal','true');await expect(dialog).toHaveAccessibleName('Entre na lista de espera');
   await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow','1');await expect(stepTitle).toHaveText('Seus dados');
   expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow)).toBe('hidden');
   if(index===0){
    await expect(phone).toHaveAttribute('type','tel');await expect(phone).toHaveAttribute('inputmode','tel');await expect(phone).toHaveAttribute('autocomplete','tel-national');await expect(email).toHaveAttribute('inputmode','email');
    for(const field of [name,email,phone])expect(await field.evaluate(input=>parseFloat(getComputedStyle(input).fontSize))).toBeGreaterThanOrEqual(16);
    await noOverflow('step1-empty');
    await next.click();await expect(dialog.locator('#waitlist-name-error')).toContainText('Informe seu nome');await expect(dialog.locator('#waitlist-email-error')).toBeVisible();await expect(dialog.locator('#waitlist-whatsapp-error')).toBeVisible();await expect(name).toBeFocused();await expect(stepTitle).toHaveText('Seus dados');
    await name.fill('Pessoa de teste');await email.fill('fixture@audit.invalid');await phone.fill('(20) 99999-9999');await next.click();await expect(dialog.locator('#waitlist-whatsapp-error')).toContainText('DDD');await expect(phone).toBeFocused();await noOverflow('step1-errors');
    await phone.fill('+55 (11) 99999-9999');await expect(phone).toHaveValue('(11) 99999-9999');
   }else{await expect(name).toHaveValue('Pessoa de teste');}
   await next.click();await expect(stepTitle).toHaveText('Suas preferências');await expect(dialog.getByRole('progressbar')).toHaveAttribute('aria-valuenow','2');await expect(planInput(slug)).toBeChecked();
   const method=closeMethods[index];
   if(method==='escape')await page.keyboard.press('Escape');else if(method==='button')await dialog.getByRole('button',{name:'Fechar'}).click();else await page.locator('.lnd-wl-overlay').click({position:{x:4,y:4}});
   await expect(dialog).toHaveCount(0);await expect(trigger).toBeFocused();expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow)).not.toBe('hidden');
  }
  expect(submissions.length).toBe(0);
  // Document-level delegation: generic "#lista-de-espera" links open the same dialog with data preserved.
  await page.getByRole('link',{name:'Lista de espera',exact:true}).click();await expect(dialog).toBeVisible();await expect(name).toHaveValue('Pessoa de teste');
  await next.click();await expect(planInput('anual')).toBeChecked();await expect(emailConsent).not.toBeChecked();await expect(whatsappConsent).not.toBeChecked();await expect(privacy).not.toBeChecked();
  await send.click();await expect(dialog.locator('#waitlist-privacy-error')).toContainText('Política de Privacidade');await expect(privacy).toBeFocused();expect(submissions.length).toBe(0);await noOverflow('step2-error');
  await expect(dialog.getByRole('link',{name:'Política de Privacidade'})).toHaveAttribute('href','/privacidade');
  await back.click();await expect(stepTitle).toHaveText('Seus dados');await expect(name).toHaveValue('Pessoa de teste');await expect(email).toHaveValue('fixture@audit.invalid');await expect(phone).toHaveValue('(11) 99999-9999');
  await next.click();await expect(planInput('anual')).toBeChecked();await privacy.check();await send.click();
  await expect(successHeading).toBeVisible();await expect(successHeading).toBeFocused();await expect(dialog).toHaveAccessibleName('Você está na lista!');
  await expect(dialog).toContainText('Seu cadastro foi realizado com sucesso. Fique de olho nas novidades do Inst Acessor e na abertura dos planos. Avisaremos pelos canais que você autorizou.');
  const confetti=page.locator('canvas[data-wl-confetti]');await expect(confetti).toHaveCount(1);expect(await confetti.evaluate(el=>getComputedStyle(el).pointerEvents)).toBe('none');
  expect(submissions).toHaveLength(1);expect(submissions[0]).toEqual({name:'Pessoa de teste',email:'fixture@audit.invalid',whatsapp:'+5511999999999',planSlug:'anual',emailConsent:false,whatsappConsent:false,privacyAccepted:true,source:'landing-plan',website:''});
  await noOverflow('success');await expect(confetti).toHaveCount(0,{timeout:4000});
  const footerLink=page.getByRole('link',{name:'Lista de espera',exact:true});
  await dialog.getByRole('button',{name:'Voltar ao site'}).click();await expect(dialog).toHaveCount(0);await expect(footerLink).toBeFocused();
  // Server failures never show success; form is fresh after a completed signup.
  responseStatus=503;await page.getByRole('link',{name:'Entrar na lista de espera — Semanal',exact:true}).click();await expect(name).toHaveValue('');
  await name.fill('Outra pessoa fictícia');await email.fill('second@audit.invalid');await phone.fill('+55 21 98888-7777');await next.click();await expect(planInput('semanal')).toBeChecked();
  await whatsappConsent.check();await privacy.check();await send.click();await expect(dialog.getByRole('alert')).toContainText('Não foi possível registrar agora');await expect(successHeading).toHaveCount(0);await expect(confetti).toHaveCount(0);
  expect(submissions).toHaveLength(2);expect(submissions[1]).toMatchObject({planSlug:'semanal',whatsappConsent:true,emailConsent:false,privacyAccepted:true,source:'landing-plan'});await noOverflow('server-error');
  responseStatus=429;await send.click();await expect(dialog.getByRole('alert')).toContainText('Muitas tentativas');await expect(successHeading).toHaveCount(0);expect(submissions).toHaveLength(3);
  // Reduced motion: success still shown, confetti skipped entirely.
  responseStatus=200;await page.emulateMedia({reducedMotion:'reduce'});await send.click();await expect(successHeading).toBeVisible();await page.waitForTimeout(150);await expect(confetti).toHaveCount(0);expect(submissions).toHaveLength(4);
  await page.keyboard.press('Escape');await expect(dialog).toHaveCount(0);
  // Hash entry point (/lista-de-espera redirects here).
  await page.goto(base+'/#lista-de-espera');await expect(dialog).toBeVisible();await expect(stepTitle).toHaveText('Seus dados');await expect(name).toHaveValue('');
  expect(errors).toEqual([]);expect(consoleErrors).toEqual([]);
  evidence.results.push({width,height,passed:true,mobileEmulation:true,signup:'MOCK contract only; no persistence',submittedContracts:submissions.length,checks:['no inline waitlist section','plan CTA opens dialog with plan preselected','Esc/close button/overlay close with focus restore and scroll lock release','document-level #lista-de-espera delegation','step 1 and step 2 inline validation never submit','Voltar preserves data','privacy acceptance required, marketing consents optional','success only after mocked 200 {ok:true} with confetti (pointer-events none)','503/429 without success','reduced motion skips confetti','hash entry opens dialog','tel/email inputs >=16px','page/dialog/feedback overflow','no page/console errors'],blockedOrigins:blocked});persist();await context.close();
 }
 console.log('Launch landing UI contract completed; no signup persistence or delivery tested.');
}catch(error){evidence.failure=error instanceof Error?error.message:String(error);persist();throw error;}finally{
 try{await browser?.close();}catch{evidence.cleanupErrors.push('Browser cleanup failed');}
 try{if(server){server.kill();await new Promise(res=>{if(server.exitCode!==null)return res();server.once('exit',res);setTimeout(res,5000);});}}catch{evidence.cleanupErrors.push('Owned server cleanup failed');}
 writeFileSync(resolve(output,'launch-iphone-server.log'),serverLog);persist();
 if(!evidence.failure&&evidence.cleanupErrors.length)throw new Error('Launch UI cleanup failed');
}
