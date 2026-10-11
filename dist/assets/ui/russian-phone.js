export function russianDigits(value){
 let digits=String(value).replace(/\D/g,'');
 if(digits.length===11 && /^[78]/.test(digits))digits=digits.slice(1);
 else if(String(value).trim().startsWith('+7'))digits=digits.slice(1);
 return digits.slice(0,10);
}
export function formatRussianPhone(value){
 const d=russianDigits(value);return '+7'+(d.length?' ('+d.slice(0,3):'')+(d.length>=3?')':'')+(d.length>3?' '+d.slice(3,6):'')+(d.length>6?'-'+d.slice(6,8):'')+(d.length>8?'-'+d.slice(8,10):'');
}
export function installRussianPhone(input){
 input.maxLength=24;input.inputMode='tel';input.removeAttribute('pattern');
 const validate=()=>input.setCustomValidity(russianDigits(input.value).length===10?'':'Введите российский номер: +7 и 10 цифр.');
 input.addEventListener('focus',()=>{if(!input.value)input.value='+7';});
 input.addEventListener('input',()=>{
  const before=input.value,pos=input.selectionStart??before.length;
  const right=before.slice(pos).replace(/\D/g,'').length;
  input.value=formatRussianPhone(before);validate();
  let caret=input.value.length,left=right;while(caret>2 && left){caret--;if(/\d/.test(input.value[caret]))left--;}
  input.setSelectionRange(caret,caret);
 });
 input.addEventListener('keydown',event=>{
  if(event.key==='Backspace' && input.selectionStart===input.selectionEnd && /[) \-]/.test(input.value[(input.selectionStart||0)-1]||'')){
   event.preventDefault();let pos=input.selectionStart;while(pos>2&&!/\d/.test(input.value[pos-1]))pos--;
   if(pos>2){input.value=input.value.slice(0,pos-1)+input.value.slice(pos);input.setSelectionRange(pos-1,pos-1);input.dispatchEvent(new Event('input',{bubbles:true}));}
  }
 });
 input.addEventListener('blur',validate);input.form.addEventListener('reset',()=>input.setCustomValidity(''));
 return validate;
}
