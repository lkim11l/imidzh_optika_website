// Browser checks for staging only. Uses an existing Playwright runtime.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = require('node:fs');
const base = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const results = [];
async function check(name, action) { if(process.env.VERIFY_ONLY && !name.includes(process.env.VERIFY_ONLY))return;await action();results.push(name);console.log('PASS',name); }
async function waitCollection(page) { await page.locator('#route-view .results-count').waitFor(); }
async function visibleCount(page) { return page.locator('#route-view .product-card').count(); }
function normalize(text) { return text.replace(/\s/g,''); }
(async() => {
  const browser = await chromium.launch({headless:true});
  const context = await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page = await context.newPage();
  const errors = [],failedRequests = [],productionRequests = [];
  page.on('pageerror',error => errors.push(error.message));
  page.on('console',message => {if(message.type() === 'error')errors.push(message.text());});
  page.on('request',request => { if(/optika77|cs-cart/i.test(request.url()))productionRequests.push(request.url()); });
  page.on('response',response => {if(response.status() >= 400 && response.url().startsWith(base))failedRequests.push(response.url());});
  await page.route('**/rest/v1/rpc/optika_submit_booking',route=>route.fulfill({status:204,body:''}));
  try {
    await check('Homepage keeps hero and has two category cards / four featured models',async() => {
      await page.goto(base);await page.locator('#featured-products .product-card').first().waitFor();
      assert.match(await page.locator('#home h1').textContent(),/Мир в деталях/);
      assert.equal(await page.locator('.editorial-categories a').count(),2);
      assert.equal(await page.locator('#featured-products .product-card').count(),4);
    });
    await check('Category navigation, direct URL and refresh',async() => {
      await page.locator('.header nav a[href="/catalog/sunglasses"]').click();await waitCollection(page);assert.equal(await visibleCount(page),12);
      await page.reload();await waitCollection(page);assert.equal(await visibleCount(page),12);
      await page.goto(base+'/catalog/optical');await waitCollection(page);assert.equal(await visibleCount(page),12);
      await page.goto(base+'/catalog');await waitCollection(page);assert.equal(await visibleCount(page),24);
    });
    await check('Brand, gender, category and price filters combine and survive reload',async() => {
      await page.locator('[data-open-filters]').click();
      await page.locator('#filter-form input[name=category][value=optical]').check();
      await page.locator('#filter-form input[name=gender][value=unisex]').check();
      await page.locator('#filter-form input[name=brand][value="Silhouette"]').check();
      await page.locator('#filter-form input[name=min]').fill('40000');await page.locator('#filter-form input[name=max]').fill('50000');
      await page.locator('#filter-form button[type=submit]').click();await waitCollection(page);
      assert.equal(await visibleCount(page),1);assert.equal(await page.locator('#route-view .product-info h3').textContent(),'Linea 02');
      assert.equal(await page.locator('.filter-chip').count(),3);
      await page.reload();await waitCollection(page);assert.equal(await visibleCount(page),1);
      await page.locator('[data-clear-filter=brand]').click();assert.equal(await page.locator('.filter-chip').count(),2);
      await page.locator('[data-reset-filters]').click();assert.equal(await visibleCount(page),12);assert.match(page.url(),/\/catalog\/optical$/);
    });
    await check('Sorting ascending, descending and new',async() => {
      await page.goto(base+'/catalog');await waitCollection(page);
      await page.locator('#sort-select').selectOption('price-asc');assert.equal(await page.locator('#route-view .product-info h3').first().textContent(),'Linea 04');
      await page.locator('#sort-select').selectOption('price-desc');assert.equal(await page.locator('#route-view .product-info h3').first().textContent(),'Linea 07');
      await page.locator('#sort-select').selectOption('new');assert.equal(await page.locator('#route-view .product-card').first().getAttribute('data-product-id'),'opt-02');
    });
    await check('Invalid price range and empty results are recoverable',async() => {
      await page.locator('[data-open-filters]').click();await page.locator('#filter-form input[name=min]').fill('90000');await page.locator('#filter-form input[name=max]').fill('20000');
      await page.locator('#filter-form button[type=submit]').click();assert.equal(await page.locator('#price-error').isVisible(),true);assert.equal(await page.locator('#filter-dialog').evaluate(d=>d.open),true);
      await page.locator('#filter-form input[name=min]').fill('99000');await page.locator('#filter-form input[name=max]').fill('100000');await page.locator('#filter-form button[type=submit]').click();
      assert.equal(await visibleCount(page),0);assert.equal(await page.getByText('Пока нет совпадений',{exact:true}).isVisible(),true);
      await page.locator('#route-view .empty-state [data-reset-filters]').click();assert.equal(await visibleCount(page),24);
    });
    await check('Search live results, query route and browser Back',async() => {
      await page.locator('[data-search]').click();await page.locator('#search-input').fill('Tom Ford');assert.equal(await page.locator('.search-result').count(),2);
      await page.locator('#search-form button').click();await waitCollection(page);assert.equal(await visibleCount(page),2);assert.equal(await page.locator('[data-clear-filter=q]').count(),1);
      await page.goBack();await waitCollection(page);assert.equal(await visibleCount(page),24);
    });
    await check('All 24 product URLs and local images load',async() => {
      const links = await page.locator('#route-view .product-card-link').evaluateAll(nodes => nodes.map(node=>node.getAttribute('href')));
      assert.equal(new Set(links).size,24);
      for(const link of links) {
        const response = await page.goto(base+link);assert.equal(response.status(),200);await page.locator('.product-detail h1').waitFor();
        await page.locator('#gallery-image').evaluate(image=>image.decode());assert.equal(await page.locator('#gallery-image').evaluate(image=>image.naturalWidth>0),true);
        assert.equal(await page.locator('.related-section .product-card').count(),4);
      }
    });
    await check('Gallery detail and information accordions',async() => {
      await page.goto(base+'/product/tom-ford-sole-01');await page.locator('.product-detail').waitFor();
      await page.locator('[data-gallery-detail]').click();assert.equal(await page.locator('#gallery-main').evaluate(el=>el.classList.contains('show-detail')),true);
      await page.locator('[data-gallery-src]').click();assert.equal(await page.locator('#gallery-main').evaluate(el=>el.classList.contains('show-detail')),false);
      await page.getByText('Доставка и получение',{exact:true}).click();assert.equal(await page.locator('details').first().evaluate(el=>el.open),true);
    });
    await check('Favorites toggle, route and persistence',async() => {
      await page.locator('#gallery-main [data-favorite]').click();assert.equal(await page.locator('#gallery-main [data-favorite]').getAttribute('aria-pressed'),'true');
      await page.locator('.favorite-nav').click();assert.equal(await visibleCount(page),1);
      await page.reload();await page.locator('#route-view .product-card').first().waitFor();assert.equal(await visibleCount(page),1);
      await page.locator('#route-view [data-favorite]').click();assert.equal(await visibleCount(page),0);assert.equal(await page.getByText('Найдите то, что вам близко',{exact:true}).isVisible(),true);
    });
    await check('Cart add, quantity, total, reload, remove and drawer',async() => {
      await page.goto(base+'/product/tom-ford-sole-01');await page.locator('[data-add-cart]').waitFor();await page.locator('[data-add-cart]').click();
      await page.locator('[data-open-cart]').click();assert.equal(await page.locator('#cart-dialog .cart-item').count(),1);
      await page.locator('#cart-dialog [data-quantity][data-delta="1"]').click();assert.equal(await page.locator('#cart-dialog .quantity output').textContent(),'2');
      assert.equal(normalize(await page.locator('#cart-dialog .summary-line.total strong').textContent()),'83800₽');
      await page.locator('#cart-dialog a[href="/cart"]').click();await page.locator('.cart-page').waitFor();
      await page.reload();await page.locator('#route-view .cart-item').waitFor();assert.equal(await page.locator('#route-view .quantity output').textContent(),'2');
      await page.locator('#route-view [data-quantity][data-delta="-1"]').click();assert.equal(normalize(await page.locator('#route-view .summary-line.total strong').textContent()),'41900₽');
      await page.locator('#route-view [data-remove-cart]').click();assert.equal(await page.locator('#route-view .cart-item').count(),0);
    });
    await check('Booking success and demonstration fitting/cart requests',async() => {
      await page.goto(base+'/product/tom-ford-sole-01');await page.locator('[data-request-product]').waitFor();await page.locator('[data-request-product]').click();
      await page.locator('#request-form input[name=phone]').fill('abcdefghi');assert.equal(await page.locator('#request-form input[name=phone]').evaluate(input=>input.checkValidity()),false);
      await page.locator('#request-form input[name=name]').fill('Тест');await page.locator('#request-form input[name=phone]').fill('+7 (999) 123-45-67');
      await page.locator('#request-form button[type=submit]').click();assert.equal(await page.locator('#request-result').isVisible(),true);await page.locator('#request-result button').click();
      await page.locator('[data-add-cart]').click();await page.locator('[data-open-cart]').click();await page.locator('#cart-dialog [data-request-cart]').click();assert.equal(await page.locator('#request-dialog').evaluate(el=>el.open),true);await page.keyboard.press('Escape');
      await page.locator('.header [data-booking]').click();await page.locator('#booking-form input[name=name]').fill('Тест');await page.locator('#booking-form input[name=phone]').fill('+7 999 123 45 67');await page.locator('#booking-form input[name=consent]').check();await page.locator('#booking-form button[type=submit]').click();await page.locator('#booking-result').waitFor();assert.equal(await page.locator('#booking-result').isVisible(),true);await page.locator('#booking-done').click();
      const storage = await page.evaluate(()=>JSON.stringify({...localStorage}));assert.equal(storage.includes('Тест'),false);assert.equal(storage.includes('999'),false);
    });
    await check('Keyboard focus is trapped in dialogs and Escape restores opener',async() => {
      await page.locator('[data-search]').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#search-dialog').evaluate(el=>el.open),true);
      for(let i=0;i<15;i++) {await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.closest('dialog')?.id),'search-dialog');}
      await page.keyboard.press('Escape');assert.equal(await page.locator('[data-search]').evaluate(el=>el===document.activeElement),true);
    });
    await check('Mobile menu and mobile filters',async() => {
      await page.setViewportSize({width:375,height:850});await page.locator('[data-open-menu]').click();await page.locator('#mobile-menu a[href="/catalog/sunglasses"]').click();await waitCollection(page);assert.equal(await visibleCount(page),12);
      assert.equal(await page.locator('#mobile-menu').evaluate(el=>el.open),false);
      await page.locator('[data-open-filters]').click();await page.locator('#filter-form input[name=gender][value=women]').check();await page.locator('#filter-form button[type=submit]').click();assert.equal(await visibleCount(page),5);
    });
    await check('Responsive layout at seven widths from 375 to 1920 and 200% text',async() => {
      for(const width of [375,430,768,1024,1280,1440,1920]) {
        await page.setViewportSize({width,height:1000});
        for(const route of ['/','/catalog','/product/tom-ford-sole-01','/cart','/favorites']) {
          await page.goto(base+route);await page.locator('#featured-products .product-card').first().waitFor({state:'attached'});
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1),false,`${width} ${route} overflow`);
        }
      }
      await page.setViewportSize({width:1024,height:1000});await page.goto(base+'/catalog');await waitCollection(page);await page.addStyleTag({content:'html{font-size:200%}'});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth > innerWidth+1),false,'200% root text overflow');
      await page.setViewportSize({width:375,height:850});await page.goto(base+'/catalog/sunglasses');await waitCollection(page);await page.screenshot({path:'qa-mobile-catalog-v2.png',fullPage:true});
      await page.goto(base+'/product/tom-ford-sole-01');await page.locator('.product-detail').waitFor();await page.screenshot({path:'qa-mobile-product-v2.png',fullPage:true});
    });
    assert.deepEqual(errors,[],'Browser errors');assert.deepEqual(failedRequests,[],'Failed local requests');assert.deepEqual(productionRequests,[],'Production requests');
    console.log('PASS No runtime errors, broken local assets or production requests');
    fs.writeFileSync('qa-report.json',JSON.stringify({passed:results.length+1,checks:results,errors,failedRequests,productionRequests},null,2));
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});

