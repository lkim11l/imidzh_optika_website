import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,symlink,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import CleanCSS from 'clean-css';
import {buildReleaseCheck} from '../scripts/build-release-check.mjs';
import {compilePreservedStyles,preservedStylesBaseline,additiveStyleSources} from '../scripts/compile-preserved-styles.mjs';
import {fixtureProducts,fixtureEditorial} from './fixtures/test-catalog.mjs';
import {publicPaths,productPath} from '../server/pages.mjs';
const sourceRoot=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const hash=value=>createHash('sha256').update(value).digest('hex');
const options={products:fixtureProducts,editorial:fixtureEditorial,fixtureLabel:'synthetic-test'};

async function temporary(t){const directory=await mkdtemp(path.join(tmpdir(),'optikim-release-build-'));t.after(()=>rm(directory,{recursive:true,force:true}));return directory;}

test('offline build requires explicit fixtures and cannot overwrite source or existing output',async t=>{
 const temp=await temporary(t),existing=path.join(temp,'existing');await mkdir(existing);await writeFile(path.join(existing,'sentinel'),'unchanged');
 await assert.rejects(buildReleaseCheck({outputDir:path.join(temp,'unspecified')}),/explicit fixture/);
 await assert.rejects(buildReleaseCheck({...options,fixtureLabel:'',outputDir:path.join(temp,'missing-label')}),/fixture label/);
 await assert.rejects(buildReleaseCheck({...options,products:[{...fixtureProducts[0],isFixture:false}],outputDir:path.join(temp,'not-fixtures')}),/fixture products/);
 for(const outputDir of [sourceRoot,path.join(sourceRoot,'dist','release-check'),path.dirname(sourceRoot)])await assert.rejects(buildReleaseCheck({...options,outputDir}),/outside the source repository/);
 await assert.rejects(buildReleaseCheck({...options,outputDir:'relative-output'}),/absolute/);
 await assert.rejects(buildReleaseCheck({...options,outputDir:existing}),/already exists/);
 assert.equal(await readFile(path.join(existing,'sentinel'),'utf8'),'unchanged');
 const alias=path.join(temp,'alias');await symlink(path.join(sourceRoot,'dist'),alias,'dir');
 await assert.rejects(buildReleaseCheck({...options,outputDir:path.join(alias,'through-symlink')}),/outside the source repository/);
});

