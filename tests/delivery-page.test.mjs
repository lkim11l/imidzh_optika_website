import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {renderPage,sitemap} from '../server/pages.mjs';

const shell=await readFile(new URL('../dist/index.html',import.meta.url),'utf8');

test('delivery page is indexable, linked, and describes confirmed pickup and order terms',()=>{
 const page=renderPage(shell,'/delivery',[]);
 assert.equal(page.status,200);
 assert.match(page.html,/<h1>Доставка и самовывоз<\/h1>/);
 assert.match(page.html,/Лермонтовский проспект, 19, корпус 1, ТЦ «Феникс», 1 этаж/);
 assert.match(page.html,/возможность доставки подтверждает салон/);
 assert.match(page.html,/способ и срок получения, а также порядок оплаты подтверждаются менеджером/);
 assert.match(page.html,/<link rel="canonical" href="https:\/\/optikim\.ru\/delivery"/);
 assert.match(page.html,/<meta name="robots" content="index,follow"/);
 assert.match(page.html,/<a href="\/delivery">Доставка и самовывоз<\/a>/);
 assert.match(page.html,/<a class="footer-contact-link" href="\/#store">Контакты<\/a>/);
 assert.match(sitemap([]),/<loc>https:\/\/optikim\.ru\/delivery<\/loc>/);
});
