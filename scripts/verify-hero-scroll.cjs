const assert=require('node:assert/strict'),path=require('node:path'),fs=require('node:fs');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),base=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
 const errors=[];async function setup(options={}){const context=await browser.newContext(options);await context.route('**/*.supabase.co/**',r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{window.heroShift=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput&&e.sources?.some(s=>s.node?.closest?.('.hero-experiment')))window.heroShift+=e.value;}).observe({type:'layout-shift',buffered:true});});return {context,page};}
 for(const [width,height] of [[1920,1080],[1440,900],[1280,720],[1024,768],[768,1024],[430,932],[390,844],[390,600]]){
  console.log('Checking width',width);const {context,page}=await setup({viewport:{width,height},reducedMotion:'no-preference'});await page.goto(base+'/');await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  if((width===390&&height===600)||width===1280){await page.locator('#hero-title').evaluate(e=>e.textContent='Правильные инструменты для качественного зрения!');await page.waitForTimeout(200);await page.evaluate(()=>window.heroShift=0);}
  const range=await page.locator('.hero-scroll-track').evaluate(t=>({start:+t.dataset.start,distance:+t.dataset.distance}));
  await page.evaluate(y=>scrollTo(0,y),range.start);await page.waitForFunction(()=>document.querySelector('.hero-glasses').classList.contains('hero-scroll-ready'));
  assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.includes('/scroll-v2/mobile/'))),width<=900,'Responsive frame resolution');
  const first=await page.locator('canvas.hero-scroll-canvas').getAttribute('data-frame');await page.waitForTimeout(400);assert.equal(await page.locator('canvas.hero-scroll-canvas').getAttribute('data-frame'),first,'No autoplay');
  const pinnedTop=await page.locator('.hero-experiment').evaluate(e=>e.getBoundingClientRect().top);
  await page.evaluate(y=>scrollTo(0,y),range.start+range.distance*.44);await page.waitForFunction(()=>Math.abs(+document.querySelector('.hero-scroll-canvas').dataset.frame-40)<=1);await page.waitForTimeout(300);
  assert(Math.abs((await page.locator('.hero-experiment').evaluate(e=>e.getBoundingClientRect().top))-pinnedTop)<2,'Hero must stay pinned during assembly');
  await page.evaluate(y=>scrollTo(0,y),range.start+range.distance*.9);await page.waitForFunction(()=>document.querySelector('.hero-scroll-canvas').dataset.frame==='79');
  assert(Math.abs((await page.locator('.hero-experiment').evaluate(e=>e.getBoundingClientRect().top))-pinnedTop)<2,'Assembly complete before release');
  const nextTop=await page.locator('.hero-scroll-track').evaluate(t=>t.nextElementSibling.getBoundingClientRect().top);assert(nextTop>=height-1,'Following section stays below viewport until assembly completes');
  const canvasBounds=await page.locator('.hero-scroll-canvas').boundingBox();assert(canvasBounds.y>=-1&&canvasBounds.y+canvasBounds.height<=height+1,'Entire glasses visible');
  await page.screenshot({path:path.join(root,`.qa-hero/pinned-${width}-${height}.png`)});
  await page.evaluate(y=>scrollTo(0,y),range.start+range.distance+150);await page.waitForTimeout(100);
  assert((await page.locator('.hero-experiment').evaluate(e=>e.getBoundingClientRect().top))<pinnedTop-100,'Hero releases after assembly');
  await page.evaluate(y=>scrollTo(0,y),range.start);await page.waitForFunction(()=>document.querySelector('.hero-scroll-canvas').dataset.frame==='0');
  assert.equal(await page.locator('video').count(),0);assert.equal(await page.locator('.hero-video-toggle').count(),0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
  assert.equal(await page.evaluate(()=>window.heroShift),0);
  const transparent=await page.locator('canvas').evaluate(c=>c.getContext('2d').getImageData(0,0,1,1).data[3]);assert.equal(transparent,0);
  await page.screenshot({path:path.join(root,`.qa-hero/scroll-${width}.png`)});
  await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>!document.querySelector('.hero-glasses').classList.contains('hero-scroll-ready'));assert.equal(await page.locator('.hero-glasses img').evaluate(e=>getComputedStyle(e).opacity),'1');await context.close();
 }
 for(const options of [{reducedMotion:'reduce'},{javaScriptEnabled:false},{saveData:true}]){
  const {context,page}=await setup({viewport:{width:1440,height:900},...options});if(options.saveData)await page.addInitScript(()=>Object.defineProperty(navigator,'connection',{value:{saveData:true}}));let frames=0;page.on('request',r=>{if(r.url().includes('/hero/scroll-v2/'))frames++;});await page.goto(base+'/');await page.waitForTimeout(500);assert.equal(frames,0);assert.equal(await page.locator('.hero-scroll-pinned').count(),0,'Static fallback has no scroll runway');assert.equal(await page.locator('.hero-glasses img').evaluate(e=>getComputedStyle(e).opacity),'1');await context.close();
 }
 const failure=await setup({viewport:{width:1440,height:900}});await failure.context.route('**/hero/scroll-v2/*',r=>r.fulfill({status:404,body:''}));await failure.page.goto(base+'/');await failure.page.waitForTimeout(500);assert.equal(await failure.page.locator('.hero-scroll-pinned').count(),0);assert.equal(await failure.page.locator('.hero-glasses img').evaluate(e=>getComputedStyle(e).opacity),'1');await failure.context.close();
 assert.deepEqual(errors,[]);console.log('PASS: eight viewports, sticky hold and release, forward/reverse scroll, no autoplay/loop, transparent pixels, zero hero CLS, no overflow, reduced motion, no JS, Save-Data, missing-frame fallback, no runtime errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
