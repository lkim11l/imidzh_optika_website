import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {once} from 'node:events';
import {createApp} from '../server/timeweb.mjs';
import {createSEOHandler} from '../api/seo.mjs';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
test('browser keeps navigation usable during outage and retains SSR snapshot',async()=>{
 const product={id:'real',slug:'real-model',brand:'Brand',model:'Model',category:'optical',gender:'unisex',price:100,images:[{src:'/assets/hero.webp',alt:'Model'}],attributes:{},description:'',shortDescription:''};
 let warm=false,offline=true;
 const seoHandler=createSEOHandler({catalog:{async get(){if(!warm)throw Error('offline');return {value:[product],stale:offline};}},editorial:{peek(){return {};}}});
 const app=createApp({seoHandler,backendHandler:async(req,res)=>{res.statusCode=offline?503:200;res.setHeader('Content-Type','application/json');res.end(offline?'{}':JSON.stringify(req.url.includes('optika_products')?[{id:product.id,slug:product.slug,data:product}]:[]));},orderHandler:async(req,res)=>{res.setHeader('Content-Type','application/json');res.end('{"ready":false}');}});
 app.listen(0,'127.0.0.1');await once(app,'listening');
 const base=`http://127.0.0.1:${app.address().port}`;
 let browser;
 try {
  browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE});
  const page=await browser.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{
    const url=route.request().url();if(url.startsWith(base))return route.continue();
    if(new URL(url).pathname==='/rest/v1/optika_products')return route.fulfill({status:offline?503:200,contentType:'application/json',body:offline?'{}':JSON.stringify([{id:product.id,slug:product.slug,data:product}])});
    return route.abort(); // Every external request is answered locally or blocked.
  });
  assert.equal((await page.goto(base)).status(),200);
  await page.waitForFunction(()=>document.querySelector('#featured-products')?.getAttribute('aria-busy')==='false');
  await page.locator('.header a[href="/about"]').first().click();
  await page.waitForFunction(()=>location.pathname==='/about'&&document.querySelector('#route-view h1'));
  await page.locator('.header a[href="/catalog/optical"]').first().click();
  await page.getByText('Коллекция временно недоступна',{exact:true}).waitFor();
  warm=true;
  assert.equal((await page.goto(base+'/product/real-model')).status(),200);
  await page.waitForFunction(()=>document.querySelector('#featured-products')?.getAttribute('aria-busy')==='false');
  assert.match(await page.locator('#route-view').innerText(),/Model/);
  assert.match(await page.locator('#route-view').innerText(),/сохранённая коллекция/);
  await page.getByRole('button',{name:'Добавить в корзину',exact:true}).click();
  await page.locator('.header a[href="/cart"]').first().click();
  await page.getByRole('heading',{name:'Корзина',exact:true}).waitFor();
  assert.match(await page.locator('#cart-review-content').innerText(),/Model/);
  await page.getByRole('link',{name:'Перейти к заказу',exact:true}).click();
  await page.getByText('Коллекция временно недоступна',{exact:true}).waitFor();
  assert.equal(await page.locator('#order-form').count(),0);
  offline=false;
  assert.equal((await page.goto(base+'/cart')).status(),200);
  await page.getByRole('link',{name:'Перейти к заказу',exact:true}).waitFor();
  await page.getByRole('link',{name:'Перейти к заказу',exact:true}).click();
  await page.locator('#order-form').waitFor({timeout:5000}).catch(async error=>{throw Error(error.message+'\n'+await page.locator('#route-view').innerText()+'\n'+JSON.stringify(errors));});
  assert.match(await page.locator('#order-summary-body').innerText(),/Model/);
  assert.deepEqual(errors,[]);
 } finally {await browser?.close();app.closeAllConnections();await new Promise(resolve=>app.close(resolve));}
});
