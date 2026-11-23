import {visionBookingState} from '../state/vision-booking.js';
const SHOWN_KEY='imidzh-optika:cart-vision-offer-shown:v1';
export function createCartOfferGate({storage}={}) {
 let shown=false;
 return {
  eligible({path,hasItems,accepted}) {
   let saved=false;try{saved=storage?.getItem(SHOWN_KEY)==='1';}catch{}
   return path==='/cart'&&hasItems&&!accepted&&!shown&&!saved;
  },
  markShown(){shown=true;try{storage?.setItem(SHOWN_KEY,'1');}catch{}}
 };
}
export function cartVisionOfferHTML(){
 return `<dialog id="cart-vision-offer" aria-labelledby="cart-vision-title" aria-describedby="cart-vision-description"><button type="button" class="vision-offer-close" data-vision-continue aria-label="Закрыть">×</button><span class="vision-offer-label">БЕСПЛАТНО ДЛЯ ВСЕХ</span><h2 id="cart-vision-title">Хотите проверить зрение?</h2><p id="cart-vision-description">Запишитесь на бесплатную проверку зрения в салоне «Имидж Оптика». Покупать очки необязательно.</p><div class="vision-offer-actions"><button class="button" type="button" data-vision-book>Записаться бесплатно</button><button class="vision-offer-continue" type="button" data-vision-continue autofocus>Продолжить покупку</button></div><small>После заявки сотрудник салона свяжется с вами и согласует время.</small></dialog>`;
}
export function installCartVisionOffer({onBook,root=document,state=visionBookingState}={}){
 let storage;try{storage=root.defaultView.sessionStorage;}catch{}
 const gate=createCartOfferGate({storage});
 root.body.insertAdjacentHTML('beforeend',cartVisionOfferHTML());
 const dialog=root.getElementById('cart-vision-offer');
 dialog.querySelectorAll('[data-vision-continue]').forEach(button=>button.addEventListener('click',()=>dialog.close()));
 dialog.querySelector('[data-vision-book]').addEventListener('click',()=>{dialog.close();onBook();});
 dialog.addEventListener('click',event=>{
  if(event.target!==dialog)return;
  const rect=dialog.getBoundingClientRect();
  if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();
 });
 return {
  visit(context){
   if(context.path!=='/cart'&&dialog.open)dialog.close();
   if(!gate.eligible({...context,accepted:state.hasAccepted()})||root.querySelector('dialog[open]'))return;
   dialog.showModal();gate.markShown();
  },
  sync(){if(state.hasAccepted()&&dialog.open)dialog.close();}
 };
}
