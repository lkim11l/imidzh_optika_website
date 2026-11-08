import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCheckout} from '../dist/assets/ui/checkout.js';

const validOrderId='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const products=[{id:'p1',slug:'p1',brand:'Fixture',model:'Model',price:100,images:[{src:'/fixture.webp',alt:'Fixture'}]}];
const response=(body,ok=true)=>({ok,json:async()=>body});
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const patchedTests=new WeakSet();

// A small form DOM exercises mounted handlers, fields and transitions without a
// browser package, external requests, database, mail worker or live catalog.
class Element {
 constructor(name='',tagName='DIV'){this.name=name;this.tagName=tagName;this.value='';this.checked=false;this.disabled=false;this.hidden=false;this.required=false;this.dataset={};this.handlers=new Map();this.textContent='';this.innerHTML='';}
 addEventListener(type,handler){const list=this.handlers.get(type)||[];list.push(handler);this.handlers.set(type,list);}
 async emit(type,details={}){const event={preventDefault(){},target:this,...details};for(const handler of this.handlers.get(type)||[])await handler(event);}
 querySelector(){return null;}
 querySelectorAll(){return [];}
 removeAttribute(){}
 setCustomValidity(value){this.validityMessage=value;}
 insertAdjacentElement(_position,element){this.adjacent=element;this.form?.controls.push(element.querySelector('#retry-order-status'));}
}

function fixture(t,{fetcher,onAccepted=()=>{}}={}){
 if(!patchedTests.has(t)){
  patchedTests.add(t);const original=globalThis.FormData;
  globalThis.FormData=class {
   constructor(form){this.form=form;}
   get(name){const field=this.form.elements[name];return !field||field.disabled?null:field.type==='checkbox'?(field.checked?'on':null):field.value;}
  };
  t.after(()=>{globalThis.FormData=original;});
 }
 const form=new Element();form.controls=[];form.elements={};
 for(const [name,value] of Object.entries({city:'Москва',country:'RU',method:'pickup',address:'Условная улица',postal:'111111',name:'Условный покупатель',phone:'+7 (999) 000-00-00',comment:'После 18:00',payment:'cash',consent:'on'})){
  const field=new Element(name,name==='country'?'SELECT':name==='comment'?'TEXTAREA':'INPUT');field.value=value;field.form=form;form.elements[name]=field;form.controls.push(field);
 }
 form.elements.consent.type='checkbox';form.elements.consent.checked=true;
 form.querySelectorAll=selector=>{const tags=new Set(selector.split(',').map(tag=>tag.trim().toUpperCase()));return form.controls.filter(field=>tags.has(field.tagName));};
 form.reportValidity=()=>!form.elements.phone.validityMessage;
 const selectors={
  '#order-form':form,'#order-message':new Element(),'#send-order':new Element('','BUTTON'),
  '#order-summary-body':new Element(),'#delivery-fields':new Element(),
  '#pickup-address':new Element(),'#checkout-content':new Element()
 };
 selectors['#order-message'].form=form;form.controls.push(selectors['#send-order']);
 const root={querySelector:selector=>selectors[selector]??null,ownerDocument:{createElement(){const node=new Element();node.retry=new Element('','BUTTON');node.querySelector=selector=>selector==='#retry-order-status'?node.retry:null;return node;}}};
 let cart=[{id:'p1',quantity:2}];let mutations=0;
 const store={getCart:()=>cart.map(item=>({...item})),setQuantity(id,quantity){mutations++;cart=cart.map(item=>item.id===id?{...item,quantity}:item);},removeFromCart(id){mutations++;cart=cart.filter(item=>item.id!==id);}};
 const mounted=mountCheckout(root,products,store,{fetcher,onAccepted});
 const recovery=selectors['#order-message'].adjacent;
 return {form,store,mounted,recovery,retry:recovery.retry,message:selectors['#order-message'],send:selectors['#send-order'],content:selectors['#checkout-content'],get mutations(){return mutations;}};
}

