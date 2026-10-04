// Restore only the experimental homepage hero and its two resource references.
import {readFile,writeFile} from 'node:fs/promises';
const index=new URL('../dist/index.html',import.meta.url);
let html=await readFile(index,'utf8');
const original=await readFile(new URL('../experiments/hero-original.html',import.meta.url),'utf8');
const pattern=/ <!-- HERO GLASSES EXPERIMENT START -->[\s\S]*? <!-- HERO GLASSES EXPERIMENT END -->/;
if(!pattern.test(html))throw new Error('Experimental hero not found; no file changed.');
html=html.replace(pattern,()=>original).replace('<link rel="stylesheet" href="/assets/hero-glasses.css">','').replace('<script src="/assets/hero-glasses.js" defer></script>','');
await writeFile(index,html);
console.log('Original homepage hero restored. Existing static hero.webp is unchanged.');
