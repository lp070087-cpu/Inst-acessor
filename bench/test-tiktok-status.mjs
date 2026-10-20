import assert from 'node:assert/strict';
import {readTikTokFetchStatus} from '../src/lib/publishing/media.ts';
const cases=[
 ['PUBLISH_COMPLETE','LIVE'],['FAILED','ERROR'],['PROCESSING_UPLOAD','PROCESSING'],['PROCESSING_DOWNLOAD','PROCESSING'],['SEND_TO_USER_INBOX','PROCESSING'],['PUBLISHED','PROCESSING'],['UNKNOWN','PROCESSING'],[undefined,'PROCESSING']
];
let checks=0;
for(const [status,expected] of cases){assert.equal(readTikTokFetchStatus({data:{status},error:{code:'ok'}}),expected);checks++;}
assert.equal(readTikTokFetchStatus({data:{state:'PUBLISH_COMPLETE'}}),'PROCESSING');checks++;
assert.equal(readTikTokFetchStatus({data:{status:'FAILED',state:'PUBLISH_COMPLETE'}}),'ERROR');checks++;
assert.equal(readTikTokFetchStatus({data:{status:'PUBLISH_COMPLETE'},error:{code:'invalid_publish_id'}}),'PROCESSING');checks++;
for(const value of [null,[],{},'PUBLISH_COMPLETE',{data:null},{data:'PUBLISH_COMPLETE'}]){assert.equal(readTikTokFetchStatus(value),'PROCESSING');checks++;}
console.log(`${checks} TikTok status assertions passed`);
