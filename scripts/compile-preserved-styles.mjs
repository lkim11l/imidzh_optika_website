import CleanCSS from 'clean-css';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

// Preserve the compiled stylesheet actually loaded by the original site.
// Legacy raw sources differ from that asset and must not silently redesign it.
export const preservedStylesBaseline=Object.freeze({
 path:'dist/assets/site.ed43d727a216.css',
 sha256:'ed43d727a216cda1f2a2f48722857d330b0487101271e0c7c764ae0062d5c622'
});
export const additiveStyleSources=Object.freeze(['dist/assets/service-pages.css','dist/assets/booking.css']);
const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sha256=value=>createHash('sha256').update(value).digest('hex');

export async function compilePreservedStyles({rootDir=defaultRoot}={}){
 const baseline=await readFile(path.join(rootDir,preservedStylesBaseline.path));
 if(sha256(baseline)!==preservedStylesBaseline.sha256)throw new Error('Original compiled stylesheet hash differs from the approved baseline. Do not rebuild legacy design automatically.');
 const inputs=[];
 const sources=await Promise.all(additiveStyleSources.map(async file=>{
  const bytes=await readFile(path.join(rootDir,file));
  return {path:file,bytes,sha256:sha256(bytes)};
 }));
 for(const source of sources)inputs.push({path:source.path,sha256:source.sha256,bytes:source.bytes.length});
 const compressed=new CleanCSS({level:1,rebase:false}).minify(sources.map(source=>source.bytes.toString('utf8')).join('\n'));
 if(compressed.errors.length)throw new Error(compressed.errors.join('\n'));
 const tail=Buffer.from(compressed.styles,'utf8');
 const css=Buffer.concat([baseline,Buffer.from('\n'),tail]);
 return {
  css,stylesheet:'/assets/site.'+sha256(css).slice(0,12)+'.css',warnings:compressed.warnings,
  strategy:'original-compiled-byte-prefix-plus-minified-additions',
  baseline:{...preservedStylesBaseline,bytes:baseline.length},
  additions:inputs,tail:{sha256:sha256(tail),bytes:tail.length},sha256:sha256(css)
 };
}
