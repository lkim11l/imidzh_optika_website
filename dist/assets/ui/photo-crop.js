// Photo edits stay local until the product is saved.
export async function cropPhoto(src, name='product') {
  const image=new Image();image.crossOrigin='anonymous';image.src=src;
  try {await image.decode();}catch {throw new Error('Не удалось открыть фото. Для обрезки загрузите файл с компьютера.');}
  const dialog=document.createElement('dialog');dialog.className='photo-crop-dialog';
  dialog.innerHTML=`<div class="heading"><h2>Обрезать фотографию</h2><button type="button" data-close aria-label="Закрыть обрезку">×</button></div><p class="hint">Перемещайте фото внутри рамки. Можно использовать стрелки на клавиатуре.</p><label>Пропорции<select data-ratio><option value="1.333333">Для каталога · 4:3</option><option value="1">Квадрат · 1:1</option><option value="1.5">Широкое фото · 3:2</option><option value="original">Исходные пропорции</option></select></label><div class="crop-stage" tabindex="0" role="img" aria-label="Область обрезки. Перемещение стрелками"><canvas></canvas><span class="crop-grid" aria-hidden="true"></span></div><label>Увеличение<input data-zoom type="range" min="1" max="3" value="1" step="0.01"></label><p class="crop-size hint" aria-live="polite"></p><p class="crop-error" role="status"></p><div class="actions"><button type="button" data-apply class="primary">Применить обрезку</button><button type="button" data-reset>Сбросить</button><button type="button" data-close>Отмена</button></div>`;
  document.body.append(dialog);
  const stage=dialog.querySelector('.crop-stage'),canvas=dialog.querySelector('canvas'),ctx=canvas.getContext('2d'),zoom=dialog.querySelector('[data-zoom]'),ratio=dialog.querySelector('[data-ratio]');
  let cx=image.naturalWidth/2,cy=image.naturalHeight/2,rect,drag=null;
  function render(){
    const aspect=ratio.value==='original'?image.naturalWidth/image.naturalHeight:Number(ratio.value);
    let width=Math.min(image.naturalWidth,image.naturalHeight*aspect)/Number(zoom.value),height=width/aspect;
    cx=Math.max(width/2,Math.min(image.naturalWidth-width/2,cx));cy=Math.max(height/2,Math.min(image.naturalHeight-height/2,cy));rect={x:cx-width/2,y:cy-height/2,width,height};
    stage.style.aspectRatio=String(aspect);stage.style.width=`min(100%, ${innerHeight*.48*aspect}px)`;canvas.width=800;canvas.height=Math.round(800/aspect);ctx.imageSmoothingQuality='high';ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,rect.x,rect.y,width,height,0,0,canvas.width,canvas.height);
    dialog.querySelector('.crop-size').textContent=`Область фото: ${Math.round(width)} × ${Math.round(height)} пикселей. Изменения применятся после сохранения товара.`;
  }
  zoom.oninput=render;ratio.onchange=render;
  stage.onpointerdown=e=>{if(e.button!==0)return;stage.focus();drag={x:e.clientX,y:e.clientY,cx,cy};stage.setPointerCapture(e.pointerId);};
  stage.onpointermove=e=>{if(!drag)return;const bounds=stage.getBoundingClientRect();cx=drag.cx-(e.clientX-drag.x)*rect.width/bounds.width;cy=drag.cy-(e.clientY-drag.y)*rect.height/bounds.height;render();};
  stage.onpointerup=stage.onpointercancel=()=>{drag=null;};
  stage.onkeydown=e=>{const step=rect.width*(e.shiftKey?.05:.015);if(e.key==='ArrowLeft')cx-=step;else if(e.key==='ArrowRight')cx+=step;else if(e.key==='ArrowUp')cy-=step;else if(e.key==='ArrowDown')cy+=step;else return;e.preventDefault();render();};
  dialog.querySelector('[data-reset]').onclick=()=>{cx=image.naturalWidth/2;cy=image.naturalHeight/2;zoom.value='1';render();};
  return new Promise(resolve=>{
    const finish=result=>{dialog.close();dialog.remove();image.src='';resolve(result);};
    dialog.querySelectorAll('[data-close]').forEach(button=>button.onclick=()=>finish(null));dialog.addEventListener('cancel',e=>{e.preventDefault();finish(null);});
    dialog.querySelector('[data-apply]').onclick=async()=>{const button=dialog.querySelector('[data-apply]');button.disabled=true;try{const output=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(rect.width,rect.height));output.width=Math.max(1,Math.round(rect.width*scale));output.height=Math.max(1,Math.round(rect.height*scale));const context=output.getContext('2d');context.imageSmoothingQuality='high';context.drawImage(image,rect.x,rect.y,rect.width,rect.height,0,0,output.width,output.height);const blob=await new Promise(r=>output.toBlob(r,'image/webp',.95));if(!blob||blob.size>5*1024*1024)throw new Error('Не удалось подготовить фото размером до 5 МБ.');finish(new File([blob],name.replace(/\.[^.]+$/,'')+'-crop.webp',{type:'image/webp'}));}catch(e){dialog.querySelector('.crop-error').textContent=e.name==='SecurityError'?'Этот источник запрещает обработку фото. Загрузите оригинал с компьютера.':e.message;button.disabled=false;}};
    dialog.showModal();render();
  });
}
