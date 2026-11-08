import './deny-live-network.mjs';
import {createServer} from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import {resolve, extname, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {renderPage, sitemap} from '../server/pages.mjs';
import {fixtureProducts, fixtureEditorial, fixtureRows} from '../tests/fixtures/test-catalog.mjs';

const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const distRoot = resolve(projectRoot, 'dist');
const directions = ['vision_check', 'progressive', 'miyosmart'];
const modes = ['success', 'fail-once', 'drop-once'];
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob:; media-src 'self'; connect-src 'self'; frame-src 'none'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'";
const mime = {'.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.webp':'image/webp', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.avif':'image/avif', '.woff2':'font/woff2', '.mp4':'video/mp4', '.ico':'image/x-icon'};
const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 360"><rect width="640" height="360" rx="30" fill="#edf0fa"/><g fill="none" stroke="#254be1" stroke-width="12"><rect x="75" y="120" width="205" height="125" rx="45"/><rect x="360" y="120" width="205" height="125" rx="45"/><path d="M280 155q40-30 80 0M75 145L25 100M565 145l50-45"/></g><text x="320" y="310" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#172135">TEST / условная модель</text></svg>';

function headers(res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Content-Security-Policy', CSP);
}
function reply(res, status, body, type='application/json; charset=utf-8') {
  res.statusCode=status; res.setHeader('Content-Type', type);
  res.end(type.startsWith('application/json') && typeof body!=='string' && !Buffer.isBuffer(body) ? JSON.stringify(body) : body);
}
function localRequest(req) {
  const remote = req.socket.remoteAddress;
  if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(remote)) return false;
  const expected = `127.0.0.1:${req.socket.localPort}`;
  if (req.headers.host !== expected) return false;
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  if (req.headers.origin && req.headers.origin !== `http://${expected}`) return false;
  return true;
}
async function readJSON(req) {
  if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error(), {status:415});
  if (Number(req.headers['content-length']) > 16384) throw Object.assign(new Error(), {status:413});
  const chunks=[]; let size=0;
  for await (const chunk of req) { size+=chunk.length; if (size>16384) throw Object.assign(new Error(), {status:413}); chunks.push(chunk); }
  try {
    const value=JSON.parse(Buffer.concat(chunks).toString());
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error();
    return value;
  } catch { throw Object.assign(new Error(), {status:400}); }
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
function validContact(payload) {
  return uuid.test(payload.request_id) && typeof payload.customer_name === 'string' && payload.customer_name.trim().length>=2 && payload.customer_name.length<=80
    && typeof payload.customer_phone === 'string' && /^\+7\d{10}$/.test(payload.customer_phone) && payload.accepted===true;
}
function configScript(contentPreview=true) {
  return `window.OPTIKA_TEST=Object.freeze({enabled:true,fixture:true,contentPreview:${contentPreview}});
window.OPTIKA_ANALYTICS=Object.freeze({mode:'dry-run'});
window.OPTIKA_CONFIG=Object.freeze({commerce:{catalog:null,frames:null,sunglasses:null,brands:null,hoya:null,cart:null,checkout:null},bookingUrl:null});
// Keep contact clicks observable without opening a real call, mailbox or remote page.
document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(!link)return;try{const target=new URL(link.href,location.href);if(target.origin!==location.origin||!['http:','https:'].includes(target.protocol)){event.preventDefault();}}catch{event.preventDefault();}},true);
`;
}
function decorateHTML(html,additionalNotice="") {
  const extra=additionalNotice?'<p>'+String(additionalNotice).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))+'</p>':'';
  // All script configuration is served locally and runs before the app module.
  html=html.replace(/<script\b[^>]*src=["'][^"']*(?:supabase-config|remote-config)[^"']*["'][^>]*>[\s\S]*?<\/script>/gi, '');
  html=html.replace(/(<meta name="robots" content=")[^"]*/i, '$1noindex,nofollow');
  html=html.replace(/<head>/i, '<head><script src="/__test/config.js"></script>');
  html=html.replace(/<\/body>/i, '<script src="/__test/panel.js" defer></script></body>');
  return html.replace(/<body([^>]*)>/i, `<body$1><aside id="test-preview-notice" role="note" style="position:relative;z-index:10000;padding:10px 16px;background:#fff3cd;color:#332b00;text-align:center;font:14px/1.5 sans-serif">ЛОКАЛЬНЫЙ ТЕСТ — используйте вымышленные имя и телефон. Товары и заказы тестовые; условия услуг — по данным салона. Заявки, письма и аналитика не отправляются.${extra}</aside>`);
}

/** Pure fixture server factory: importing this module does not listen or start workers. */
export function createTestPreview({products=fixtureProducts,editorial=fixtureEditorial,notice="",contentPreview=true}={}) {
  const accepted={booking:new Map(), order:new Map()};
  let state;
  function reset() {
    accepted.booking.clear(); accepted.order.clear();
    state={fixture:true,orderReady:true,modes:{booking:'success',order:'success',catalog:'success'},counts:{booking:{attempts:0,accepted:0,replayed:0,rejected:0,failed:0,dropped:0},order:{attempts:0,accepted:0,replayed:0,rejected:0,failed:0,dropped:0}},directions:Object.fromEntries(directions.map(key=>[key,0])),orderItems:[],requestLog:[]};
  }
  reset();
  function log(kind, result, safe={}) {
    state.requestLog.push({kind,result,...safe});
    if (state.requestLog.length>200) state.requestLog.shift();
  }
  const snapshot = () => structuredClone(state);
  async function submit(kind, req, res) {
    if (req.method!=='POST') return reply(res,405,{error:'Метод недоступен.'});
    const counts=state.counts[kind]; counts.attempts++;
    if (kind==='order' && !state.orderReady) { counts.failed++; log(kind,'unavailable'); return reply(res,503,{error:'Тест: приём заказов временно недоступен.'}); }
    let payload;
    try { payload=await readJSON(req); }
    catch (error) { counts.rejected++; log(kind,'invalid'); return reply(res,error.status || 400,{error:'Проверьте тестовую заявку.'}); }
    if (!validContact(payload)) { counts.rejected++; log(kind,'invalid'); return reply(res,400,{error:'Укажите тестовое имя, телефон и согласие.'}); }
    let data;
    if (kind==='booking') {
      if (!directions.includes(payload.direction)) { counts.rejected++; log(kind,'invalid-direction'); return reply(res,400,{error:'Выберите направление.'}); }
      data={direction:payload.direction};
    } else {
      if (!Array.isArray(payload.selected_items) || !payload.selected_items.length || payload.selected_items.length>20) { counts.rejected++; log(kind,'invalid-items'); return reply(res,400,{error:'Выберите тестовые товары.'}); }
      const items=[]; const seen=new Set();
      for (const item of payload.selected_items) {
        const product=products.find(product=>product.id===item?.id);
        if (!product || seen.has(item.id) || !Number.isInteger(item.quantity) || item.quantity<1 || item.quantity>10) { counts.rejected++; log(kind,'invalid-items'); return reply(res,409,{error:'Тестовый товар или количество недоступны.'}); }
        seen.add(item.id); items.push({id:item.id,quantity:item.quantity});
      }
      const delivery=payload.delivery_details;
      if (!delivery || !['pickup','delivery'].includes(delivery.method) || (delivery.method==='delivery' && (typeof delivery.city!=='string' || !delivery.city.trim() || typeof delivery.address!=='string' || !delivery.address.trim() || !/^\d{6}$/.test(delivery.postal)))) { counts.rejected++; log(kind,'invalid-delivery'); return reply(res,400,{error:'Проверьте тестовый способ получения.'}); }
      data={items,total:items.reduce((sum,item)=>sum+products.find(product=>product.id===item.id).price*item.quantity,0)};
    }
    // Raw contact/address/comment fields are neither retained nor exposed in logs.
    const fingerprint=digest({customer_name:payload.customer_name.trim(),customer_phone:payload.customer_phone,accepted:payload.accepted,...data,...(kind==='order'?{delivery:payload.delivery_details,comment:payload.customer_comment || ''}:{})});
    const previous=accepted[kind].get(payload.request_id);
    if (previous) {
      if (previous.fingerprint!==fingerprint) { counts.rejected++; log(kind,'conflict'); return reply(res,409,{error:'Данные изменились. Начните новую тестовую заявку.'}); }
      counts.replayed++; log(kind,'replayed',kind==='booking'?data:{}); return reply(res,200,previous.result);
    }
    const mode=state.modes[kind];
    if (mode!=='success') state.modes[kind]='success';
    if (mode==='fail-once') { counts.failed++; log(kind,'simulated-failure'); return reply(res,503,{error:'Тест: временная ошибка. Повторите отправку.'}); }
    const result=kind==='booking'?{accepted:true,id:payload.request_id,direction:data.direction}:{id:payload.request_id,total:data.total};
    accepted[kind].set(payload.request_id,{fingerprint,result}); counts.accepted++;
    if (kind==='booking') state.directions[data.direction]++; else state.orderItems.push(data.items);
    log(kind,'accepted',kind==='booking'?data:{items:data.items,total:data.total});
    if (mode==='drop-once') { counts.dropped++; log(kind,'simulated-response-loss'); req.socket.destroy(); return; }
    return reply(res,200,result);
  }
  const server=createServer(async(req,res)=>{
    headers(res);
    if (!localRequest(req)) return reply(res,403,{error:'Тестовый сервер доступен только локально.'});
    let url;
    try { url=new URL(req.url,`http://${req.headers.host}`); }
    catch { return reply(res,400,{error:'Некорректный адрес.'}); }
    const path=url.pathname;
    try {
      if (path==='/__test/state') return req.method==='GET'?reply(res,200,snapshot()):reply(res,405,{error:'Метод недоступен.'});
      if (path==='/__test/control') {
        if (req.method!=='POST') return reply(res,405,{error:'Метод недоступен.'});
        const value=await readJSON(req);
        if (Object.keys(value).some(key=>!['reset','booking','order','catalog','orderReady'].includes(key)) || (value.reset!==undefined && typeof value.reset!=='boolean') || (value.orderReady!==undefined && typeof value.orderReady!=='boolean') || ['booking','order'].some(key=>value[key]!==undefined&&!modes.includes(value[key])) || (value.catalog!==undefined&&!['success','unavailable'].includes(value.catalog))) return reply(res,400,{error:'Некорректный тестовый режим.'});
        if (value.reset) reset();
        for (const key of ['booking','order','catalog']) if (value[key]!==undefined) state.modes[key]=value[key];
        if (value.orderReady!==undefined) state.orderReady=value.orderReady;
        return reply(res,200,snapshot());
      }
      if (path==='/api/service-bookings') return await submit('booking',req,res);
      if (path==='/api/orders') return await submit('order',req,res);
      if (['/api/orders/status','/api/bookings/status','/api/service-bookings/status'].includes(path)) return req.method==='GET'?reply(res,200,{ready:path==='/api/orders/status'?state.orderReady:true,fixture:true}):reply(res,405,{error:'Метод недоступен.'});
      if (path==='/api/backend/rest/v1/optika_products' && req.method==='GET') {
        if (state.modes.catalog==='unavailable') return reply(res,503,{error:'Тест: каталог временно недоступен.'});
        const offset=Math.max(0,Number(url.searchParams.get('offset'))||0), limit=Math.max(0,Math.min(500,Number(url.searchParams.get('limit'))||500));
        return reply(res,200,products.map(product=>({id:product.id,slug:product.slug,data:product,published:true,updated_at:product.updatedAt})).slice(offset,offset+limit));
      }
      if (path==='/api/backend/rest/v1/optika_content' && req.method==='GET') return reply(res,200,[{id:'homepage',data:editorial,updated_at:'2026-11-06T00:00:00Z'}]);
      if (path.startsWith('/api/') || path.startsWith('/__test/') && !['/__test/config.js','/__test/panel.js'].includes(path)) return reply(res,404,{error:'Этот API отсутствует в локальной тестовой версии.'});
      if (!['GET','HEAD'].includes(req.method)) return reply(res,405,{error:'Метод недоступен.'});
      if (path==='/__test/config.js' || path==='/assets/config.js') return reply(res,200,configScript(contentPreview),'text/javascript; charset=utf-8');
      if (path==='/__test/panel.js') return reply(res,200,await readFile(resolve(projectRoot,'scripts/test-preview-panel.js'),'utf8'),'text/javascript; charset=utf-8');
      if (path==='/assets/data/supabase-config.js') return reply(res,200,`export const supabaseConfig=Object.freeze(${JSON.stringify({url:`http://${req.headers.host}`,apiBase:'/api/backend',publishableKey:'fixture-only-not-a-key',catalogEnabled:true,bookingsEnabled:true})});\n`,'text/javascript; charset=utf-8');
      if (path==='/__fixtures/frame.svg') return reply(res,200,svg,'image/svg+xml');
      if (path==='/robots.txt') return reply(res,200,'User-agent: *\nDisallow: /\n','text/plain; charset=utf-8');
      if (path==='/sitemap.xml') return reply(res,200,sitemap(products),'application/xml; charset=utf-8');
      if (path==='/product' && url.searchParams.has('slug')) { res.setHeader('Location','/product/'+encodeURIComponent(url.searchParams.get('slug'))); return reply(res,308,'','text/plain; charset=utf-8'); }
      if (path.startsWith('/assets/')) {
        let requested;
        try { requested=await realpath(resolve(distRoot,'.'+decodeURIComponent(path))); }
        catch { return reply(res,404,'Not found','text/plain; charset=utf-8'); }
        if (!requested.startsWith(distRoot+sep)) return reply(res,404,'Not found','text/plain; charset=utf-8');
        return reply(res,200,await readFile(requested),mime[extname(requested)] || 'application/octet-stream');
      }
      if (state.modes.catalog==='unavailable') { res.setHeader('Retry-After','60'); return reply(res,503,decorateHTML('<!doctype html><html lang="ru"><head><meta name="robots" content="noindex,nofollow"><title>Тест: временно недоступно</title></head><body><h1>Тестовый каталог временно недоступен</h1><p>Повторите загрузку после восстановления тестовых данных.</p></body></html>'),'text/html; charset=utf-8'); }
      const shell=await readFile(resolve(distRoot,'index.html'),'utf8');
      const result=renderPage(shell,path.replace(/\/$/,'') || '/',products,editorial,{preview:contentPreview});
      return reply(res,result.status,decorateHTML(result.html,notice),'text/html; charset=utf-8');
    } catch (error) {
      return reply(res,error.status || 500,{error:error.status?'Некорректные тестовые данные.':'Ошибка локального тестового сервера.'});
    }
  });
  return {server,snapshot};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const port=Number(process.env.OPTIKA_TEST_PORT || 4174);
  if (!Number.isInteger(port) || port<1024 || port>65535) throw new Error('OPTIKA_TEST_PORT must be between 1024 and 65535.');
  const {server}=createTestPreview();
  server.listen(port,'127.0.0.1',()=>process.stdout.write(`Local fixture preview: http://127.0.0.1:${port}\nNo live catalog, mail or analytics.\n`));
}
