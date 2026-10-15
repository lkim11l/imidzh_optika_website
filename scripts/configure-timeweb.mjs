import {writeFile} from 'node:fs/promises';
const url=process.env.SUPABASE_URL,key=process.env.SUPABASE_PUBLISHABLE_KEY;
if(!url||!key)throw new Error('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY. Never use a service-role/secret key.');
const parsed=new URL(url);
if(parsed.protocol!=='https:'||parsed.hostname.endsWith('.supabase.co'))throw new Error('Use the HTTPS endpoint of the Russian Supabase instance.');
if(key.startsWith('sb_secret_'))throw new Error('Secret key is forbidden in browser configuration');
if(key.split('.').length===3){let payload;try{payload=JSON.parse(Buffer.from(key.split('.')[1],'base64url'));}catch{throw new Error('Invalid JWT key');}if(payload.role!=='anon')throw new Error('Only anon JWT may be published');}
else if(!key.startsWith('sb_publishable_'))throw new Error('Expected a publishable key or anon JWT');
await writeFile(new URL('../dist/assets/data/supabase-config.js',import.meta.url),`export const supabaseConfig = Object.freeze(${JSON.stringify({url:parsed.origin,apiBase:'/api/backend',publishableKey:key,catalogEnabled:true,bookingsEnabled:false},null,2)});\n`);
console.log('Russian endpoint configured; build next.');
