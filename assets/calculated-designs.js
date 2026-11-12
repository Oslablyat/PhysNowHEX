/* Compact summaries of actual Teplo calls. No search, acceptance or geometry edits. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CalculatedDesigns=api})(globalThis,function(){
 'use strict';
 const columns=[
  {key:'rank',label:'Место',digits:0,heat:false,width:50,flex:.12,group:'Габариты и компоновка'},
  {key:'tubeSize',label:'DN трубы',digits:3,heat:false,width:62,flex:.15,group:'Габариты и компоновка'},
  {key:'height',label:'Длина, мм',digits:3,width:83,flex:.2,group:'Габариты и компоновка'},
  {key:'diameter',label:'Диаметр, мм',digits:0,width:83,flex:.2,group:'Габариты и компоновка'},
  {key:'count',label:'Трубок, шт.',digits:0,width:83,flex:.2,group:'Габариты и компоновка'},
  {key:'rowCount',label:'Рядов',digits:0,width:53,flex:.13,group:'Габариты и компоновка'},
  {key:'tubePressureDropKPa',label:'Δp трубное, кПа',header:'Δp, кПа\nтрубное',digits:2,heat:false,width:76,group:'Потоки и тепловой расчёт',unavailable:'Перепад давления в трубном пространстве: текущая методика змеевиков не рассчитывает Δp.'},
  {key:'shellPressureDropKPa',label:'Δp межтрубное, кПа',header:'Δp, кПа\nмежтрубное',digits:2,heat:false,width:76,group:'Потоки и тепловой расчёт',unavailable:'Перепад давления в межтрубном пространстве: текущая методика змеевиков не рассчитывает Δp.'},
  {key:'tubeMetres',label:'Всего трубы, м',digits:3,width:92,default:false,group:'Труба и поверхность',help:'Полная длина всех трубок с отводами и концами.'},
  {key:'volumeLitres',label:'Габаритный объём, л',digits:2,width:98,default:false,group:'Габариты и компоновка',help:'Объём наружного цилиндра по длине и диаметру корпуса, не объём жидкости.'},
  {key:'area',label:'Площадь теплообмена, м²',digits:3,heat:false,width:100,default:false,group:'Труба и поверхность',help:'Поверхность по среднему диаметру трубки, которую использует Teplo, без отводов.'},
  {key:'ua',label:'UA, Вт/К',digits:1,heat:false,width:96,default:false,group:'Потоки и тепловой расчёт'},
  {key:'k',label:'K, Вт/(м²·К)',digits:1,heat:false,width:104,default:false,group:'Потоки и тепловой расчёт'},
  {key:'reHot',label:'Re трубное',header:'Re\nтрубное',optionLabel:'Re в трубном пространстве',digits:0,heat:false,width:88,default:false,group:'Потоки и тепловой расчёт',help:'Минимальное число Рейнольдса среди отдельных трубок по поверке Teplo.'},
  {key:'reCold',label:'Re межтрубное',header:'Re\nмежтрубное',optionLabel:'Re в межтрубном пространстве',digits:0,heat:false,width:100,default:false,group:'Потоки и тепловой расчёт',help:'Число Рейнольдса межтрубного потока по поверке Teplo.'},
  {key:'velocityHot',label:'Скорость трубная, м/с',header:'Скорость, м/с\nтрубная',optionLabel:'Скорость в трубном, м/с',digits:3,heat:false,width:100,default:false,group:'Потоки и тепловой расчёт',help:'Средняя скорость по суммарному проходному сечению труб по поверке Teplo.'},
  {key:'velocityCold',label:'Скорость межтрубная, м/с',header:'Скорость, м/с\nмежтрубная',optionLabel:'Скорость в межтрубном, м/с',digits:3,heat:false,width:108,default:false,group:'Потоки и тепловой расчёт',help:'Скорость в минимальном свободном межтрубном сечении по поверке Teplo.'}
 ];
 const defaultColumnKeys=columns.filter(c=>c.default!==false).map(c=>c.key),storageKey='physnow-calculated-columns-v1';
 function normalizeColumnKeys(value){const selected=new Set(Array.isArray(value)?value:[]),keys=columns.filter(c=>selected.has(c.key)).map(c=>c.key);return keys.length?keys:[...defaultColumnKeys]}
 const sizeFormat=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3,useGrouping:false});
 function tubeDimensions(row){return Number.isFinite(row.tubeDiameter)&&row.tubeDiameter>0&&Number.isFinite(row.tubeWall)&&row.tubeWall>0?[row.tubeDiameter,row.tubeWall]:null}
 function formatTubeSize(row){const size=tubeDimensions(row);return size?size.map(n=>sizeFormat.format(n)).join('×'):'—'}
 function sortRows(rows,key='id',direction='asc'){
  if(!columns.some(c=>c.key===key))key='id';const sign=direction==='desc'?-1:1;
  const value=r=>key==='tubeSize'?tubeDimensions(r)?.[0]:r[key];
  return [...rows].sort((a,b)=>{const av=value(a),bv=value(b),missing=v=>v==null||typeof v==='number'&&!Number.isFinite(v);if(missing(av)||missing(bv))return missing(av)===missing(bv)?a.id-b.id:missing(av)?1:-1;return sign*(typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'ru',{numeric:true}))||(key==='tubeSize'?sign*(a.tubeWall-b.tubeWall):0)||a.id-b.id});
 }
 function filterRows(rows){return rows.filter(r=>r.status==='accepted')}
 function heatRanges(rows,keys=defaultColumnKeys){
  return Object.fromEntries(columns.filter(c=>c.heat!==false&&keys.includes(c.key)).map(c=>{
   const values=rows.map(r=>r[c.key]).filter(Number.isFinite);
   return [c.key,values.length?[Math.min(...values),Math.max(...values)]:null];
  }));
 }
 function heatColor(value,range){
  if(!Number.isFinite(value)||!range)return null;
  const [min,max]=range,t=max===min?0:Math.max(0,Math.min(1,(value-min)/(max-min)));
  return `rgb(${Math.round(35+84*t)}, ${Math.round(78-13*t)}, ${Math.round(69-16*t)})`;
 }
 function create(host,options={}){
  const doc=host.ownerDocument,head=host.querySelector('thead'),body=host.querySelector('tbody');
  const formats=new Map(columns.map(c=>[c.key,new Intl.NumberFormat('ru-RU',{maximumFractionDigits:c.digits})]));
  let storage,visibleKeys=[...defaultColumnKeys];
  try{storage=doc.defaultView.localStorage;const saved=JSON.parse(storage.getItem(storageKey));if(saved?.version===1)visibleKeys=normalizeColumnKeys(saved.columns)}catch{}
  let rows=[],selectedId=null,recommendedId=null,searchKey=null,sortKey='rank',direction='asc',loading=false,canSelect=true,includeAll=false;
  const make=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e};
  const table=head.closest('table'),scroll=host.querySelector('.calculated-scroll'),colgroup=make('colgroup');table.classList.add('calculated-heatmap');table.prepend(colgroup);
  const shownColumns=()=>columns.filter(c=>visibleKeys.includes(c.key));
  function renderHead(){
   const shown=shownColumns(),flex=shown.reduce((sum,c)=>sum+(c.flex||0),0),fixed=34+shown.filter(c=>!c.flex).reduce((sum,c)=>sum+c.width,0),minimum=34+shown.reduce((sum,c)=>sum+c.width,0);
   table.style.minWidth=minimum+'px';table.style.width=flex?'100%':fixed+'px';table.style.setProperty('--calculated-flex-width',`calc(100% - ${fixed}px)`);
   head.replaceChildren();colgroup.replaceChildren();const tr=make('tr');
   for(const c of shown){
    const col=make('col');col.style.width=c.flex?`calc(var(--calculated-flex-width) * ${c.flex/flex})`:c.width+'px';colgroup.append(col);
    const th=make('th'),button=make('button',c.header||c.label),arrow=make('span');th.scope='col';th.dataset.key=c.key;th.dataset.label=c.label;th.dataset.unavailable=String(!!c.unavailable);button.type='button';button.dataset.sort=c.key;button.disabled=!!c.unavailable;button.title=c.unavailable||c.help||c.label;arrow.className='sort-arrow';arrow.hidden=!!c.unavailable;arrow.setAttribute('aria-hidden','true');button.append(arrow);button.addEventListener('click',()=>{direction=sortKey===c.key&&direction==='asc'?'desc':'asc';sortKey=c.key;render()});th.append(button);tr.append(th);
   }
   const cardCol=make('col');cardCol.style.width='34px';colgroup.append(cardCol);
   const cardHeading=make('th'),cardLabel=make('span','Карточка');cardHeading.scope='col';cardHeading.className='calculated-card-cell';cardLabel.className='sr-only';cardHeading.append(cardLabel);tr.append(cardHeading);head.append(tr);
  }
  const trigger=host.closest('.design-detail-settings')?.querySelector('[data-table-settings]'),dialog=make('dialog');dialog.id='calculated-settings-dialog';dialog.className='calculated-settings-dialog';dialog.setAttribute('aria-labelledby','calculated-settings-title');
  const dialogHead=make('div'),title=make('h2','Настройки таблицы'),close=make('button','×');dialogHead.className='calculated-settings-heading';title.id='calculated-settings-title';close.type='button';close.className='calculated-settings-close';close.setAttribute('aria-label','Закрыть настройки таблицы');dialogHead.append(title,close);
  const fields=make('div');fields.className='calculated-settings-fields';
  for(const group of ['Габариты и компоновка','Труба и поверхность','Потоки и тепловой расчёт']){
   const fieldset=make('fieldset'),legend=make('legend',group),list=make('div');list.className='calculated-settings-options';fieldset.append(legend,list);
   for(const c of columns.filter(c=>c.group===group)){const label=make('label'),input=make('input'),caption=make('span',c.optionLabel||c.label);input.type='checkbox';input.dataset.columnKey=c.key;input.checked=visibleKeys.includes(c.key);label.title=c.unavailable||c.help||c.label;label.append(input,caption);list.append(label)}fields.append(fieldset);
  }
  const footer=make('div'),status=make('span'),reset=make('button','По умолчанию'),done=make('button','Готово');footer.className='calculated-settings-footer';status.className='calculated-settings-status';status.setAttribute('role','status');reset.type=done.type='button';done.className='calculated-settings-done';footer.append(status,reset,done);
  dialog.append(dialogHead,fields,footer);doc.body.append(dialog);
  const syncOptions=()=>{for(const input of fields.querySelectorAll('[data-column-key]'))input.checked=visibleKeys.includes(input.dataset.columnKey);status.textContent=''};
  function setColumns(keys){
   const top=scroll.scrollTop,left=scroll.scrollLeft;visibleKeys=normalizeColumnKeys(keys);
   if(!visibleKeys.includes(sortKey)){sortKey=shownColumns().find(c=>!c.unavailable)?.key||'id';direction='asc'}
   try{storage?.setItem(storageKey,JSON.stringify({version:1,columns:visibleKeys}))}catch{}
   renderHead();render();scroll.scrollTop=top;scroll.scrollLeft=left;syncOptions();
  }
  fields.addEventListener('change',event=>{const input=event.target;if(!input.matches('[data-column-key]'))return;const keys=[...fields.querySelectorAll('[data-column-key]:checked')].map(el=>el.dataset.columnKey);if(!keys.length){input.checked=true;status.textContent='Оставьте хотя бы один столбец';return}setColumns(keys)});
  reset.addEventListener('click',()=>setColumns(defaultColumnKeys));close.addEventListener('click',()=>dialog.close());done.addEventListener('click',()=>dialog.close());
  trigger?.addEventListener('click',()=>{syncOptions();dialog.showModal();close.focus()});
  dialog.addEventListener('click',event=>{if(event.target!==dialog)return;const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close()});
  renderHead();
  function render(){
   const shown=shownColumns(),compared=includeAll?rows:rows.filter(r=>r.rank!=null),visible=sortRows(compared,sortKey,direction),ranges=heatRanges(compared,visibleKeys);
   for(const th of head.querySelectorAll('th[data-key]')){const unavailable=th.dataset.unavailable==='true',active=!unavailable&&th.dataset.key===sortKey;th.setAttribute('aria-sort',active?(direction==='asc'?'ascending':'descending'):'none');th.querySelector('.sort-arrow').textContent=unavailable?'':active?(direction==='asc'?'↑':'↓'):'↕';th.querySelector('button').setAttribute('aria-label',th.dataset.label+': '+(unavailable?'расчёт не подключён':active&&direction==='asc'?'сортировать по убыванию':'сортировать по возрастанию'))}
   const focusedId=body.contains(doc.activeElement)?doc.activeElement.dataset.calculationId:null;
   body.replaceChildren();
   if(!visible.length){const empty=make('tr'),td=make('td',loading?'Выполняется расчёт…':'Среди проверенных конструкций подходящих не найдено.');td.colSpan=shown.length+1;td.className='calculated-empty';empty.append(td);body.append(empty);return}
   for(const r of visible){const row=make('tr');row.dataset.calculationId=String(r.id);row.dataset.selected=String(r.id===selectedId);row.dataset.status=r.status;
    row.tabIndex=loading||!canSelect?-1:0;
    row.setAttribute('aria-label','Выбрать конструкцию №'+r.id);
    row.setAttribute('aria-selected',String(r.id===selectedId));
    row.setAttribute('aria-disabled',String(loading||!canSelect));
    row.addEventListener('click',()=>{if(!loading&&canSelect)options.onSelect?.(r.id)});
    row.addEventListener('keydown',event=>{if(event.target===row&&(event.key==='Enter'||event.key===' ')){event.preventDefault();if(!loading&&canSelect)options.onSelect?.(r.id)}});
    for(const c of shown){const value=r[c.key],td=make('td'),cell=make('span'),format=formats.get(c.key);
     td.dataset.key=c.key;cell.className='calculated-value';cell.textContent=c.unavailable?'—':c.key==='tubeSize'?formatTubeSize(r):value==null||!Number.isFinite(value)?'—':format.format(value);
     if(c.unavailable){cell.classList.add('calculated-unavailable-value');cell.title=c.unavailable;}
     if(c.key==='tubeSize'){cell.classList.add('calculated-tube-value');cell.title='Наружный диаметр × толщина стенки трубы, мм';}
     if(c.heat===false&&c.key!=='rank'&&!c.unavailable&&c.key!=='tubeSize'){cell.classList.add('calculated-plain-value');cell.title=c.help||c.label;}
     if(c.heat!==false){
      const background=heatColor(value,ranges[c.key]);cell.classList.add('calculated-heat-value');cell.dataset.metric=c.key;
      if(background){cell.style.backgroundColor=background;const [min,max]=ranges[c.key];cell.title=c.label+': '+cell.textContent+'. '+(min===max?'Значение одинаково у всех показанных вариантов.':'Меньше — лучше. Диапазон сравнения: '+format.format(min)+'…'+format.format(max)+'. Цветовая шкала общая для всего списка.');}
     }
     if(c.key==='rank'&&r.id===recommendedId){cell.textContent='★ '+cell.textContent;td.className='calculated-recommendation';td.title='Рекомендованная конструкция'}
     if(r.warning&&(c.key==='rank'||!visibleKeys.includes('rank')&&c.key===shown[0].key)){const warning=make('span',' ⚠ Re');warning.title='Исключение по Re одного змеевика. Применимость трубной корреляции Teplo не подтверждена.';warning.className='calculated-warning';cell.append(warning)}
     td.append(cell);
     row.append(td)
    }
    const action=make('td'),card=make('button');action.className='calculated-card-cell';card.type='button';card.className='calculated-card-button';card.dataset.calculationCard=String(r.id);card.disabled=loading||!canSelect;card.title='Карточка теплообменника';card.setAttribute('aria-label','Карточка конструкции №'+r.id);card.setAttribute('aria-haspopup','dialog');card.setAttribute('aria-controls','exchanger-card-dialog');
    card.innerHTML='<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 3h8l2 2v12H4V3h2Zm1 5h6m-6 3h6m-6 3h4"/></svg>';
    card.addEventListener('click',event=>{event.stopPropagation();if(!loading&&canSelect)options.onCard?.(r.id)});action.append(card);row.append(action);body.append(row)
   }
   if(focusedId)body.querySelector('tr[data-calculation-id="'+focusedId+'"]')?.focus({preventScroll:true});
  }
  return {setData(data){
   if(searchKey!==data.searchKey){includeAll=false;sortKey='rank';direction='asc';searchKey=data.searchKey}
   const received=!rows.length&&data.rows?.length;
   rows=filterRows(data.rows??[]);selectedId=data.selectedId??null;recommendedId=data.recommendedId??null;
   if(received&&selectedId!=null&&selectedId!==recommendedId){
    const chosen=rows.find(r=>r.id===selectedId);
    if(chosen)includeAll=chosen.rank==null;
   }
   loading=!!data.loading;canSelect=data.canSelect!==false;host.hidden=data.visible===false;render();
  }};
 }
 return {columns,defaultColumnKeys,normalizeColumnKeys,sortRows,filterRows,heatRanges,heatColor,formatTubeSize,create};
});
