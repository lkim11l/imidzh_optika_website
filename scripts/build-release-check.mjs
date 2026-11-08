// Offline SSR/CSS verification only. This is deliberately not a deployment bundle.
import './deny-live-network.mjs';
import {compilePreservedStyles} from './compile-preserved-styles.mjs';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,realpath,lstat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {mockProducts} from '../dist/assets/data/products.js';
import {renderPage,sitemap,publicPaths,productPath} from '../server/pages.mjs';

const sourceRoot=await realpath(path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'));
const sha256=value=>createHash('sha256').update(value).digest('hex');
const within=(parent,child)=>{const relative=path.relative(parent,child);return relative===''||(!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative));};
const sourcePath=relative=>path.join(sourceRoot,relative);
async function verifiedDestination(outputDir){
 if(typeof outputDir!=='string'||!path.isAbsolute(outputDir)||outputDir.includes('\0'))throw new Error('An absolute, explicit isolated output directory is required.');
 const requested=path.resolve(outputDir);
 // A new leaf under an existing parent avoids recursive creation through unknown symlinks.
 const parent=await realpath(path.dirname(requested));
 const destination=path.join(parent,path.basename(requested));
 if(within(sourceRoot,destination)||within(destination,sourceRoot))throw new Error('Output must be outside the source repository and must not be its ancestor.');
 try{await lstat(destination);throw new Error('Output already exists; use a new unique directory.');}catch(error){if(error.code!=='ENOENT')throw error;}
 return destination;
}
async function moduleInputs(entries){
 const seen=new Set();
 async function visit(file){
  const absolute=path.resolve(file);if(seen.has(absolute))return;
  if(!within(sourceRoot,absolute))throw new Error('Unexpected source dependency outside repository.');
  seen.add(absolute);const source=await readFile(absolute,'utf8');
  if(!/\.[cm]?js$/.test(absolute))return;
  const matches=[...source.matchAll(/\bfrom\s*['"](\.[^'"]+)['"]/g),...source.matchAll(/\bimport\s*['"](\.[^'"]+)['"]/g)];
  for(const match of matches)await visit(path.resolve(path.dirname(absolute),match[1]));
 }
 for(const entry of entries)await visit(sourcePath(entry));
 return [...seen].sort();
}
function inertVerificationHTML(html){
 // Preserve renderer content/JSON-LD while making the isolated artifact noninteractive.
 return html.replace(/(<meta name="robots" content=")[^"]*/,'$1noindex,nofollow')
  .replace(/<script\b(?=[^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g,'')
  .replace('</head>','<meta name="optikim-artifact" content="TEST_ONLY_DO_NOT_DEPLOY">\n</head>');
}
export async function buildReleaseCheck({outputDir,products,editorial={},fixtureLabel}={}){
 if(!Array.isArray(products)||!products.length||products.some(product=>product?.isFixture!==true))throw new Error('Only explicit fixture products are accepted; no live catalog input.');
 if(typeof fixtureLabel!=='string'||!fixtureLabel.trim())throw new Error('An explicit fixture label is required.');
 if(products.some(product=>!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)))throw new Error('Invalid fixture slug.');
 if(new Set(products.map(product=>product.slug)).size!==products.length)throw new Error('Fixture slugs must be unique.');
 const output=await verifiedDestination(outputDir);
 const source=await readFile(sourcePath('dist/index.html'),'utf8');
 const styles=await compilePreservedStyles({rootDir:sourceRoot});
 const {css,stylesheet}=styles;
 let shell=source.replace(/<link rel="stylesheet" href="\/assets\/[^"]+">/g,'');
 shell=shell.replace('</head>','<link rel="stylesheet" href="'+stylesheet+'">\n</head>');
 const moduleFiles=await moduleInputs(['scripts/build-release-check.mjs','server/pages.mjs']);
 const inputFiles=[...new Set([...moduleFiles,sourcePath('dist/index.html'),sourcePath('package.json'),sourcePath('package-lock.json'),sourcePath(styles.baseline.path),...styles.additions.map(input=>sourcePath(input.path))])].sort();
 const inputs=[];for(const file of inputFiles){const bytes=await readFile(file);inputs.push({path:path.relative(sourceRoot,file),sha256:sha256(bytes),bytes:bytes.length});}
 // Same route set as prepare-pages, with explicit fixtures replacing its live reader.
 const routes=[...new Set([...publicPaths.filter(Boolean),'product','favorites','cart','checkout',...mockProducts.map(product=>'product/'+product.slug),...products.map(product=>productPath(product.slug).slice(1))])];
 const pages=[];
 const files=new Map([[stylesheet.slice(1),css]]);
 const render=(route,file)=>{
  const result=renderPage(shell,route,products,editorial);
  const productionRobots=result.html.match(/<meta name="robots" content="([^"]+)"/)?.[1]||null;
  files.set(file,inertVerificationHTML(result.html));
  pages.push({path:route,file,rendererStatus:result.status,productionRobots,artifactRobots:'noindex,nofollow'});
 };
 for(const route of routes)render('/'+route,route+'/index.html');
 render('/','index.html');render('/not-found','404.html');
 files.set('robots.txt','# TEST_ONLY_DO_NOT_DEPLOY\nUser-agent: *\nDisallow: /\n');
 files.set('sitemap.xml',sitemap(products));
 files.set('TEST_ONLY_DO_NOT_DEPLOY.txt','OFFLINE VERIFICATION ARTIFACT. DO NOT DEPLOY.\nUses fixture products, no live catalog. Includes SSR HTML and compiled CSS only.\nRuntime scripts, images, fonts, server entry points and configuration are deliberately not copied.\nAll artifact pages are noindex,nofollow and robots.txt disallows crawling.\n');
 // Nothing is written until validation/rendering succeeds. mkdir is exclusive at the leaf.
 await mkdir(output);
 const artifacts=[];
 for(const [relative,content] of files){
  const filename=path.join(output,relative);await mkdir(path.dirname(filename),{recursive:true});await writeFile(filename,content,{flag:'wx'});
  artifacts.push({path:relative,sha256:sha256(content),bytes:Buffer.byteLength(content)});
 }
 const manifest={format:1,testOnly:true,deployable:false,productionBuild:false,fixtureLabel,fixtureProductCount:products.length,fixtureDataSHA256:sha256(JSON.stringify({products,editorial})),networkPolicy:'loopback-only',sourceRoot,outputDirectory:output,nodeVersion:process.version,liveCatalogRead:false,envFilesRead:false,runtimeWorkersStarted:false,runtimeScriptsIncluded:false,scope:'production renderPage/sitemap and shared CSS helper preserving original compiled bytes plus additive styles; offline fixture data; inert HTML/CSS artifact, not a full runtime/deployment build',stylesheet,preservedStyles:{strategy:styles.strategy,baseline:styles.baseline,additions:styles.additions,tail:styles.tail,sha256:styles.sha256},cssWarnings:styles.warnings,sourceInputs:inputs,artifactFiles:artifacts,manifestSelfHashExcluded:true,pages};
 await writeFile(path.join(output,'verification-manifest.json'),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
 return manifest;
}
async function cli(){
 const args=process.argv.slice(2);const options={};
 for(let index=0;index<args.length;index+=2){const key=args[index],value=args[index+1];if(!['--output','--fixture'].includes(key)||!value||value.startsWith('--')||options[key])throw new Error('Usage: --output /absolute/new-directory --fixture synthetic|catalog-25');options[key]=value;}
 if(!options['--output']||!['synthetic','catalog-25'].includes(options['--fixture']))throw new Error('Usage: --output /absolute/new-directory --fixture synthetic|catalog-25');
 let products,editorial={};
 if(options['--fixture']==='synthetic'){const fixture=await import('../tests/fixtures/test-catalog.mjs');products=fixture.fixtureProducts;editorial=fixture.fixtureEditorial;}
 else ({products}=JSON.parse(await readFile(sourcePath('tests/fixtures/catalog-batch-25.json'),'utf8')));
 const manifest=await buildReleaseCheck({outputDir:options['--output'],products,editorial,fixtureLabel:options['--fixture']});
 process.stdout.write(JSON.stringify({testOnly:true,deployable:false,outputDirectory:manifest.outputDirectory,pages:manifest.pages.length,fixtureProducts:manifest.fixtureProductCount,stylesheet:manifest.stylesheet})+'\n');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await cli();
