'use strict';

const concepts = [
 ['Свёрнутая строка','Одна строка над чертежом. Список раскрывается по запросу.','stripe'],
 ['Нижняя выдвижная панель','Варианты появляются поверх нижней части рабочего поля.','bottom'],
 ['Боковая выдвижная панель','Каталог открывается справа поверх чертежа.','drawer'],
 ['Окно выбора','Большая таблица в модальном окне. После выбора окно закрывается.','modal'],
 ['Отдельный экран выбора','Каталог занимает рабочую область. Кнопка возвращает к чертежу.','screen'],
 ['Узкий список слева','Компактные строки между параметрами и чертежом.','left'],
 ['Каталог справа','Постоянная правая панель с сортировкой и поиском.','right'],
 ['Три лучших предложения','Карточки трёх компромиссов над рабочим полем.','top-cards'],
 ['Лента под чертежом','Горизонтальные карточки листаются в нижней ленте.','carousel'],
 ['Список с раскрытием','Короткие строки раскрывают параметры одной конструкции.','accordion'],
 ['Вкладка «Конструкции»','Чертёж и каталог используют одну область с переключением вкладок.','tabs'],
 ['Выпадающий каталог','Небольшой список привязан к кнопке текущей конструкции.','popover'],
 ['Поиск по конструкции','Поиск по номеру, размерам и параметрам в быстром окне.','command'],
 ['Сравнение трёх','Сначала выбрать до трёх вариантов, затем сравнить их рядом.','compare'],
 ['Вертикальная матрица','Показатели идут строками, конструкции — столбцами.','matrix'],
 ['Карта компромиссов','Выбор точки на карте длины и диаметра с краткой карточкой.','scatter'],
 ['Выбор по приоритету','Приоритет поднимает подходящие варианты. Полный каталог доступен рядом.','goals'],
 ['Дерево компоновок','Варианты сгруппированы по числу рядов и трубок.','tree'],
 ['Одна конструкция за раз','Карточка текущего предложения и переходы вперёд и назад.','stepper'],
 ['Панель с изменяемой высотой','Нижняя панель меняет высоту перетаскиванием и сворачивается в строку.','resizable']
];
const rows = window.LAB_DATA.rows;
const page = Number(document.body.dataset.variant || 0);
const $ = selector => document.querySelector(selector);
const format = value => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}).format(value);
const route = number => `variant-${String(number).padStart(2,'0')}.html`;
let selected=451, preview=451, sort='rank', query='', scope='front', open=false, comparison=[451,399,259], goal='rank', position=0;
let group='all';
const current = () => rows.find(row=>row.id===preview);
const button=(text,action,extra='')=>`<button type="button" data-action="${action}" ${extra}>${text}</button>`;

