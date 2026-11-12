'use strict';
/* Лаборатория таблицы «Рассчитанные конструкции».
   Каждая страница — отдельный способ снять с рабочего поля громоздкую таблицу.
   Данные демонстрационные, основной проект не меняется. */

const D=window.RESULTS_LAB_DATA;
window.addEventListener('error',event=>{document.documentElement.dataset.jsError=String(event.message||'error')});
const rows=D.rows;
const COLUMNS=D.columns;
const byId=id=>rows.find(r=>r.id===id);
const FMT={};
COLUMNS.forEach(c=>{FMT[c.key]=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:c.digits})});
const cell=(row,key)=>{const v=row[key];if(v==null||v==='')return '—';return typeof v==='number'?FMT[key].format(v):String(v)};
const route=n=>'variant-'+String(n).padStart(2,'0')+'.html';
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

const CONCEPTS=[
 ['Строка-сводка','Так было бы видно по умолчанию: одна строка над чертежом, таблица раскрывается по запросу.','stripe','Сверху','0 px в покое'],
 ['Нижняя выдвижная панель','Таблица выезжает поверх нижней части рабочего поля и закрывается после выбора.','bottom','Поверх','Чертёж не сжимается'],
 ['Боковая панель справа','Каталог выезжает справа поверх чертежа.','drawer','Поверх','Ширина не меняется'],
 ['Модальное окно','Полная таблица в отдельном окне; после выбора окно закрывается.','modal','Поверх','Рабочее поле не меняется'],
 ['Отдельный экран','Таблица занимает всю рабочую область, чертёж ждёт за кнопкой возврата.','screen','Отдельный режим','Максимум места для данных'],
 ['Вкладки «Чертёж / Конструкции»','Одна область, два режима, переключение без наложения.','tabs','Вкладка','Тот же объём экрана'],
 ['Постоянная панель справа','Узкий список карточек вместо таблицы: 16 колонок не нужны.','panel','Сбоку','−¼ ширины постоянно'],
 ['Строка с раскрытием','Три главных показателя, остальные — по клику на строку.','expand','Снизу','Панель 220 px'],
 ['Пресеты колонок','«Основные / геометрия / тепло» вместо всех 16 столбцов сразу.','cols','Наложение','Таблица без прокрутки'],
 ['Мастер отбора','Три вопроса сужают список до нескольких вариантов.','wizard','Сверху','Таблица почти не нужна'],
 ['Карта компромиссов','Длина и диаметр на одной карте; точка — конструкция.','scatter','Наложение','Вместо таблицы карта'],
 ['Сравнение трёх','Отметить до трёх вариантов и сравнить их рядом.','compare','Наложение','Таблица только для избранных'],
 ['Док с изменяемой высотой','Тянется за верхний край и сворачивается в полоску.','dock','Снизу','Высоту задаёт пользователь'],
 ['Приоритеты','Один вопрос — что важнее — и одна рекомендация с причиной.','goals','Сверху','Каталог под кнопкой'],
 ['Дерево компоновок','Ряды и трубки как группы, таблица — только для выбранной группы.','tree','Слева','Список из 5–10 строк'],
 ['По одной конструкции','Карточка и стрелки вместо списка.','stepper','Сверху','Список не нужен вовсе'],
 ['Группы по рядам','Заголовки групп с итогами, строки внутри сворачиваются.','groups','Наложение','Контекст сохраняется'],
 ['Плотная таблица','Два уровня текста, полосы вместо цифр, закреплённые столбцы.','dense','Снизу','Вдвое больше строк'],
 ['Мини-панель поверх чертежа','Небольшая таблица в углу чертежа, которую можно свернуть.','pip','Поверх','Наложение 320×220'],
 ['Быстрый поиск Ctrl K','Поле поиска и короткий список; полная таблица не нужна.','command','По клавише','Открывается по требованию']
];

const page=Number(document.body.dataset.variant||0);
const concept=page?CONCEPTS[page-1]:null;
const type=concept?concept[2]:null;

let selectedId=D.recommendedId;
let previewId=D.recommendedId;
/* В демонстрации каталог раскрыт там, где он не отнимает высоту у чертежа. */
const OPEN_BY_DEFAULT=[2,3,4,5,6,9,11,12,13,17,20];
let open=OPEN_BY_DEFAULT.includes(page);
let sortKey='rank';
let dir='asc';
let scope='front';
let query='';
let preset='all';
let goal='balance';
let groupFilter=null;
let collapsed=new Set();
let expanded=new Set();
let comparison=[D.recommendedId,rows[3].id,rows[5].id];
let wizard={rows:null,maxLength:null,maxMetres:null};
let dockHeight=300;
let dockCollapsed=false;
let pipOpen=true;
let columnsOn=new Set(COLUMNS.map(c=>c.key));

const PRESETS={
 core:['rank','id','height','diameter','count','rowCount'],
 geometry:['rank','id','height','diameter','count','rowCount','tubeMetres','stockMetres'],
 thermal:['rank','id','height','diameter','duty','area','ua','k','reHot','reCold'],
 all:COLUMNS.map(c=>c.key)
};
const colsByKeys=keys=>keys.map(k=>COLUMNS.find(c=>c.key===k)).filter(Boolean);

function rowMark(row){return row.id===D.recommendedId?'<span class="star" title="Рекомендация">★</span> ':''}
function warnMark(row){return row.warning?' <span class="pill warn" title="'+row.warning+'">!</span>':''}
function nameOf(row){return rowMark(row)+'№'+row.id+warnMark(row)}

function visibleRows(){
 const q=query.trim();
 let list=rows.filter(r=>scope==='front'?r.rank!=null:true);
 if(groupFilter!=null)list=list.filter(r=>r.rowCount===groupFilter);
 if(q)list=list.filter(r=>`${r.id} ${r.height} ${r.diameter} ${r.count} ${r.rowCount} ${r.tubeMetres}`.includes(q));
 const sign=dir==='asc'?1:-1;
 return [...list].sort((a,b)=>{
  const av=a[sortKey],bv=b[sortKey];
  if(av==null||bv==null)return av==null?1:-1;
  return sign*(av-bv)||a.id-b.id;
 });
}

function sortButton(key,label){
 const active=key===sortKey;
 return `<button type="button" data-sort="${key}">${label}<span class="arrow" aria-hidden="true">${active?(dir==='asc'?'↑':'↓'):'↕'}</span></button>`;
}

