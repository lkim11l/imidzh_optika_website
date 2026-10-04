const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),output=path.join(root,'.qa-brands');fs.mkdirSync(output,{recursive:true});
const base=process.env.PREVIEW_URL||'http://127.0.0.1:4173';
(async()=>{
 const {mockProducts}=await import(path.join(root,'dist/assets/data/products.js'));
 const products=['Alpha','Beta','Gamma','Draft Only'].map((brand,i)=>({id:mockProducts[i].id,slug:mockProducts[i].slug,published:i!==3,data:{...mockProducts[i],brand},updated_at:'2026-10-04T00:00:00Z'}));
 let content={id:'homepage',data:{heroTitle:'Заголовок владельца',customField:'keep'},updated_at:'2026-10-04T00:00:00Z'},revision=0,conflict=false,fail=false,readsFail=false;
 const writes=[],errors=[];
 const browser=await chromium.launch(process.env.CHROMIUM_EXECUTABLE?{executablePath:process.env.CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage']}:{});
 try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
 context.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
 await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 await context.route('**/fzbhjgojsxieotjsiquv.supabase.co/**',async route=>{
  const req=route.request(),url=new URL(req.url()),method=req.method();let data=null,status=200;
  if(url.pathname==='/auth/v1/token')data={access_token:'brands-test-token',expires_in:3600,user:{email:'qa@example.invalid'}};
  else if(url.pathname==='/rest/v1/rpc/optika_is_admin')data=true;
  else if(url.pathname==='/rest/v1/optika_products'){assert.equal(method,'GET','Brand management must never write products');data=url.searchParams.has('published')?products.filter(r=>r.published):products;}
  else if(url.pathname==='/rest/v1/optika_content'){
   if(method==='GET'){if(readsFail){status=503;data={};}else data=content?[content]:[];}
   else {
    assert.equal(req.headers().authorization,'Bearer brands-test-token');const body=req.postDataJSON();writes.push(body);
    if(fail){fail=false;status=503;data={};}
    else if(conflict||(method==='PATCH'&&url.searchParams.get('updated_at')!=='eq.'+content.updated_at)){conflict=false;data=[];}
    else{content={...body,updated_at:`2026-10-04T00:00:${String(++revision).padStart(2,'0')}Z`};data=[content];}
   }
  }else if(url.pathname==='/auth/v1/logout'){status=204;}
  else{status=404;data={};}
  await route.fulfill({status,contentType:'application/json',body:status===204?'':JSON.stringify(data)});
 });
 const admin=await context.newPage();await admin.goto(base+'/admin/');await admin.getByLabel('Электронная почта').fill('qa@example.invalid');await admin.getByLabel('Пароль',{exact:true}).fill('fake-password');await admin.getByRole('button',{name:'Войти',exact:true}).click();await admin.locator('#new-product').waitFor();
 const brandsTab=async()=>{await admin.getByRole('button',{name:'Бренды',exact:true}).click();await admin.locator('#add-brand-form').waitFor();};
 const add=async name=>{await admin.locator('[name=brandName]').fill(name);await admin.getByRole('button',{name:'Добавить бренд',exact:true}).click();};
 const row=name=>admin.locator('.managed-brand').filter({has:admin.locator('strong',{hasText:new RegExp('^'+name+'$')})});
 const save=async()=>{await admin.locator('#save-brands').click();await admin.getByText('Бренды сохранены. Обновите главную страницу, чтобы увидеть изменения.').waitFor();};
 await brandsTab();assert.equal(await admin.locator('.managed-brand').count(),3);
 await add('Empty');assert.match(await row('Empty').innerText(),/нет опубликованных моделей/);
 const before=writes.length;await add(' alpha ');assert.match(await admin.locator('#brands-error').innerText(),/уже есть/);assert.equal(writes.length,before);assert.equal(await admin.locator('.managed-brand').count(),4);
 await add('Draft Only');assert.match(await row('Draft Only').innerText(),/Моделей в каталоге: 0/);
 await row('Beta').locator('input').uncheck();await row('Gamma').getByRole('button',{name:'Поднять Gamma'}).click();await row('Gamma').getByRole('button',{name:'Поднять Gamma'}).click();await save();
 assert.equal(content.data.heroTitle,'Заголовок владельца');assert.equal(content.data.customField,'keep');assert.equal(content.data.homepageBrands[0].name,'Gamma');assert.equal(content.data.homepageBrands.find(b=>b.name==='Beta').enabled,false);
 await admin.screenshot({path:path.join(output,'brands-desktop.png')});await admin.setViewportSize({width:390,height:1000});assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);await admin.screenshot({path:path.join(output,'brands-mobile.png')});
 const home=await context.newPage();await home.goto(base+'/');await home.locator('#brand-list a').first().waitFor();assert.deepEqual(await home.locator('#brand-list a').allTextContents(),['Gamma','Alpha']);
 await home.locator('#brand-list a').first().click();await home.locator('#route-view .product-card').waitFor();assert.equal(await home.locator('#route-view .product-card').count(),1);assert.match(await home.locator('#route-view .product-card').innerText(),/Gamma/i);
 await home.getByRole('button',{name:/Фильтры/}).click();assert(await home.locator('#filter-form [name=brand][value=Beta]').count());await home.keyboard.press('Escape');
 await admin.getByRole('button',{name:'Главная страница',exact:true}).click();await admin.locator('[name=heroTitle]').fill('Текст после изменения брендов');await admin.getByRole('button',{name:'Сохранить тексты'}).click();await admin.getByText('Тексты главной страницы сохранены.').waitFor();assert.equal(content.data.homepageBrands[0].name,'Gamma');assert.equal(content.data.customField,'keep');
 await brandsTab();await row('Empty').getByRole('button',{name:'Убрать Empty из списка'}).click();await save();assert(!content.data.homepageBrands.some(b=>b.name==='Empty'));
 await row('Gamma').locator('input').uncheck();const original=JSON.stringify(content);conflict=true;await admin.locator('#save-brands').click();await admin.locator('#brands-error').getByText(/уже изменена/).waitFor();assert.equal(JSON.stringify(content),original);assert.equal(await row('Gamma').locator('input').isChecked(),false);
 fail=true;await admin.locator('#save-brands').click();await admin.locator('#brands-error').getByText(/Операция не выполнена/).waitFor();assert.equal(JSON.stringify(content),original);await save();
 while(await admin.locator('.managed-brand').count())await admin.locator('.managed-brand').first().getByRole('button',{name:/Убрать .* из списка/}).click();await save();assert.deepEqual(content.data.homepageBrands,[]);
 await home.goto(base+'/');await home.waitForFunction(()=>document.querySelector('#brands').hidden);assert.equal(await home.locator('#brand-list a').count(),0);
 // With saved configuration, newly published brands appear only if explicitly added.
 await add(' future brand ');await save();await home.goto(base+'/');await home.waitForFunction(()=>document.querySelector('#brands').hidden);
 products.push({id:'future',slug:'future',published:true,data:{...mockProducts[0],id:'future',slug:'future',brand:'Future Brand'}});
 await home.reload();await home.locator('#brand-list a').waitFor();assert.deepEqual(await home.locator('#brand-list a').allTextContents(),['future brand']);assert.match(await home.locator('#brand-list a').getAttribute('href'),/brand=Future\+Brand/);
 await brandsTab();assert.equal(await admin.locator('.managed-brand').count(),1);assert.match(await row('future brand').innerText(),/Моделей в каталоге: 1/);
 // A settings read failure must not silently republish hidden brands.
 readsFail=true;await home.reload();await home.waitForFunction(()=>document.querySelector('#brands').hidden);assert.equal(await home.locator('#brand-list a').count(),0);readsFail=false;
 // A missing content row uses a derived list; first save uses POST.
 content=null;await brandsTab();assert.equal(await admin.locator('.managed-brand').count(),4);await save();assert(content.data.homepageBrands.length===4);
 assert.deepEqual(errors,[]);console.log('PASS brands: add, duplicate validation, hide, order, remove, empty list, published-only links, canonical filter links, filters preserved, text/unknown data preserved, conflicts/errors retain draft, reload persistence, missing-row POST, read failure hides brands, mobile, admin-authenticated content writes only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
