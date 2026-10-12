const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE});try{
 const base=process.env.PREVIEW_URL||'http://127.0.0.1:4182',out=path.resolve(__dirname,'../.qa-static-hero');fs.mkdirSync(out,{recursive:true});
 let row={id:'homepage',updated_at:'2026-10-05T00:00:00Z',data:{heroTitle:'Правильные инструменты для качественного зрения!',heroLead:'',customField:'preserve',homepageBrands:[]}},writes=0,uploads=0,conflict=false,failCatalog=false;
 const context=await browser.newContext({viewport:{width:1440,height:950},reducedMotion:'reduce'}),errors=[];
 await context.route('https://fonts.googleapis.com/**',r=>r.fulfill({status:200,contentType:'text/css',body:''}));
 const fixture=fs.readFileSync(path.resolve(__dirname,'../dist/assets/products/optical-01.webp'));
 await context.route('**/*.supabase.co/**',async route=>{const req=route.request(),url=new URL(req.url());let body=[];
  if(url.pathname.startsWith('/storage/v1/object/public/'))return route.fulfill({contentType:'image/webp',body:fixture});
  if(url.pathname==='/auth/v1/token')body={access_token:'test-only',expires_in:3600,user:{email:'test@example.invalid'}};
  else if(url.pathname==='/rest/v1/rpc/optika_is_admin')body=true;
  else if(url.pathname==='/rest/v1/optika_products'){if(failCatalog)return route.fulfill({status:503,body:'{}'});body=[];}
  else if(url.pathname==='/rest/v1/optika_content'){if(req.method()==='GET')body=[row];else{writes++;assert.equal(req.headers().authorization,'Bearer test-only');assert(url.searchParams.has('updated_at'));if(conflict){body=[];conflict=false;}else{row={...req.postDataJSON(),updated_at:`2026-10-05T00:00:0${writes}Z`};body=[row];}}}
  else if(url.pathname.startsWith('/storage/v1/object/')){uploads++;assert.equal(req.headers().authorization,'Bearer test-only');body={};}
  else if(url.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});else throw Error('Unexpected API '+url.pathname);
  await route.fulfill({contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 let assemblyRequests=0;page.on('request',r=>{if(/assembly-design|hero-glasses.js/.test(r.url()))assemblyRequests++;});
 await page.goto(base+'/');await page.locator('.hero-photo img').evaluate(img=>img.decode());
 assert.equal(await page.locator('.hero-scroll-canvas,.hero-scroll-track').count(),0);
 for(const width of [1440,1024,768,390,320]){await page.setViewportSize({width,height:900});await page.evaluate(()=>scrollTo(0,0));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'overflow '+width);await page.locator('.hero-photo img').evaluate(img=>img.decode());if(width===1440||width===390)await page.screenshot({path:path.join(out,'home-'+width+'.png')});}
 assert.equal(assemblyRequests,0);
 await page.setViewportSize({width:1440,height:950});await page.goto(base+'/cookie/');await page.getByLabel('Электронная почта').fill('test@example.invalid');await page.getByLabel('Пароль',{exact:true}).fill('test-only');await page.getByRole('button',{name:'Войти',exact:true}).click();await page.locator('[data-tab=content]').click();await page.locator('[data-upload-field=heroImage]').waitFor();
 const frame=page.frameLocator('#content-preview-host iframe');
 await page.locator('[data-upload-field=heroImage]').setInputFiles({name:'hero.webp',mimeType:'image/webp',buffer:fixture});await frame.locator('.hero-photo img').evaluate(img=>img.decode());assert.match(await frame.locator('.hero-photo img').getAttribute('src'),/^blob:/);assert.equal(writes,0);assert.equal(uploads,0);await page.screenshot({path:path.join(out,'admin-hero.png')});
 await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await page.locator('#editorial-status').filter({hasText:'Изменения сохранены'}).waitFor();assert.equal(uploads,1);assert.equal(writes,1);assert.equal(row.data.customField,'preserve');assert.match(row.data.heroImage,/^https:/);
 const visitor=await context.newPage();await visitor.goto(base+'/');await visitor.locator('.hero-photo img').waitFor();await visitor.waitForFunction(src=>document.querySelector('.hero-photo img').src===src,row.data.heroImage);assert.equal(await visitor.locator('.hero-photo img').getAttribute('srcset'),null);
 await page.locator('[data-reset-field=heroImage]').click();await frame.locator('.hero-photo img').evaluate(img=>img.decode());assert.equal(await frame.locator('.hero-photo img').getAttribute('src'),'/assets/hero-portrait-v1.webp');await page.getByRole('button',{name:'Сохранить изменения',exact:true}).click();await page.locator('#editorial-status').filter({hasText:'Изменения сохранены'}).waitFor();assert.equal(row.data.heroImage,'');assert.equal(uploads,1);await visitor.reload();await visitor.locator('.hero-photo img').evaluate(img=>img.decode());assert.equal(await visitor.locator('.hero-photo img').getAttribute('src'),'/assets/hero-portrait-v1.webp');assert.deepEqual(errors,[]);
 console.log('PASS: static hero, no animation requests, five responsive widths, admin draft preview, authenticated image upload/save, preserved content, public custom image and reset.');
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
