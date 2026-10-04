const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.resolve(root,'.qa-hero');fs.mkdirSync(output,{recursive:true});
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
(async()=>{
 const {mockProducts}=await import(path.join(root,'dist/assets/data/products.js'));
 const rows=mockProducts.map(p=>({id:p.id,slug:p.slug,published:true,data:p,updated_at:'2026-10-04T00:00:00Z'}));
 const browser=await chromium.launch({...(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
 const report={screens:[],errors:[],heroLayoutShift:0};
 async function makeContext(options={}){
  const context=await browser.newContext(options);
  await context.route('**/fzbhjgojsxieotjsiquv.supabase.co/**',r=>{
   const pathname=new URL(r.request().url()).pathname;
   if(r.request().method()!=='GET')throw new Error('Unexpected database write');
   return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(pathname.includes('optika_products')?rows:[])});
  });
  await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
  return context;
 }
 try{
  const context=await makeContext({reducedMotion:'reduce'});const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(m.type()==='error')report.errors.push(m.text());});
  for(const width of [1920,1440,1280,1024,768,430,390]){
   await page.setViewportSize({width,height:1000});await page.goto(base+'/');await page.locator('.hero-glasses img').evaluate(img=>img.decode());await page.locator('#featured-products .product-card').first().waitFor();
   const measurements=await page.evaluate(()=>{
    const hero=document.querySelector('.hero-experiment'),image=hero.querySelector('img'),title=hero.querySelector('h1'),visual=hero.querySelector('.hero-glasses');
    const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};
    return {overflow:document.documentElement.scrollWidth>innerWidth+1,titleOverflow:title.scrollWidth>title.clientWidth+1,hero:rect(hero),visual:rect(visual),image:rect(image),annotations:[...hero.querySelectorAll('.hero-annotation')].map(e=>({visible:getComputedStyle(e).display!=='none',...rect(e)})),title:title.innerText};
   });
   assert.equal(measurements.overflow,false,`${width} document overflow`);assert.equal(measurements.titleOverflow,false,`${width} headline overflow`);assert.match(measurements.title,/Смотри на мир/);
   assert(measurements.image.x>=measurements.visual.x-.1&&measurements.image.right<=measurements.visual.right+.1);
   assert(measurements.image.w>measurements.visual.w*.9);
   if(width<=900)assert(measurements.annotations.every(a=>!a.visible));
   else for(const a of measurements.annotations){assert(a.x>=measurements.visual.x-1&&a.right<=measurements.visual.right+1);}
   await page.screenshot({path:path.join(output,`hero-${width}.png`)});report.screens.push({width,...measurements});
  }
  await page.locator('.hero-ctas [data-booking]').click();assert(await page.locator('#booking-dialog').isVisible());await page.keyboard.press('Escape');
  await page.locator('.hero-ctas a').click();await page.locator('#route-view .product-card').first().waitFor();assert.match(page.url(),/\/catalog/);
  await page.goto(base+'/');await page.locator('[data-open-menu]').click();await page.locator('#mobile-menu a[href="/catalog/optical"]').click();await page.locator('#route-view .product-card').first().waitFor();assert.equal(await page.locator('#route-view .product-card').count(),12);
  const motionContext=await makeContext({viewport:{width:1440,height:1000}});const motion=await motionContext.newPage();motion.on('pageerror',e=>report.errors.push(e.message));await motion.goto(base+'/');
  await motion.waitForTimeout(1550);if(await motion.locator('.hero-video').count())await motion.waitForFunction(()=>document.querySelector('.hero-glasses').classList.contains('hero-video-playing'));const visual=await motion.locator('.hero-glasses').boundingBox();await motion.mouse.move(visual.x+visual.width*.9,visual.y+visual.height*.8);await motion.waitForTimeout(400);
  const depth=await motion.locator('.hero-glasses-motion').evaluate(e=>({inline:e.style.transform,matrix:new DOMMatrix(getComputedStyle(e).transform).toFloat64Array().slice(12,14)}));
  if(await motion.locator('.hero-scroll-canvas').count()){assert.equal(depth.inline,'');report.parallax='Scroll controls transparent frames';}else if(await motion.locator('.hero-video').count()){assert.equal(depth.inline,'');report.parallax='Disabled during video playback';}else{assert.match(depth.inline,/translate3d/);assert(Math.abs(depth.matrix[0])<=6.1&&Math.abs(depth.matrix[1])<=4.1);report.parallax=depth.inline;}
  await motion.emulateMedia({reducedMotion:'reduce'});await motion.waitForTimeout(20);assert.equal(await motion.locator('.hero-glasses-motion').evaluate(e=>getComputedStyle(e).transform),'none');assert.equal(await motion.locator('.hero-glasses-intro').evaluate(e=>getComputedStyle(e).opacity),'1');
  await motion.emulateMedia({reducedMotion:'no-preference'});await motion.setViewportSize({width:768,height:1000});await motion.locator('.hero-glasses').dispatchEvent('pointermove',{clientX:700,clientY:500,pointerType:'mouse'});assert.equal(await motion.locator('.hero-glasses-motion').evaluate(e=>e.style.transform),'');
  // Delay the hero image deliberately: reserved layout must stay unchanged.
  const shiftContext=await makeContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const shiftPage=await shiftContext.newPage();
  await shiftPage.addInitScript(()=>{window.heroShift=0;new PerformanceObserver(list=>{for(const entry of list.getEntries())if(!entry.hadRecentInput&&entry.sources?.some(s=>s.node?.closest?.('.hero-experiment')))window.heroShift+=entry.value;}).observe({type:'layout-shift',buffered:true});});
  let release;const gate=new Promise(resolve=>release=resolve);await shiftPage.route('**/assets/hero/exploded-glasses.webp',async route=>{await gate;await route.continue();});
  await shiftPage.goto(base+'/',{waitUntil:'domcontentloaded'});const before=await shiftPage.locator('.hero-glasses').boundingBox();release();await shiftPage.locator('.hero-glasses img').evaluate(img=>img.decode());const after=await shiftPage.locator('.hero-glasses').boundingBox();assert.deepEqual(after,before);report.heroLayoutShift=await shiftPage.evaluate(()=>window.heroShift);assert.equal(report.heroLayoutShift,0);
  const staticContext=await makeContext({viewport:{width:390,height:1000},javaScriptEnabled:false,reducedMotion:'reduce'});const staticPage=await staticContext.newPage();await staticPage.goto(base+'/');assert(await staticPage.locator('.hero-glasses img').isVisible());assert(await staticPage.locator('.hero-ctas button').isVisible());await staticPage.screenshot({path:path.join(output,'hero-no-js.png')});
  await page.setViewportSize({width:1440,height:1000});await page.goto(base+'/');await page.addStyleTag({content:'html{font-size:200%}'});const enlarged=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth+1,elements:[...document.querySelectorAll('body *')].filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,text:e.textContent.slice(0,80),right:e.getBoundingClientRect().right})).slice(0,12)}));report.enlargedTextExistingOverflow=enlarged;assert.equal(await page.locator('.hero-experiment').evaluate(e=>e.scrollWidth>e.clientWidth+1),false,'Hero overflow at 200% text');
  assert.deepEqual(report.errors,[]);fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log('PASS hero: 7 widths, CTA/menu/catalog navigation, parallax bounds, reduced motion, tablet disabled motion, no JS, delayed image zero shift, 200% text, no runtime errors.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