if(!page){
 document.body.classList.add('gallery');
 $('#app').innerHTML=`<header class="gallery-head"><a class="brand" href="../../index.html"><img src="../physnow-logo.png" alt="">PhysNow</a><span>Тестовые варианты интерфейса</span></header><main class="gallery-main"><h1>Как выбирать конструкцию</h1><p class="intro">20 способов освободить рабочее поле. Откройте вариант, выберите другую конструкцию и попробуйте вернуться к чертежу. На всех страницах одинаковые демонстрационные данные.</p><div class="legend"><span>Два верхних ряда — варианты с компактным доступом к каталогу</span><span>На каждой странице есть переход к следующему варианту</span></div><div class="concept-grid">${concepts.map(([name,note,type],i)=>`<a href="design-table-lab/${route(i+1)}" class="concept"><div class="mini mini-${type}"><span class="mini-left"></span><span class="mini-canvas"></span><span class="mini-catalog"></span></div><div class="concept-title"><span>${String(i+1).padStart(2,'0')}</span><h2>${name}</h2></div><p>${note}</p></a>`).join('')}</div></main>`;
}else{
 const [name,note,type]=concepts[page-1];
 document.body.dataset.layout=type;
 $('#app').innerHTML=`<header class="site-header"><a class="brand" href="../design-table-variants.html"><img src="../physnow-logo.png" alt="">PhysNow</a><nav aria-label="Разделы"><a href="../../index.html">Проектировочный</a><span class="nav-active">Проработка конструкции</span></nav><span class="sheet">Демо · Змеевиковый</span><a class="all-link" href="../design-table-variants.html">Все 20 вариантов ↗</a></header><section class="labbar"><div><span class="variant-number">${String(page).padStart(2,'0')} / 20</span><h1>${name}</h1><span class="labnote">${note}</span></div><div class="lab-nav"><a href="${route(page===1?20:page-1)}" aria-label="Предыдущий вариант">←</a><select id="variant-picker" aria-label="Вариант интерфейса">${concepts.map(([label],i)=>`<option value="${i+1}" ${i+1===page?'selected':''}>${String(i+1).padStart(2,'0')} · ${label}</option>`).join('')}</select><a href="${route(page===20?1:page+1)}" aria-label="Следующий вариант">→</a></div></section><main class="workbench"><div class="work-heading"><h2>Проработка конструкции</h2><span class="demo-label">Демонстрационные данные</span><span id="active-label" role="status"></span></div><div id="top-slot"></div><div class="workspace"><aside class="parameters"><div class="panel-head">Конструктивные параметры</div><div class="parameter-body"><p>Змеевиковый аппарат</p><h3>Корпус</h3><label>Наружный диаметр <span><input id="geometry-diameter" type="number" value="140"> мм</span></label><label>Рабочая высота <span><input id="geometry-height" type="number" value="398"> мм</span></label><label>Толщина стенки <span><input type="number" value="1"> мм</span></label><h3>Вытеснительная труба</h3><label>Диаметр <span><input type="number" value="98"> мм</span></label><label>Стенка <span><input type="number" value="2"> мм</span></label><h3>Трубы змеевиков</h3><label>Диаметр трубы <span><input type="number" value="14"> мм</span></label><label>Стенка <span><input type="number" value="2.5" step=".5"> мм</span></label><h3>Ряды змеевиков</h3><label>Количество трубок <span><input id="geometry-count" type="number" value="4"> шт.</span></label><label>Рядов <span><input id="geometry-rows" type="number" value="1"> шт.</span></label><p class="parameter-note">Для проверки расположения каталога. Числа и контуры используются как тестовый пример.</p></div></aside><div id="left-slot"></div><section class="drawing-panel"><div class="panel-head"><span>Компоновка аппарата</span><div id="canvas-tools"></div></div><div id="canvas-body"><div class="drawing-grid apparatus-drawing"><figure><figcaption>Вид сверху <small>Вид А</small></figcaption>${window.LAB_DATA.drawings[0]}</figure><figure class="side-view"><figcaption>Высота аппарата <small>Сечение Б</small></figcaption>${window.LAB_DATA.drawings[1]}</figure><figure><figcaption>Зазоры между трубами</figcaption>${window.LAB_DATA.drawings[2]}</figure></div><div class="drawing-summary" id="drawing-summary"></div></div><div id="canvas-replacement" hidden></div><div id="bottom-slot"></div></section><div id="right-slot"></div></div><div id="outside-bottom"></div></main><div id="overlay-root"></div><div id="notification" class="notification" role="status" hidden></div>`;
 $('#variant-picker').addEventListener('change',event=>location.href=route(Number(event.target.value)));
 document.addEventListener('click',handleClick);
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&open){open=false;render();$('#launch')?.focus();}
  if(type==='command'&&(event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='k'){event.preventDefault();open=true;render();$('#candidate-search')?.focus();}
 });
 render();
}

