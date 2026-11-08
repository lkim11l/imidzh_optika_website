// Served only by the local fixture harness. Never copied into production HTML.
(() => {
  if (!window.OPTIKA_TEST?.enabled || document.getElementById('test-preview-panel')) return;
  const directionNames=['vision_check','progressive','miyosmart'];
  const goalNames=['contact_click','booking_success','order_request_success'];
  const pathNames=new Set(['/','/proverka-zreniya','/lenses','/lenses/progressivnye-linzy','/lenses/hoya-miyosmart','/lenses/kak-vybrat-linzy','/about','/catalog','/catalog/optical','/catalog/sunglasses','/cart','/checkout','/privacy','/terms','/consent','/cookies','/favorites','/product','/other']);
  const resultNames=new Set(['invalid','unavailable','invalid-direction','invalid-items','invalid-delivery','conflict','replayed','simulated-failure','accepted','simulated-response-loss']);
  const modes=new Set(['success','fail-once','drop-once','unavailable']);
  const number=value=>Number.isSafeInteger(value)&&value>=0?value:0;
  const fixtureID=value=>/^10000000-0000-4000-8000-00000000000[123]$/.test(value);
  const safeItems=value=>(Array.isArray(value)?value:[]).filter(item=>fixtureID(item?.id)).map(item=>({id:item.id,quantity:number(item.quantity)}));
  function safeState(raw={}) {
    const counts={};
    for (const kind of ['booking','order']) {
      counts[kind]={};
      for (const key of ['attempts','accepted','replayed','rejected','failed','dropped']) counts[kind][key]=number(raw.counts?.[kind]?.[key]);
    }
    return {
      fixture:true,
      orderReady:raw.orderReady===true,
      modes:Object.fromEntries(['booking','order','catalog'].map(key=>[key,modes.has(raw.modes?.[key])?raw.modes[key]:'unknown'])),
      counts,
      directions:Object.fromEntries(directionNames.map(key=>[key,number(raw.directions?.[key])])),
      orderItems:(Array.isArray(raw.orderItems)?raw.orderItems:[]).map(safeItems),
      requestLog:(Array.isArray(raw.requestLog)?raw.requestLog:[]).filter(entry=>['booking','order'].includes(entry?.kind)&&resultNames.has(entry.result)).map(entry=>({kind:entry.kind,result:entry.result,...(directionNames.includes(entry.direction)?{direction:entry.direction}:{}),...(Array.isArray(entry.items)?{items:safeItems(entry.items),total:number(entry.total)}:{})}))
    };
  }
  function safeEvents(value) {
    return (Array.isArray(value)?value:[]).filter(event=>event?.type==='pageview'||event?.type==='goal'&&goalNames.includes(event.name)).map(event=>{
      let path='/other';
      try { const candidate=new URL(event.url,location.origin).pathname; path=pathNames.has(candidate)?candidate:'/other'; } catch {}
      const params={};
      if (directionNames.includes(event.params?.direction)) params.direction=event.params.direction;
      if (['phone','telegram'].includes(event.params?.channel)) params.channel=event.params.channel;
      return {type:event.type,...(goalNames.includes(event.name)?{name:event.name}:{}),path,params};
    });
  }
  const panel=document.createElement('details');
  panel.id='test-preview-panel';
  panel.style.cssText='position:fixed;bottom:8px;right:8px;z-index:100000;box-sizing:border-box;max-width:calc(100% - 16px);width:550px;border:2px solid #254be1;border-radius:10px;background:#f7f8ff;color:#172135;box-shadow:0 3px 25px #17213533;font:13px/1.45 sans-serif;text-align:left';
  panel.innerHTML='<summary style="padding:10px;cursor:pointer;font-weight:700">Только тест: журнал и режимы</summary><div style="max-height:50vh;overflow:auto;padding:0 10px 10px"><p>Локальные заглушки. Владелец ничего не получает; личные поля и ключи заявок здесь скрыты.</p><div style="display:flex;flex-wrap:wrap;gap:6px;margin:8px 0"><button type="button" data-test-refresh>Обновить журнал</button></div><fieldset><legend>Следующая тестовая заявка</legend><div style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" data-test-booking="success">Успех</button><button type="button" data-test-booking="fail-once">Ошибка один раз</button><button type="button" data-test-booking="drop-once">Ответ потерян один раз</button></div></fieldset><fieldset><legend>Приём заказа оправ</legend><div style="display:flex;flex-wrap:wrap;gap:6px"><button type="button" data-test-order-ready="false">Выключить приём</button><button type="button" data-test-order-ready="true">Восстановить приём</button></div></fieldset><p data-test-panel-status role="status" aria-live="polite"></p><pre data-test-panel-log style="max-width:100%;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font:11px/1.4 monospace"></pre></div>';
  document.body.append(panel);
  const status=panel.querySelector('[data-test-panel-status]');
  const output=panel.querySelector('[data-test-panel-log]');
  let busy=false;
  async function update(control) {
    if (busy) return;
    busy=true; panel.querySelectorAll('button').forEach(button=>button.disabled=true);
    try {
      if (control) {
        const changed=await fetch('/__test/control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(control)});
        if (!changed.ok) throw new Error();
      }
      const response=await fetch('/__test/state',{cache:'no-store'});
      if (!response.ok) throw new Error();
      const server=safeState(await response.json());
      const analytics=safeEvents(window.__OPTIKA_ANALYTICS__?.getEvents?.());
      output.textContent=JSON.stringify({server,analytics},null,2);
      status.textContent='Журнал обновлён. Аналитика: '+(window.__OPTIKA_ANALYTICS__?.mode==='dry-run'?'только память':'ещё не готова')+'.';
    } catch {
      status.textContent='Не удалось обновить локальный журнал. Повторите попытку.';
    } finally {
      busy=false; panel.querySelectorAll('button').forEach(button=>button.disabled=false);
    }
  }
  panel.addEventListener('click',event=>{
    const button=event.target.closest('button'); if (!button) return;
    if (button.hasAttribute('data-test-refresh')) update();
    else if (button.dataset.testBooking) update({booking:button.dataset.testBooking});
    else if (button.dataset.testOrderReady) update({orderReady:button.dataset.testOrderReady==='true'});
  });
  update();
})();
