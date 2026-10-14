import {supabaseConfig} from '../dist/assets/data/supabase-config.js';
export async function adminStatus(req,res,fetcher=fetch){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 if(req.method!=='GET'){res.statusCode=405;res.setHeader('Allow','GET');return res.end();}
 const paths={catalog:'/rest/v1/optika_products?select=id&published=eq.true&limit=1',auth:'/auth/v1/settings'};
 const checks=await Promise.all(Object.entries(paths).map(async([name,path])=>{
  try{const r=await fetcher(supabaseConfig.url+path,{headers:{apikey:supabaseConfig.publishableKey},redirect:'error',signal:AbortSignal.timeout(8000)});await r.arrayBuffer();return [name,r.ok];}catch{return [name,false];}
 }));
 const services=Object.fromEntries(checks);const ready=Object.values(services).every(Boolean);
 res.statusCode=ready?200:503;res.end(JSON.stringify({ready,services}));
}
