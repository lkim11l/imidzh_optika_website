import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {backendProxy} from '../server/backend-proxy.mjs';
function request(url,method='GET',headers={},body=''){const req=Readable.from(body?[Buffer.from(body)]:[]);Object.assign(req,{url,method,headers:{host:'pilot.test',...headers}});return req;}
function response(){return {statusCode:200,headers:{},setHeader(k,v){this.headers[k]=v;},end(body){this.body=body;}};}

test('paused bookings and email endpoints cannot be forwarded',async()=>{
 for(const [route,method] of [['rpc/optika_submit_booking','POST'],['rpc/optika_submit_fitting','POST'],['optika_bookings','GET'],['optika_email_settings','PATCH'],['optika_email_queue','GET']]){
  const res=response();await backendProxy(request('/api/backend/rest/v1/'+route,method),res,()=>{throw Error('must not fetch');});assert.equal(res.statusCode,404);
 }
});
test('backend proxy restricts routes, methods, origins and size before forwarding',async()=>{
 for(const req of [request('/api/backend/auth/v1/signup','POST'),request('/api/backend/rest/v1/optika_admins'),request('/api/backend/auth/v1/token','GET'),request('/api/backend/auth/v1/token','POST',{origin:'https://foreign.test'}),request('/api/backend/auth/v1/token','POST',{'content-length':'1048577'})]){
 const res=response();await backendProxy(req,res,()=>{throw new Error('must not fetch');});assert.ok([403,404,413].includes(res.statusCode));assert.equal(res.headers['Cache-Control'],'no-store');
 }
});
test('backend proxy preserves public permissions and bearer while dropping cookies and custom keys',async()=>{
 const res=response();await backendProxy(request('/api/backend/auth/v1/token?grant_type=password','POST',{origin:'https://pilot.test',cookie:'private',apikey:'wrong','content-type':'application/json'},'{"email":"pilot@example.invalid"}'),res,async(url,opts)=>{
 assert.match(url,/\/auth\/v1\/token\?grant_type=password$/);assert.equal(opts.headers.cookie,undefined);assert.notEqual(opts.headers.apikey,'wrong');assert.equal(opts.redirect,'error');assert.match(opts.body.toString(),/pilot@example.invalid/);return new Response('{"error":"Invalid login credentials"}',{status:400,headers:{'content-type':'application/json'}});
 });assert.equal(res.statusCode,400);assert.match(res.body.toString(),/Invalid login/);
});
