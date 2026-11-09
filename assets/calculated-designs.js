/* Compact summaries of actual Teplo calls. No search, acceptance or geometry edits. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CalculatedDesigns=api})(globalThis,function(){
 'use strict';
 const columns=[
  {key:'rank',label:'Место',digits:0},{key:'id',label:'№',digits:0},
  {key:'height',label:'Длина, мм',digits:3},{key:'diameter',label:'Диаметр, мм',digits:0},
  {key:'count',label:'Трубок, шт.',digits:0},{key:'rowCount',label:'Рядов',digits:0},
  {key:'tubeMetres',label:'Всего трубы, м',digits:3},{key:'stockMetres',label:'Закупка, м',digits:2},
  {key:'lengthSpread',label:'Разброс длин, м',digits:3},{key:'volumeLitres',label:'Объём, л',digits:2},
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
  const filter=host.querySelector('[data-calculation-filter]'),pager=host.querySelector('[data-calculation-pages]');
  const rationale=host.querySelector('[data-calculation-rationale]'),reason=rationale.querySelector('p');
  const prev=host.querySelector('[data-calculation-prev]'),next=host.querySelector('[data-calculation-next]'),pageLabel=host.querySelector('[data-calculation-page]');
  const formats=columns.map(c=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:c.digits}));
  const differenceFormat=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:3}),pageSize=50;
  let rows=[],selectedId=null,recommendedId=null,searchKey=null,stats=null,sortKey='rank',direction='asc',loading=false,canSelect=true,page=0,stock=true,manual=false;
  const make=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e};
  const scroll=host.querySelector('.calculated-scroll'),edge=make('div');
  edge.className='calculated-bottom-edge';edge.setAttribute('aria-hidden','true');host.append(edge);
  let drag=null;
  edge.addEventListener('pointerdown',event=>{if(event.button!==0)return;event.preventDefault();drag={id:event.pointerId,y:event.clientY,height:scroll.getBoundingClientRect().height};edge.setPointerCapture(event.pointerId)});
  edge.addEventListener('pointermove',event=>{if(drag?.id!==event.pointerId)return;scroll.style.height=Math.max(96,Math.min(1200,drag.height+event.clientY-drag.y))+'px'});
  const finish=event=>{if(drag?.id!==event.pointerId)return;drag=null;if(edge.hasPointerCapture(event.pointerId))edge.releasePointerCapture(event.pointerId)};
  edge.addEventListener('pointerup',finish);edge.addEventListener('pointercancel',finish);edge.addEventListener('lostpointercapture',finish);
  const tr=make('tr'),choiceHead=make('th','Выбор');choiceHead.scope='col';choiceHead.className='calculated-choice';tr.append(choiceHead);for(const c of columns){const th=make('th'),button=make('button',c.label),arrow=make('span');th.scope='col';th.dataset.key=c.key;button.type='button';button.dataset.sort=c.key;arrow.className='sort-arrow';arrow.setAttribute('aria-hidden','true');button.append(arrow);button.addEventListener('click',()=>{direction=sortKey===c.key&&direction==='asc'?'desc':'asc';sortKey=c.key;page=0;render()});th.append(button);tr.append(th)}head.append(tr);
  filter.addEventListener('change',()=>{page=0;render()});
  prev.addEventListener('click',()=>{page--;render();scroll.scrollTop=0});
  next.addEventListener('click',()=>{page++;render();scroll.scrollTop=0});
  function render(){
   const front=rows.filter(r=>r.rank!=null),visible=sortRows(filter.value==='all'?rows:front,sortKey,direction);
   const pages=Math.ceil(visible.length/pageSize);page=Math.max(0,Math.min(page,pages-1));
   count.textContent=loading?'Подбор…':stats?`Поверок ${stats.evaluations.toLocaleString('ru-RU')} · Подходящих ${rows.length.toLocaleString('ru-RU')} · Компромиссов ${front.length}`:'Нет расчётов';
   filter.disabled=loading||!rows.length;pager.hidden=pages<=1;prev.disabled=page===0;next.disabled=page+1>=pages;
   pageLabel.textContent=(page+1)+' / '+pages;
   note.textContent=loading?'Выполняется подбор.':rows.length?'Рекомендована №'+recommendedId+'. Переключатель в первом столбце загружает выбранную конструкцию в проработку.':'';
   if(!loading&&rows.length&&selectedId!=null&&(selectedId!==recommendedId||manual))note.textContent+=' В проработке №'+selectedId+(manual?' с ручными правками.':'.');
   if(stats?.errors)note.textContent+=' Поверок с ошибкой: '+stats.errors+'.';
   const best=front.find(r=>r.id===recommendedId);rationale.hidden=!best;
   if(best){
    const labels=[['height','длина',' мм'],['diameter','диаметр',' мм'],['materialMetres',stock?'закупка':'труба',' м'],['count','трубки',''],['rowCount','ряды','']];
    const delta=labels.map(([key,label,unit])=>{
     const gap=best[key]-Math.min(...front.map(r=>r[key]));
     return label+' '+(gap>0?'+':'')+differenceFormat.format(gap)+unit;
    });
    reason.textContent='№'+recommendedId+' относительно лучших значений каждого показателя — '+delta.join(', ')+'. Наибольшее отставание по пяти шкалам — '+(100*best.worstLoss).toLocaleString('ru-RU',{maximumFractionDigits:1})+' % диапазона.';
   }
   for(const th of head.querySelectorAll('th[data-key]')){const active=th.dataset.key===sortKey;th.setAttribute('aria-sort',active?(direction==='asc'?'ascending':'descending'):'none');th.querySelector('.sort-arrow').textContent=active?(direction==='asc'?'↑':'↓'):'↕';th.querySelector('button').setAttribute('aria-label',th.querySelector('button').firstChild.textContent+': '+(active&&direction==='asc'?'сортировать по убыванию':'сортировать по возрастанию'))}
   body.replaceChildren();head.querySelector('th[data-key="stockMetres"]').hidden=!stock;
   if(!visible.length){const empty=make('tr'),td=make('td',loading?'Выполняется расчёт…':'Среди проверенных конструкций подходящих не найдено.');td.colSpan=columns.length+1;td.className='calculated-empty';empty.append(td);body.append(empty);return}
   for(const r of visible.slice(page*pageSize,(page+1)*pageSize)){const row=make('tr');row.dataset.calculationId=String(r.id);row.dataset.selected=String(r.id===selectedId);row.dataset.status=r.status;
    const choice=make('td'),radio=make('input');choice.className='calculated-choice';radio.type='radio';radio.name='calculated-design-choice';radio.checked=r.id===selectedId;radio.disabled=loading||!canSelect;radio.setAttribute('aria-label','Выбрать конструкцию №'+r.id);radio.addEventListener('change',()=>options.onSelect?.(r.id));radio.addEventListener('click',()=>{if(r.id===selectedId)options.onSelect?.(r.id)});choice.append(radio);row.append(choice);
    for(const [i,c] of columns.entries()){const value=r[c.key],td=make('td');
     if(c.key==='stockMetres'&&!stock)continue;
     td.textContent=value==null||!Number.isFinite(value)?'—':formats[i].format(value);
     if(c.key==='rank'&&r.id===recommendedId){td.textContent='★ '+td.textContent;td.className='calculated-recommendation';td.title='Рекомендованная конструкция'}
     if(c.key==='id'&&r.warning){const warning=make('span',' ⚠ Re');warning.title='Исключение по Re одного змеевика. Применимость трубной корреляции Teplo не подтверждена.';warning.className='calculated-warning';td.append(warning)}
     row.append(td)
    }body.append(row)
   }
  }
  const layout=()=>host.closest('#construction-page')?.classList.toggle('has-calculated-table',host.open&&!host.hidden);
  host.addEventListener('toggle',layout);
  return {setProgress(text){if(loading)count.textContent=text},setData(data){
   if(searchKey!==data.searchKey){page=0;filter.value='front';rationale.open=false;sortKey='rank';direction='asc';searchKey=data.searchKey}
   const received=!rows.length&&data.rows?.length;
   rows=filterRows(data.rows??[]);selectedId=data.selectedId??null;recommendedId=data.recommendedId??null;stats=data.stats;stock=data.stock!==false;
   manual=!!data.manual;
   if(received&&selectedId!=null&&selectedId!==recommendedId){
    const chosen=rows.find(r=>r.id===selectedId);
    if(chosen){if(chosen.rank==null)filter.value='all';const visible=filter.value==='all'?rows:rows.filter(r=>r.rank!=null);page=Math.floor(sortRows(visible,sortKey,direction).indexOf(chosen)/pageSize)}
   }
   loading=!!data.loading;canSelect=data.canSelect!==false;host.hidden=data.visible===false;render();layout();
  }};
 }
 return {columns,sortRows,filterRows,create};
});