test('readiness failure remains visible after refresh; retry recovers without losing entered values',async t=>{
 let checks=0;
 const ui=fixture(t,{fetcher:async()=>++checks===1?response({ready:false}):response({ready:true})});
 await settle();
 assert.equal(ui.send.disabled,true);assert.equal(ui.recovery.hidden,false);
 assert.match(ui.message.textContent,/не удалось подтвердить приём/);
 assert.match(ui.recovery.innerHTML,/tel:\+74956416676/);assert.match(ui.recovery.innerHTML,/Повторить проверку/);
 ui.form.elements.name.value='Изменённое условное имя';ui.form.elements.comment.value='Сохранить пожелание';
 const before=ui.message.textContent;ui.mounted.refresh();assert.equal(ui.message.textContent,before);
 await ui.retry.emit('click');
 assert.equal(checks,2);assert.equal(ui.send.disabled,false);assert.equal(ui.recovery.hidden,true);
 assert.equal(ui.form.elements.name.value,'Изменённое условное имя');assert.equal(ui.form.elements.comment.value,'Сохранить пожелание');
});

test('network failure and malformed readiness have a visible recovery action and no order submission',async t=>{
 for(const failedStatus of [()=>Promise.reject(new Error('offline')),()=>response({ready:'yes'}),()=>response(null),()=>response({ready:true},false)]){
  let posts=0;
  const ui=fixture(t,{fetcher:async(url)=>{if(url==='/api/orders'){posts++;return response({});}return failedStatus();}});
  await settle();await ui.form.emit('submit');
  assert.equal(posts,0);assert.equal(ui.send.disabled,true);assert.equal(ui.recovery.hidden,false);assert.match(ui.message.textContent,/Повторите проверку/);
 }
});

test('busy order disables selects and ignores double submit; a network retry preserves payload id and form',async t=>{
 const pending=deferred();const posted=[];const accepted=[];
 const ui=fixture(t,{onAccepted:value=>accepted.push(value),fetcher:async(url,options)=>{
  if(url.endsWith('/status'))return response({ready:true});
  posted.push(JSON.parse(options.body));return posted.length===1?pending.promise:response({id:posted.at(-1).request_id,total:200});
 }});
 await settle();
 const first=ui.form.emit('submit');await settle();
 assert.equal(ui.form.elements.country.disabled,true);assert.equal(ui.form.elements.payment.disabled,true);
 assert.equal(ui.form.controls.every(field=>field.disabled),true);
 await ui.form.emit('submit');assert.equal(posted.length,1);
 pending.reject(new Error('offline'));await first;
 assert.equal(ui.form.elements.country.disabled,false);assert.equal(ui.form.elements.name.disabled,false);
 assert.equal(ui.form.elements.address.disabled,true);assert.equal(ui.form.elements.postal.disabled,true);
 assert.equal(ui.form.elements.name.value,'Условный покупатель');assert.equal(ui.form.elements.consent.checked,true);
 const error=ui.message.textContent;ui.mounted.refresh();assert.equal(ui.message.textContent,error);
 assert.equal(ui.mutations,0);assert.equal(accepted.length,0);
 await ui.form.emit('submit');
 assert.equal(posted.length,2);assert.deepEqual(posted[0],posted[1]);
 assert.deepEqual(accepted,[{accepted:true,requestId:posted[0].request_id}]);
 assert.equal(accepted[0].requestId,posted[1].request_id);
 assert.equal(ui.store.getCart().length,0);assert.match(ui.content.innerHTML,/ЗАКАЗ ПОЛУЧЕН/);
});

test('invalid success responses never clear cart or trigger acceptance',async t=>{
 const invalid=[()=>null,()=>({}),()=>({id:validOrderId,total:200}),()=>({id:'not-a-uuid',total:200}),
  id=>({id}),id=>({id,total:'200'}),id=>({id,total:NaN}),id=>({id,total:Infinity}),id=>({id,total:-1})];
 for(const makeResult of invalid){
  const accepted=[];const ui=fixture(t,{onAccepted:value=>accepted.push(value),fetcher:async(url,options)=>response(url.endsWith('/status')?{ready:true}:makeResult(JSON.parse(options.body).request_id))});
  await settle();await ui.form.emit('submit');
  assert.equal(ui.mutations,0);assert.deepEqual(ui.store.getCart(),[{id:'p1',quantity:2}]);
  assert.equal(accepted.length,0);assert.doesNotMatch(ui.content.innerHTML,/ЗАКАЗ ПОЛУЧЕН/);
  assert.match(ui.message.textContent,/Сервер не подтвердил заказ/);assert.equal(ui.recovery.hidden,false);assert.equal(ui.send.disabled,false);
 }
});

