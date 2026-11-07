/* Compact summaries of actual Teplo calls. No search, acceptance or geometry edits. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CalculatedDesigns=api})(globalThis,function(){
 'use strict';
 const columns=[
  {key:'id',label:'№',digits:0},
  {key:'height',label:'Длина, мм',digits:0},{key:'diameter',label:'Диаметр, мм',digits:0},
  {key:'count',label:'Трубок, шт.',digits:0},{key:'rowCount',label:'Рядов',digits:0},
  {key:'tubeMetres',label:'Всего трубы, м',digits:3},{key:'volumeLitres',label:'Объём, л',digits:2},
  {key:'area',label:'Площадь, м²',digits:3},{key:'duty',label:'Мощность, кВт',digits:3},
  {key:'reHot',label:'Re трубный',digits:0},
  {key:'reCold',label:'Re межтрубный',digits:0},{key:'ua',label:'UA, Вт/К',digits:1},
  {key:'k',label:'K, Вт/(м²·К)',digits:1}
 ];
 function sortRows(rows,key='id',direction='asc'){
  if(!columns.some(c=>c.key===key))key='id';const sign=direction==='desc'?-1:1;
  const value=r=>r[key];
  return [...rows].sort((a,b)=>{const av=value(a),bv=value(b),missing=v=>v==null||typeof v==='number'&&!Number.isFinite(v);if(missing(av)||missing(bv))return missing(av)===missing(bv)?a.id-b.id:missing(av)?1:-1;return sign*(typeof av==='number'&&typeof bv==='number'?av-bv:String(av).localeCompare(String(bv),'ru',{numeric:true}))||a.id-b.id});
 }
 function filterRows(rows){return rows.filter(r=>r.status==='accepted')}
 function create(host,options={}){
  const doc=host.ownerDocument,head=host.querySelector('thead'),body=host.querySelector('tbody'),count=host.querySelector('[data-calculation-count]'),note=host.querySelector('[data-calculation-note]');
  let rows=[],selectedId=null,sortKey='id',direction='asc',loading=false,canSelect=true;
  const make=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e};
  const scroll=host.querySelector('.calculated-scroll'),edge=make('div');
  edge.className='calculated-bottom-edge';edge.setAttribute('aria-hidden','true');host.append(edge);
  let drag=null;
  edge.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();drag={id:event.pointerId,y:event.clientY,height:scroll.getBoundingClientRect().height};edge.setPointerCapture(event.pointerId)});
  edge.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;scroll.style.height=Math.max(96,Math.min(1200,drag.height+event.clientY-drag.y))+'px'});
  const finish=event=>{if(drag?.id!==event.pointerId)return;drag=null;if(edge.hasPointerCapture(event.pointerId))edge.releasePointerCapture(event.pointerId)};
  edge.addEventListener('pointerup',finish);edge.addEventListener('pointercancel',finish);edge.addEventListener('lostpointercapture',finish);
  const tr=make('tr'),choiceHead=make('th','Выбор');choiceHead.scope='col';choiceHead.className='calculated-choice';tr.append(choiceHead);for(const c of columns){const th=make('th'),button=make('button',c.label),arrow=make('span');th.scope='col';th.dataset.key=c.key;button.type='button';button.dataset.sort=c.key;arrow.className='sort-arrow';arrow.setAttribute('aria-hidden','true');button.append(arrow);button.addEventListener('click',()=>{direction=sortKey===c.key&&direction==='asc'?'desc':'asc';sortKey=c.key;render()});th.append(button);tr.append(th)}head.append(tr);
  function render(){
   const visible=sortRows(rows,sortKey,direction);
   count.textContent=loading?'Подбор…':`Подходящих: ${visible.length}`;
   note.textContent=loading?'Выполняется подбор подходящих конструкций.':'Выберите конструкцию в первом столбце, чтобы продолжить её проработку. Нажмите на заголовок для сортировки.';
   for(const th of head.querySelectorAll('th[data-key]')){const active=th.dataset.key===sortKey;th.setAttribute('aria-sort',active?(direction==='asc'?'ascending':'descending'):'none');th.querySelector('.sort-arrow').textContent=active?(direction==='asc'?'↑':'↓'):'↕';th.querySelector('button').setAttribute('aria-label',th.querySelector('button').firstChild.textContent+': '+(active&&direction==='asc'?'сортировать по убыванию':'сортировать по возрастанию'))}
   body.replaceChildren();
   if(!visible.length){const empty=make('tr'),td=make('td',loading?'Выполняется расчёт…':'Подходящих конструкций не найдено.');td.colSpan=columns.length+1;td.className='calculated-empty';empty.append(td);body.append(empty);return}
   for(const r of visible){const row=make('tr');row.dataset.calculationId=String(r.id);row.dataset.selected=String(r.id===selectedId);row.dataset.status=r.status;
    const choice=make('td'),radio=make('input');choice.className='calculated-choice';radio.type='radio';radio.name='calculated-design-choice';radio.checked=r.id===selectedId;radio.disabled=loading||!canSelect;radio.setAttribute('aria-label','Выбрать конструкцию №'+r.id);radio.addEventListener('change',()=>options.onSelect?.(r.id));radio.addEventListener('click',()=>{if(r.id===selectedId)options.onSelect?.(r.id)});choice.append(radio);row.append(choice);
    for(const c of columns){const value=r[c.key],td=make('td');
     td.textContent=value==null||!Number.isFinite(value)?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:c.digits??2}).format(value);
     row.append(td)
    }body.append(row)
   }
  }
  const layout=()=>host.closest('#construction-page')?.classList.toggle('has-calculated-table',host.open&&!host.hidden);
  host.addEventListener('toggle',layout);
  return {setData(data){rows=filterRows(data.rows??[]);selectedId=data.selectedId??null;loading=!!data.loading;canSelect=data.canSelect!==false;host.hidden=data.visible===false;render();layout()}};
 }
 return {columns,sortRows,filterRows,create};
});
