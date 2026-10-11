const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const {chromium}=require('playwright');
const origin=process.env.QA_ORIGIN||'http://127.0.0.1:4189';
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Users/Ruslan/AppData/Local/ms-playwright/chromium-1234/chrome-win64/chrome.exe'});
 try{
 const context=await browser.newContext({viewport:{width:390,height:844}});let submissions=[];
 await context.route('**/*.supabase.co/**',r=>{if(r.request().url().includes('optika_submit_booking')){submissions.push(r.request().postDataJSON());return r.fulfill({status:submissions.length===1?500:200,contentType:'application/json',body:'{}'});}return r.fulfill({contentType:'application/json',body:'[]'});});
 const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/',{waitUntil:'domcontentloaded'});await p.waitForTimeout(1800);
 assert.equal(await p.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('assembly-design-hd/')).length),1);
 await p.locator('.hero [data-booking]').click();const phone=p.locator('#booking-form input[name=phone]');await phone.focus();assert.equal(await phone.inputValue(),'+7');
 await phone.fill('8 (999) 123-45-67');assert.equal(await phone.inputValue(),'+7 (999) 123-45-67');
 await phone.fill('9991234567');assert.equal(await phone.inputValue(),'+7 (999) 123-45-67');
 await phone.press('End');await phone.press('Backspace');assert.equal(await phone.inputValue(),'+7 (999) 123-45-6');
 await p.locator('#booking-form input[name=name]').fill('Проверка');await p.locator('#booking-form input[name=consent]').check();await p.locator('#booking-form button[type=submit]').click();assert.equal(submissions.length,0);
 await phone.fill('+79991234567');await p.locator('#booking-form button[type=submit]').click();await p.getByText('Не удалось отправить заявку.',{exact:false}).waitFor();await p.locator('#booking-form button[type=submit]').click();await p.locator('#booking-result').waitFor();assert.equal(submissions.length,2);assert.equal(submissions[0].customer_phone,'+79991234567');assert.equal(submissions[0].request_id,submissions[1].request_id);
 await p.locator('#booking-done').click();
 const track=p.locator('.hero-scroll-track');const target=await track.evaluate(el=>Number(el.dataset.start)+Number(el.dataset.distance)*.4);await p.evaluate(y=>scrollTo(0,y),target);await p.waitForFunction(()=>Number(document.querySelector('.hero-scroll-canvas').dataset.frame)>20);await p.waitForFunction(()=>document.querySelector('.hero-scroll-canvas').dataset.previewReady==='true');
 const end=await track.evaluate(el=>Number(el.dataset.start)+Number(el.dataset.distance));await p.evaluate(y=>scrollTo(0,y),end);await p.waitForFunction(()=>document.querySelector('.hero-scroll-canvas').dataset.frame==='79');await p.evaluate(()=>scrollTo(0,0));await p.waitForFunction(()=>document.querySelector('.hero-scroll-canvas').dataset.frame==='0');
 await context.route('**/*.supabase.co/**',r=>r.fulfill({status:500,body:'{}'}));
 for(const slug of ['kak-vybrat-linzy','progressivnye-linzy']){
 await p.goto(origin+'/lenses/'+slug,{waitUntil:'domcontentloaded'});await p.waitForTimeout(600);assert.equal(await p.locator('.lens-guide h1').count(),1);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);assert.equal(await p.evaluate(()=>performance.getEntriesByType('resource').filter(e=>e.name.includes('assembly-design-hd/')).length),0);assert.equal(await p.locator('meta[name=robots]').getAttribute('content'),'index,follow');assert.equal(await p.locator('link[rel=canonical]').getAttribute('href'),'https://optikim.ru/lenses/'+slug);
 await p.locator('.guide-toc a').first().click();await p.waitForTimeout(300);assert.notEqual(new URL(p.url()).hash,'');
 }
 await p.setViewportSize({width:1440,height:900});await p.goto(origin+'/lenses',{waitUntil:'domcontentloaded'});await p.locator('.guide-cards a').first().click();await p.locator('.lens-guide h1').waitFor();assert.match(await p.title(),/Как правильно/);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
 await p.screenshot({path:'C:/Users/Ruslan/.codex/.chatgpt-projects/g-p-6ac004f2ed9881919e1e61f79b9bac6f/lens-guide-desktop.png',fullPage:true});
 await p.setViewportSize({width:390,height:844});await p.screenshot({path:'C:/Users/Ruslan/.codex/.chatgpt-projects/g-p-6ac004f2ed9881919e1e61f79b9bac6f/lens-guide-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);
 const noJS=await browser.newContext({javaScriptEnabled:false,viewport:{width:390,height:844}});const staticPage=await noJS.newPage();await staticPage.goto(origin+'/lenses/progressivnye-linzy',{waitUntil:'domcontentloaded'});assert.equal(await staticPage.locator('.lens-guide h1').count(),1);assert.match(await staticPage.locator('.guide-body').innerText(),/Привыкание/);
 const robots=await (await p.request.get(origin+'/robots.txt')).text();assert.match(robots,/Sitemap: https:\/\/optikim.ru\/sitemap.xml/);const sitemap=await (await p.request.get(origin+'/sitemap.xml')).text();assert.match(sitemap,/progressivnye-linzy/);
 console.log('PASS: automatic +7, paste 8/+7/10 digits, deletion, incomplete rejection, canonical phone and retry idempotency; one initial hero frame; forward/reverse animation; articles survive API errors, no-JS articles, mobile/desktop layout, SPA links, canonical, robots and sitemap. Mocked bookings only; no real emails.');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
