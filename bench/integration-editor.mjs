import { LocalPostgres } from './local-postgres.mjs';
import { Client } from 'pg';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { mkdirSync,writeFileSync,existsSync,readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require=createRequire(import.meta.url),root=resolve(import.meta.dirname,'..');
const dev=process.argv.includes('--dev'),productBuild=process.argv.includes('--product-build');
if(dev&&productBuild)throw new Error('Choose --dev or --product-build, never both');
const portArg=process.argv.find(arg=>arg.startsWith('--port='));const httpPort=portArg?Number(portArg.split('=')[1]):3107;if(![3107,3110].includes(httpPort))throw new Error('Only isolated ports 3107 or 3110 allowed');
for(const name of ['.env','.env.local','.env.development','.env.development.local','.env.production','.env.production.local'])if(existsSync(resolve(root,name)))throw new Error('Refusing Next env fallback: '+name+' exists; no values read');
const output=resolve(root,dev?'outputs/verification/editor-integration-dev':'outputs/verification/editor-integration');mkdirSync(output,{recursive:true});
const env={};for(const key of ['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','COMSPEC','ComSpec','PATHEXT','APPDATA','LOCALAPPDATA'])if(process.env[key])env[key]=process.env[key];
const port=await new Promise((r,j)=>{const s=createServer();s.once('error',j);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const base='http://127.0.0.1:'+httpPort,db=`postgresql://audit:audit@127.0.0.1:${port}/inst_acessor_audit`;
Object.assign(env,{DATABASE_URL:db,DIRECT_URL:db,AUDIT_DATABASE_PORT:String(port),AUTH_URL:base,NEXTAUTH_URL:base,NEXTAUTH_SECRET:'editor-synthetic-local-only-2026',ADMIN_EMAIL:'admin@audit.invalid',TOKEN_ENCRYPTION_KEY:'editor-synthetic-local-key-2026',NEXT_TELEMETRY_DISABLED:'1',PUBLISHING_WORKER_ENABLED:'false',NODE_OPTIONS:`--require "${resolve(root,'bench/offline-network.cjs').replaceAll('\\','/')}"`});
if(dev)env.NEXT_OUTPUT_DIR='outputs/editor-dev';else if(productBuild)env.NEXT_OUTPUT_DIR='outputs/product-build';
// LocalPostgres also inherits only this sanitized environment, never original provider credentials.
for(const k of Object.keys(process.env))delete process.env[k];Object.assign(process.env,env);
const pg=new LocalPostgres(resolve(root,`outputs/editor-postgres-${Date.now()}`),port);
async function run(args){const p=spawn(process.execPath,args,{cwd:root,env,windowsHide:true});let text='';p.stdout.on('data',b=>text+=b);p.stderr.on('data',b=>text+=b);const code=await new Promise((r,j)=>{p.once('error',j);p.once('close',r);});if(code!==0)throw new Error(text.slice(-4000));return text;}
let server,browser,prisma;let serverLog='';let failure=null;const results=[];const stages=[],cleanupErrors=[],videoViewports=[],legalResults=[];
function evidence(){writeFileSync(resolve(output,'server.log'),serverLog);writeFileSync(resolve(output,'results.json'),JSON.stringify({mode:dev?'development':'production',outputDirectory:env.NEXT_OUTPUT_DIR||'.next',results,failure,stages,cleanupErrors,videoViewports,legalResults,externalIntegration:false,limitations:['Blob and Library registration protocol mocked; real storage/upload authentication NOT tested','Synthetic signed local admin session only','No external provider integration']},null,2));}
function stage(name){stages.push({name,time:new Date().toISOString()});evidence();console.log('EDITOR_STAGE '+name);}
async function cleanup(name,operation){try{await operation();}catch(error){cleanupErrors.push({name,message:error instanceof Error?error.message:String(error),time:new Date().toISOString()});}}

try{
 stage('postgres-initialise');await pg.initialise();stage('postgres-start');await pg.start();stage('database-create');await pg.createDatabase('inst_acessor_audit');stage('schema-diff');
 const sql=await run([resolve(require.resolve('prisma/package.json'),'../build/index.js'),'migrate','diff','--from-empty','--to-schema-datamodel','prisma/schema.prisma','--script']);
 stage('schema-apply-local');const c=new Client({connectionString:db});await c.connect();try{await c.query(sql);}finally{await c.end();}
 const {PrismaClient}=require('@prisma/client');prisma=new PrismaClient();
 stage('synthetic-user-create');const user=await prisma.user.create({data:{email:'admin@audit.invalid',name:'Editor fictício',role:'ADMIN',passwordHash:'synthetic-not-a-login-password',firstAccessCompleted:true,emailVerified:new Date()}});
 await prisma.userProfile.create({data:{userId:user.id,onboardingCompleted:true}});
 const {encode}=require('next-auth/jwt');const token=await encode({secret:env.NEXTAUTH_SECRET,token:{id:user.id,email:user.email,role:'ADMIN',authVersion:createHash('sha256').update(user.passwordHash).digest('hex')},maxAge:3600});
 const state=resolve(output,'synthetic-session.json');writeFileSync(state,JSON.stringify({cookies:[{name:'next-auth.session-token',value:token,domain:'127.0.0.1',path:'/',expires:Math.floor(Date.now()/1000)+3600,httpOnly:true,secure:false,sameSite:'Lax'}],origins:[]}));
 stage('server-port-probe');await new Promise((r,j)=>{const s=createServer();s.once('error',j);s.listen(httpPort,'127.0.0.1',()=>s.close(r));});
 stage('server-start');server=spawn(process.execPath,[resolve(require.resolve('next/package.json'),'../dist/bin/next'),dev?'dev':'start','--hostname','127.0.0.1','--port',String(httpPort)],{cwd:root,env:{...env,NODE_ENV:dev?'development':'production'},windowsHide:true});server.stdout.on('data',b=>serverLog+=b);server.stderr.on('data',b=>serverLog+=b);
 let ready=false;for(let i=0;i<90;i++){if(server.exitCode!==null)throw new Error('Isolated server stopped');if(serverLog.includes('Ready')){ready=true;break;}await new Promise(r=>setTimeout(r,1000));}if(!ready)throw new Error('Isolated server did not become ready within 90 seconds');
 stage('server-ready');
 if(process.platform==='win32')process.env.PLAYWRIGHT_BROWSERS_PATH='C:/Users/55819/AppData/Local/ms-playwright';
 stage('browser-launch');const {chromium,expect:baseExpect}=await import('@playwright/test');const expect=baseExpect.configure({timeout:30000});browser=await chromium.launch({headless:true});
 stage('browser-ready');
 // Anonymous public-document checks use a new context, never the synthetic editor session.
 const legalContext=await browser.newContext();
 await legalContext.route('**/*',route=>new URL(route.request().url()).origin===base?route.continue():route.abort());
 try{
  for(const [path,title] of [['/termos','Termos de uso'],['/privacidade','Privacidade'],['/data-deletion','Exclusão de dados']]){
   for(const [width,height] of [[320,568],[1440,900]]){
    stage('legal-'+path.slice(1)+'-'+width);const legalPage=await legalContext.newPage();await legalPage.setViewportSize({width,height});legalPage.setDefaultTimeout(30000);legalPage.setDefaultNavigationTimeout(dev?180000:90000);
    const pageErrors=[],apiCalls=[];legalPage.on('pageerror',e=>pageErrors.push(e.message));legalPage.on('request',r=>{const u=new URL(r.url());if(u.origin===base&&u.pathname.startsWith('/api/'))apiCalls.push(u.pathname);});
    const response=await legalPage.goto(base+path);expect(response.status()).toBe(200);expect(new URL(legalPage.url()).pathname).toBe(path);await expect(legalPage.getByRole('heading',{level:1,name:title,exact:true})).toBeVisible();
    await expect(legalPage.getByRole('heading',{level:2,name:'Versão para validação, com pendências',exact:true})).toBeVisible();await expect(legalPage.getByText(/O responsável legal e o canal oficial de atendimento ainda não foram definidos/)).toBeVisible();
    const legalNav=legalPage.getByRole('navigation',{name:'Documentos e informações sobre dados'});for(const [href,label] of [['/termos','Termos de uso'],['/privacidade','Privacidade'],['/data-deletion','Exclusão de dados']])await expect(legalNav.getByRole('link',{name:label,exact:true})).toHaveAttribute('href',href);
    await legalPage.keyboard.press('Tab');const skip=legalPage.getByRole('link',{name:'Ir para o conteúdo',exact:true});await expect(skip).toBeFocused();await expect(skip).toBeVisible();await legalPage.keyboard.press('Enter');await expect(legalPage).toHaveURL(base+path+'#conteudo-legal');await expect(legalPage.getByRole('main')).toBeVisible();
    expect(await legalPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1)).toBe(false);expect(pageErrors).toEqual([]);expect(apiCalls).toEqual([]);expect((await legalContext.cookies()).some(c=>c.name.includes('session-token'))).toBe(false);
    await legalPage.screenshot({path:resolve(output,'legal-'+path.slice(1)+'-'+width+'.png'),fullPage:true});legalResults.push({path,width,height,passed:true,anonymous:true,apiCalls,pageErrors,dbIndependence:'No browser API requests; absence of SSR database calls requires separate static review, not proven by a running database'});evidence();await legalPage.close();
   }
  }
 }finally{await legalContext.close();}
const fixturePage=await browser.newPage();const dataUrl=await fixturePage.evaluate(async()=>{const c=document.createElement('canvas');c.width=32;c.height=16;const x=c.getContext('2d');x.fillStyle='red';x.fillRect(0,0,16,16);x.fillStyle='blue';x.fillRect(16,0,16,16);const url=c.toDataURL('image/png');const image=await createImageBitmap(await (await fetch(url)).blob());if(image.width!==32||image.height!==16)throw new Error('PNG fixture decode failed');image.close();return url;});await fixturePage.close();const png=Buffer.from(dataUrl.split(',')[1],'base64');
 const clientPayload=Buffer.from(JSON.stringify({allowedContentTypes:['image/jpeg','image/png','video/mp4','video/quicktime'],maximumSizeInBytes:104857600,validUntil:Date.now()+3600000,addRandomSuffix:false})).toString('base64');
 const mockClientToken='vercel_blob_client_editor_'+Buffer.from('synthetic-signature.'+clientPayload).toString('base64');
 const waitSave=(page,method)=>page.waitForResponse(r=>r.url().includes('/api/drafts')&&r.request().method()===method,{timeout:30000}).catch(async error=>{throw new Error(method+' draft timeout: '+error.message+' UI: '+(await page.locator('body').innerText()).slice(-2500));});
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900]]){
  const ctx=await browser.newContext({viewport:{width,height},storageState:state});let writes=0;const files=new Map();const errors=[];let delayedSource=null,delayedLoads=0;
  await ctx.route('**/*',async route=>{const req=route.request(),url=new URL(req.url());
   if(url.origin===base&&url.pathname==='/api/upload/media'){return route.fulfill({json:{type:'blob.generate-client-token',clientToken:mockClientToken}});}
   if(url.origin===base&&url.pathname==='/api/media-library'&&req.method()==='GET')return route.fulfill({json:{items:[{id:'library-replacement',url:'https://fixture.public.blob.vercel-storage.com/inst-acessor/'+user.id+'/library-replacement.png',pathname:'inst-acessor/'+user.id+'/library-replacement.png',type:'IMAGE',mimeType:'image/png',size:png.length,originalName:'Library replacement fixture',title:null,createdAt:new Date().toISOString()}],nextCursor:null}});
   if(url.origin===base&&url.pathname==='/api/media-library'&&req.method()==='POST')return route.fulfill({json:{ok:true,mockedRegistration:true}});
   if(url.origin===base)return route.continue();
   // Protocol mock only: no real Blob token, SDK request, storage account or external socket.
   if(req.method()==='PUT'&&url.hostname==='vercel.com'&&url.pathname==='/api/blob/'){const pathname=url.searchParams.get('pathname')||decodeURIComponent(url.pathname.slice(1));const body=req.postDataBuffer()||png;files.set(pathname,body);writes++;return route.fulfill({headers:{'access-control-allow-origin':base},json:{url:`https://fixture.public.blob.vercel-storage.com/${pathname}`,downloadUrl:`https://fixture.public.blob.vercel-storage.com/${pathname}`,pathname,contentType:pathname.endsWith('.mp4')?'video/mp4':'image/jpeg',contentDisposition:'inline',etag:'fixture'}});}
   if(url.href===delayedSource){delayedLoads++;await new Promise(r=>setTimeout(r,700));}
   if(url.hostname==='fixture.public.blob.vercel-storage.com')return route.fulfill({headers:{'access-control-allow-origin':'*'},contentType:url.pathname.endsWith('.mp4')?'video/mp4':'image/jpeg',body:files.get(decodeURIComponent(url.pathname.slice(1)))||png});
   if(req.method()==='OPTIONS'&&url.hostname==='vercel.com'&&url.pathname.startsWith('/api/blob'))return route.fulfill({status:204,headers:{'access-control-allow-origin':base,'access-control-allow-methods':'PUT,GET,OPTIONS','access-control-allow-headers':'*'}});
   return route.abort();
  });
  const page=await ctx.newPage();page.setDefaultTimeout(30000);page.setDefaultNavigationTimeout(dev?180000:90000);page.on('pageerror',e=>errors.push(e.message));stage('navigation-'+width);await page.goto(base+'/preview-social');stage('navigation-ready-'+width);
  await page.getByRole('button',{name:'Carrossel',exact:true}).click();await page.locator('input[type=file]').first().setInputFiles([1,2,3,4,5,6,7].map(n=>({name:`fixture-${n}.png`,mimeType:'image/png',buffer:png})));
  await expect(page.getByText(/7 imagens.*ordem/)).toBeVisible();await page.getByLabel('Rotação',{exact:true}).evaluate(el=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,'90');el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));});await page.getByLabel('Proporção da mídia').selectOption('1:1');
  const saved=waitSave(page,'POST');await page.getByRole('button',{name:/Salvar rascunho/i}).click();const response=await saved;expect(response.status()).toBe(200);const {draft}=await response.json();const project=JSON.parse(draft.framing);expect(project.slides.length).toBe(7);expect(project.slides[6].rotation).toBe(90);expect(project.slides[0].rotation).toBe(0);expect(writes).toBe(14);
  await page.reload();await page.getByRole('tab',{name:/Rascunhos/}).click();await page.getByRole('button',{name:'Abrir',exact:true}).first().click();await expect(page.getByText(/7 imagens.*ordem/)).toBeVisible();await expect(page.getByLabel('Proporção da mídia')).toHaveValue('1:1');
  await page.getByRole('button',{name:'Limpar',exact:true}).click();await expect(page.getByLabel('Proporção da mídia')).toHaveValue('4:5');
  await page.getByRole('tab',{name:/Rascunhos/}).click();await page.getByRole('button',{name:'Abrir',exact:true}).first().click();await expect(page.getByText(/7 imagens.*ordem/)).toBeVisible();
  const patched=waitSave(page,'PATCH');await page.getByRole('button',{name:/Salvar rascunho/i}).click();const patchResponse=await patched;expect(patchResponse.status()).toBe(200);const patchBody=await patchResponse.json();expect(patchBody.draft.id).toBe(draft.id);expect(JSON.parse(patchBody.draft.framing).slides.map(s=>s.id)).toEqual(project.slides.map(s=>s.id));expect(await prisma.socialDraft.count({where:{userId:user.id}})).toBe(1);
  if(width===390){
   const firstThumbnail=page.getByRole('button',{name:'Mover para a esquerda',exact:true}).first().locator('xpath=../..');const coverUrl=await firstThumbnail.locator('img').getAttribute('src');
   await page.getByRole('button',{name:'Mover para a esquerda',exact:true}).nth(1).locator('xpath=../..').click({position:{x:30,y:20}});
   await page.getByRole('button',{name:'Substituir pela Biblioteca',exact:true}).click();await page.getByRole('button',{name:'Library replacement fixture',exact:true}).click();await page.getByRole('button',{name:'Usar mídia',exact:true}).click();
   await expect(page.getByText(/7 imagens.*ordem/)).toBeVisible();await expect(firstThumbnail.locator('img')).toHaveAttribute('src',coverUrl);await expect(page.getByAltText('Preview da mídia',{exact:true})).toHaveAttribute('src',coverUrl);
   await expect(page.getByRole('button',{name:'Mover para a esquerda',exact:true}).nth(1).locator('xpath=../..').locator('img')).toHaveAttribute('src',/library-replacement\.png$/);stage('library-replace-second-preserves-cover');
  }
  let videoResult={state:'not-run-in-this-viewport'};
  if(width===390){
   const fixture=await page.evaluate(async()=>{const mime=['video/mp4;codecs=avc1.42E01E','video/mp4'].find(m=>MediaRecorder.isTypeSupported(m));if(!mime)return null;const canvas=document.createElement('canvas');canvas.width=96;canvas.height=128;const ctx=canvas.getContext('2d');const stream=canvas.captureStream(15);const chunks=[];const recorder=new MediaRecorder(stream,{mimeType:mime});recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};const stopped=new Promise(r=>recorder.onstop=r);recorder.start();const begin=performance.now();await new Promise(resolve=>{function draw(){ctx.fillStyle='red';ctx.fillRect(0,0,48,128);ctx.fillStyle='blue';ctx.fillRect(48,0,48,128);if(performance.now()-begin<1600)requestAnimationFrame(draw);else resolve();}draw();});recorder.stop();await stopped;stream.getTracks().forEach(t=>t.stop());const blob=new Blob(chunks,{type:'video/mp4'});return {bytes:Array.from(new Uint8Array(await blob.arrayBuffer()))};});
   if(!fixture){videoResult={state:'blocked',reason:'Browser cannot generate a real MP4 fixture; no fake extension used'};}
   else{
    await page.getByRole('button',{name:'Limpar',exact:true}).click();await page.getByRole('button',{name:'Reel',exact:true}).click();
    await page.locator('input[type=file]').first().setInputFiles({name:'original-A.mp4',mimeType:'video/mp4',buffer:Buffer.from(fixture.bytes)});
    // A failed metadata import must not make the unchanged parent impossible to save.
    await page.getByLabel('Importar MP4/MOV').setInputFiles({name:'invalid.mp4',mimeType:'video/mp4',buffer:Buffer.from('invalid fixture, deliberately not a movie')});
    await expect(page.getByText('Vídeo incompatível, inacessível ou sem permissão CORS.',{exact:true})).toBeVisible();
    const savedOriginal=waitSave(page,'POST');await page.getByRole('button',{name:/Salvar rascunho/i}).click();const originalResponse=await savedOriginal;expect(originalResponse.status()).toBe(200);
    stage('invalid-import-preserves-parent-save');
    await page.getByRole('button',{name:'Limpar',exact:true}).click();await page.getByRole('button',{name:'Reel',exact:true}).click();
    await page.locator('input[type=file]').first().setInputFiles({name:'original-A.mp4',mimeType:'video/mp4',buffer:Buffer.from(fixture.bytes)});
    let forbiddenMutations=0;const mutationObserver=request=>{const u=new URL(request.url());if(u.origin===base&&request.method()==='POST'&&['/api/drafts','/api/calendar','/api/calendar/schedule-from-draft','/api/publishing'].includes(u.pathname))forbiddenMutations++;};page.on('request',mutationObserver);
    await page.getByLabel('Importar MP4/MOV').setInputFiles({name:'synthetic-colors.mp4',mimeType:'video/mp4',buffer:Buffer.from(fixture.bytes)});
    await expect(page.getByRole('region',{name:'Editor de vídeo'}).getByRole('button',{name:'Salvar projeto editável',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:/Salvar rascunho/i}).click();await expect(page.getByText('Salve o projeto de vídeo ou exporte as edições antes de salvar o rascunho.')).toBeVisible();expect(forbiddenMutations).toBe(0);
    await page.getByPlaceholder('Escreva a legenda ou gere com IA. Você pode editar livremente depois.').fill('Conteúdo sintético pendente B');await page.getByRole('button',{name:'Programar publicação',exact:true}).click();await page.locator('input[type=datetime-local]').fill('2030-01-01T12:00');await page.getByRole('button',{name:'Programar',exact:true}).click();await expect(page.getByText('Exporte novamente o projeto de vídeo antes de programar.')).toBeVisible();expect(forbiddenMutations).toBe(0);await page.getByRole('button',{name:'Cancelar',exact:true}).click();page.off('request',mutationObserver);

    const videoEditor=page.getByRole('region',{name:'Editor de vídeo'});await expect(videoEditor.getByRole('button',{name:'Salvar projeto editável',exact:true})).toBeEnabled();
    const projectDownload=page.waitForEvent('download',{timeout:20000});await videoEditor.getByRole('button',{name:'Salvar projeto editável',exact:true}).click();const downloaded=await projectDownload;const videoJson=resolve(output,'synthetic-video-project.json');await downloaded.saveAs(videoJson);
    await page.getByLabel('Reabrir projeto JSON').setInputFiles(videoJson);await expect(page.getByText('Projeto reaberto. Exporte novamente para usar o vídeo final.')).toBeVisible();
    const originalProject=JSON.parse(readFileSync(videoJson,'utf8'));
    const duplicate={...originalProject,layout:'side-by-side',clips:[originalProject.clips[0],{...originalProject.clips[0],id:'duplicate-source'}]};
    await page.getByLabel('Reabrir projeto JSON').setInputFiles({name:'duplicate.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(duplicate))});
    await expect(videoEditor.getByText('Para tela dividida, selecione dois arquivos distintos.',{exact:true})).toBeVisible();
    await expect(videoEditor.getByLabel(/^Layout/)).toHaveValue('sequence');stage('duplicate-source-import-rejected');
    const source=originalProject.clips[0];const secondUrl=new URL(source.url);secondUrl.pathname=secondUrl.pathname.replace(/[^/]+$/,'delayed-second.mp4');
    files.set(decodeURIComponent(secondUrl.pathname.slice(1)),Buffer.from(fixture.bytes));delayedSource=secondUrl.href;
    const sequence={...originalProject,clips:[{...source,start:0,end:0.5,zoom:3,x:0.5},{...source,id:'second-delayed',url:secondUrl.href,start:0,end:Math.min(source.duration,1.5),zoom:3,x:-0.5}]};
    await page.getByLabel('Reabrir projeto JSON').setInputFiles({name:'sequence.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(sequence))});
    await expect(videoEditor.locator('ol > li')).toHaveCount(2);
    await videoEditor.getByRole('button',{name:'Reproduzir prévia',exact:true}).click();
    await expect.poll(async()=>page.getByLabel('Prévia da composição de vídeo').evaluate(c=>{const x=c.getContext('2d');const p=x.getImageData(c.width/2,c.height/2,1,1).data;return p[2]>180&&p[0]<80;}),{timeout:10000,intervals:[50]}).toBe(true);
    expect(delayedLoads).toBe(1);stage('playback-load-survives-timeline-ticks');
    await page.getByLabel('Reabrir projeto JSON').setInputFiles(videoJson);
    await expect(videoEditor.locator('ol > li')).toHaveCount(1);delayedSource=null;
    await expect(videoEditor.getByRole('button',{name:'Exportar vídeo e capa',exact:true})).toBeEnabled();
    const downloads=[];page.on('download',d=>downloads.push(d.suggestedFilename()));await videoEditor.getByRole('button',{name:'Exportar vídeo e capa',exact:true}).click();await expect(page.getByText(/MP4 e capa exportados|Vídeo WebM e capa exportados/)).toBeVisible({timeout:30000});expect(downloads.some(name=>name.endsWith('.jpg'))).toBe(true);
    if(await page.getByText(/MP4 e capa exportados/).count()){
     const savedVideo=waitSave(page,'POST');await page.getByRole('button',{name:/Salvar rascunho/i}).click();const savedVideoResponse=await savedVideo;expect(savedVideoResponse.status()).toBe(200);const {draft:videoDraft}=await savedVideoResponse.json();const videoEnvelope=JSON.parse(videoDraft.framing);expect(videoEnvelope.videoRendered).toBe(true);expect(JSON.parse(videoEnvelope.videoProject).clips.length).toBe(1);
     await page.reload();await page.getByRole('tab',{name:/Rascunhos/}).click();await page.getByRole('button',{name:'Abrir',exact:true}).first().click();await expect(page.getByLabel('Prévia da composição de vídeo')).toBeVisible();videoResult={state:'passed',scope:'Pending local edit blocks saving/scheduling stale original A; MP4 import, durable project mock, JSON reopen, real export, draft persist/reopen',downloads};
    }else{videoResult={state:'partial',scope:'MP4 import and project reopen; actual WebM download only',downloads};}
    for(const [vw,vh] of [[320,568],[360,800],[390,844],[412,915],[768,1024],[1024,768],[1280,720],[1440,900],[1920,1080],[568,320],[800,360],[844,390],[915,412]]){
     stage('video-viewport-'+vw+'x'+vh);await page.setViewportSize({width:vw,height:vh});await expect(page.getByLabel('Prévia da composição de vídeo')).toBeVisible();await expect(page.getByRole('button',{name:'Exportar vídeo e capa',exact:true})).toBeVisible();
     const observation=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,offenders:[...document.querySelectorAll('main *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>innerWidth+1&&getComputedStyle(e).position!=='absolute';}).slice(0,8).map(e=>({tag:e.tagName,text:e.textContent?.trim().slice(0,80)}))}));
     videoViewports.push({width:vw,height:vh,...observation});await page.screenshot({path:resolve(output,'video-'+vw+'x'+vh+'.png'),fullPage:true});evidence();expect(observation.overflow).toBe(false);
    }
    await page.setViewportSize({width:390,height:844});

   }
  }
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);expect(overflow).toBe(false);expect(errors).toEqual([]);await page.screenshot({path:resolve(output,`${width}.png`),fullPage:true});
  results.push({width,height,passed:true,draftId:draft.id,slides:7,blob:'mocked protocol',writes,video:videoResult});await ctx.close();await prisma.socialDraft.deleteMany({where:{userId:user.id}});
 }
 console.log('Editor isolated UI completed.');
}catch(error){failure=error instanceof Error?error.message:String(error);try{evidence();}catch(logError){console.error('Evidence write failed before cleanup:',logError.message);}throw error;}finally{
 await cleanup('browser-close',async()=>{await browser?.close();});
 await cleanup('owned-server-stop',async()=>{if(!server)return;server.kill();await new Promise(r=>{if(server.exitCode!==null)return r();server.once('exit',r);setTimeout(r,5000);});});
 await cleanup('prisma-disconnect',async()=>{await prisma?.$disconnect();});
 await cleanup('owned-postgres-stop',async()=>{await pg.stop();});
 await cleanup('evidence-write',async()=>{evidence();});
 if(!failure&&cleanupErrors.length)throw new Error('Editor checks finished but cleanup failed: '+cleanupErrors.map(e=>e.name+': '+e.message).join('; '));
}
