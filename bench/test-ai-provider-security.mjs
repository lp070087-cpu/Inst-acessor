import assert from 'node:assert/strict';
import { OpenAIProvider } from '../src/lib/ai/openai.ts';
import { GeminiProvider } from '../src/lib/ai/gemini.ts';
import { AIProviderError } from '../src/lib/ai/provider.ts';

// Transport is entirely replaced. No key, account, database or paid call is used.
const originalFetch=globalThis.fetch;
const secret='fixture-private-key-never-real',privateText='fixture-private-prompt';
const opts={messages:[{role:'user',content:privateText}],maxTokens:100};
let checks=0;
function check(value,label){assert.ok(value,label);checks++;console.log('ok '+label);}
try {
  for(const [name,Provider,success] of [
    ['openai',OpenAIProvider,{choices:[{message:{content:'Resposta fictícia'}}]}],
    ['gemini',GeminiProvider,{candidates:[{content:{parts:[{text:'Resposta fictícia'}]}}]}],
  ]){
    const provider=new Provider(secret,'fixture-model');let calls=0;
    globalThis.fetch=async(url,init)=>{
      calls++;
      const target=new URL(url);
      check(!target.href.includes(secret)&&!target.searchParams.has('key'),name+' key is absent from URL');
      check((name==='gemini'?init.headers['x-goog-api-key']:init.headers.Authorization)===(name==='gemini'?secret:'Bearer '+secret),name+' authenticates by header');
      check(init.redirect==='error'&&init.cache==='no-store',name+' rejects redirects and response caching');
      return new Response(JSON.stringify(success),{status:200});
    };
    check(await provider.complete(opts)==='Resposta fictícia',name+' successful text contract preserved');
    check(calls===1,name+' makes one request without retry');
    calls=0;
    globalThis.fetch=async()=>{calls++;throw new Error('unexpected request');};
    await assert.rejects(new Provider('','fixture-model').complete(opts),AIProviderError);checks++;
    check(calls===0,name+' empty key fails before transport');
    for(const status of [400,401,429,503]){
      globalThis.fetch=async()=>new Response(JSON.stringify({error:{message:secret+' '+privateText}}),{status});
      await assert.rejects(provider.complete(opts),error=>{
        check(error instanceof AIProviderError&&error.status===status,name+' HTTP '+status+' remains typed');
        check(!error.message.includes(secret)&&!error.message.includes(privateText),name+' HTTP '+status+' excludes provider body');
        check(error.code===(status===429?'rate_limit':'http'),name+' HTTP '+status+' preserves category');
        return true;
      });
    }
    globalThis.fetch=async()=>{throw new Error('Transport reflected '+secret+' '+privateText);};
    await assert.rejects(provider.complete(opts),error=>error instanceof AIProviderError&&!error.message.includes(secret)&&!error.message.includes(privateText));checks++;
    globalThis.fetch=async()=>new Response(secret+' '+privateText,{status:200});
    await assert.rejects(provider.complete(opts),error=>error instanceof AIProviderError&&!error.message.includes(secret)&&!error.message.includes(privateText));checks++;
    globalThis.fetch=async()=>new Response('{}',{status:200});
    await assert.rejects(provider.complete(opts),error=>error instanceof AIProviderError&&error.code==='empty');checks++;
  }
} finally { globalThis.fetch=originalFetch; }
console.log(`${checks} AI provider security assertions passed; mocked transport only`);
