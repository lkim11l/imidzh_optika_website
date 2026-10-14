import test from 'node:test';
import assert from 'node:assert/strict';
import {adminStatus} from '../server/admin-status.mjs';
const response=()=>({headers:{},statusCode:200,setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}});
test('admin readiness requires both public catalog and auth, without exposing configuration',async()=>{
 const res=response();await adminStatus({method:'GET'},res,async()=>new Response('{}'));
 assert.equal(res.statusCode,200);assert.deepEqual(JSON.parse(res.body),{ready:true,services:{catalog:true,auth:true}});assert.equal(res.headers['Cache-Control'],'no-store');
 const failed=response();await adminStatus({method:'GET'},failed,async url=>new Response('{}',{status:url.includes('/auth/')?503:200}));
 assert.equal(failed.statusCode,503);assert.deepEqual(JSON.parse(failed.body),{ready:false,services:{catalog:true,auth:false}});
});
test('admin readiness tolerates unavailable upstream and refuses mutation methods',async()=>{
 const res=response();await adminStatus({method:'GET'},res,async()=>{throw new Error('private upstream error');});assert.equal(res.statusCode,503);assert.ok(!res.body.includes('private'));
 const post=response();await adminStatus({method:'POST'},post,()=>{throw new Error('must not fetch');});assert.equal(post.statusCode,405);
});
