import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {backendProxy} from '../server/backend-proxy.mjs';

test('booking forms forward only through the approved backend RPC routes',async()=>{
 for(const route of ['optika_submit_booking','optika_submit_fitting']){
  const payload=JSON.stringify({request_id:'00000000-0000-4000-8000-000000000001',customer_name:'Diagnostic',customer_phone:'+70000000000',accepted:true});
  const req=Object.assign(Readable.from([Buffer.from(payload)]),{url:'/api/backend/rest/v1/rpc/'+route,method:'POST',headers:{host:'site.test',origin:'https://site.test','content-type':'application/json'}});
  const res={setHeader(){},end(body){this.body=body;}};
  let forwarded=false;
  await backendProxy(req,res,async(url,options)=>{
   forwarded=true;assert.ok(url.endsWith('/rest/v1/rpc/'+route));assert.equal(options.method,'POST');assert.equal(options.body.toString(),payload);
   return new Response(null,{status:204});
  });
  assert.ok(forwarded);assert.equal(res.statusCode,204);
 }
});
