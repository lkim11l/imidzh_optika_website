import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source=await readFile(new URL('../dist/assets/admin.js',import.meta.url),'utf8');
const start=source.indexOf('function renderBookings(bookings)');
const end=source.indexOf("window.addEventListener('optika:session-ended'",start);
assert.ok(start>0&&end>start,'Real admin renderer and direction helper must be present');
// Execute the actual renderer and its escaping helper, without imports, auth,
// session restore or backend initialization from the rest of the admin module.
const rendererSource=source.split('\n').find(line=>line.startsWith('const esc='))+'\n'+source.slice(start,end);
const row={id:'local-booking-1',name:'Тестовая заявка',phone:'+70000000001',created_at:'2026-11-08T09:15:00.000Z',status:'new'};
function render(bookings){
 const workspace={innerHTML:''},refresh={},tabs=[];
 const context={Date,busy:false,document:{
  querySelector(selector){assert.ok(['#workspace-body','#refresh'].includes(selector));return selector==='#workspace-body'?workspace:refresh;},
  querySelectorAll(selector){assert.ok(['[data-status]','[data-delete-booking]'].includes(selector));return [];}
 },showTab:tab=>tabs.push(tab)};
 context.$=selector=>context.document.querySelector(selector);
 vm.createContext(context);vm.runInContext(rendererSource,context,{timeout:1000});
 context.renderBookings(bookings);assert.equal(typeof refresh.onclick,'function');refresh.onclick();assert.deepEqual(tabs,['bookings']);
 return workspace.innerHTML;
}
// Exact original HTML for this fictional row, captured before direction support.
// Comparing the complete result catches markup, copy, status or action drift.
function originalHTML({fitting=false}={}){
 const date=new Date(row.created_at).toLocaleString('ru-RU');
 return '<div class="heading"><div><h1>Заявки</h1><p class="count">Последние 500 заявок · 1 новых</p></div><button id="refresh">Обновить</button></div>'+
 '<div class="table-wrap"><table><thead><tr><th>Дата</th><th>Имя</th><th>Телефон</th><th>Обращение</th><th>Статус</th><th>Действие</th></tr></thead><tbody>'+
 `<tr><td>${date}</td><td>Тестовая заявка</td><td><a href="tel:+70000000001">+70000000001</a></td><td>${fitting?'Примерка<p>Оправа &lt;примерка&gt;</p>':'Проверка зрения'}</td>`+
 '<td><select class="status-select" aria-label="Статус заявки Тестовая заявка" data-status="local-booking-1" data-current="new">'+
 '<option value="new" selected>Новая</option><option value="contacted" >Связались</option><option value="closed" >Закрыта</option></select></td>'+
 '<td><button class="danger" data-delete-booking="local-booking-1" aria-label="Удалить заявку Тестовая заявка">Удалить</button></td></tr></tbody></table></div>';
}

test('actual admin renderer keeps complete legacy vision-check HTML and original refresh action unchanged',()=>{
 for(const extra of [{},{kind:'vision'},{direction:'vision_check'},{kind:'vision',direction:'vision_check'},{direction:null}]){
  assert.equal(render([{...row,...extra}]),originalHTML());
 }
 assert.ok(source.includes("b.kind==='fitting'?'Примерка':'Проверка зрения'"));
});

test('actual admin renderer changes only the request label for the two explicitly supported new directions',()=>{
 for(const [direction,label]of [['progressive','Прогрессивные очки'],['miyosmart','Заказ HOYA MiYOSMART по рецепту']]){
  const actual=render([{...row,kind:'vision',direction}]);
  assert.equal(actual,originalHTML().replace('<td>Проверка зрения</td>','<td>'+label+'</td>'));
 }
});

test('fitting remains byte-for-byte identical even when a new or default direction is present',()=>{
 for(const direction of [undefined,'vision_check','progressive','miyosmart','<img src=x onerror=alert(1)>']){
  assert.equal(render([{...row,kind:'fitting',product_label:'Оправа <примерка>',direction}]),originalHTML({fitting:true}));
 }
});

test('unrecognized and hostile direction values never become dynamic labels or HTML',()=>{
 for(const direction of ['unknown','constructor','toString','__proto__','<script>alert(1)</script>','<img src=x onerror="alert(1)">',{toString(){throw Error('Direction must not be coerced');}}]){
  const actual=render([{...row,direction}]);assert.equal(actual,originalHTML());assert.doesNotMatch(actual,/<script|onerror|constructor|__proto__/);
 }
 const escaped=render([{...row,name:'<img onerror="alert(1)">',direction:'miyosmart'}]);
 assert.ok(escaped.includes('&lt;img onerror=&quot;alert(1)&quot;&gt;'));assert.doesNotMatch(escaped,/<img/);
});