function candidates(){
 return rows.filter(row=>(scope==='all'||row.rank<=5)&&(group==='all'||String(row.rowCount)===group)&&`${row.id} ${row.height} ${row.diameter} ${row.count}`.includes(query.trim())).sort((a,b)=>a[sort]-b[sort]||a.id-b.id);
}
function toolbar(){
 return `<div class="catalog-tools"><label><span class="sr-only">Поиск по конструкции</span><input id="candidate-search" placeholder="Номер или размер…" value="${query}"></label><select id="candidate-scope" aria-label="Состав каталога"><option value="front" ${scope==='front'?'selected':''}>5 компромиссов</option><option value="all" ${scope==='all'?'selected':''}>Все 12 вариантов</option></select><select id="candidate-sort" aria-label="Сортировка"><option value="rank" ${sort==='rank'?'selected':''}>По рекомендации</option><option value="height" ${sort==='height'?'selected':''}>По длине</option><option value="diameter" ${sort==='diameter'?'selected':''}>По диаметру</option><option value="tubeMetres" ${sort==='tubeMetres'?'selected':''}>По метражу</option></select></div>`;
}
function card(row,compact=false){
 return `<button type="button" class="candidate ${compact?'compact':''} ${preview===row.id?'is-preview':''}" data-preview="${row.id}" aria-pressed="${preview===row.id}"><span class="candidate-title"><strong>${row.id===451?'★ ':''}№${row.id}</strong><small>${selected===row.id?'В работе':row.rank===1?'Рекомендован':row.rowCount+' ряд · '+row.count+' трубки'}</small></span><span class="candidate-dimensions">${row.height} <span>× Ø</span>${row.diameter} <small>мм</small></span><span class="candidate-foot">${format(row.tubeMetres)} м трубы <span>${format(row.duty)} кВт</span></span></button>`;
}
function table(){
 return `<div class="table-scroll"><table><thead><tr>${['Конструкция','Длина, мм','Ø, мм','Трубок','Рядов','Труба, м','Q, кВт'].map(label=>`<th>${label}</th>`).join('')}</tr></thead><tbody>${candidates().map(row=>`<tr class="${preview===row.id?'is-preview':''}"><td><button type="button" data-preview="${row.id}" aria-pressed="${preview===row.id}">${row.id===451?'★ ':''}№${row.id}${selected===row.id?' <small>В работе</small>':''}</button></td><td>${row.height}</td><td>${row.diameter}</td><td>${row.count}</td><td>${row.rowCount}</td><td>${format(row.tubeMetres)}</td><td>${format(row.duty)}</td></tr>`).join('')}</tbody></table>${candidates().length?'':'<p class="empty">Ничего не найдено. Измените поиск или состав каталога.</p>'}</div>`;
}
function list(){return `<div class="candidate-list">${candidates().map(row=>card(row,true)).join('')||'<p class="empty">Ничего не найдено.</p>'}</div>`;}
function applyBar(){
 const row=current();
 return `<footer class="apply-bar"><span><strong>№${row.id}</strong> · ${row.height} × Ø${row.diameter} мм <small>${preview===selected?'Используется в проработке':'Предпросмотр'}</small></span>${button(preview===selected?'В работе':'Применить','apply',`class="primary" ${preview===selected?'disabled':''}`)}</footer>`;
}
function catalog(content='table',heading='Конструкции'){
 return `<section class="catalog"><header class="catalog-head"><div><h3>${heading}</h3><span>1 000 поверок · 12 тестовых вариантов</span></div>${open?button('×','close','class="close" aria-label="Закрыть каталог"'):''}</header>${toolbar()}${content==='table'?table():list()}${applyBar()}</section>`;
}
function launch(label='Выбрать конструкцию',className=''){
 return button(`${label} <span>⌄</span>`,'toggle',`id="launch" class="${className}" aria-expanded="${open}"`);
}
function selectPreview(id){preview=id;render();}
function handleClick(event){
 const candidate=event.target.closest('[data-preview]');
 if(candidate){selectPreview(Number(candidate.dataset.preview));return;}
 const action=event.target.closest('[data-action]')?.dataset.action;
 if(action==='toggle'){open=!open;render();if(open&&document.body.dataset.layout==='command')$('#candidate-search')?.focus();}
 if(action==='close'){open=false;render();$('#launch')?.focus();}
 if(action==='apply'){selected=preview;open=false;render();const notice=$('#notification');notice.hidden=false;notice.textContent=`Конструкция №${selected} загружена в проработку`;clearTimeout(handleClick.timer);handleClick.timer=setTimeout(()=>notice.hidden=true,2200);}
 if(action==='next'||action==='previous'){position=(rows.findIndex(row=>row.id===preview)+(action==='next'?1:-1)+rows.length)%rows.length;preview=rows[position].id;render();}
 if(action==='compare'){open=true;render();}
 if(action==='dock-small'||action==='dock-medium'||action==='dock-large'){$('#outside-bottom').style.height={ 'dock-small':'46px','dock-medium':'230px','dock-large':'380px'}[action];}
 const goalButton=event.target.closest('[data-goal]');
 if(goalButton){goal=goalButton.dataset.goal;sort=goal;preview=[...rows].sort((a,b)=>a[goal]-b[goal])[0].id;render();}
 const groupButton=event.target.closest('[data-group]');
 if(groupButton){group=groupButton.dataset.group;scope='all';render();}
}
function matrix(){
 const labels=[['Длина, мм','height'],['Диаметр, мм','diameter'],['Труба, м','tubeMetres'],['Трубок','count'],['Рядов','rowCount'],['Мощность, кВт','duty']];
 return `<div class="table-scroll"><table class="matrix"><thead><tr><th>Показатель</th>${candidates().map(row=>`<th>${button('№'+row.id,'none',`data-preview="${row.id}" class="${preview===row.id?'is-preview':''}"`)}</th>`).join('')}</tr></thead><tbody>${labels.map(([label,key])=>`<tr><th>${label}</th>${candidates().map(row=>`<td class="${preview===row.id?'is-preview':''}">${format(row[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function scatter(){
 return `<section class="plot"><div class="plot-axis">Длина аппарата, мм</div><svg viewBox="0 0 600 275" role="group" aria-label="Карта длины и диаметра">${[0,1,2,3,4].map(i=>`<path class="plot-grid" d="M50 ${30+i*48}H570"/><text x="8" y="${34+i*48}">${1000-i*220}</text>`).join('')}<path class="plot-grid" d="M50 20V240H570"/>${rows.map(row=>{const x=50+(row.diameter-100)*2.3,y=240-(row.height-100)*.23;return `<g data-preview="${row.id}"><circle tabindex="0" role="button" aria-label="Конструкция ${row.id}, длина ${row.height}, диаметр ${row.diameter}" cx="${x}" cy="${y}" r="${preview===row.id?9:6}" class="${preview===row.id?'selected-dot':''}"></circle><text x="${x+11}" y="${y+4}">${row.id}</text></g>`;}).join('')}<text x="240" y="270">Наружный диаметр, мм →</text></svg><div class="plot-selection">${card(current(),true)}${applyBar()}</div></section>`;
}
function render(){
 const [,,type]=concepts[page-1];
 for(const selector of ['#top-slot','#left-slot','#right-slot','#bottom-slot','#outside-bottom','#canvas-tools','#canvas-replacement','#overlay-root'])$(selector).innerHTML='';
 $('#canvas-body').hidden=false;$('#canvas-replacement').hidden=true;$('#outside-bottom').className='';
 $('#active-label').textContent=`В работе · №${selected}`;
 const shown=rows.find(row=>row.id===selected);
 for(const text of document.querySelectorAll('.drawing-grid svg text')){
  text.dataset.originalText??=text.textContent;
  text.textContent=text.dataset.originalText.replaceAll('398',String(shown.height)).replace(/Ø\s?140/g,'Ø '+shown.diameter);
 }
 $('#geometry-diameter').value=shown.diameter;$('#geometry-height').value=shown.height;$('#geometry-count').value=shown.count;$('#geometry-rows').value=shown.rowCount;
 $('#drawing-summary').innerHTML=`<strong>№${selected}</strong><span>Высота ${shown.height} мм</span><span>Диаметр ${shown.diameter} мм</span><span>${shown.count} трубки · ${shown.rowCount} ряд</span><span>${format(shown.tubeMetres)} м трубы</span>`;
 $('#canvas-tools').innerHTML=launch('№'+selected+' · Конструкции');
 if(['stripe','left','right','top-cards','carousel','accordion','compare','scatter','goals','tree','stepper','resizable'].includes(type))$('#canvas-tools').innerHTML='';
 const place=(selector,html)=>$(selector).innerHTML=html;
 const replace=html=>{$('#canvas-body').hidden=true;$('#canvas-replacement').hidden=false;place('#canvas-replacement',html);};
 if(type==='stripe')place('#top-slot',`<div class="selection-stripe"><span>★ Рекомендация №451 <small>398 × Ø140 мм · 12 м закупки</small></span>${launch(open?'Свернуть':'Другие конструкции · 12')}</div>${open?catalog():''}`);
 if(type==='bottom'&&open)place('#overlay-root',`<div class="backdrop" data-action="close"></div><div class="floating bottom-sheet" role="dialog" aria-modal="true" aria-label="Выбор конструкции">${catalog()}</div>`);
 if(type==='drawer'&&open)place('#overlay-root',`<div class="backdrop" data-action="close"></div><div class="floating right-drawer" role="dialog" aria-modal="true" aria-label="Выбор конструкции">${catalog('list')}</div>`);
 if((type==='modal'||type==='command')&&open)place('#overlay-root',`<div class="backdrop" data-action="close"></div><div class="floating ${type==='command'?'command-window':'modal-window'}" role="dialog" aria-modal="true" aria-label="Выбор конструкции">${catalog(type==='command'?'list':'table',type==='command'?'Быстрый поиск конструкции':'Выбор конструкции')}</div>`);
 if(type==='screen'&&open){place('#overlay-root',`<div class="catalog-screen"><header>${button('← К проработке','close')}<span>Каталог конструкций</span></header>${catalog()}</div>`);}
 if(type==='left')place('#left-slot',catalog('list'));
 if(type==='right')place('#right-slot',catalog('list'));
 if(type==='top-cards')place('#top-slot',`<div class="recommendation-cards">${[rows[0],rows[4],rows[1]].map(row=>card(row,true)).join('')}<div class="card-action">${launch('Все варианты')}${applyBar()}</div></div>${open?catalog():''}`);
 if(type==='carousel')place('#bottom-slot',`<div class="carousel">${candidates().map(row=>card(row,true)).join('')}</div>${applyBar()}`);
 if(type==='accordion')place('#outside-bottom',`<section class="accordion-catalog"><header><h3>Конструкции</h3><span>Нажмите на строку, чтобы раскрыть параметры</span></header>${rows.slice(0,5).map(row=>`<div class="accordion-row">${button(`<strong>№${row.id}</strong><span>${row.height} × Ø${row.diameter} мм</span><small>${selected===row.id?'В работе':'Подробнее ⌄'}</small>`,'none',`data-preview="${row.id}" aria-expanded="${preview===row.id}"`)}${preview===row.id?`<div class="accordion-detail">Труба ${format(row.tubeMetres)} м · ${row.count} трубки · ${row.rowCount} ряд · ${format(row.duty)} кВт ${applyBar()}</div>`:''}</div>`).join('')}</section>`);
 if(type==='tabs'){$('#canvas-tools').innerHTML=`<div class="segmented">${button('Чертёж','close',`class="${open?'':'active'}"`)}${button('Конструкции · 12','toggle',`class="${open?'active':''}" id="launch"`)}</div>`;if(open)replace(catalog());}
 if(type==='popover'&&open)place('#overlay-root',`<div class="popover-catalog">${catalog('list')}</div>`);
 if(type==='command')$('#canvas-tools').innerHTML=launch('Найти конструкцию · Ctrl K');
 if(type==='compare'){
  place('#top-slot',`<div class="selection-stripe"><span>Сравнение конструкций <small>Отметьте до трёх вариантов</small></span>${button('Сравнить выбранные · '+comparison.length,'compare','id="launch"')}</div>`);
  place('#right-slot',`<section class="catalog"><header class="catalog-head"><h3>В сравнение</h3></header><div class="compare-picks">${rows.slice(0,8).map(row=>`<label><input type="checkbox" data-compare="${row.id}" ${comparison.includes(row.id)?'checked':''}> №${row.id} <span>${row.height} × Ø${row.diameter}</span></label>`).join('')}</div></section>`);
  if(open)replace(`<section class="catalog"><header class="catalog-head"><h3>Сравнение ${comparison.length} конструкций</h3>${button('К чертежу','close')}</header><div class="compare-cards">${comparison.map(id=>card(rows.find(row=>row.id===id))).join('')}</div>${applyBar()}</section>`);
 }
 if(type==='matrix'&&open)replace(`<section class="catalog"><header class="catalog-head"><h3>Сравнение по показателям</h3>${button('К чертежу','close')}</header>${toolbar()}${matrix()}${applyBar()}</section>`);
 if(type==='scatter'){place('#top-slot',`<div class="selection-stripe"><span>Карта компромиссов <small>Каждая точка — одна конструкция</small></span>${launch(open?'К чертежу':'Открыть карту')}</div>`);if(open)replace(scatter());}
 if(type==='goals')place('#top-slot',`<div class="goal-bar"><span>Что важнее?</span>${[['rank','Баланс'],['height','Короче'],['diameter','Уже'],['tubeMetres','Меньше трубы']].map(([key,label])=>button(label,'none',`data-goal="${key}" class="${goal===key?'active':''}"`)).join('')}${launch('Все варианты')}</div><div class="goal-result">${card(current(),true)}${applyBar()}</div>${open?catalog():''}`);
 if(type==='tree')place('#left-slot',`<section class="catalog"><header class="catalog-head"><h3>Компоновки</h3></header><div class="tree-groups">${[['all','Все компоновки'],['1','Один ряд'],['2','Два ряда'],['3','Три ряда']].map(([key,label])=>button(label+' <small>'+rows.filter(row=>key==='all'||String(row.rowCount)===key).length+'</small>','none',`data-group="${key}" class="${group===key?'active':''}"`)).join('')}</div>${list()}${applyBar()}</section>`);
 if(type==='stepper')place('#top-slot',`<div class="stepper-bar">${button('←','previous','aria-label="Предыдущая конструкция"')}<span>${rows.findIndex(row=>row.id===preview)+1} из ${rows.length}</span>${card(current(),true)}${button('→','next','aria-label="Следующая конструкция"')}${applyBar()}${launch('Каталог')}</div>${open?catalog():''}`);
 if(type==='resizable'){
  $('#outside-bottom').className='dock';
  place('#outside-bottom',`<div class="dock-grip" role="separator" aria-orientation="horizontal" aria-label="Высота каталога" tabindex="0"></div><div class="dock-title"><strong>Конструкции · 12</strong><span>${button('Свернуть','dock-small')}${button('Средняя','dock-medium')}${button('Развернуть','dock-large')}</span></div>${toolbar()}${table()}${applyBar()}`);
  const grip=$('.dock-grip'),dock=$('#outside-bottom');
  grip.addEventListener('pointerdown',event=>{event.preventDefault();const start=event.clientY,height=dock.getBoundingClientRect().height;grip.setPointerCapture(event.pointerId);const move=e=>dock.style.height=Math.max(46,Math.min(innerHeight*.65,height+start-e.clientY))+'px';const end=()=>{grip.removeEventListener('pointermove',move);grip.removeEventListener('pointerup',end);grip.removeEventListener('pointercancel',end);};grip.addEventListener('pointermove',move);grip.addEventListener('pointerup',end);grip.addEventListener('pointercancel',end);});
  grip.addEventListener('keydown',event=>{if(['ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();dock.style.height=Math.max(46,Math.min(innerHeight*.65,dock.getBoundingClientRect().height+(event.key==='ArrowUp'?35:-35)))+'px';}});
 }
 wireControls();
}
function wireControls(){
 $('#candidate-search')?.addEventListener('input',event=>{const caret=event.target.selectionStart;query=event.target.value.replace(/[<>"&]/g,'');render();$('#candidate-search')?.focus();$('#candidate-search')?.setSelectionRange(caret,caret);});
 $('#candidate-scope')?.addEventListener('change',event=>{scope=event.target.value;render();});
 $('#candidate-sort')?.addEventListener('change',event=>{sort=event.target.value;render();});
 document.querySelectorAll('[data-compare]').forEach(input=>input.addEventListener('change',()=>{const id=Number(input.dataset.compare);if(input.checked&&comparison.length<3)comparison.push(id);else{comparison=comparison.filter(value=>value!==id);input.checked=false;}render();}));
 document.querySelectorAll('.plot circle').forEach(circle=>circle.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectPreview(Number(circle.closest('[data-preview]').dataset.preview));}}));
 const dialog=$('[role="dialog"]');
 if(dialog){dialog.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const focusable=[...dialog.querySelectorAll('button:not(:disabled),input,select')];if(!focusable.length)return;const first=focusable[0],last=focusable.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}});}
 if(dialog&&!dialog.contains(document.activeElement))dialog.querySelector('input,button:not(:disabled),select')?.focus();
}
