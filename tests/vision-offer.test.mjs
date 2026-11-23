import test from 'node:test';
import assert from 'node:assert/strict';
import {createVisionBookingState} from '../dist/assets/state/vision-booking.js';
import {createBookingController} from '../dist/assets/ui/booking-controller.js';
import {catalogPageHTML} from '../dist/assets/ui/catalog-page.js';
import {productDetailHTML} from '../dist/assets/ui/product-detail.js';
import {checkoutPageHTML} from '../dist/assets/ui/checkout.js';
import {createCartOfferGate,cartVisionOfferHTML} from '../dist/assets/ui/vision-offer.js';
import {fixtureProducts} from './fixtures/test-catalog.mjs';

const filters={category:'',genders:[],brands:[],min:null,max:null,sort:'popular',query:''};
const products=Array.from({length:25},(_,index)=>({...fixtureProducts[index%3],id:'item-'+index,slug:'item-'+index,popularity:100-index}));

test('no invitations remain in catalog, product or checkout pages',()=>{
 for(const html of [catalogPageHTML(products,filters),productDetailHTML(products[0],[]),checkoutPageHTML(products,[{id:products[0].id,quantity:1}])])assert.doesNotMatch(html,/data-vision-offer|Начните с проверки зрения/);
 assert.equal((catalogPageHTML(products,filters).match(/data-product-id=/g)||[]).length,25);
});

test('popup requires a populated cart and no accepted booking; never interrupts other routes',()=>{
 const gate=createCartOfferGate();
 assert.equal(gate.eligible({path:'/cart',hasItems:false,accepted:false}),false);
 assert.equal(gate.eligible({path:'/cart',hasItems:true,accepted:true}),false);
 for(const path of ['/catalog','/checkout','/product/test','/'])assert.equal(gate.eligible({path,hasItems:true,accepted:false}),false);
 assert.equal(gate.eligible({path:'/cart',hasItems:true,accepted:false}),true);
 gate.markShown();assert.equal(gate.eligible({path:'/cart',hasItems:true,accepted:false}),false);
 const html=cartVisionOfferHTML();assert.match(html,/Продолжить покупку/);assert.match(html,/data-vision-book/);assert.match(html,/Покупать очки необязательно/);
});

test('popup is shown once per browser session, with in-memory fallback',()=>{
 const data=new Map(),storage={getItem:key=>data.get(key),setItem:(key,value)=>data.set(key,value)};
 const context={path:'/cart',hasItems:true,accepted:false};
 createCartOfferGate({storage}).markShown();
 assert.equal(createCartOfferGate({storage}).eligible(context),false);
 const blocked=createCartOfferGate({storage:{getItem(){throw Error();},setItem(){throw Error();}}});
 assert.equal(blocked.eligible(context),true);blocked.markShown();assert.equal(blocked.eligible(context),false);
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
