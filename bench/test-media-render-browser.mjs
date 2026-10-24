import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
const root = resolve(import.meta.dirname, '..');
if (process.platform === 'win32') process.env.PLAYWRIGHT_BROWSERS_PATH ??= 'C:/Users/55819/AppData/Local/ms-playwright';
const { chromium } = await import('@playwright/test');
const output = resolve(root,'outputs/editor-validation'); mkdirSync(output,{recursive:true});
const modules = Object.fromEntries(['video-project','video-renderer','image-export','image-crop'].map(name=>[
  `/${name}.js`,ts.transpileModule(readFileSync(resolve(root,`src/lib/media-editor/${name}.ts`),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace('"./video-project"','"/video-project.js"').replace('"./image-crop"','"/image-crop.js"')
]));
const browser=await chromium.launch({headless:true});
const evidence={browser:browser.version(),status:'running',assertions:[],errors:[]};
try {
  const context=await browser.newContext();
  await context.route('**/*',route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://editor.invalid') return route.abort();
    return route.fulfill({contentType:modules[url.pathname]?'text/javascript':'text/html',body:modules[url.pathname]??'<!doctype html><html lang="pt-BR"><title>Bancada local do editor</title><body><h1>Teste local de exportação</h1></body></html>'});
  });
  const page=await context.newPage();page.on('pageerror',error=>evidence.errors.push(error.message));
  await page.goto('http://editor.invalid');
  const results=await page.evaluate(async()=>{
    const {exportEditedImage}=await import('/image-export.js');
    const {emptyVideoProject}=await import('/video-project.js');
    const {drawVideoFrame,renderVideo,loadVideo,seekFrame}=await import('/video-renderer.js');
    const results=[];
    const check=(name,pass)=>{if(!pass)throw new Error(name);results.push(name);};
    const show=(label,canvas)=>{const figure=document.createElement('figure');const caption=document.createElement('figcaption');caption.textContent=label;canvas.style.maxWidth='240px';canvas.style.maxHeight='300px';figure.append(caption,canvas);document.body.append(figure);};
    const source=document.createElement('canvas');source.width=200;source.height=200;
    const ctx=source.getContext('2d');ctx.fillStyle='#ff0000';ctx.fillRect(0,0,100,200);ctx.fillStyle='#0000ff';ctx.fillRect(100,0,100,200);
    const original=source.toDataURL('image/png');
    const slide={id:'fixture',originalUrl:original,type:'image',framing:{zoom:1,offsetX:0,offsetY:0},rotation:0,brightness:1,contrast:1};
    const decode=async(file)=>{const bitmap=await createImageBitmap(file);const c=document.createElement('canvas');c.width=bitmap.width;c.height=bitmap.height;c.getContext('2d').drawImage(bitmap,0,0);bitmap.close();return c;};
    const pixel=(c,x,y)=>Array.from(c.getContext('2d').getImageData(x,y,1,1).data);
    // Exportação em pixels nativos da área recortada, dentro de 320–1440 px (limites do Instagram).
    const at=(c,fx,fy)=>pixel(c,Math.round(c.width*fx),Math.round(c.height*fy));
    const edited=await decode(await exportEditedImage(slide,1));
    check('JPEG output raised to the 320px platform minimum, 1:1',edited.width===320&&edited.height===320);
    check('Original asymmetric pixels preserved without edit',at(edited,0.1,0.5)[0]>220&&at(edited,0.9,0.5)[2]>220);
    const rotated=await decode(await exportEditedImage({...slide,rotation:180},1));
    check('Rotation changes actual exported pixels',at(rotated,0.1,0.5)[2]>220&&at(rotated,0.9,0.5)[0]>220);
    const dark=await decode(await exportEditedImage({...slide,brightness:0.5},4/5));
    check('Brightness changes actual bytes and ratio',at(dark,0.1,0.5)[0]<160&&dark.width===320&&dark.height===400);
    const zoom=await decode(await exportEditedImage({...slide,framing:{zoom:2,offsetX:0.4,offsetY:0}},9/16));
    check('Crop zoom and position exported',Math.abs(zoom.width/zoom.height-9/16)<0.005&&at(zoom,0.83,0.26)[0]>220);
    check('Original canvas not destroyed',source.toDataURL('image/png')===original);
    show('Original',source);show('JPEG exportado',edited);show('Rotação exportada',rotated);show('Brilho exportado',dark);show('Recorte exportado',zoom);
    // Generate two real, small, local video fixtures, never network media.
    const fixture=async(color)=>{
      const c=document.createElement('canvas');c.width=160;c.height=160;const x=c.getContext('2d');x.fillStyle=color;x.fillRect(0,0,160,160);
      const stream=c.captureStream(10);const mime=['video/mp4','video/webm;codecs=vp8','video/webm'].find(m=>MediaRecorder.isTypeSupported(m));
      const recorder=new MediaRecorder(stream,{mimeType:mime});const chunks=[];
      const done=new Promise(resolve=>{recorder.ondataavailable=e=>chunks.push(e.data);recorder.onstop=()=>resolve(new Blob(chunks,{type:mime}));});recorder.start();
      const animation=setInterval(()=>x.fillRect(0,0,160,160),40);
      await new Promise(resolve=>setTimeout(resolve,1000));clearInterval(animation);recorder.stop();const blob=await done;stream.getTracks().forEach(t=>t.stop());return URL.createObjectURL(blob);
    };
    const red=await fixture('#ff0000'),blue=await fixture('#0000ff');
    const a=await loadVideo(red),b=await loadVideo(blue);const maps=new Map([[red,a],[blue,b]]);
    // Some recorded containers report Infinity until first seek; fixtures are known600ms.
    const clip=(id,url)=>({id,url,name:id,duration:0.5,start:0,end:0.4,zoom:1,x:0,y:0,volume:0,offset:0});
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=160;
    for(const layout of ['side-by-side','stacked','picture-in-picture']){
      const p={...emptyVideoProject(),ratio:'1:1',layout,clips:[clip('a',red),clip('b',blue)]};drawVideoFrame(canvas,p,maps,0.1);
      const first=layout==='stacked'?pixel(canvas,80,30):pixel(canvas,30,80);
      const second=layout==='stacked'?pixel(canvas,80,130):layout==='picture-in-picture'?pixel(canvas,130,30):pixel(canvas,130,80);
      check(`${layout} draws independent video pixels`,first[0]>180&&second[2]>180);
      const copy=document.createElement('canvas');copy.width=160;copy.height=160;copy.getContext('2d').drawImage(canvas,0,0);show(layout,copy);
      const out=await renderVideo(p,{signal:new AbortController().signal,onProgress:()=>{}});
      const outUrl=URL.createObjectURL(out.file),outVideo=await loadVideo(outUrl);await seekFrame(outVideo,0.1);
      const rendered=document.createElement('canvas');rendered.width=160;rendered.height=160;rendered.getContext('2d').drawImage(outVideo,0,0,160,160);
      const one=layout==='stacked'?pixel(rendered,80,30):pixel(rendered,30,80);
      const two=layout==='stacked'?pixel(rendered,80,130):layout==='picture-in-picture'?pixel(rendered,130,30):pixel(rendered,130,80);
      check(`${layout} exported file matches composite`,one[0]>180&&two[2]>180);
      outVideo.removeAttribute('src');outVideo.load();URL.revokeObjectURL(outUrl);
    }
    const p={...emptyVideoProject(),ratio:'1:1',clips:[clip('a',red)]};
    const exported=await renderVideo(p,{signal:new AbortController().signal,onProgress:()=>{}});
    check('Video export produces real playable file',exported.file.size>200&&['video/mp4','video/webm'].includes(exported.file.type));
    check('Cover export produces JPEG',exported.cover.type==='image/jpeg'&&exported.cover.size>100);
    const url=URL.createObjectURL(exported.file),video=await loadVideo(url);
    check('Export decodes with final dimensions',video.videoWidth===720&&video.videoHeight===720);
    await seekFrame(video,0.1);const f=document.createElement('canvas');f.width=160;f.height=160;f.getContext('2d').drawImage(video,0,0,160,160);
    check('Exported video contains expected pixels',pixel(f,80,80)[0]>180);
    const abort=new AbortController();abort.abort();let cancelled=false;
    try{await renderVideo(p,{signal:abort.signal,onProgress:()=>{}});}catch{cancelled=true;}
    check('Cancelled export never returns success',cancelled);
    // Boundary cover must use the final visible frame, never time === duration
    // (which has no active clips). Decode the real JPEG rather than mocking canvas.
    const boundary=await renderVideo({...p,coverTime:0.4},{signal:new AbortController().signal,onProgress:()=>{}});
    const boundaryCover=await decode(boundary.cover);
    check('Cover at duration uses the final visible frame',pixel(boundaryCover,360,360)[0]>180);

    // Cancel after the real recorder has emitted progress; a pre-aborted signal
    // alone cannot prove that live recording and decoder resources are stopped.
    const during=new AbortController();let reachedProgress=false,cancelError;
    try {
      await renderVideo(p,{signal:during.signal,onProgress:value=>{if(value>=10&&value<100){reachedProgress=true;during.abort();}}});
    } catch(error) { cancelError=error; }
    check('Cancellation is requested after recording starts',reachedProgress);
    check('In-progress cancellation never returns a successful file',cancelError?.name==='AbortError');

    // Real synthetic tone, real encoded source, real renderer and audio decode.
    // Codec/autoplay failures must fail the test, never become an approved skip.
    const toneContext=new AudioContext();let toneUrl;
    let audioEvidence;
    try {
      await toneContext.resume();
      if(toneContext.state!=='running')throw new Error('AudioContext was denied; audio validation is not approved.');
      const toneDestination=toneContext.createMediaStreamDestination();
      const oscillator=toneContext.createOscillator(),sourceGain=toneContext.createGain();
      oscillator.frequency.value=440;sourceGain.gain.value=0.2;oscillator.connect(sourceGain).connect(toneDestination);
      const toneCanvas=document.createElement('canvas');toneCanvas.width=160;toneCanvas.height=160;
      const tonePaint=toneCanvas.getContext('2d');tonePaint.fillStyle='#00ff00';tonePaint.fillRect(0,0,160,160);
      const toneStream=toneCanvas.captureStream(20);
      for(const track of toneDestination.stream.getAudioTracks())toneStream.addTrack(track);
      const sourceMime=['video/mp4;codecs=avc1.42E01E,mp4a.40.2','video/webm;codecs=vp8,opus','video/webm;codecs=vp9,opus'].find(value=>MediaRecorder.isTypeSupported(value));
      if(!sourceMime)throw new Error('No source encoder supports audio; audio validation is not approved.');
      let sourceRecorder,animation;
      let toneBlob;
      try {
        sourceRecorder=new MediaRecorder(toneStream,{mimeType:sourceMime});const pieces=[];
        const recorded=new Promise((resolve,reject)=>{
          sourceRecorder.ondataavailable=event=>{if(event.data.size)pieces.push(event.data);};
          sourceRecorder.onerror=()=>reject(new Error('Synthetic audio/video encoding failed.'));
          sourceRecorder.onstop=()=>resolve(new Blob(pieces,{type:sourceMime.split(';')[0]}));
        });
        void recorded.catch(()=>{});oscillator.start();sourceRecorder.start(100);
        animation=setInterval(()=>tonePaint.fillRect(0,0,160,160),40);
        await new Promise(resolve=>setTimeout(resolve,1500));sourceRecorder.stop();toneBlob=await recorded;
      } finally {
        if(animation)clearInterval(animation);
        if(sourceRecorder&&sourceRecorder.state!=='inactive')sourceRecorder.stop();
        try{oscillator.stop();}catch{}oscillator.disconnect();sourceGain.disconnect();
        toneStream.getTracks().forEach(track=>track.stop());
      }
      const amplitude=async blob=>{
        let buffer;
        try{buffer=await toneContext.decodeAudioData(await blob.arrayBuffer());}
        catch{throw new Error(`Audio decode unsupported for ${blob.type}; volume validation is not approved.`);}
        const margin=Math.round(buffer.sampleRate*0.12),start=Math.min(margin,Math.floor(buffer.length/4)),end=buffer.length-start;
        if(end<=start||buffer.numberOfChannels<1)throw new Error('Decoded audio has no usable samples.');
        let energy=0,count=0;
        for(let channel=0;channel<buffer.numberOfChannels;channel++){const samples=buffer.getChannelData(channel);for(let i=start;i<end;i++){energy+=samples[i]*samples[i];count++;}}
        return Math.sqrt(energy/count);
      };
      const sourceRms=await amplitude(toneBlob);
      check('Synthetic audio source decodes to a non-silent real tone',sourceRms>0.02);
      toneUrl=URL.createObjectURL(toneBlob);
      const toneClip={...clip('tone',toneUrl),duration:1.5,end:1,volume:1};
      const loud=await renderVideo({...emptyVideoProject(),ratio:'1:1',clips:[toneClip]},{signal:new AbortController().signal,onProgress:()=>{}});
      const muted=await renderVideo({...emptyVideoProject(),ratio:'1:1',clips:[{...toneClip,volume:0}]},{signal:new AbortController().signal,onProgress:()=>{}});
      const loudRms=await amplitude(loud.file),mutedRms=await amplitude(muted.file);
      check('Volume one exports a decoded non-silent audio track',loudRms>0.02);
      check('Volume zero exports at least 95 percent lower audio amplitude',mutedRms<loudRms*0.05);
      audioEvidence={sourceMime,outputMime:loud.file.type,sourceRms,loudRms,mutedRms,ratio:mutedRms/loudRms};
    } finally {
      if(toneUrl)URL.revokeObjectURL(toneUrl);
      if(toneContext.state!=='closed')await toneContext.close();
    }
    for(const v of [a,b,video]){v.pause();v.removeAttribute('src');v.load();}for(const u of [red,blue,url])URL.revokeObjectURL(u);
    document.body.style.cssText='display:flex;flex-wrap:wrap;gap:16px;font-family:system-ui;background:#f7f8fa;color:#111318';
    return {assertions:results,audio:audioEvidence,outputType:exported.file.type,video:Array.from(new Uint8Array(await exported.file.arrayBuffer())),cover:Array.from(new Uint8Array(await exported.cover.arrayBuffer())),image:Array.from(new Uint8Array(await (await exportEditedImage({...slide,rotation:180},1)).arrayBuffer()))};
  });
  evidence.assertions=results.assertions;evidence.videoType=results.outputType;evidence.audio=results.audio;assert.equal(evidence.errors.length,0);
  writeFileSync(resolve(output,results.outputType==='video/mp4'?'fixture-export.mp4':'fixture-export.webm'),Buffer.from(results.video));
  writeFileSync(resolve(output,'fixture-cover.jpg'),Buffer.from(results.cover));writeFileSync(resolve(output,'fixture-edited.jpg'),Buffer.from(results.image));
  await page.screenshot({path:resolve(output,'render-fixture.png')});
  evidence.status='approved';
  console.log(`${results.assertions.length} browser media rendering assertions passed (${results.outputType})`);
} catch(error) {
  evidence.status='failed';evidence.failure=error instanceof Error?error.message:'Media validation failed';
  throw error;
} finally {writeFileSync(resolve(output,'render-results.json'),JSON.stringify(evidence,null,2));await browser.close();}
