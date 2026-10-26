/* Isolated flow/nozzle comparison. No calculator state or calculation modes changed. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./rectangle-variants.js'));else{const api=factory(root.PhysNowRectangleVariants);root.PhysNowFlowComparison=api;api.mount(document)}})(globalThis,function(diagram){
 'use strict';
 const base=diagram.narrowVariants[0];
 const layouts=[
  {name:'Выбранная компоновка',note:'Текущее расстояние от торцов',margin:31,neck:12},
  {name:'Ближе к торцам',note:'Максимально разнесены по высоте',margin:22,neck:12},
  {name:'Небольшой отступ',note:'Чуть ближе к рабочей части',margin:44,neck:12},
  {name:'Умеренный отступ',note:'Спокойная симметричная компоновка',margin:58,neck:12},
  {name:'Ближе к центру',note:'Меньше разница уровней',margin:76,neck:12},
  {name:'Правый ближе к центру',note:'Разные отступы от торцов',margin:31,leftMargin:31,rightMargin:54,neck:12},
  {name:'Левый ближе к центру',note:'Обратная асимметрия',margin:31,leftMargin:54,rightMargin:31,neck:12},
  {name:'Удлинённые шейки',note:'Боковые выводы заметнее',margin:31,neck:22},
  {name:'Короткие шейки',note:'Патрубки ближе к стенке',margin:31,neck:6},
  {name:'Разнесённые выводы',note:'Отступ от торцов и длинные шейки',margin:44,neck:30}
 ];
 function variant(index,mode){return {...base,...layouts[index],flowMode:mode}}
 function svg(index,mode,small=false){const counter=mode==='counter',v=variant(index,mode);return diagram.svg(v,index*2+(counter?1:0),small).replace(/aria-label="[^"]*"/,`aria-label="${index+1}. ${v.name}. ${counter?'Противоток: слева вверху, справа внизу':'Прямоток: слева внизу, справа вверху'}"`)}
 function rows(){return layouts.map((v,i)=>`<section class="flow-row" id="layout-${i+1}" aria-labelledby="row-title-${i}"><header><span class="number">${String(i+1).padStart(2,'0')}</span><div><h2 id="row-title-${i}">${v.name}</h2><p>${v.note}</p></div><a href="#comparison" aria-label="К началу таблицы">↑</a></header><div class="flow-pair">${['parallel','counter'].map(mode=>`<button type="button" class="flow-cell" data-index="${i}" data-mode="${mode}" aria-label="Крупно: вариант ${i+1}, ${mode==='parallel'?'прямоток':'противоток'}"><span class="flow-cell-title">${mode==='parallel'?'Прямоток ↓↓':'Противоток ↓↑'}</span><span class="flow-cell-scene">${svg(i,mode,true)}</span><span class="flow-cell-note">${mode==='parallel'?'Слева — ниже · справа — выше':'Слева — выше · справа — ниже'}</span></button>`).join('')}</div></section>`).join('')}
 function mount(doc){
  const table=doc.getElementById('flow-table'),dialog=doc.getElementById('flow-detail');table.innerHTML=rows();
  doc.getElementById('quick-nav').innerHTML=layouts.map((v,i)=>`<a href="#layout-${i+1}" aria-label="К варианту ${i+1}: ${v.name}">${String(i+1).padStart(2,'0')}</a>`).join('');
  let index=0,mode='parallel';
  function render(){doc.getElementById('flow-selected-title').textContent=`${index+1} / 10 · ${layouts[index].name}`;doc.getElementById('flow-selected-scene').innerHTML=svg(index,mode);doc.getElementById('flow-selected-note').textContent=mode==='parallel'?'Прямоток: межтрубный поток справа сверху → влево вниз.':'Противоток: межтрубный поток справа снизу → влево вверх.';for(const button of dialog.querySelectorAll('[data-flow-mode]'))button.setAttribute('aria-pressed',String(button.dataset.flowMode===mode))}
  table.addEventListener('click',event=>{const button=event.target.closest('button[data-index]');if(!button)return;index=Number(button.dataset.index);mode=button.dataset.mode;render();dialog.showModal()});
  for(const button of dialog.querySelectorAll('[data-flow-mode]'))button.addEventListener('click',()=>{mode=button.dataset.flowMode;render()});
  doc.getElementById('flow-close').addEventListener('click',()=>dialog.close());
  doc.getElementById('flow-prev').addEventListener('click',()=>{index=(index+9)%10;render()});doc.getElementById('flow-next').addEventListener('click',()=>{index=(index+1)%10;render()});
 }
 return {layouts,variant,svg,rows,mount};
});
