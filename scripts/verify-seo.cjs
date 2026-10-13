const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.SEO_BASE_URL||'http://127.0.0.1:4173';
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const plain=await browser.newContext({javaScriptEnabled:false});const page=await plain.newPage();
  const xml=await (await page.request.get(base+'/sitemap.xml')).text();
  const urls=[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1].replace('https://optikim.ru',base));
  for(const url of urls){
   const response=await page.goto(url,{waitUntil:'domcontentloaded'});assert.equal(response.status(),200,url);
   assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'),url.replace(base,'https://optikim.ru'));
   assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'index,follow');
   if(url.includes('/product/'))assert.ok((await page.locator('#route-view h1').textContent()).trim());
  }
  console.log(`Verified ${urls.length} sitemap URLs without JavaScript`);
  const context=await browser.newContext({viewport:{width:390,height:844}});const live=await context.newPage();const errors=[];live.on('pageerror',e=>errors.push(e.message));
  await live.goto(base+'/catalog/sunglasses',{waitUntil:'domcontentloaded'});await live.waitForFunction(()=>document.querySelector('#route-view .product-card-link')&&document.querySelector('#featured-products')?.getAttribute('aria-busy')==='false');
  const cards=live.locator('#route-view .product-card-link');console.log('Public category cards:',await cards.count());const href=await cards.first().getAttribute('href');assert.ok(href.startsWith('/product/'));assert.ok(!href.includes('?'));
  await cards.first().click();await live.waitForFunction(()=>document.querySelector('link[rel=canonical]')?.href.includes('/product/'));
  assert.equal(await live.locator('link[rel=canonical]').getAttribute('href'),'https://optikim.ru'+href);
  assert.equal(await live.locator('meta[name=robots]').getAttribute('content'),'index,follow');
  assert.ok((await live.locator('#route-view h1').textContent()).trim());
  const schemas=JSON.parse(await live.locator('#seo-data').textContent());assert.ok(schemas.some(s=>s['@type']==='Product'));assert.ok(schemas.some(s=>s['@type']==='BreadcrumbList'));
  if(process.env.SEO_SCREENSHOT)await live.screenshot({path:process.env.SEO_SCREENSHOT,fullPage:true});
  await live.goBack();await live.waitForSelector('#route-view .filter-toggle');assert.equal(await live.locator('meta[name=robots]').getAttribute('content'),'index,follow');
  await live.locator('#route-view .filter-toggle').click();await live.waitForSelector('#filter-dialog[open]');await live.keyboard.press('Escape');
  const legacy=await live.request.get(base+'/product?slug='+href.split('/').pop(),{maxRedirects:0});assert.equal(legacy.status(),308);assert.equal(legacy.headers().location,href);
  const missing=await live.request.get(base+'/product/not-a-product');assert.equal(missing.status(),404);
  assert.deepEqual(errors,[]);console.log('Product navigation, filters, Back, JSON-LD, redirects and 404 passed');
 } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