function tableMarkup(options){
 const opts=options||{};
 const cols=opts.cols||colsByKeys(PRESETS[preset]);
 const list=opts.rows||visibleRows();
 const dense=!!opts.dense;
 if(!list.length)return '<p class="tbl-empty">Ничего не найдено. Измените фильтр или состав каталога.</p>';
 const head=`<tr><th class="pick" scope="col"><span class="sr-only">Выбор</span></th>${cols.map(c=>{
  const active=c.key===sortKey;
  return `<th scope="col" data-key="${c.key}" aria-sort="${active?(dir==='asc'?'ascending':'descending'):'none'}">${sortButton(c.key,c.label)}</th>`;
 }).join('')}</tr>`;
 const body=list.map(row=>{
  const tds=cols.map(c=>{
   if(c.key==='rank')return `<td class="num">${row.rank==null?'—':row.rank}</td>`;
   if(c.key==='id')return `<td class="name">${nameOf(row)}</td>`;
   if(dense&&c.key==='tubeMetres')return `<td class="num">${cell(row,c.key)}<span class="bar"><i style="width:${Math.round(row.tubeMetres/16*100)}%"></i></span></td>`;
   if(dense&&c.key==='height')return `<td class="num">${cell(row,c.key)}<span class="bar"><i style="width:${Math.round(row.height/1000*100)}%"></i></span></td>`;
   return `<td class="num">${cell(row,c.key)}</td>`;
  }).join('');
  const current=row.id===selectedId?' data-current="true"':'';
  const preview=row.id===previewId?' data-picked="true"':'';
  const main=`<tr${current}${preview} data-preview-row="${row.id}"${opts.expandable?' data-expand-row="true"':''}><td class="pick"><input class="dot" type="radio" name="pick-${opts.key||'t'}" value="${row.id}" ${row.id===previewId?'checked':''} data-preview="${row.id}" aria-label="Предпросмотр конструкции №${row.id}"></td>${tds}</tr>`;
  if(opts.expandable&&expanded.has(row.id)){
   const rest=COLUMNS.filter(c=>!cols.includes(c));
   return main+`<tr class="detail-row"><td></td><td colspan="${cols.length}"><dl class="detail-grid">${rest.map(c=>`<div><dt>${c.label}</dt><dd>${cell(row,c.key)}</dd></div>`).join('')}</dl></td></tr>`;
  }
  return main;
 }).join('');
 return `<table class="tbl${dense?' dense':''}"><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function card(row,extra){
 return `<button type="button" class="card" data-preview="${row.id}" aria-pressed="${previewId===row.id}">
  <span class="card-top"><span class="card-title">${nameOf(row)}</span><small>${row.id===selectedId?'В работе':row.rank===1?'Рекомендован':row.rowCount+' ряд · '+row.count+' трубок'}</small></span>
  <span class="card-dim">${row.height} <span>× Ø</span> ${row.diameter} <span>мм</span></span>
  <span class="card-foot"><span>${cell(row,'tubeMetres')} м трубы</span><span>${cell(row,'duty')} кВт</span></span>
  ${extra||''}</button>`;
}

function toolbarMarkup(){
 return `<div class="tbar">
  <label class="grow"><span class="sr-only">Поиск по конструкции</span><input type="search" data-search placeholder="Номер, длина, диаметр…" value="${query}"></label>
  <label><span class="sr-only">Состав</span><select data-scope><option value="front"${scope==='front'?' selected':''}>12 компромиссов</option><option value="all"${scope==='all'?' selected':''}>Все ${rows.length}</option></select></label>
 </div>`;
}

function sheetHead(title,sub,withClose){
 return `<div class="sheet-head"><div><h3>${title}</h3><span class="meta">${sub}</span></div><div class="right">${withClose?'<button type="button" class="close-x" data-action="close" aria-label="Закрыть">×</button>':''}</div></div>`;
}

function applyBar(label){
 const row=byId(previewId);
 const changed=previewId!==selectedId;
 return `<footer class="apply-bar"><span class="sel"><span>${nameOf(row)} · ${row.height} × Ø${row.diameter} мм</span><small>${changed?'Предпросмотр — в проработке №'+selectedId:'Уже используется в проработке'}</small></span><span class="spacer"></span><button type="button" class="primary" data-action="apply" ${changed?'':'disabled'}>Применить</button></footer>`;
}

function catalogPanel(options){
 const opts=options||{};
 return `<section class="floating" style="${opts.style||''}" role="dialog" aria-modal="true" aria-label="Каталог конструкций">
  ${sheetHead(opts.title||'Рассчитанные конструкции',opts.sub||('Поверок '+D.evaluations.toLocaleString('ru-RU')+' · подходящих '+rows.length+' · компромиссов '+D.frontSize),true)}
  ${opts.toolbar===false?'':toolbarMarkup()}
  <div class="tbl-wrap" style="${opts.wrapStyle||''}">${tableMarkup(opts)}</div>
  ${applyBar()}
 </section>`;
}

/* ---------------- shell ---------------- */

function shell(){
 document.body.dataset.layout=type;
 $('#app').innerHTML=`<header class="site-header"><a class="brand" href="../results-table-variants.html"><img src="../physnow-logo.png" alt="">PhysNow</a><nav aria-label="Разделы"><a href="../../index.html">Проектировочный</a><a href="../../index.html#construction-page">Проработка</a><span class="nav-active">Таблица результатов</span></nav><span class="hdr-chip">Демо · Змеевиковый</span><a class="hdr-link" href="../results-table-variants.html">Все 20 вариантов ↗</a></header>
 <section class="labbar"><div class="labbar-main"><span class="variant-number">${String(page).padStart(2,'0')}</span><h1>${concept[0]}</h1><span class="labnote">${concept[1]} <b style="color:#9fb6c9">· ${concept[4]}</b></span></div>
 <div class="lab-nav"><a href="${route(page===1?20:page-1)}" aria-label="Предыдущий вариант">←</a><select id="variant-picker" aria-label="Вариант">${CONCEPTS.map(([name],i)=>`<option value="${i+1}"${i+1===page?' selected':''}>${String(i+1).padStart(2,'0')} · ${name}</option>`).join('')}</select><a href="${route(page===20?1:page+1)}" aria-label="Следующий вариант">→</a></div></section>
 <main class="workbench">
  <div class="work-head"><h2>Проработка конструкции</h2><span class="demo-label">демонстрационные данные</span><span class="work-state" id="state-label" role="status"></span></div>
  <div id="top-slot"></div>
  <div class="workspace" id="workspace">
   <aside class="parameters"><div class="panel-head">Конструктивные параметры</div><div class="param-body">
    <p>Змеевиковый аппарат</p>
    <h3>Корпус</h3>
    <label>Диаметр <span><input id="g-diameter" type="number" value="140" readonly> мм</span></label>
    <label>Рабочая высота <span><input id="g-height" type="number" value="398" readonly> мм</span></label>
    <h3>Змеевики</h3>
    <label>Трубок <span><input id="g-count" type="number" value="4" readonly> шт.</span></label>
    <label>Рядов <span><input id="g-rows" type="number" value="1" readonly> шт.</span></label>
    <label>Труба <span><input id="g-metres" type="number" value="9.674" readonly> м</span></label>
    <p class="param-note">Значения подставлены из выбранной строки таблицы — только для демонстрации.</p>
   </div></aside>
   <div id="left-slot"></div>
   <section class="drawing-panel"><div class="panel-head"><span>Компоновка аппарата</span><div class="canvas-tools" id="canvas-tools"></div></div>
    <div id="canvas-body"><div class="drawing-grid">${D.drawings.map((svg,i)=>`<figure class="${i===1?'side':''}"><figcaption>${['Вид сверху','Продольное сечение','Зазоры между трубками'][i]}<small>${['Вид А','Сечение Б','Узел'][i]}</small></figcaption>${svg}</figure>`).join('')}</div><div class="drawing-summary" id="drawing-summary"></div></div>
    <div id="canvas-replacement" hidden></div>
    <div id="pip-root"></div>
   </section>
   <div id="right-slot"></div>
  </div>
  <div id="bottom-slot"></div>
 </main>
 <div id="overlay-root"></div>
 <div id="notification" class="notification" role="status" hidden></div>`;

 $('#variant-picker').addEventListener('change',e=>{location.href=route(Number(e.target.value))});
 document.addEventListener('click',onClick);
 document.addEventListener('change',onChange);
 document.addEventListener('input',onInput);
 document.addEventListener('keydown',onKey);
}

function render(){
 clearSlots();
 $('#canvas-body').hidden=false;
 $('#canvas-replacement').hidden=true;
 $('#workspace').classList.remove('has-left','has-right');
 const row=byId(selectedId);
 $('#state-label').textContent='В работе · №'+selectedId;
 [['g-diameter','diameter'],['g-height','height'],['g-count','count'],['g-rows','rowCount'],['g-metres','tubeMetres']].forEach(([id,key])=>{
  const el=document.getElementById(id);
  if(el)el.value=row[key];
 });
 for(const text of $$('.drawing-grid svg text')){
  text.dataset.original??=text.textContent;
  text.textContent=text.dataset.original
   .replace(/Корпус Ø \d+ \/ внутри Ø \d+/,'Корпус Ø '+row.diameter+' / внутри Ø '+(row.diameter-2))
   .replace(/H = \d+/,'H = '+row.height);
 }
 $('#drawing-summary').innerHTML=`<strong>${nameOf(row)}</strong><span class="sep"></span><span>Высота ${row.height} мм</span><span>Диаметр ${row.diameter} мм</span><span>${row.count} трубок · ${row.rowCount} ряд</span><span>${cell(row,'tubeMetres')} м трубы</span><span class="sep"></span><small>${previewId!==selectedId?'предпросмотр №'+previewId:'выбрано'}</small>`;
 const renderers={1:v1,2:v2,3:v3,4:v4,5:v5,6:v6,7:v7,8:v8,9:v9,10:v10,11:v11,12:v12,13:v13,14:v14,15:v15,16:v16,17:v17,18:v18,19:v19,20:v20};
 renderers[page]();
}

function clearSlots(){
 ['#top-slot','#left-slot','#right-slot','#bottom-slot','#canvas-tools','#canvas-replacement','#overlay-root','#pip-root'].forEach(s=>{const el=$(s);if(el)el.innerHTML=''});
 if($('#pip-root'))$('#pip-root').className='';
}

function replaceCanvas(html){
 $('#canvas-body').hidden=true;
 $('#canvas-replacement').hidden=false;
 $('#canvas-replacement').innerHTML=html;
}

/* ---------------- variants ---------------- */

function v1(){
 $('#top-slot').innerHTML=`<div class="note-strip"><b>Вариант 1.</b> В покое таблица не занимает места: остаётся одна строка с рекомендацией. Раскрытие — по кнопке.</div>
 <section class="catalog-strip" id="strip">
  <span class="strip-line"><span class="star">★</span> Рекомендация <b>№${D.recommendedId}</b> <small>${byId(D.recommendedId).height} × Ø${byId(D.recommendedId).diameter} мм · ${cell(byId(D.recommendedId),'tubeMetres')} м трубы · ${D.frontSize} компромиссов из ${rows.length}</small></span>
  <button type="button" class="ghost-btn" data-action="toggle" aria-expanded="${open}">${open?'Свернуть':'Другие конструкции · '+D.frontSize} <span aria-hidden="true">⌄</span></button>
 </section>
 ${open?`<section style="display:flex;flex-direction:column;min-height:0;flex:none;max-height:min(300px,34dvh);border:1px solid #333;border-radius:10px;background:#1c1c1c;overflow:hidden">${sheetHead('Все рассчитанные конструкции',`Поверок ${D.evaluations.toLocaleString('ru-RU')} · подходящих ${rows.length}`,true)}${toolbarMarkup()}<div class="tbl-wrap" style="flex:1">${tableMarkup({})}</div>${applyBar()}</section>`:''}`;
}

function v2(){
 $('#canvas-tools').innerHTML=overlayLauncher('Снизу');
 if(!open)return;
 $('#overlay-root').innerHTML=`<div class="backdrop" data-action="close"></div>${catalogPanel({style:'left:max(16px,6vw);right:max(16px,6vw);bottom:14px;height:min(440px,64dvh);border-radius:14px'})}`;
}

function v3(){
 $('#canvas-tools').innerHTML=overlayLauncher('Сбоку');
 if(!open)return;
 $('#overlay-root').innerHTML=`<div class="backdrop" data-action="close"></div>${catalogPanel({style:'right:12px;top:62px;bottom:12px;width:min(540px,52vw);border-radius:13px'})}`;
}

function v4(){
 $('#canvas-tools').innerHTML=overlayLauncher('Окно');
 if(!open)return;
 $('#overlay-root').innerHTML=`<div class="backdrop" data-action="close"></div>${catalogPanel({style:'left:50%;top:50%;transform:translate(-50%,-50%);width:min(1080px,92vw);height:min(560px,78dvh);border-radius:14px',title:'Выбор конструкции',sub:'Полная таблица · 16 показателей'})}`;
}

function v5(){
 $('#canvas-tools').innerHTML=overlayLauncher('Экран');
 if(!open)return;
 $('#overlay-root').innerHTML=`<div class="catalog-screen"><header class="sheet-head"><button type="button" class="ghost-btn" data-action="close">← К проработке</button><div><h3>Рассчитанные конструкции</h3><span class="meta">Весь каталог на одном экране</span></div></header>${toolbarMarkup()}<div class="tbl-wrap" style="flex:1">${tableMarkup({})}</div>${applyBar()}</div>`;
}

function overlayLauncher(label){
 return `<button type="button" class="ghost-btn" data-action="toggle" aria-expanded="${open}">${open?'Скрыть таблицу':'Конструкции · '+label}</button>`;
}

function v6(){
 $('#canvas-tools').innerHTML=`<div class="seg"><button type="button" data-action="close" aria-pressed="${!open}">Чертёж</button><button type="button" data-action="toggle" aria-pressed="${open}">Конструкции · ${D.frontSize}</button></div>`;
 if(open)replaceCanvas(`<div style="display:flex;flex-direction:column;height:100%;min-height:0;padding:9px;gap:0">${sheetHead('Рассчитанные конструкции','Показатели из проверенных поверок Teplo',false)}${toolbarMarkup()}<div class="tbl-wrap" style="flex:1">${tableMarkup({})}</div>${applyBar()}</div>`);
}

function v7(){
 $('#workspace').classList.add('has-right');
 $('#right-slot').innerHTML=`<section style="display:flex;flex-direction:column;flex:1;min-height:0;border:1px solid #333;border-radius:11px;background:#1c1c1c;overflow:hidden">
  ${sheetHead('Конструкции',D.frontSize+' компромиссов')}
  <div class="tbar" style="padding:7px 9px">${toolbarMarkup().replace('class="tbar"','class="tbar" style="padding:0;border:0"')}</div>
  <div class="tbl-wrap" style="flex:1;padding:7px 8px"><div style="display:flex;flex-direction:column;gap:6px">${visibleRows().map(r=>card(r)).join('')}</div></div>
  ${applyBar()}
 </section>`;
}

function v8(){
 $('#bottom-slot').innerHTML=`<section style="display:flex;flex-direction:column;height:252px;min-height:0;flex:none;border:1px solid #333;border-radius:10px;background:#1c1c1c;overflow:hidden">
  ${sheetHead('Рассчитанные конструкции','Три показателя; клик по строке раскрывает остальные')}
  ${toolbarMarkup()}
  <div class="tbl-wrap" style="flex:1">${tableMarkup({cols:colsByKeys(['rank','id','height','diameter','tubeMetres']),expandable:true,key:'v8'})}</div>
  ${applyBar()}
 </section>`;
}

function v9(){
 $('#canvas-tools').innerHTML=`<button type="button" class="ghost-btn" data-action="toggle" aria-expanded="${open}">${open?'К чертежу':'Таблица с пресетами'}</button>`;
 if(!open)return;
 const cols=colsByKeys(PRESETS[preset]).filter(c=>columnsOn.has(c.key));
 replaceCanvas(`<div style="display:flex;flex-direction:column;height:100%;min-height:0;padding:9px;gap:0">
  ${sheetHead('Пресеты колонок','Выберите набор — таблица перестаёт быть широкой',false)}
  <div class="tbar">
   <div class="seg">${[['core','Основные'],['geometry','Геометрия'],['thermal','Тепло'],['all','Все 16']].map(([k,l])=>`<button type="button" data-preset="${k}" aria-pressed="${preset===k}">${l}</button>`).join('')}</div>
   <span style="width:1px;height:16px;background:#333"></span>
   ${COLUMNS.filter(c=>PRESETS[preset].includes(c.key)).map(c=>`<label class="chip" aria-pressed="${columnsOn.has(c.key)}" data-col="${c.key}">${c.label}</label>`).join('')}
  </div>
  <div class="tbl-wrap" style="flex:1">${tableMarkup({cols})}</div>${applyBar()}
 </div>`);
}

function wizardList(){
 return rows.filter(r=>(wizard.rows==null||r.rowCount===wizard.rows)&&(wizard.maxLength==null||r.height<=wizard.maxLength)&&(wizard.maxMetres==null||r.tubeMetres<=wizard.maxMetres)).sort((a,b)=>(a.rank||99)-(b.rank||99)||a.id-b.id);
}

function v10(){
 const result=wizardList();
 $('#top-slot').innerHTML=`<section style="display:flex;flex-direction:column;gap:8px;border:1px solid #333;border-radius:10px;background:#1a1a1a;padding:10px 12px;flex:none">
  <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
   <span style="font-size:11px;color:#8f979f">Шаг 1 · Компоновка</span>
   <div class="chips">${[1,2,3,4].map(n=>`<button type="button" class="chip" data-wizard="rows" data-value="${n}" aria-pressed="${wizard.rows===n}">${n} ряд${n>1?'а':''}</button>`).join('')}</div>
   <span style="width:1px;height:16px;background:#333"></span>
   <span style="font-size:11px;color:#8f979f">Шаг 2 · Высота до</span>
   <div class="chips">${[400,600,1000].map(n=>`<button type="button" class="chip" data-wizard="maxLength" data-value="${n}" aria-pressed="${wizard.maxLength===n}">${n} мм</button>`).join('')}</div>
   <span style="width:1px;height:16px;background:#333"></span>
   <span style="font-size:11px;color:#8f979f">Шаг 3 · Трубы до</span>
   <div class="chips">${[11,13,16].map(n=>`<button type="button" class="chip" data-wizard="maxMetres" data-value="${n}" aria-pressed="${wizard.maxMetres===n}">${n} м</button>`).join('')}</div>
   <button type="button" class="ghost-btn" data-action="wizard-reset" style="margin-left:auto">Сбросить</button>
  </div>
  <div style="display:flex;gap:8px;align-items:stretch;min-height:0">
   ${result.slice(0,3).map(r=>card(r)).join('')||'<p class="hint" style="padding:12px">Ни одна конструкция не подходит — ослабьте условия.</p>'}
   <div style="display:flex;flex-direction:column;gap:6px;justify-content:center;padding-left:8px;border-left:1px solid #2c2c2c;min-width:170px">
    <span style="font-size:11px;color:#93a4b3">Подходит: <b style="color:#dfeaf4">${result.length}</b></span>
    <button type="button" class="ghost-btn" data-action="toggle" aria-expanded="${open}">${open?'Свернуть список':'Показать все '+result.length}</button>
   </div>
  </div>
 </section>
 ${open?`<section style="flex:none;max-height:min(240px,30dvh);display:flex;flex-direction:column;border:1px solid #333;border-radius:10px;background:#1c1c1c;overflow:hidden">${sheetHead('Результат отбора','Строки, прошедшие три шага',true)}<div class="tbl-wrap" style="flex:1">${tableMarkup({rows:result})}</div>${applyBar()}</section>`:''}`;
}

function v11(){
 $('#canvas-tools').innerHTML=`<button type="button" class="ghost-btn" data-action="toggle" aria-expanded="${open}">${open?'К чертежу':'Карта компромиссов'}</button>`;
 if(!open)return;
 const list=visibleRows();
 const x=v=>36+(v-115)/140*520;
 const y=v=>250-(v-230)/760*220;
 replaceCanvas(`<div style="display:flex;flex-direction:column;height:100%;min-height:0;padding:10px">
  ${sheetHead('Карта компромиссов','Горизонталь — диаметр, вертикаль — высота аппарата',false)}
  <div style="flex:1;min-height:0;display:flex;gap:12px">
   <div style="flex:1;min-width:0;display:flex;flex-direction:column">
    <svg viewBox="0 0 600 300" style="width:100%;flex:1;min-height:0" role="img" aria-label="Карта длины и диаметра конструкций">
     ${[0,1,2,3,4].map(i=>`<path d="M36 ${250-i*55}H570" stroke="#2b2b2b"/><text x="6" y="${254-i*55}" fill="#7f8b95" font-size="9">${Math.round(230+i*190)}</text>`).join('')}
     ${[0,1,2,3,4].map(i=>`<path d="M36 ${250-i*55}V${250-i*55}" stroke="none"/>`).join('')}
     <path d="M36 20V250H570" stroke="#3a3a3a" fill="none"/>
     ${list.map(r=>`<g data-preview="${r.id}" style="cursor:pointer"><circle cx="${x(r.diameter).toFixed(1)}" cy="${y(r.height).toFixed(1)}" r="${r.id===previewId?9:6}" fill="${r.id===previewId?'#d7e9ff':'#5d90bd'}" stroke="#a4c6e4" stroke-width="1"/><text x="${(x(r.diameter)+11).toFixed(1)}" y="${(y(r.height)+3).toFixed(1)}" fill="#8fa3b3" font-size="9">${r.id}</text></g>`).join('')}
     <text x="300" y="284" fill="#7f8b95" font-size="9.5" text-anchor="middle">Наружный диаметр, мм →</text>
    </svg>
   </div>
   <div style="width:260px;flex:none;display:flex;flex-direction:column;gap:8px">
    ${card(byId(previewId))}
    <p class="hint">Каждая точка — проверенная конструкция. Наведите или нажмите, чтобы увидеть параметры; лишние точки скрывает фильтр «только компромиссы».</p>
    ${applyBar()}
   </div>
  </div>
 </div>`);
}

function v12(){
 $('#right-slot').innerHTML=`<section style="display:flex;flex-direction:column;flex:1;min-height:0;border:1px solid #333;border-radius:11px;background:#1c1c1c;overflow:hidden">
  ${sheetHead('В сравнение',comparison.length+' из 3')}
  <div class="tbl-wrap" style="flex:1;padding:5px 8px"><div style="display:flex;flex-direction:column;gap:2px">
   ${rows.filter(r=>r.rank!=null).map(r=>`<label style="display:flex;align-items:center;gap:8px;padding:6px 4px;font-size:11px;cursor:pointer" class="${comparison.includes(r.id)?'is-on':''}"><input class="plain" type="checkbox" data-cmp="${r.id}" ${comparison.includes(r.id)?'checked':''} ${!comparison.includes(r.id)&&comparison.length>=3?'disabled':''}><span>${nameOf(r)}</span><span style="margin-left:auto;color:#8b98a2;font-size:10px">${r.height} × Ø${r.diameter}</span></label>`).join('')}
  </div></div>
  <div style="padding:8px 10px;border-top:1px solid #2d2d2d"><button type="button" class="primary" style="width:100%" data-action="toggle">${open?'Скрыть сравнение':'Сравнить выбранные'}</button></div>
 </section>`;
 if(!open)return;
 const picked=comparison.map(byId).filter(Boolean);
 const metrics=[['rank','Место'],['height','Длина, мм'],['diameter','Диаметр, мм'],['count','Трубок'],['rowCount','Рядов'],['tubeMetres','Труба, м'],['stockMetres','Закупка, м'],['area','Площадь, м²'],['duty','Мощность, кВт'],['reHot','Re трубный'],['ua','UA, Вт/К'],['k','K, Вт/(м²·К)']];
 replaceCanvas(`<div style="display:flex;flex-direction:column;height:100%;min-height:0;padding:9px">
  ${sheetHead('Сравнение '+picked.length+' конструкций','Только выбранные строки — таблица перестаёт быть широкой',false)}
  <div class="tbl-wrap" style="flex:1"><table class="tbl"><thead><tr><th style="text-align:left">Показатель</th>${picked.map(r=>`<th style="text-align:right"><button type="button" data-preview="${r.id}">${nameOf(r)}</button></th>`).join('')}</tr></thead>
  <tbody>${metrics.map(([key,label])=>`<tr><td style="text-align:left;color:#9aa5ae">${label}</td>${picked.map(r=>`<td class="num">${cell(r,key)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
  ${applyBar()}
 </div>`);
}

function v13(){
 const collapsedNow=dockCollapsed;
 $('#bottom-slot').innerHTML=`<section class="dock" id="dock" style="height:${collapsedNow?'36':dockHeight}px">
  <div class="dock-grip" id="dock-grip" role="separator" aria-orientation="horizontal" aria-label="Высота таблицы" tabindex="0"><span></span></div>
  <div class="dock-head"><strong>Рассчитанные конструкции</strong><span class="meta">${D.frontSize} компромиссов · ${rows.length} подходящих</span>
   <span class="spacer"></span>
   <button type="button" class="icon-btn" data-dock="36" aria-label="Свернуть в полоску" title="Свернуть">⌄</button>
   <button type="button" class="icon-btn" data-dock="210" aria-label="Средняя высота" title="Средняя">▭</button>
   <button type="button" class="icon-btn" data-dock="420" aria-label="Большая высота" title="Развернуть">⌃</button>
  </div>
  ${collapsedNow?'':`${toolbarMarkup()}<div class="tbl-wrap" style="flex:1">${tableMarkup({})}</div>${applyBar()}`}
 </section>`;
 wireDock();
}

function wireDock(){
 const grip=$('#dock-grip'),dock=$('#dock');
 if(!grip||!dock)return;
 grip.addEventListener('pointerdown',event=>{
  event.preventDefault();
  const startY=event.clientY,startHeight=dock.getBoundingClientRect().height;
  grip.setPointerCapture(event.pointerId);
  const move=e=>{dockHeight=Math.max(36,Math.min(innerHeight*.62,startHeight+startY-e.clientY));dock.style.height=dockHeight+'px';dockCollapsed=dockHeight<=40;};
  const up=()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',up);grip.removeEventListener('pointercancel',up);render();};
  grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',up);grip.addEventListener('pointercancel',up);
 });
 grip.addEventListener('keydown',event=>{
  if(!['ArrowUp','ArrowDown'].includes(event.key))return;
  event.preventDefault();
  dockHeight=Math.max(36,Math.min(innerHeight*.62,dockHeight+(event.key==='ArrowUp'?40:-40)));
  dockCollapsed=dockHeight<=40;render();
 });
}

function v14(){
 const goals=[
  ['balance','Баланс','минимальное максимальное отставание по пяти показателям'],
  ['height','Короче','наименьшая рабочая высота'],
  ['diameter','Уже','наименьший наружный диаметр'],
  ['tubeMetres','Меньше трубы','наименьший метраж'],
  ['count','Меньше трубок','наименьшее число трубок']
 ];
 const best=[...rows].filter(r=>r.rank!=null).sort((a,b)=>a[goal]-b[goal]||a.id-b.id)[0];
 const copy=goals.find(g=>g[0]===goal);
 $('#top-slot').innerHTML=`<section style="display:flex;flex-direction:column;gap:9px;border:1px solid #333;border-radius:10px;background:#1a1a1a;padding:10px 12px;flex:none">
  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap"><span style="font-size:11px;color:#8f979f">Что важнее?</span>
   ${goals.map(([k,l])=>`<button type="button" class="chip" data-goal="${k}" aria-pressed="${goal===k}">${l}</button>`).join('')}
   <button type="button" class="ghost-btn" data-action="toggle" aria-expanded="${open}" style="margin-left:auto">${open?'Свернуть каталог':'Весь каталог · '+D.frontSize}</button>
  </div>
  <div style="display:flex;gap:10px;align-items:stretch">
   ${card(best)}
   <div style="flex:1;display:flex;flex-direction:column;gap:5px;justify-content:center;padding-left:12px;border-left:1px solid #2c2c2c">
    <span style="font-size:11.5px;color:#cfe0ee">Почему эта: ${copy[2]}.</span>
    <span class="hint">Три остальные характеристики остаются на уровне фронта Парето, поэтому вариант не выпадает из допустимых.</span>
   </div>
   ${applyBar()}
  </div>
 </section>
 ${open?`<section style="flex:none;max-height:min(250px,32dvh);display:flex;flex-direction:column;border:1px solid #333;border-radius:10px;background:#1c1c1c;overflow:hidden">${sheetHead('Все конструкции',`Поверок ${D.evaluations.toLocaleString('ru-RU')}`,true)}${toolbarMarkup()}<div class="tbl-wrap" style="flex:1">${tableMarkup({})}</div></section>`:''}`;
}

function v15(){
 const groups=[1,2,3,4];
 $('#workspace').classList.add('has-left');
 $('#left-slot').innerHTML=`<section style="display:flex;flex-direction:column;flex:1;min-height:0;border:1px solid #333;border-radius:11px;background:#1c1c1c;overflow:hidden">
  ${sheetHead('Компоновки','Дерево: ряды → трубки')}
  <div class="tbl-wrap" style="flex:1;padding:6px 8px">
   <button type="button" class="tree-row" data-group="all" aria-pressed="${groupFilter==null}">Все конструкции <small>${rows.length}</small></button>
   ${groups.map(n=>{
    const inGroup=rows.filter(r=>r.rowCount===n);
    const tubes=[...new Set(inGroup.map(r=>r.count))].sort((a,b)=>a-b);
    return `<button type="button" class="tree-row" data-group="${n}" aria-pressed="${groupFilter===n}">${n} ряд${n>1?'а':''} <small>${inGroup.length}</small></button>${groupFilter===n?tubes.map(t=>`<button type="button" class="tree-row sub" data-group="${n}" data-tubes="${t}">${t} трубок <small>${inGroup.filter(r=>r.count===t).length}</small></button>`).join(''):''}`;
   }).join('')}
  </div>
 </section>`;
 if(!open)return;
 const list=groupFilter==null?visibleRows():rows.filter(r=>r.rowCount===groupFilter&&(scope==='front'?r.rank!=null:true));
 replaceCanvas(`<div style="display:flex;flex-direction:column;height:100%;min-height:0;padding:9px">
  ${sheetHead('Группа: '+(groupFilter?groupFilter+' ряд':'все')+' · '+list.length+' строк','Таблица показывает только выбранную ветку',false)}
  <div class="tbl-wrap" style="flex:1">${tableMarkup({rows:list})}</div>${applyBar()}
 </div>`);
}

function v16(){
 const list=visibleRows().length?visibleRows():rows;
 const index=Math.max(0,list.findIndex(r=>r.id===previewId));
 const row=list[index]||list[0];
 $('#top-slot').innerHTML=`<div class="note-strip"><b>Вариант 16.</b> Таблица не нужна: одна карточка и переходы. Хорошо для просмотра, плохо для сравнения.</div>
 <section style="display:flex;align-items:center;gap:10px;flex:none;border:1px solid #333;border-radius:10px;background:#1a1a1a;padding:8px 10px">
  <button type="button" class="icon-btn" data-action="step" data-value="-1" aria-label="Предыдущая конструкция">←</button>
  <span style="font-size:10.5px;color:#8f979f;min-width:58px;text-align:center">${index+1} / ${list.length}</span>
  ${card(row)}
  <div style="flex:1;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
   <span class="hint" style="max-width:340px">Просмотр по одной строке: каждое нажатие обновляет чертёж и параметры слева.</span>
  </div>
  ${applyBar()}
  <button type="button" class="icon-btn" data-action="step" data-value="1" aria-label="Следующая конструкция">→</button>
  <button type="button" class="ghost-btn" data-action="toggle" aria-expanded="${open}">${open?'Свернуть':'Каталог'}</button>
 </section>
 ${open?`<section style="flex:none;max-height:min(300px,36dvh);display:flex;flex-direction:column;border:1px solid #333;border-radius:10px;background:#1c1c1c;overflow:hidden">${sheetHead('Все конструкции','Список — для перехода к нужной строке',true)}${toolbarMarkup()}<div class="tbl-wrap" style="flex:1">${tableMarkup({})}</div></section>`:''}`;
}

function v17(){
 $('#canvas-tools').innerHTML=`<button type="button" class="ghost-btn" data-action="toggle" aria-expanded="${open}">${open?'К чертежу':'Таблица по группам'}</button>`;
 if(!open)return;
 const groups=[...new Set(rows.map(r=>r.rowCount))].sort((a,b)=>a-b);
 replaceCanvas(`<div style="display:flex;flex-direction:column;height:100%;min-height:0;padding:9px">
  ${sheetHead('Конструкции по числу рядов','Заголовки групп сворачиваются, итог виден всегда',false)}
  <div class="tbl-wrap" style="flex:1"><table class="tbl"><thead><tr><th style="text-align:left">Группа</th><th>Строк</th><th>Длина, мм</th><th>Диаметр, мм</th><th>Труба, м</th><th>Мощность, кВт</th></tr></thead><tbody>
   ${groups.map(n=>{
    const inGroup=rows.filter(r=>r.rowCount===n);
    const avg=key=>inGroup.reduce((sum,r)=>sum+r[key],0)/inGroup.length;
    const isCollapsed=collapsed.has(n);
    return `<tr data-group-head="${n}" style="cursor:pointer;background:#202020"><td style="text-align:left">${isCollapsed?'▸':'▾'} ${n} ряд${n>1?'а':''}</td><td class="num">${inGroup.length}</td><td class="num">≈ ${FMT.height.format(avg('height'))}</td><td class="num">≈ ${FMT.diameter.format(avg('diameter'))}</td><td class="num">≈ ${FMT.tubeMetres.format(avg('tubeMetres'))}</td><td class="num">≈ ${FMT.duty.format(avg('duty'))}</td></tr>
    ${isCollapsed?'':inGroup.map(r=>`<tr${r.id===selectedId?' data-current="true"':''}${r.id===previewId?' data-picked="true"':''} data-preview-row="${r.id}"><td class="name" style="padding-left:22px">${nameOf(r)}</td><td class="num">${r.count}</td><td class="num">${cell(r,'height')}</td><td class="num">${cell(r,'diameter')}</td><td class="num">${cell(r,'tubeMetres')}</td><td class="num">${cell(r,'duty')}</td></tr>`).join('')}`;
   }).join('')}
  </tbody></table></div>${applyBar()}
 </div>`);
}

function v18(){
 $('#bottom-slot').innerHTML=`<section style="display:flex;flex-direction:column;height:300px;min-height:0;flex:none;border:1px solid #333;border-radius:10px;background:#1c1c1c;overflow:hidden">
  ${sheetHead('Рассчитанные конструкции','Плотный режим: полосы вместо цифр, два уровня текста')}
  ${toolbarMarkup()}
  <div class="tbl-wrap" style="flex:1">${tableMarkup({dense:true})}</div>
  ${applyBar()}
 </section>`;
}

function v19(){
 if(!pipOpen)return;
 const list=visibleRows().slice(0,7);
 $('#pip-root').innerHTML=`<div class="pip" role="region" aria-label="Мини-таблица конструкций">
  <header><strong>Конструкции</strong><span class="meta">${D.frontSize}</span><span class="spacer"></span><button type="button" class="icon-btn" data-action="pip-close" aria-label="Свернуть мини-таблицу">×</button></header>
  <div class="tbl-wrap" style="flex:1"><table class="tbl"><thead><tr><th style="text-align:left">№</th><th>Длина</th><th>Ø</th><th>Труба</th></tr></thead><tbody>
   ${list.map(r=>`<tr${r.id===selectedId?' data-current="true"':''}${r.id===previewId?' data-picked="true"':''} data-preview-row="${r.id}"><td class="name">${nameOf(r)}</td><td class="num">${r.height}</td><td class="num">${r.diameter}</td><td class="num">${cell(r,'tubeMetres')}</td></tr>`).join('')}
  </tbody></table></div>
  <footer><span class="meta">${scope==='front'?'компромиссы':'все'}</span><button type="button" class="ghost-btn" data-action="pip-expand" style="margin-left:auto">Развернуть</button></footer>
 </div>`;
 $('#canvas-tools').innerHTML=`<button type="button" class="ghost-btn" data-action="toggle" aria-expanded="${open}">${open?'Скрыть таблицу':'Полная таблица'}</button>`;
 if(open){
  $('#overlay-root').innerHTML=`<div class="backdrop" data-action="close"></div>${catalogPanel({style:'left:50%;top:50%;transform:translate(-50%,-50%);width:min(980px,92vw);height:min(520px,76dvh)',title:'Полная таблица',sub:'16 показателей — открывается редко'})}`;
 }
}

function v20(){
 $('#canvas-tools').innerHTML=`<button type="button" class="ghost-btn" data-action="toggle">Найти конструкцию · Ctrl K</button>`;
 if(!open)return;
 const q=query.trim();
 const list=rows.filter(r=>!q||`${r.id} ${r.height} ${r.diameter} ${r.count} ${r.rowCount} ${r.tubeMetres}`.includes(q)).slice(0,8);
 $('#overlay-root').innerHTML=`<div class="backdrop" data-action="close"></div>
 <section class="floating" style="left:50%;top:14dvh;transform:translateX(-50%);width:min(620px,92vw);max-height:min(520px,72dvh);border-radius:13px" role="dialog" aria-modal="true" aria-label="Быстрый поиск конструкции">
  ${sheetHead('Быстрый поиск','Ctrl K · номер, длина, диаметр, метраж',true)}
  <div class="tbar" style="padding:10px 12px"><input type="search" data-search placeholder="Например: 374 или 178" value="${query}" autofocus></div>
  <div class="tbl-wrap" style="flex:1;padding:6px 8px"><div style="display:flex;flex-direction:column;gap:5px">
   ${list.map(r=>card(r)).join('')||'<p class="tbl-empty">Ничего не найдено.</p>'}
  </div></div>
  ${applyBar()}
 </section>`;
}

/* ---------------- events ---------------- */

function toast(text){
 const n=$('#notification');
 n.hidden=false;n.textContent=text;
 clearTimeout(toast.timer);
 toast.timer=setTimeout(()=>{n.hidden=true},2200);
}

function applySelection(){
 selectedId=previewId;open=false;dockCollapsed=false;render();
 toast('Конструкция №'+selectedId+' загружена в проработку');
}

function onClick(event){
 const previewEl=event.target.closest('[data-preview]');
 if(previewEl){
  previewId=Number(previewEl.dataset.preview);render();return;
 }
 const rowEl=event.target.closest('[data-preview-row]');
 if(rowEl){
  const id=Number(rowEl.dataset.previewRow);
  if(rowEl.dataset.expandRow&&!event.target.closest('.pick')){
   if(expanded.has(id))expanded.delete(id);else expanded.add(id);
  }
  previewId=id;render();return;
 }
 const sortEl=event.target.closest('[data-sort]');
 if(sortEl){const key=sortEl.dataset.sort;dir=sortKey===key&&dir==='asc'?'desc':'asc';sortKey=key;render();return}
 const presetEl=event.target.closest('[data-preset]');
 if(presetEl){preset=presetEl.dataset.preset;columnsOn=new Set(PRESETS[preset]);render();return}
 const colEl=event.target.closest('[data-col]');
 if(colEl){const key=colEl.dataset.col;if(columnsOn.has(key)&&columnsOn.size>1)columnsOn.delete(key);else columnsOn.add(key);render();return}
 const goalEl=event.target.closest('[data-goal]');
 if(goalEl){goal=goalEl.dataset.goal;const best=[...rows].filter(r=>r.rank!=null).sort((a,b)=>a[goal]-b[goal]||a.id-b.id)[0];previewId=best.id;render();return}
 const groupEl=event.target.closest('[data-group]');
 if(groupEl){const value=groupEl.dataset.group;groupFilter=value==='all'?null:Number(value);previewId=rows.find(r=>r.rowCount===groupFilter&&(scope==='front'?r.rank!=null:true))?.id||previewId;open=true;render();return}
 const groupHead=event.target.closest('[data-group-head]');
 if(groupHead){const key=Number(groupHead.dataset.groupHead);if(collapsed.has(key))collapsed.delete(key);else collapsed.add(key);render();return}
 const wizEl=event.target.closest('[data-wizard]');
 if(wizEl){const key=wizEl.dataset.wizard,value=Number(wizEl.dataset.value);wizard[key]=wizard[key]===value?null:value;render();return}
 const dockEl=event.target.closest('[data-dock]');
 if(dockEl){dockHeight=Number(dockEl.dataset.dock);dockCollapsed=dockHeight<=40;render();return}
 const actionEl=event.target.closest('[data-action]');
 if(!actionEl)return;
 const action=actionEl.dataset.action;
 if(action==='toggle'){open=!open;render();if(open&&type==='command')$('[data-search]')?.focus();return}
 if(action==='close'){open=false;render();return}
 if(action==='apply'){applySelection();return}
 if(action==='step'){const list=visibleRows().length?visibleRows():rows;const index=list.findIndex(r=>r.id===previewId);const next=(index+Number(actionEl.dataset.value)+list.length)%list.length;previewId=list[next].id;render();return}
 if(action==='wizard-reset'){wizard={rows:null,maxLength:null,maxMetres:null};open=false;render();return}
 if(action==='pip-close'){pipOpen=false;render();return}
 if(action==='pip-expand'){open=true;render();return}
}

function onChange(event){
 const target=event.target;
 if(target.matches('[data-scope]')){scope=target.value;render();return}
 if(target.matches('[data-cmp]')){
  const id=Number(target.dataset.cmp);
  if(target.checked){if(comparison.length<3)comparison.push(id);else target.checked=false}
  else comparison=comparison.filter(value=>value!==id);
  render();return;
 }
 if(target.matches('[data-toggle-row]')){
  const id=Number(target.dataset.toggleRow);
  if(expanded.has(id))expanded.delete(id);else expanded.add(id);
  render();return;
 }
}

function onInput(event){
 const target=event.target;
 if(!target.matches('[data-search]'))return;
 const caret=target.selectionStart;
 query=target.value.replace(/[<>"&]/g,'');
 render();
 const next=$('[data-search]');
 if(next){next.focus();try{next.setSelectionRange(caret,caret)}catch{}}
}

function onKey(event){
 if(event.key==='Escape'&&open){open=false;render();return}
 if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){
  event.preventDefault();
  if(type==='command'){open=true;render();$('[data-search]')?.focus()}
  else{location.href=route(20)}
 }
}

/* ---------------- gallery ---------------- */

function miniFor(type){
 const box=(style)=>`<span class="mini-pane" style="${style}"></span>`;
 const cat=(style)=>`<span class="mini-cat" style="${style}"></span>`;
 const canvas=box('left:7%;top:8%;width:60%;height:84%');
 const map={
  stripe:canvas+cat('left:9%;top:9%;width:56%;height:16%')+box('left:7%;top:29%;width:60%;height:63%'),
  bottom:canvas+box('left:7%;top:8%;width:14%;height:84%')+cat('left:24%;bottom:6%;width:68%;height:38%'),
  drawer:canvas+box('left:7%;top:8%;width:14%;height:84%')+cat('right:6%;top:6%;width:32%;height:88%'),
  modal:canvas+box('left:7%;top:8%;width:14%;height:84%')+cat('left:26%;top:16%;width:52%;height:68%'),
  screen:box('left:7%;top:8%;width:14%;height:84%')+cat('left:26%;top:6%;width:68%;height:88%'),
  tabs:box('left:7%;top:8%;width:14%;height:84%')+cat('left:24%;top:8%;width:69%;height:84%')+cat('left:24%;top:6%;width:22%;height:6%'),
  panel:canvas+box('left:7%;top:8%;width:14%;height:84%')+cat('right:6%;top:6%;width:24%;height:88%'),
  expand:canvas+box('left:7%;top:8%;width:14%;height:84%')+cat('left:24%;bottom:6%;width:68%;height:26%'),
  cols:box('left:7%;top:8%;width:14%;height:84%')+cat('left:24%;top:14%;width:69%;height:74%')+cat('left:24%;top:6%;width:52%;height:6%'),
  wizard:canvas+cat('left:9%;top:6%;width:60%;height:12%')+cat('left:7%;top:22%;width:45%;height:32%')+cat('left:7%;top:57%;width:60%;height:33%'),
  scatter:box('left:7%;top:8%;width:14%;height:84%')+cat('left:24%;top:9%;width:47%;height:82%')+box('right:6%;top:14%;width:18%;height:40%'),
  compare:box('left:7%;top:8%;width:14%;height:84%')+cat('left:24%;top:9%;width:45%;height:82%')+cat('right:6%;top:6%;width:20%;height:88%'),
  dock:canvas+box('left:7%;top:8%;width:14%;height:84%')+cat('left:7%;bottom:4%;width:88%;height:34%'),
  goals:canvas+cat('left:9%;top:6%;width:60%;height:15%')+box('left:7%;top:26%;width:60%;height:63%'),
  tree:box('left:7%;top:8%;width:18%;height:84%')+cat('left:27%;top:8%;width:66%;height:84%'),
  stepper:canvas+cat('left:9%;top:6%;width:60%;height:14%')+box('left:7%;top:25%;width:60%;height:64%'),
  groups:box('left:7%;top:8%;width:14%;height:84%')+cat('left:24%;top:9%;width:69%;height:82%'),
  dense:box('left:7%;top:8%;width:14%;height:84%')+cat('left:7%;bottom:4%;width:88%;height:30%'),
  pip:canvas+box('left:7%;top:8%;width:14%;height:84%')+cat('left:48%;top:34%;width:44%;height:40%'),
  command:box('left:7%;top:8%;width:14%;height:84%')+box('left:24%;top:9%;width:69%;height:82%')+cat('left:31%;top:18%;width:54%;height:44%')
 };
 return `<div class="mini"><span class="mini-pat"></span>${map[type]||canvas}</div>`;
}

if(!page){
 document.body.classList.add('gallery');
 $('#app').innerHTML=`<header class="site-header"><a class="brand" href="../../index.html"><img src="../physnow-logo.png" alt="">PhysNow</a><span class="hdr-chip">Тестовые страницы</span><a class="hdr-link" href="../../index.html">В приложение ↗</a></header>
 <main class="gallery-main">
  <h1>Куда деть таблицу «Рассчитанные конструкции»</h1>
  <p class="gallery-lead">Сейчас таблица стоит над рабочим полем отдельным блоком: строка заголовка, панель фильтров, до 16 столбцов, пояснение и раскрывающийся текст «Почему выбран этот вариант». Даже свёрнутая она отнимает высоту у чертежа, а раскрытая выталкивает его вниз. Ниже — 20 способов это разгрузить. На каждой странице одинаковые данные, одинаковые 16 показателей и одинаковый сценарий: посмотреть, сравнить, применить.</p>
  <div class="problem">
   <div><b>Высота</b><p>Блок с таблицей + фильтрами + пояснением занимает верх рабочей области. Чертёж и параметры получают остаток.</p></div>
   <div><b>Ширина</b><p>16 столбцов не влезают; появляется горизонтальная прокрутка, а первый столбец с переключателем уезжает.</p></div>
   <div><b>Внимание</b><p>Таблица нужна на 10–20 секунд при выборе, но висит всё время и спорит с чертежом за взгляд.</p></div>
  </div>
  <div class="concept-grid">${CONCEPTS.map(([name,note,kind,where,cost],i)=>`<a class="concept" href="results-table-lab/${route(i+1)}">${miniFor(kind)}<span class="concept-title"><span>${String(i+1).padStart(2,'0')}</span><h2>${name}</h2></span><p>${note}</p><span class="concept-tag">${where} · ${cost}</span></a>`).join('')}</div>
 </main>`;
}else{
 shell();
 render();
}