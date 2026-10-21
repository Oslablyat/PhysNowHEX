(() => {
 'use strict';
 const $=id=>document.getElementById(id),esc=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const parameters=[
  ['body-d','Наружный диаметр корпуса','мм','600','700','top side body','Корпус','Изменяется наружный контур на обоих видах и доступное место для рядов.'],
  ['body-h','Рабочая высота корпуса','мм','2000','2200','side body','Корпус','На виде сбоку изменяется высота корпуса; на виде сверху диаметр остаётся прежним.'],
  ['body-t','Толщина стенки корпуса','мм','4','6','top section body','Сечение корпуса','Наружный диаметр сохраняется; внутри меняются диаметр и толщина стенки. Нужен увеличенный разрез.'],
  ['core-d','Диаметр вытеснительной трубы','мм','180','220','top side core','Сечение вытеснителя','На обоих видах меняется размер центральной вставки и радиальные промежутки.'],
  ['core-h','Длина вытеснительной трубы','мм','1800','1600','side core','Вытеснительная труба','На виде сбоку становится виден изменившийся торцевой участок вставки.'],
  ['core-t','Стенка вытеснительной трубы','мм','3','4','section core','Сечение вытеснителя','Толщина стенки показывается в увеличенном сечении; наружный диаметр не меняется.'],
  ['tube-d','Наружный диаметр трубы змеевика','мм','20','25','top side section coil','Сечение трубы','Меняется толщина изображения труб на проекциях и их сечение. Реальные зазоры нужно проверять заново.'],
  ['tube-t','Толщина стенки трубы змеевика','мм','2','3','section coil','Сечение трубы','Снаружи труба остаётся прежней, внутри уменьшается проходное сечение. Изменение видно в разрезе.'],
  ['rows','Количество радиальных рядов','рядов','3','4','top side rows','Радиальные ряды','Добавляется ещё один радиальный ряд на виде сверху и соответствующая навивка на виде сбоку.'],
  ['row-d','Диаметр навивки выбранного ряда','мм','300','340','top side rows','Выбранный ряд','Меняется окружность оси навивки сверху и ширина этого ряда сбоку.'],
  ['row-count','Змеевиков в выбранном ряду','шт.','2','3','top side rows unroll','Навивки выбранного ряда','На виде сверху меняется число входов, на виде сбоку и развёртке — число параллельных навивок.'],
  ['row-turns','Витков на змеевик','вит.','10','12','side rows unroll','Фрагмент навивки','На виде сбоку становится больше витков; при неизменном шаге увеличивается высота ряда.'],
  ['row-pitch','Шаг навивки','мм','60','70','side rows unroll','Шаг между витками','Меняется подъём за один оборот и высота навивки. На развёртке меняется наклон линий.'],
  ['row-offset','Смещение ряда по высоте','мм','0','100','side rows','Осевое положение ряда','Ряд сдвигается вдоль аппарата без изменения количества витков, шага и диаметра.'],
  ['row-phase','Начальный угол навивки','°','0','45','top side rows unroll','Положение входов','На виде сверху поворачиваются входы выбранного ряда. На боковом виде меняется проекция навивки.'],
  ['row-hand','Направление навивки','','Правое','Левое','side rows unroll','Направление навивки','Показываются направление спирали, стрелка навивки и передние/задние участки. Одного силуэта может быть недостаточно.'],
  ['gap-core','Минимальный зазор до вытеснителя','мм','5','8','gap core-gap','Зазор до вытеснителя','Меняется требуемая зона вокруг вставки, а не положение труб. Видны фактический зазор и заданный минимум.'],
  ['gap-body','Минимальный зазор до корпуса','мм','5','8','gap body-gap','Зазор до корпуса','Меняется допустимая зона вдоль внутренней стенки корпуса. Геометрия сама не перестраивается.'],
  ['gap-row','Минимальный зазор между рядами','мм','5','8','gap row-gap','Зазор между рядами','Выделяются расстояния между соседними рядами и требуемый минимум.'],
  ['gap-coil','Минимальный зазор между навивками','мм','5','8','gap coil-gap unroll','Зазор между навивками','На увеличенном фрагменте и развёртке показывается требуемое расстояние между соседними трубами.']
 ];
 const variants=[
  ['Две основные проекции','Сверху и сбоку, без смены режима. Обе проекции постоянно видны и реагируют на выбранный параметр.','<strong>Подходит:</strong> для постоянной работы с общей компоновкой. Толщины стенок требуют локального увеличения.'],
  ['Большой вид сбоку + детали','Главная проекция занимает большую часть поля. Справа — вид сверху, сечение и выбранный зазор.','<strong>Баланс общего и частного.</strong> Положение дополнительных видов не меняется, поэтому к интерфейсу легко привыкнуть.','Основной кандидат'],
  ['Три равноправных окна','Отдельные области для бокового вида, вида сверху и детали, связанной с редактируемым параметром.','<strong>Подходит:</strong> если одинаково часто нужны общая геометрия и сечения. Каждая проекция получает меньше ширины.'],
  ['Общая схема + узлы','Две общие проекции сверху и полоса небольших конструктивных деталей под ними.','<strong>Подходит:</strong> для обзора всей конструкции. Мелкие узлы можно разворачивать при выборе соответствующего поля.'],
  ['Общая схема + фокус на параметре','Слева аппарат целиком, справа — крупный фрагмент. Содержимое фрагмента меняется вместе с выбранным полем.','<strong>Подходит:</strong> для точечной настройки. Например, поле «Стенка трубы» сразу показывает увеличенное сечение.','Альтернатива'],
  ['Сборка + разнесённые элементы','Собранный аппарат рядом с отдельно показанными корпусом, вытеснителем и выбранным рядом.','<strong>Подходит:</strong> для понимания состава аппарата. Разнесение условное; реальные расстояния остаются на сборке.'],
  ['Послойная компоновка','Общие виды с управлением видимостью корпуса, вытеснителя и рядов. Ненужные элементы можно приглушить.','<strong>Подходит:</strong> для сложной многорядной компоновки. Редактируемый элемент должен оставаться видимым.'],
  ['Компоновка + развёртка навивки','Общие виды слева, крупная развёртка выбранного ряда справа. Акцент на шаге и параллельных змеевиках.','<strong>Подходит:</strong> для настройки самих навивок. Толщины и диаметры дополнительно поясняются увеличенной деталью.'],
  ['Размерная схема и зазоры','Проекции с размерными линиями и отдельная колонка расстояний: до корпуса, вставки и соседних рядов.','<strong>Подходит:</strong> для плотного размещения труб. Фактическое расстояние и заданный минимум различаются явно.'],
  ['Новая геометрия + предыдущий контур','Сплошной контур нового состояния и приглушённый пунктир предыдущего. Под схемой — подпись изменения.','<strong>Подходит:</strong> чтобы оценить результат правки. Предыдущий контур можно скрыть, не меняя текущую конструкцию.']
 ];
 const key='physnow-layout-comparison-v1';let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
 const selected=new Set(Array.isArray(saved.selected)?saved.selected.filter(i=>Number.isInteger(i)&&i>=0&&i<10):[]);
 let chosenParameter=parameters[0],before=chosenParameter[3],after=chosenParameter[4],view=saved.view==='large'?'large':'grid',filtered=false;
 const zones={top:['Вид сверху','Диаметры, ряды, входы змеевиков и радиальные промежутки.'],side:['Вид сбоку','Высоты, витки, шаг навивки и осевые смещения.'],section:['Сечение трубы','Наружный и внутренний диаметры, толщина стенки.'],detail:['Увеличенная деталь','Здесь будет крупный фрагмент для выбранного параметра.'],body:['Корпус','Сечение стенки и габаритные размеры корпуса.'],core:['Вытеснительная труба','Диаметр, длина и увеличенное сечение стенки.'],coil:['Труба змеевика','Крупное сечение с наружным и внутренним диаметрами.'],rows:['Выбранный ряд','Диаметр навивки, число змеевиков и осевое положение.'],gap:['Выбранный зазор','Фактическое расстояние ↔ заданный минимум.'],unroll:['Развёртка навивки','Шаг, параллельные навивки, направление и промежутки.'],'core-gap':['До вытеснителя','Фактический зазор / требуемый минимум.'],'body-gap':['До корпуса','Фактический зазор / требуемый минимум.'],'row-gap':['Между рядами','Фактический зазор / требуемый минимум.']};
 function persist(){try{localStorage.setItem(key,JSON.stringify({selected:[...selected],view}))}catch{}}
 function zone(kind,options={}){const [title,description]=zones[kind],types=options.types||kind,symbol=['top','side','section','unroll'].includes(kind)?kind:'detail';return '<div class="zone'+(options.compact?' compact':'')+'" data-zone="'+types+'" data-kind="'+kind+'"'+(options.dynamic?' data-dynamic-detail':'')+'><div class="zone-symbol '+symbol+'" aria-hidden="true"></div><div class="zone-title">'+title+'</div><div class="zone-description">'+description+'</div><div class="zone-response"></div><span class="previous-tag">Пунктир: предыдущий контур</span></div>'}
 const pair=()=>'<div class="overview-pair">'+zone('top')+zone('side',{dynamic:true,types:'side detail'})+'</div>';
 function layout(i){
  if(i===0)return '<div class="mock-canvas layout-dual">'+zone('top',{types:'top section'})+zone('side',{types:'side detail',dynamic:true})+'</div>';
  if(i===1)return '<div class="mock-canvas layout-hero">'+zone('side')+zone('top',{compact:true})+zone('section',{compact:true,dynamic:true,types:'section'})+zone('gap',{compact:true,dynamic:true,types:'gap'})+'</div>';
  if(i===2)return '<div class="mock-canvas layout-triptych">'+zone('side')+zone('top')+zone('detail',{dynamic:true})+'</div>';
  if(i===3)return '<div class="mock-canvas layout-nodes">'+zone('top')+zone('side')+zone('body',{compact:true})+zone('core',{compact:true})+zone('coil',{compact:true})+zone('rows',{compact:true,types:'rows gap unroll'})+'</div>';
  if(i===4)return '<div class="mock-canvas layout-focus">'+pair()+zone('detail',{dynamic:true})+'</div>';
  if(i===5)return '<div class="mock-canvas layout-exploded">'+pair()+zone('body',{compact:true})+zone('core',{compact:true})+zone('rows',{compact:true,dynamic:true,types:'rows coil gap'})+'</div>';
  if(i===6)return '<div class="mock-canvas layout-layers">'+pair()+'<aside class="layer-panel"><h3>Видимость элементов</h3>'+[['body','Корпус'],['core','Вытеснитель'],['row1','Ряд 1'],['row2','Ряд 2'],['row3','Ряд 3']].map(([k,label])=>'<label><input type="checkbox" data-layer="'+k+'" checked>'+label+'</label>').join('')+'<p class="layer-hint">Выбранный узел подсвечивается. Скрытые элементы не должны мешать редактированию.</p><p class="layer-hidden" aria-live="polite"></p></aside></div>';
  if(i===7)return '<div class="mock-canvas layout-unroll">'+pair()+zone('unroll',{dynamic:true,types:'unroll section'})+'</div>';
  if(i===8)return '<div class="mock-canvas layout-clearance">'+pair()+zone('core-gap',{compact:true,types:'core-gap core'})+zone('body-gap',{compact:true,types:'body-gap body'})+zone('row-gap',{compact:true,dynamic:true,types:'row-gap coil-gap gap rows'})+'</div>';
  return '<div class="mock-canvas layout-overlay previous-contour">'+zone('top',{types:'top section'})+zone('side',{dynamic:true,types:'side detail'})+'<div class="overlay-controls"><span class="change-description"></span><button type="button" data-overlay-toggle aria-pressed="true">Скрыть прошлый контур</button></div></div>';
 }
 function render(){
  $('gallery').innerHTML=variants.map((v,i)=>'<article class="variant" data-variant="'+i+'" id="variant-'+(i+1)+'"><div class="variant-title"><span class="variant-number">'+String(i+1).padStart(2,'0')+'</span><h2>'+v[0]+'</h2>'+(v[3]?'<span class="recommend">'+v[3]+'</span>':'')+'</div><p class="variant-description">'+v[1]+'</p><section class="workbench" aria-label="Вариант '+(i+1)+' блока Компоновка аппарата"><div class="workbench-head"><span class="step">05</span><div class="mode"><span>Компоновка аппарата</span><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 7 6 6 6-6"/></svg></div><span class="sketch-label">Эскиз интерфейса</span></div>'+layout(i)+'<div class="mock-footer">'+(i===8?'Размерные линии и зоны показаны условно. Минимальные зазоры не перемещают трубы автоматически.':'При выборе параметра выделяется соответствующая проекция или увеличенная деталь.')+'</div></section><p class="variant-note">'+v[2]+'</p><button type="button" class="choose" data-select="'+i+'" aria-pressed="false"></button></article>').join('');
  $('quick-nav').innerHTML=variants.map((v,i)=>'<button type="button" data-jump="'+i+'" title="'+v[0]+'"><span>'+String(i+1).padStart(2,'0')+'</span><span class="quick-name">'+['Два вида','Главный вид','Три окна','Узлы','Фокус','Разнесение','Слои','Развёртка','Зазоры','До / после'][i]+'</span></button>').join('');
  updateScenario();updateGallery();
 }
 function changeText(){return (before.trim()||'…')+' → '+(after.trim()||'…')+(chosenParameter[2]?' '+chosenParameter[2]:'')}
 function updateScenario(){
  const p=chosenParameter,types=new Set(p[5].split(' ')),change=changeText(),gap=p[0].startsWith('gap-');
  $('active-scenario').textContent=p[1]+': '+change;
  $('scenario-hint').textContent=p[7];
  for(const el of document.querySelectorAll('[data-zone]')){
   const zoneTypes=el.dataset.zone.split(' '),dynamic=el.hasAttribute('data-dynamic-detail');
   const affected=(dynamic&&zoneTypes.includes('detail'))||zoneTypes.some(t=>types.has(t));el.classList.toggle('affected',affected);
   const title=el.querySelector('.zone-title'),description=el.querySelector('.zone-description');
   if(dynamic&&el.dataset.kind==='detail'){title.textContent=p[6];description.textContent=gap?'Здесь будет выделена требуемая зона и проверка фактического расстояния.':'Здесь будет увеличенный фрагмент для выбранного параметра.'}
   else if(dynamic&&el.dataset.kind==='side'){description.textContent=types.has('side')?zones.side[1]:'Локальная выноска: '+p[6].toLowerCase()+'. Общий вид остаётся на месте.'}
   else if(dynamic){title.textContent=affected?p[6]:zones[el.dataset.kind][0];description.textContent=affected?'Здесь будет увеличенная деталь, связанная с выбранным полем.':zones[el.dataset.kind][1]}
   el.querySelector('.zone-response').textContent=affected?p[1]+': '+change:'';
   el.setAttribute('aria-label',title.textContent+(affected?' · '+p[1]+': '+change:''));
  }
  document.querySelectorAll('.change-description').forEach(el=>el.textContent=p[1]+': '+change);
 }
 function updateGallery(){
  $('gallery').classList.toggle('large',view==='large');
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
  document.querySelectorAll('[data-variant]').forEach(el=>{const i=Number(el.dataset.variant);el.hidden=filtered&&!selected.has(i);el.classList.toggle('selected',selected.has(i));const b=el.querySelector('.choose');b.setAttribute('aria-pressed',String(selected.has(i)));b.textContent=selected.has(i)?'✓ В сравнении':'+ Добавить в сравнение'});
  $('filter').textContent='Выбранные · '+selected.size;$('filter').setAttribute('aria-pressed',String(filtered));
  $('gallery').querySelector('.empty')?.remove();if(filtered&&!selected.size)$('gallery').insertAdjacentHTML('beforeend','<div class="empty">Нет выбранных вариантов. Нажмите «Выбранные», чтобы показать все 10.</div>');persist();
 }
 function setScenario(index){chosenParameter=parameters[index];before=chosenParameter[3];after=chosenParameter[4];$('parameter').value=index;$('before').value=before;$('after').value=after;document.querySelectorAll('.value-unit').forEach(el=>el.textContent=chosenParameter[2]);const numeric=chosenParameter[0]!=='row-hand';$('before').inputMode=$('after').inputMode=numeric?'decimal':'text';updateScenario()}
 $('parameter').innerHTML=parameters.map((p,i)=>'<option value="'+i+'">'+esc(p[1])+'</option>').join('');
 $('parameter').addEventListener('change',e=>setScenario(Number(e.target.value)));
 $('before').addEventListener('input',e=>{before=e.target.value;updateScenario()});$('after').addEventListener('input',e=>{after=e.target.value;updateScenario()});
 $('reset-scenario').addEventListener('click',()=>setScenario(Number($('parameter').value)));
 document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;updateGallery()}));
 $('filter').addEventListener('click',()=>{filtered=!filtered;updateGallery()});$('clear').addEventListener('click',()=>{selected.clear();filtered=false;updateGallery()});
 $('quick-nav').addEventListener('click',e=>{const b=e.target.closest('[data-jump]');if(!b)return;filtered=false;updateGallery();$('variant-'+(Number(b.dataset.jump)+1)).scrollIntoView({block:'start'})});
 $('gallery').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-select')){const i=Number(b.dataset.select);selected.has(i)?selected.delete(i):selected.add(i);updateGallery()}if(b.hasAttribute('data-overlay-toggle')){const on=b.getAttribute('aria-pressed')!=='true';b.setAttribute('aria-pressed',String(on));b.textContent=on?'Скрыть прошлый контур':'Показать прошлый контур';b.closest('.mock-canvas').classList.toggle('previous-contour',on)}});
 $('gallery').addEventListener('change',e=>{if(!e.target.matches('[data-layer]'))return;const panel=e.target.closest('.layer-panel'),hidden=[...panel.querySelectorAll('input:not(:checked)')].map(input=>input.parentElement.textContent.trim());panel.querySelector('.layer-hidden').textContent=hidden.length?'В эскизе будут скрыты: '+hidden.join(', '):'Все элементы видимы';panel.closest('.mock-canvas').querySelectorAll('.zone').forEach(z=>z.style.opacity=hidden.length?'.65':'1')});
 render();setScenario(0);
})();