test('accepted hook failures cannot reverse a validated success',async t=>{
 for(const onAccepted of [()=>{throw new Error('analytics unavailable');},async()=>{throw new Error('async analytics unavailable');}]){
  const ui=fixture(t,{onAccepted,fetcher:async(url,options)=>response(url.endsWith('/status')?{ready:true}:{id:JSON.parse(options.body).request_id,total:200})});
  await settle();await ui.form.emit('submit');await settle();
  assert.equal(ui.store.getCart().length,0);assert.match(ui.content.innerHTML,/ЗАКАЗ ПОЛУЧЕН/);
  assert.doesNotMatch(ui.message.textContent,/analytics unavailable/);
 }
});

test('changed cart after failure receives a new id, while accepted quantity alone is removed',async t=>{
 const posted=[];const pending=deferred();
 const ui=fixture(t,{fetcher:async(url,options)=>{
  if(url.endsWith('/status'))return response({ready:true});posted.push(JSON.parse(options.body));
  return posted.length===1?response({error:'retry'},false):pending.promise;
 }});
 await settle();await ui.form.emit('submit');
 // External cart updates are detected even if no form input event was fired.
 ui.store.setQuantity('p1',3);ui.mounted.refresh();
 const second=ui.form.emit('submit');await settle();
 assert.notEqual(posted[0].request_id,posted[1].request_id);assert.equal(posted[1].selected_items[0].quantity,3);
 ui.store.setQuantity('p1',5);pending.resolve(response({id:posted[1].request_id,total:300}));await second;
 assert.deepEqual(ui.store.getCart(),[{id:'p1',quantity:2}]);
});

test('delivery fields and select become usable after rejection; a changed form gets a new request id',async t=>{
 const posted=[];const ui=fixture(t,{fetcher:async(url,options)=>{
  if(url.endsWith('/status'))return response({ready:true});posted.push(JSON.parse(options.body));return response({error:'Попробуйте ещё раз'},false);
 }});
 await settle();ui.form.elements.method.value='delivery';await ui.form.emit('change',{target:ui.form.elements.method});
 await ui.form.emit('submit');
 assert.equal(ui.form.elements.country.disabled,false);assert.equal(ui.form.elements.address.disabled,false);assert.equal(ui.form.elements.address.required,true);assert.equal(ui.form.elements.postal.disabled,false);
 ui.form.elements.comment.value='Другое условное пожелание';await ui.form.emit('input',{target:ui.form.elements.comment});
 await ui.form.emit('submit');
 assert.notEqual(posted[0].request_id,posted[1].request_id);assert.match(posted[1].customer_comment,/Другое условное пожелание/);
 assert.equal(posted[1].delivery_details.address,'Условная улица');assert.equal(ui.mutations,0);
});

test('a confirmed server quote differing from the displayed catalog is accepted once with its actual total',async t=>{
 const accepted=[];let posts=0;
 const ui=fixture(t,{onAccepted:value=>accepted.push(value),fetcher:async(url,options)=>{
  if(url.endsWith('/status'))return response({ready:true});
  posts++;return response({id:JSON.parse(options.body).request_id,total:250});
 }});
 await settle();await ui.form.emit('submit');await ui.form.emit('submit');
 assert.equal(posts,1);assert.equal(accepted.length,1);assert.equal(ui.store.getCart().length,0);
 assert.match(ui.content.innerHTML,/ЗАКАЗ ПОЛУЧЕН/);assert.match(ui.content.innerHTML,/250/);
});