test('isolated SSR/CSS build covers routes, hashes artifacts, uses exact minifier and preserves source',async t=>{
 const temp=await temporary(t),outputDir=path.join(temp,'verification');
 const originalShell=await readFile(path.join(sourceRoot,'dist/index.html'));
 const styles=JSON.parse(await readFile(path.join(sourceRoot,'scripts/style-sources.json'),'utf8'));
 const originalCSS=await Promise.all(styles.map(file=>readFile(path.join(sourceRoot,'dist',file),'utf8')));
 const baseline=await readFile(path.join(sourceRoot,preservedStylesBaseline.path));
 const tailRaw=await Promise.all(additiveStyleSources.map(file=>readFile(path.join(sourceRoot,file),'utf8')));
 const expectedTail=new CleanCSS({level:1,rebase:false}).minify(tailRaw.join('\n')).styles;
 const expectedCSS=Buffer.concat([baseline,Buffer.from('\n'),Buffer.from(expectedTail)]);
 const manifest=await buildReleaseCheck({...options,outputDir});
 assert.equal(manifest.testOnly,true);assert.equal(manifest.deployable,false);assert.equal(manifest.productionBuild,false);
 assert.equal(manifest.liveCatalogRead,false);assert.equal(manifest.envFilesRead,false);assert.equal(manifest.runtimeWorkersStarted,false);assert.equal(manifest.runtimeScriptsIncluded,false);
 assert.equal(manifest.fixtureProductCount,3);assert.equal(manifest.stylesheet,'/assets/site.'+hash(expectedCSS).slice(0,12)+'.css');
 const actualCSS=await readFile(path.join(outputDir,manifest.stylesheet));
 assert.deepEqual(actualCSS,expectedCSS);
 assert.deepEqual(actualCSS.subarray(0,baseline.length),baseline);
 assert.equal(actualCSS.subarray(baseline.length+1).toString('utf8'),expectedTail);
 assert.deepEqual(manifest.preservedStyles.baseline,{...preservedStylesBaseline,bytes:baseline.length});
 assert.deepEqual(manifest.preservedStyles.additions.map(input=>input.path),[...additiveStyleSources]);
 for(const file of [preservedStylesBaseline.path,...additiveStyleSources,'scripts/compile-preserved-styles.mjs'])assert.ok(manifest.sourceInputs.some(input=>input.path===file),file);
 assert.equal(await readFile(path.join(outputDir,'robots.txt'),'utf8'),'# TEST_ONLY_DO_NOT_DEPLOY\nUser-agent: *\nDisallow: /\n');
 assert.match(await readFile(path.join(outputDir,'TEST_ONLY_DO_NOT_DEPLOY.txt'),'utf8'),/DO NOT DEPLOY/);
 const persisted=JSON.parse(await readFile(path.join(outputDir,'verification-manifest.json'),'utf8'));assert.deepEqual(persisted,manifest);
 for(const artifact of manifest.artifactFiles){
  const bytes=await readFile(path.join(outputDir,artifact.path));assert.equal(hash(bytes),artifact.sha256);assert.equal(bytes.length,artifact.bytes);
 }
 for(const input of manifest.sourceInputs)assert.equal(hash(await readFile(path.join(sourceRoot,input.path))),input.sha256,input.path);
 assert.deepEqual(await readFile(path.join(sourceRoot,'dist/index.html')),originalShell);
 assert.deepEqual(await Promise.all(styles.map(file=>readFile(path.join(sourceRoot,'dist',file),'utf8'))),originalCSS);
 for(const route of publicPaths.map(route=>'/'+route).concat(fixtureProducts.map(product=>productPath(product.slug)))){
  const entry=manifest.pages.find(page=>page.path===route);assert.ok(entry,route);assert.equal(entry.rendererStatus,200,route);
  const html=await readFile(path.join(outputDir,entry.file),'utf8');
  assert.match(html,/<meta name="robots" content="noindex,nofollow"/);assert.match(html,/TEST_ONLY_DO_NOT_DEPLOY/);
  assert.doesNotMatch(html,/<script\b[^>]*\bsrc=/);assert.match(html,/id="seo-data"/);
 }
 const xml=await readFile(path.join(outputDir,'sitemap.xml'),'utf8');for(const product of fixtureProducts)assert.ok(xml.includes(productPath(product.slug)));
 assert.doesNotMatch(xml,/\/cart<|\/checkout<|\/favorites<|\/admin/);
 assert.equal(manifest.pages.find(page=>page.path==='/not-found').rendererStatus,404);
 await assert.rejects(stat(path.join(outputDir,'assets/app.js')),error=>error.code==='ENOENT');
 await assert.rejects(stat(path.join(outputDir,'assets/data/supabase-config.js')),error=>error.code==='ENOENT');
 await assert.rejects(stat(path.join(outputDir,'server/timeweb.mjs')),error=>error.code==='ENOENT');
});

test('verification uses clean production service renderer and installs its own live-network block',async t=>{
 const temp=await temporary(t),manifest=await buildReleaseCheck({...options,outputDir:path.join(temp,'clean-services')});
 for(const route of ['/proverka-zreniya','/lenses/progressivnye-linzy','/lenses/hoya-miyosmart']){
  const entry=manifest.pages.find(page=>page.path===route),html=await readFile(path.join(manifest.outputDirectory,entry.file),'utf8');
  assert.doesNotMatch(html,/Локальная тестовая версия · не опубликовано|Локальная тестовая форма не подтверждает время визита|Для проверки используйте вымышленные контактные данные/);
 }
 await assert.rejects(fetch('https://example.com/never-contacted'),error=>error.code==='ERR_TEST_NETWORK_BLOCKED');
});


test('shared CSS helper is byte-preserving and idempotent, and rejects an unapproved baseline',async t=>{
 const before=await readFile(path.join(sourceRoot,preservedStylesBaseline.path));
 const first=await compilePreservedStyles({rootDir:sourceRoot}),second=await compilePreservedStyles({rootDir:sourceRoot});
 assert.deepEqual(first.css,second.css);assert.equal(first.stylesheet,second.stylesheet);
 assert.deepEqual(first.css.subarray(0,before.length),before);assert.equal(hash(before),preservedStylesBaseline.sha256);
 assert.equal(first.stylesheet,'/assets/site.'+hash(first.css).slice(0,12)+'.css');
 assert.deepEqual(await readFile(path.join(sourceRoot,preservedStylesBaseline.path)),before);
 const fakeRoot=await temporary(t);await mkdir(path.join(fakeRoot,'dist/assets'),{recursive:true});
 await writeFile(path.join(fakeRoot,preservedStylesBaseline.path),'unapproved replacement');
 await assert.rejects(compilePreservedStyles({rootDir:fakeRoot}),/hash differs/);
});
