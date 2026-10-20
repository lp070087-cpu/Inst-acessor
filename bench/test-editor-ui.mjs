/** Requires an already running isolated server and synthetic session; never starts services. */
process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'C:/Users/55819/AppData/Local/ms-playwright';
const { chromium, expect } = await import('@playwright/test');
import { resolve, relative } from 'node:path';
import { mkdirSync, writeFileSync } from 'node:fs';
const root=resolve(import.meta.dirname,'..');
const base=new URL(process.env.EDITOR_TEST_URL||'http://127.0.0.1:3107');
if(base.hostname!=='127.0.0.1'||!['3107','3110'].includes(base.port)||process.env.EDITOR_TEST_ISOLATED!=='true')throw new Error('Explicit isolated local target required');
const state=resolve(process.env.EDITOR_TEST_STORAGE_STATE||'');
if(!process.env.EDITOR_TEST_STORAGE_STATE||relative(root,state).startsWith('..'))throw new Error('Synthetic storageState inside worktree required');
const output=resolve(root,'outputs/verification/editor-ui');mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true});const results=[];
try{
 for(const [width,height] of [[320,568],[390,844],[768,1024],[1440,900]]){
  const context=await browser.newContext({viewport:{width,height},storageState:state});
  const rejected=[];
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===base.origin)return route.continue();rejected.push(url.origin);return route.abort();});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(new URL('/preview-social',base).href);
  await expect(page.getByRole('button',{name:'Carrossel',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Carrossel',exact:true}).click();
  const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
  await page.locator('input[type=file]').first().setInputFiles([1,2,3].map(i=>({name:`fixture-${i}.png`,mimeType:'image/png',buffer:png})));
  await expect(page.getByText(/3 imagens.*ordem/)).toBeVisible();
  await page.getByRole('button',{name:'Substituir mídia selecionada',exact:true}).click({noWaitAfter:true});
  await page.locator('input[type=file]').first().setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:png});
  await expect(page.getByText(/3 imagens.*ordem/)).toBeVisible();
  await page.getByLabel('Rotação',{exact:true}).fill('90');
  await page.getByLabel('Proporção da mídia').selectOption('1:1');
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
  expect(overflow).toBe(false);expect(errors).toEqual([]);
  await page.screenshot({path:resolve(output,`${width}.png`),fullPage:true});
  results.push({width,height,passed:true,externalRequestsBlocked:rejected,scope:'multiple image import, active replacement preserves count, rotation, ratio, overflow'});
  await context.close();
 }
}finally{await browser.close();writeFileSync(resolve(output,'results.json'),JSON.stringify({results,pending:['Persist/reopen with local Blob protocol mock','Cancel upload before draft write','Server ownership rejection','Rendered JPEG pixel comparison']},null,2));}
