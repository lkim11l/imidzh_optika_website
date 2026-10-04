const assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
(async()=>{const browser=await chromium.launch();try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/catalog');await page.locator('#route-view .product-card').first().waitFor();assert.equal(await page.locator('#route-view .product-card').count(),24);
 await page.locator('#route-view .product-card-link').first().click();await page.locator('.product-detail').waitFor();await page.reload();await page.locator('.product-detail').waitFor();console.log('Live Supabase catalog and product refresh passed');
 if(!process.env.LIVE_BOOKING_TEST)await page.route('**/rest/v1/rpc/optika_submit_booking',route=>route.fulfill({status:204,body:''}));
 await page.goto(base+'/');await page.locator('.header [data-booking]').click();await page.locator('#booking-form input[name=name]').fill('QA — тест подключения');await page.locator('#booking-form input[name=phone]').fill('+70000000000');await page.locator('#booking-form input[name=consent]').check();
 await page.locator('#booking-form button[type=submit]').click();await page.locator('#booking-result').waitFor();console.log(process.env.LIVE_BOOKING_TEST?'Real booking saved':'Booking success UI verified with mock transport');
 await page.goto(base+'/admin/');await page.screenshot({path:'qa-admin-login.png'});
 await page.setViewportSize({width:375,height:850});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'qa-admin-mobile.png'});
 // UI mutation and conflict/error cases with an isolated mock backend; no real admin credentials.
 const mock=await browser.newPage({viewport:{width:1440,height:1000}});let catalog=[],content=null,allow=true;const calls=[];
 await mock.route('https://fzbhjgojsxieotjsiquv.supabase.co/**',async route=>{const req=route.request(),url=new URL(req.url()),method=req.method();let data=null,status=200;const body=req.postDataJSON();calls.push({path:url.pathname,method});
 if(url.pathname==='/auth/v1/token')data={access_token:'qa-token',expires_in:3600,user:{email:'qa@example.invalid'}};
 else if(url.pathname==='/rest/v1/rpc/optika_is_admin')data=allow;
 else if(url.pathname==='/rest/v1/optika_products') {if(method==='GET')data=catalog;else {assert.equal(req.headers().authorization,'Bearer qa-token');if(method==='POST'){const row={...body,updated_at:'2026-10-03T00:00:00Z'};catalog.push(row);data=[row];}else {const row=catalog.find(r=>r.id===url.searchParams.get('id').slice(3));Object.assign(row,body);data=[row];}}}
 else if(url.pathname==='/rest/v1/optika_bookings'){data=method==='GET'?[{id:'qa-booking',name:'Тестовый клиент',phone:'+70000000000',status:'new',created_at:new Date().toISOString()}]:[{...body}];}
 else if(url.pathname==='/rest/v1/optika_content'){if(method==='GET')data=content?[content]:[];else {content={...body,updated_at:'2026-10-03T00:00:00Z'};data=[content];}}
 else if(url.pathname.startsWith('/storage/v1/object/'))data={Key:'test.webp'};
 else if(url.pathname==='/auth/v1/logout'){status=204;}
 else {status=404;data={};}
 await route.fulfill({status,contentType:'application/json',body:status===204?'':JSON.stringify(data)});
 });
 await mock.goto(base+'/admin/');await mock.getByLabel('Электронная почта').fill('qa@example.invalid');await mock.getByLabel('Пароль',{exact:true}).fill('qa-placeholder-not-real');await mock.getByRole('button',{name:'Войти',exact:true}).click();await mock.getByRole('button',{name:'Добавить товар'}).click();
 await mock.locator('[name=brand]').fill('QA Brand');await mock.locator('[name=model]').fill('QA Model');await mock.locator('[name=slug]').fill('qa-model');await mock.locator('[name=price]').fill('15000');await mock.locator('[name=images]').fill('/assets/products/optical-01.webp');await mock.locator('[name=published]').check();await mock.getByRole('button',{name:'Сохранить товар'}).click();await mock.getByText('QA Brand',{exact:true}).waitFor();assert.equal(catalog[0].data.price,15000);
 await mock.getByRole('button',{name:'Изменить',exact:true}).click();await mock.locator('[name=price]').fill('18000');await mock.locator('[name=published]').uncheck();await mock.getByRole('button',{name:'Сохранить товар'}).click();await mock.getByText('Скрыт',{exact:true}).waitFor();assert.equal(catalog[0].data.price,18000);
 await mock.screenshot({path:'qa-admin-products.png'});
 await mock.getByRole('button',{name:'Заявки',exact:true}).click();await mock.locator('[data-status]').selectOption('contacted');await mock.getByText('Статус заявки сохранён.').waitFor();await mock.screenshot({path:'qa-admin-bookings.png'});
 await mock.getByRole('button',{name:'Главная страница',exact:true}).click();await mock.locator('[name=heroTitle]').fill('Новый заголовок');await mock.getByRole('button',{name:'Сохранить тексты'}).click();await mock.getByText('Тексты главной страницы сохранены.').waitFor();assert.equal(content.data.heroTitle,'Новый заголовок');
 await mock.getByRole('button',{name:'Выйти',exact:true}).click();await mock.locator('#login-panel').waitFor();allow=false;await mock.getByLabel('Электронная почта').fill('qa@example.invalid');await mock.getByLabel('Пароль',{exact:true}).fill('qa-placeholder-not-real');await mock.getByRole('button',{name:'Войти',exact:true}).click();await mock.getByText('У этой учётной записи нет прав администратора.').waitFor();assert.equal(await mock.locator('#workspace').isVisible(),false);
 assert.deepEqual(errors,[]);console.log('Admin UI create/edit/hide, booking status, content, logout and unauthorized account checks passed (mock transport).');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});

