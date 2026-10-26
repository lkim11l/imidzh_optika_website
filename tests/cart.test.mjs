import test from 'node:test';
import assert from 'node:assert/strict';
import {cartPageHTML} from '../dist/assets/ui/cart.js';
const product={id:'one',brand:'First',model:'Frame',slug:'first',price:1000,images:[{src:'/frame.jpg',alt:'Frame'}]};
test('cart reviews multiple frames before customer details and links to checkout',()=>{const html=cartPageHTML([product,{...product,id:'two',brand:'Second',slug:'second',price:2000}],[{id:'one',quantity:2},{id:'two',quantity:1}]);assert.match(html,/First/);assert.match(html,/Second/);assert.equal((html.match(/data-order-quantity=/g)||[]).length,2);assert.match(html,/href="\/checkout">Перейти к оплате/);assert.doesNotMatch(html,/<form|name="phone"|name="consent"/);assert.match(html,/4[\s\u00a0]000/);});
test('empty cart has no checkout action',()=>{const html=cartPageHTML([product],[]);assert.match(html,/В корзине пока пусто/);assert.doesNotMatch(html,/Перейти к оплате/);});
