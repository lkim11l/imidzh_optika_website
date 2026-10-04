const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const base = 'http://127.0.0.1:4173';
const report = {images:0,widths:[],fallback:[],runtimeErrors:[]};
const dimensions = element => {const r=element.getBoundingClientRect();return {width:r.width,height:r.height};};
(async() => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
  const normalErrors = [];
  page.on('pageerror',e=>report.runtimeErrors.push(e.message));
  page.on('console',message=>{if(message.type()==='error')normalErrors.push(message.text());});
  try {
    await page.goto(base+'/catalog');await page.locator('#route-view .product-card').first().waitFor();
    const images = page.locator('#route-view .product-image img');assert.equal(await images.count(),24);
    const paths = await images.evaluateAll(nodes=>nodes.map(image=>new URL(image.src).pathname));assert.equal(new Set(paths).size,24);
    for(let i=0;i<24;i++) {
      const image=images.nth(i);await image.scrollIntoViewIfNeeded();await image.evaluate(image=>image.decode());
      assert.equal(await image.evaluate(image=>image.complete && image.naturalWidth===362 && image.naturalHeight===362),true);
      assert.equal(await image.evaluate(image=>image.parentElement.dataset.imageState),'loaded');report.images++;
    }
    assert.equal(await page.locator('.product-more').count(),0);
    assert.equal(await page.locator('#route-view .results-count').textContent(),'24 модели');
    for(const [route,title] of [['/catalog','Очки, которые'],['/catalog/optical','Хорошо видеть.'],['/catalog/sunglasses','Солнце меняется.']]) {
      await page.goto(base+route);await page.locator('.catalog-heading h1').waitFor();assert.ok((await page.locator('.catalog-heading h1').textContent()).includes(title));
      const bounds = await page.locator('.catalog-page .catalog-heading').evaluate(dimensions);assert.ok(bounds.height>=250 && bounds.height<=350,`Intro height: ${bounds.height}`);
    }
    for(const width of [375,430,768,1024,1100,1280,1440,1920]) {
      await page.setViewportSize({width,height:1000});
      const desktop = width>=1100;
      assert.equal(await page.locator('.header nav').isVisible(),desktop,`Navigation at ${width}`);
      assert.equal(await page.locator('.mobile-menu-button').isVisible(),!desktop,`Menu at ${width}`);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`Overflow at ${width}`);
      const columns = await page.locator('#route-view .product-grid').evaluate(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').length);
      assert.ok(columns>=(width<768?1:2) && columns<=4);report.widths.push({width,desktopNavigation:desktop,columns});
    }
    await page.setViewportSize({width:1440,height:1050});await page.goto(base+'/catalog');await page.locator('#route-view .product-card').first().waitFor();
    await page.locator('#route-view .product-card').first().hover();
    const hoverTransform = await page.locator('#route-view .product-image img').first().evaluate(image=>getComputedStyle(image).transform);
    assert.ok(hoverTransform.includes('1.02'),hoverTransform);
    await page.mouse.move(0,0);await page.screenshot({path:'qa-refined-catalog.png',fullPage:true});
    await page.goto(base);await page.locator('#featured-products .product-card').first().waitFor();await page.locator('.optical-photo img').evaluate(image=>image.decode());
    await page.screenshot({path:'qa-refined-home.png',fullPage:true});
    await page.goto(base+'/product/chopard-sole-02');await page.locator('#gallery-image').waitFor();await page.locator('#gallery-image').evaluate(image=>image.decode());
    await page.screenshot({path:'qa-refined-product.png',fullPage:true});
    assert.deepEqual(normalErrors,[]);

    // A separate context intentionally returns broken images. Expected HTTP
    // failures are isolated from the clean baseline console above.
    const failurePage = await browser.newPage({viewport:{width:1440,height:1050},reducedMotion:'reduce'});
    failurePage.on('pageerror',e=>report.runtimeErrors.push(e.message));
    await failurePage.route('**/*qa-missing-image*',route=>route.fulfill({status:404,contentType:'text/plain',body:'Expected image failure'}));
    await failurePage.goto(base+'/catalog');await failurePage.locator('#route-view .product-card').first().waitFor();
    const firstCard = failurePage.locator('#route-view .product-card').first();
    const image = firstCard.locator('img');await image.evaluate(image=>image.decode());
    const before = await firstCard.evaluate(dimensions), alt = await image.getAttribute('alt');
    await image.evaluate(image=>{image.src='/assets/products/qa-missing-image.webp';});
    await firstCard.locator('[data-image-state="error"]').waitFor();
    assert.deepEqual(await firstCard.evaluate(dimensions),before,'Failed image must not change card dimensions');
    assert.equal(await image.getAttribute('alt'),alt);assert.ok(alt.length>20);
    assert.equal(await image.evaluate(image=>getComputedStyle(image).opacity),'0');
    assert.equal(await image.evaluate(image=>getComputedStyle(image).fontSize),'0px');
    assert.equal(await firstCard.locator('.image-fallback').evaluate(label=>getComputedStyle(label).opacity),'1');
    await failurePage.screenshot({path:'qa-refined-image-fallback.png',fullPage:true});
    report.fallback.push('Catalog keeps exact dimensions and accessible alt without visible broken-image text');
    await firstCard.locator('.product-card-link').click();await failurePage.locator('#gallery-image').waitFor();
    const gallery = failurePage.locator('#gallery-main'), galleryBefore = await gallery.evaluate(dimensions);
    await failurePage.locator('#gallery-image').evaluate(image=>{image.src='/assets/products/qa-missing-image-gallery.webp';});
    await gallery.locator('[data-image-state="error"]').waitFor();assert.deepEqual(await gallery.evaluate(dimensions),galleryBefore);
    report.fallback.push('Product gallery preserves dimensions on failure');
    await failurePage.locator('[data-add-cart]').click();await failurePage.locator('[data-open-cart]').click();
    const cartPhoto = failurePage.locator('#cart-dialog .cart-photo');const cartBefore = await cartPhoto.evaluate(dimensions);
    await cartPhoto.locator('img').evaluate(image=>{image.src='/assets/products/qa-missing-image-cart.webp';});
    await cartPhoto.locator('[data-image-state="error"]').waitFor();assert.deepEqual(await cartPhoto.evaluate(dimensions),cartBefore);
    report.fallback.push('Cart thumbnail preserves dimensions on failure');
    await failurePage.keyboard.press('Escape');await failurePage.locator('[data-search]').click();
    const searchPhoto = failurePage.locator('.search-thumb').first();const searchBefore = await searchPhoto.evaluate(dimensions);
    await searchPhoto.locator('img').evaluate(image=>{image.src='/assets/products/qa-missing-image-search.webp';});
    await searchPhoto.locator('..').locator('[data-image-state="error"]').waitFor();assert.deepEqual(await searchPhoto.evaluate(dimensions),searchBefore);
    report.fallback.push('Search thumbnail preserves dimensions on failure');
    await failurePage.close();
    await page.setViewportSize({width:375,height:850});await page.goto(base+'/catalog');await page.locator('#route-view .product-card').first().waitFor();await page.screenshot({path:'qa-refined-mobile.png',fullPage:true});
    assert.deepEqual(report.runtimeErrors,[]);fs.writeFileSync('qa-refinement-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
