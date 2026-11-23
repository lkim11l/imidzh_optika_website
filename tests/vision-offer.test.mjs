import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisionBookingState} from '../dist/assets/state/vision-booking.js';
import {createBookingController} from '../dist/assets/ui/booking-controller.js';
import {catalogPageHTML} from '../dist/assets/ui/catalog-page.js';
import {productDetailHTML} from '../dist/assets/ui/product-detail.js';
import {checkoutPageHTML} from '../dist/assets/ui/checkout.js';
import {visionOfferHTML} from '../dist/assets/ui/vision-offer.js';
import {fixtureProducts} from './fixtures/test-catalog.mjs';

const filters={category:'',genders:[],brands:[],min:null,max:null,sort:'popular',query:''};
const products=Array.from({length:25},(_,index)=>({...fixtureProducts[index%3],id:'item-'+index,slug:'item-'+index,popularity:100-index}));

test('catalog invitation follows every ten displayed products, including after filtering',()=>{
 for(const count of [0,9,10,11,20,25]){
  const html=catalogPageHTML(products.slice(0,count),filters);
  const tokens=[...html.matchAll(/data-product-id="[^"]+"|data-vision-offer/g)].map(x=>x[0]);
  let seen=0,offers=0;
  for(const token of tokens){if(token.startsWith('data-product-id'))seen++;else{offers++;assert.equal(seen,offers*10);}}
  assert.equal(offers,Math.floor(count/10));assert.equal(seen,count);
 }
 const html=catalogPageHTML(products,{...filters,category:'optical'});
 assert.equal((html.match(/data-product-id=/g)||[]).length,17);
 assert.equal((html.match(/data-vision-offer/g)||[]).length,1);
});

test('product and populated checkout offer free checks without requiring purchase',()=>{
 for(const html of [productDetailHTML(products[0],[]),checkoutPageHTML(products,[{id:products[0].id,quantity:1}])]){
  assert.match(html,/Покупать очки необязательно/);
  assert.match(html,/data-booking data-direction="vision_check"/);
 }
 assert.equal(visionOfferHTML('catalog',{accepted:true}),'');
 assert.doesNotMatch(checkoutPageHTML(products,[]),/data-vision-offer/);
});

test('only confirmed eye-check requests persist a nonpersonal acceptance flag',async()=>{
 const data=new Map();const storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const state=createVisionBookingState({storage});
 const values={customer_name:'Тест',customer_phone:'+79990000000',accepted:true,direction:'vision_check'};
 let fail=true;
 const controller=createBookingController({createId:()=> 'request-1',submit:async payload=>{
  if(fail)throw new Error('offline');
  return {accepted:true,id:payload.request_id,direction:payload.direction};
 },onAccepted:confirmation=>state.accept(confirmation)});
 assert.equal((await controller.submit(values)).status,'error');assert.equal(state.hasAccepted(),false);
 assert.equal(state.accept({accepted:true,direction:'vision_check'},{callback:true}),false);
 assert.equal(state.accept({accepted:true,direction:'miyosmart'}),false);
 assert.equal(state.accept({accepted:false,direction:'vision_check'}),false);
 fail=false;assert.equal((await controller.submit(values)).status,'accepted');
 assert.equal(state.hasAccepted(),true);assert.equal(createVisionBookingState({storage}).hasAccepted(),true);
 assert.deepEqual([...data.values()],['1']);
});

test('blocked browser storage still suppresses offers for the current page session',()=>{
 const state=createVisionBookingState({storage:{getItem(){throw Error();},setItem(){throw Error();}}});
 assert.equal(state.hasAccepted(),false);
 state.accept({accepted:true,direction:'vision_check'});
 assert.equal(state.hasAccepted(),true);
});
