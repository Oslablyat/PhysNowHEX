import {createDesignView} from './design-view.js?v=rows-sidebar-20261022';

const COLORS=['#72bddc','#e5ad71','#76c6a6','#aa9ae5','#da95b7','#b9ca71','#79b4ed','#c99a76'];
const EYE='<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5Z"/><circle cx="8" cy="8" r="2"/><path class="eye-slash" d="m2 2 12 12"/></svg>';
const CHEVRON='<svg class="chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
const LAYERS='<svg viewBox="0 0 18 18" aria-hidden="true"><path d="m9 2 7 4-7 4-7-4 7-4Zm-7 8 7 4 7-4M2 14l7 4 7-4"/></svg>';
const designs=[
 ['panel','Компактная сетка','Ряды в две колонки, всегда доступны.','Для частых переключений. Компактнее отдельного столбика кнопок.'],
 ['layers','Меню «Слои»','Одна кнопка раскрывает список рядов.','Максимум свободного поля в закрытом состоянии. Внутри можно оставить только один ряд.'],
 ['rail','Вертикальная лента','Номера и глаза в одной узкой панели.','Ближе всего к текущему интерфейсу, но без разрозненных карточек.'],
 ['bottom','Нижняя строка','Ряды собраны в компактную панель снизу.','Верхний правый угол остаётся свободным. Все переключатели на одной линии.'],
 ['header','Ряды в шапке','Управление вынесено над областью модели.','Не перекрывает геометрию. Требует дополнительной строки по высоте.'],
 ['sidebar','Боковая панель','Чекбоксы и названия в отдельной колонке.','Инженерный список с ясными подписями. Поле модели становится немного уже.'],
 ['drawer','Выдвижной список','Панель справа можно целиком убрать.','Для подробной работы со слоями; после настройки список закрывается.'],
 ['legend','Легенда без рамки','Цвета рядов и чекбоксы прямо на поле.','Минимум оформления: читается как легенда к модели, а не отдельное меню.'],
 ['rings','Кольцевая схема','Ряды показаны как концентрические кольца.','Связь с геометрией видна сразу. Номера дублируют кольца для точного выбора.'],
 ['focus','Быстрый фокус','Обычное скрытие и перебор отдельных рядов.','Для проверки по одному ряду: стрелки оставляют только выбранный ряд.']
];
function example(count){return {diameter:600,height:1000,shellWall:6,coreDiameter:80,coreLength:1000,coreWall:3,tubeDiameter:16,tubeWall:1.5,leadBendRadius:32,leadStraightLength:100,rows:Array.from({length:count},(_,index)=>({index,diameter:180+350*index/(count-1),turns:10,pitch:85,count:1,offset:60,phase:0,direction:'right',hidden:index===2}))};}
const heading=(name='Ряды',all='Все')=>'<div class="control-heading"><span>'+name+' <small data-counter></small></span><button type="button" data-show-all>'+all+'</button></div>';
const rows=()=>'<div data-rows></div>';
function controls(type){
 if(type==='panel')return '<section class="compact-panel" aria-label="Видимость рядов">'+heading()+rows()+'</section>';
 if(type==='layers')return '<div class="layers-control"><button type="button" class="layers-trigger" data-disclosure aria-expanded="true" aria-controls="layers-popover">'+LAYERS+'<span>Слои</span><small data-counter></small>'+CHEVRON+'</button><section id="layers-popover" class="layers-popover" data-disclosure-panel aria-label="Ряды змеевиков">'+heading('Ряды','Показать все')+rows()+'<p class="popover-hint">«Только» — оставить один ряд.</p></section></div>';
 if(type==='rail')return '<section class="vertical-rail" aria-label="Видимость рядов">'+heading()+rows()+'</section>';
 if(type==='bottom')return '<section class="bottom-dock" aria-label="Видимость рядов">'+heading()+rows()+'</section>';
 if(type==='header')return '<section class="header-rows" aria-label="Видимость рядов"><span class="header-rows-label">Ряды</span>'+rows()+'<button type="button" data-show-all>Все</button></section>';
 if(type==='sidebar')return '<aside class="row-sidebar" aria-label="Видимость рядов"><div class="sidebar-title">'+LAYERS+'<span>Конструкция</span></div>'+heading('Змеевики')+rows()+'</aside>';
 if(type==='drawer')return '<div class="drawer-control"><button type="button" class="drawer-trigger" data-disclosure aria-expanded="true" aria-controls="row-drawer">'+LAYERS+'<span>Ряды</span></button><aside class="row-drawer" id="row-drawer" data-disclosure-panel aria-label="Ряды змеевиков"><div class="drawer-heading"><span>Видимость рядов</span><button type="button" data-close aria-label="Закрыть список рядов">×</button></div>'+heading('Показано')+rows()+'</aside></div>';
 if(type==='legend')return '<section class="row-legend" aria-label="Видимость рядов">'+heading('Видимость')+rows()+'</section>';
 if(type==='rings')return '<section class="ring-panel" aria-label="Видимость рядов">'+heading()+'<div data-rings></div>'+rows()+'</section>';
 return '<section class="focus-dock" aria-label="Видимость и фокус на ряде">'+heading()+'<div class="focus-navigation"><button type="button" data-focus-step="-1" aria-label="Показать предыдущий ряд">‹</button><span data-focus-label>Свой набор</span><button type="button" data-focus-step="1" aria-label="Показать следующий ряд">›</button></div>'+rows()+'</section>';
}
document.getElementById('comparison-variants').innerHTML=designs.map(([type,title,description,tradeoff],index)=>'<article class="variant" id="variant-'+type+'" data-variant="'+type+'"><header class="variant-heading"><div><span class="variant-number">'+String(index+1).padStart(2,'0')+'</span><h2>'+title+'</h2></div></header><p class="variant-description">'+description+'</p><section class="demo" aria-label="Вариант '+(index+1)+': '+title+'"><div class="demo-heading"><span class="step">05</span><span>Компоновка аппарата</span>'+CHEVRON+'</div><div class="stage"><div class="model-host" data-status="idle"><span class="model-status" role="status">Подготовка 3D…</span></div><div class="section-switch" role="group" aria-label="Представление модели, вариант '+(index+1)+'"><button type="button" data-mode="cutaway" aria-pressed="false">Вырез</button><button type="button" data-mode="section" aria-pressed="true">Разрез</button></div>'+controls(type)+'</div></section><div class="tradeoff"><p>'+tradeoff+'</p></div></article>').join('');
document.querySelector('.variant-navigation').innerHTML=designs.map(([type,title],index)=>'<a href="#variant-'+type+'" aria-label="Вариант '+(index+1)+': '+title+'">'+String(index+1).padStart(2,'0')+'</a>').join('');
const variants=[...document.querySelectorAll('.variant')].map(root=>({root,host:root.querySelector('.model-host'),g:example(6),mode:'section',view:null,focus:-1}));
function rowMarkup(type,index){
 const style=' style="--row-color:'+COLORS[index]+'"',number=index+1;
 if(type==='layers'||type==='drawer')return '<div class="layer-row"'+style+'><button type="button" class="layer-toggle" data-row="'+index+'"><span class="color-dot" aria-hidden="true"></span><span>Ряд '+number+'</span>'+EYE+'</button><button type="button" class="layer-solo" data-solo="'+index+'" aria-label="Показать только ряд '+number+'">Только</button></div>';
 if(type==='sidebar'||type==='legend')return '<button type="button" class="check-row" data-row="'+index+'"'+style+'><span class="row-check" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="m2 6 3 3 5-6"/></svg></span><span class="color-dot" aria-hidden="true"></span><span>Ряд '+number+'</span></button>';
 return '<button type="button" class="row-chip" data-row="'+index+'"'+style+'><span>'+number+'</span>'+(['header','bottom','rings','focus'].includes(type)?'':EYE)+'</button>';
}
function drawRows(state){
 const {root,g}=state,type=root.dataset.variant;root.querySelector('[data-rows]').innerHTML=g.rows.map((_,index)=>rowMarkup(type,index)).join('');
 if(type==='rings')root.querySelector('[data-rings]').innerHTML='<svg class="ring-diagram" viewBox="0 0 140 140" aria-label="Концентрические ряды"><circle class="ring-core" cx="70" cy="70" r="9"/>'+[...g.rows].reverse().map(row=>{const i=row.index,radius=18+42*i/(g.rows.length-1);return '<g role="button" tabindex="0" data-ring="'+i+'" style="--row-color:'+COLORS[i]+'"><circle class="ring-hit" cx="70" cy="70" r="'+radius+'"/><circle class="ring-line" cx="70" cy="70" r="'+radius+'"/></g>';}).join('')+'</svg>';
 refresh(state);
}
function refresh(state){
 const {root,g}=state,shown=g.rows.filter(row=>!row.hidden).length;
 for(const counter of root.querySelectorAll('[data-counter]'))counter.textContent=shown+' / '+g.rows.length;
 for(const button of root.querySelectorAll('[data-show-all]'))button.disabled=shown===g.rows.length;
 for(const button of root.querySelectorAll('[data-row],[data-ring]')){const index=Number(button.dataset.row??button.dataset.ring),shown=!g.rows[index].hidden;button.setAttribute('aria-pressed',String(shown));button.setAttribute('aria-label',(shown?'Скрыть':'Показать')+' ряд '+(index+1));}
 for(const button of root.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(button.dataset.mode===state.mode));
 const label=root.querySelector('[data-focus-label]');if(label)label.textContent=state.focus>=0?'Только ряд '+(state.focus+1):shown===g.rows.length?'Все ряды':'Свой набор';
}
function showRows(state,predicate,focus=-1){state.focus=focus;state.g.rows.forEach((row,index)=>{row.hidden=!predicate(index);state.view?.setRowVisible(index,!row.hidden);});refresh(state);}
function toggleRow(state,index){const row=state.g.rows[index];row.hidden=!row.hidden;state.focus=-1;state.view?.setRowVisible(index,!row.hidden);refresh(state);}
function disclosure(state,open,focus=false){const trigger=state.root.querySelector('[data-disclosure]'),panel=state.root.querySelector('[data-disclosure-panel]');if(!trigger)return;trigger.setAttribute('aria-expanded',String(open));panel.hidden=!open;if(focus)trigger.focus();}
function activate(state){
 if(state.view)return;
 try{state.view=createDesignView(state.host,(status,message='')=>{state.host.dataset.status=status;state.host.querySelector('.model-status').textContent=status==='error'?'Не удалось показать 3D: '+message:status==='loading'?'Обновление 3D…':'';});state.view.update(state.g,state.mode,0);}catch(error){state.host.dataset.status='error';state.host.querySelector('.model-status').textContent='3D недоступно: '+error.message;}
}
function deactivate(state){if(!state.view)return;state.view.dispose();state.view=null;state.host.dataset.status='idle';state.host.querySelector('.model-status').textContent='Подготовка 3D…';}
const observer=new IntersectionObserver(entries=>{for(const entry of entries){const state=variants.find(item=>item.root===entry.target);if(entry.isIntersecting)activate(state);else deactivate(state);}},{rootMargin:'60px'});
for(const state of variants){
 drawRows(state);observer.observe(state.root);
 state.root.addEventListener('click',event=>{
  const row=event.target.closest('[data-row],[data-ring]');if(row){toggleRow(state,Number(row.dataset.row??row.dataset.ring));return;}
  const solo=event.target.closest('[data-solo]');if(solo){const index=Number(solo.dataset.solo);showRows(state,i=>i===index,index);return;}
  if(event.target.closest('[data-show-all]')){showRows(state,()=>true);return;}
  const focus=event.target.closest('[data-focus-step]');if(focus){const step=Number(focus.dataset.focusStep),index=state.focus<0?(step>0?0:state.g.rows.length-1):(state.focus+step+state.g.rows.length)%state.g.rows.length;showRows(state,i=>i===index,index);return;}
  const mode=event.target.closest('[data-mode]');if(mode){state.mode=mode.dataset.mode;refresh(state);state.view?.update(state.g,state.mode,0);return;}
  const trigger=event.target.closest('[data-disclosure]');if(trigger){disclosure(state,trigger.getAttribute('aria-expanded')!=='true');return;}
  if(event.target.closest('[data-close]'))disclosure(state,false,true);
 });
 state.root.addEventListener('keydown',event=>{if(event.target.closest('[data-ring]')&&['Enter',' '].includes(event.key)){event.preventDefault();toggleRow(state,Number(event.target.closest('[data-ring]').dataset.ring));}});
}
for(const button of document.querySelectorAll('[data-count]'))button.addEventListener('click',()=>{
 const count=Number(button.dataset.count);for(const item of document.querySelectorAll('[data-count]'))item.setAttribute('aria-pressed',String(item===button));
 for(const state of variants){state.g=example(count);state.focus=-1;drawRows(state);state.view?.update(state.g,state.mode,0);}
});
document.querySelector('.reset-all').addEventListener('click',()=>variants.forEach(state=>showRows(state,()=>true)));
document.addEventListener('click',event=>{const state=variants.find(item=>item.root.dataset.variant==='layers');if(!event.target.closest('.layers-control'))disclosure(state,false);});
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;for(const state of variants)if(state.root.contains(event.target)&&state.root.querySelector('[data-disclosure]')?.getAttribute('aria-expanded')==='true'){event.preventDefault();disclosure(state,false,true);}});
window.addEventListener('pagehide',event=>{if(!event.persisted){observer.disconnect();variants.forEach(deactivate);}},{once:true});
