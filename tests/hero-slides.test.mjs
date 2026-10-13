import test from 'node:test';
import assert from 'node:assert/strict';
import {heroSlides,heroSlidesHTML} from '../dist/assets/data/hero-slides.js';
import {renderPage} from '../server/pages.mjs';

test('saved carousel preserves order, limits photos and rejects unsafe sources',()=>{
  const photos=[{src:'javascript:alert(1)'},{src:'/assets/optical-lifestyle.webp',alt:'<img onerror="bad">'},{src:'/assets/hero.webp'}];
  assert.deepEqual(heroSlides({heroCarousel:photos}).map(p=>p.src),['/assets/optical-lifestyle.webp','/assets/hero.webp']);
  assert.equal(heroSlides({heroCarousel:Array(20).fill(photos[1])}).length,12);
  assert.equal(heroSlides({heroImage:'/assets/hero.webp'})[0].src,'/assets/hero.webp');
  assert.equal(heroSlides({heroCarousel:[]}).length,3);
  const html=heroSlidesHTML({heroCarousel:photos});
  assert.ok(html.includes('&lt;img onerror=&quot;bad&quot;&gt;'));
  assert.ok(!html.includes('javascript:'));
});
test('homepage renders saved carousel in server HTML with no deployment needed',()=>{
  const shell='<html><head></head><body><div class="hero-carousel-stage"><!-- hero-slides:start -->old<!-- hero-slides:end --></div></body></html>';
  const html=renderPage(shell,'/',[],{heroCarousel:[{src:'/assets/hero.webp',alt:'Новая фотография'}]}).html;
  assert.ok(html.includes('src="/assets/hero.webp"'));
  assert.ok(html.includes('aria-label="1 из 1"'));
  assert.ok(!html.includes('>old<'));
});
