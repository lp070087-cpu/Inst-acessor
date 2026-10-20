import assert from 'node:assert/strict';
import { normalizeTikTokCreatorInfo, tiktokPublishingIssue, tiktokContentBinding, hasTikTokPublishScope, isVerifiedTikTokMediaUrl, queryTikTokCreatorInfo } from '../src/lib/integrations/tiktok/creator-info.ts';
import { buildTikTokPostBody } from '../src/lib/publishing/media.ts';

let checks=0;
function check(value,label){assert.ok(value,label);checks++;console.log('ok '+label);}
const now=Date.parse('2026-10-19T12:00:00Z');
const envelope={error:{code:'ok'},data:{creator_nickname:'Criador fictício',creator_username:'fixture',privacy_level_options:['SELF_ONLY','MUTUAL_FOLLOW_FRIENDS'],comment_disabled:true,duet_disabled:false,stitch_disabled:true,max_video_post_duration_sec:30}};
const creator=normalizeTikTokCreatorInfo(envelope,'account-fixture',false,now);
check(creator.privacyOptions.length===1&&creator.privacyOptions[0]==='SELF_ONLY','Unaudited client permits private visibility only');
check(creator.nickname==='Criador fictício'&&creator.accountId==='account-fixture','Creator display and connection identity retained');
assert.throws(()=>normalizeTikTokCreatorInfo({...envelope,data:{...envelope.data,privacy_level_options:['PUBLIC_TO_EVERYONE','SELF_ONLY']}},'a',false,now));checks++;
for(const value of [null,{}, {...envelope,error:{code:'scope_not_authorized'}},{...envelope,data:{...envelope.data,comment_disabled:undefined}}]){assert.throws(()=>normalizeTikTokCreatorInfo(value,'a',true,now));checks++;}
const binding=tiktokContentBinding('Legenda revisada','#teste','https://fixture.public.blob.vercel-storage.com/video.mp4');
const options={version:1,accountId:creator.accountId,privacy:'SELF_ONLY',allowComment:false,allowDuet:false,allowStitch:false,commercial:false,ownBrand:false,thirdPartyBrand:false,aiGenerated:false,durationSec:10,contentBinding:binding,musicConsent:true,brandedPolicyConsent:false,uploadConsent:true,consentAt:new Date(now).toISOString()};
check(tiktokPublishingIssue(options,creator,binding,now)===null,'Explicit valid choices accepted');
for(const [label,patch] of [
 ['Missing privacy',{privacy:undefined}],['Missing music consent',{musicConsent:false}],['Missing upload consent',{uploadConsent:false}],
 ['Other account',{accountId:'someone-else'}],['Unavailable privacy',{privacy:'PUBLIC_TO_EVERYONE'}],['Comments forbidden',{allowComment:true}],['Stitch forbidden',{allowStitch:true}],
 ['Overlong video',{durationSec:31}],['Missing disclosure selection',{commercial:true}],['Hidden commercial selection',{ownBrand:true}],
 ['Private branded content',{commercial:true,thirdPartyBrand:true,brandedPolicyConsent:true}],['Future consent',{consentAt:new Date(now+120000).toISOString()}],
 ])check(!!tiktokPublishingIssue({...options,...patch},creator,binding,now),label+' rejected');
check(!!tiktokPublishingIssue(options,creator,binding+'changed',now),'Changed content invalidates consent');
check(!!tiktokPublishingIssue(options,{...creator,fetchedAt:new Date(now-301000).toISOString()},binding,now),'Stale creator info rejected');
const audited=normalizeTikTokCreatorInfo({...envelope,data:{...envelope.data,privacy_level_options:['PUBLIC_TO_EVERYONE','SELF_ONLY']}},creator.accountId,true,now);
const brand={...options,privacy:'PUBLIC_TO_EVERYONE',commercial:true,thirdPartyBrand:true,brandedPolicyConsent:true};
check(!tiktokPublishingIssue(brand,audited,binding,now),'Public branded disclosure requires explicit policy consent');
check(!!tiktokPublishingIssue({...brand,brandedPolicyConsent:false},audited,binding,now),'Missing branded policy consent rejected');
check(hasTikTokPublishScope('user.info.basic,video.publish')&&!hasTikTokPublishScope('video.list')&&!hasTikTokPublishScope('video.publisher'),'Only exact granted publication scope accepted');
for(const [url,expected] of [['https://media.fixture.invalid/a.mp4',true],['https://media.fixture.invalid.attacker.test/a.mp4',false],['http://media.fixture.invalid/a.mp4',false],['https://user:secret@media.fixture.invalid/a.mp4',false]])check(isVerifiedTikTokMediaUrl(url,'https://media.fixture.invalid')===expected,'Exact HTTPS origin policy '+checks);
check(!isVerifiedTikTokMediaUrl('https://media.fixture.invalid/a.mp4',''),'No verified origin means no upload');
const body=buildTikTokPostBody('Legenda','#invalid-is-only-a-builder',brand,1000);
check(body.post_info.privacy_level==='PUBLIC_TO_EVERYONE'&&body.post_info.brand_content_toggle&&body.post_info.disable_comment&&body.post_info.video_cover_timestamp_ms===1000,'Builder preserves chosen privacy, disclosures, interactions and cover');
check(!('video_cover_timestamp_ms' in buildTikTokPostBody('x','https://media.fixture.invalid/a.mp4',options,10000).post_info),'Cover outside video duration omitted');
const oldFetch=globalThis.fetch,oldFlag=process.env.TIKTOK_PUBLISHING_ENABLED;let calls=0;
try{delete process.env.TIKTOK_PUBLISHING_ENABLED;globalThis.fetch=async()=>{calls++;throw new Error('Unexpected external call');};await assert.rejects(queryTikTokCreatorInfo('fictitious-token',creator.accountId));checks++;check(calls===0,'Disabled feature makes no provider call');}
finally{globalThis.fetch=oldFetch;if(oldFlag===undefined)delete process.env.TIKTOK_PUBLISHING_ENABLED;else process.env.TIKTOK_PUBLISHING_ENABLED=oldFlag;}
console.log(`${checks} TikTok publishing policy assertions passed; no external integration exercised`);
