import {supabaseConfig} from '../dist/assets/data/supabase-config.js';
const methods=new Map([
 ['/auth/v1/token',['POST']],['/auth/v1/logout',['POST']],
 ['/rest/v1/optika_products',['GET','POST','PATCH']],
 ['/rest/v1/optika_content',['GET','POST','PATCH']],
 ['/rest/v1/optika_bookings',['GET','PATCH']],
 ['/rest/v1/rpc/optika_submit_booking',['POST']],
 ['/rest/v1/rpc/optika_submit_fitting',['POST']],
 ['/rest/v1/rpc/optika_is_admin',['POST']],
 ['/rest/v1/rpc/optika_delete_product',['POST']],
 ['/rest/v1/rpc/optika_delete_booking',['POST']],
 ['/rest/v1/rpc/optika_pending_file_cleanup',['POST']],
 ['/rest/v1/optika_orders',['GET','PATCH']],
 ['/rest/v1/rpc/optika_delete_order',['POST']],
 ['/storage/v1/object/optika-products',['DELETE']]
]);
export async function backendProxy(req,res,fetcher=fetch){
 res.setHeader('Cache-Control','no-store');
 const incoming=new URL(req.url,'https://localhost');
 const route=incoming.pathname.slice('/api/backend'.length);
 const upload=/^\/storage\/v1\/object\/optika-products\/[a-f0-9-]{36}\.(jpg|jpeg|png|webp)$/i.test(route);
 const allowed=methods.get(route)||(upload?['POST']:[]);
 if(!allowed.includes(req.method)){res.statusCode=404;return res.end();}
 if(req.headers.origin){let from;try{from=new URL(req.headers.origin);}catch{res.statusCode=403;return res.end();}if(from.host!==req.headers.host){res.statusCode=403;return res.end();}}
 const max=upload?5*1024*1024:1024*1024;
 if(Number(req.headers['content-length'])>max){res.statusCode=413;return res.end();}
 const chunks=[];let size=0;
 for await(const chunk of req){size+=chunk.length;if(size>max){res.statusCode=413;return res.end();}chunks.push(chunk);}
 const headers={apikey:supabaseConfig.publishableKey};
 for(const name of ['authorization','content-type','prefer','x-upsert'])if(req.headers[name])headers[name]=req.headers[name];
 try{
  const response=await fetcher(supabaseConfig.url+route+incoming.search,{method:req.method,headers,body:chunks.length?Buffer.concat(chunks):undefined,redirect:'error',signal:AbortSignal.timeout(15000)});
  res.statusCode=response.status;
  for(const name of ['content-type','content-range','retry-after']){const value=response.headers.get(name);if(value)res.setHeader(name,value);}
  res.end(Buffer.from(await response.arrayBuffer()));
 }catch{res.statusCode=502;res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:'Backend connection unavailable'}));}
}
