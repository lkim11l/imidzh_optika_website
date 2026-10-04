import {writeFile} from 'node:fs/promises';
import {mockProducts} from '../dist/assets/data/products.js';
const quote=value=>"'"+value.replaceAll("'","''")+"'";
const sql='-- Explicit initial demo catalog. Does not overwrite existing records.\nbegin;\n'+mockProducts.map(({id,slug,...data})=>`insert into public.optika_products(id,slug,published,data) values (${quote(id)},${quote(slug)},true,${quote(JSON.stringify(data))}::jsonb) on conflict(id) do nothing;`).join('\n')+'\ncommit;\n';
await writeFile(new URL('../supabase/seed.sql',import.meta.url),sql);
