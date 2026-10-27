/* Standalone selector comparison; no calculator state or thermal calculation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.PhysNowFlowControls=api;api.mount(document)}})(globalThis,function(){
 'use strict';
 const modes=[['counter','Противоток'],['parallel','Прямоток']];
 const variants=[
  {name:'Сегменты как поля',note:'Та же рамка и скругление, что у выбора типа аппарата.',kind:'field'},
  {name:'Отдельные кнопки',note:'Две самостоятельные кнопки с небольшим промежутком.',kind:'separate'},
  {name:'Вкладки с линией',note:'Без заливки-пилюли: выбранный режим подчёркнут синим.',kind:'underline'},
  {name:'Как тип аппарата',note:'Выпадающий список в оформлении соседнего поля.',kind:'select'},
  {name:'Радиокнопки',note:'Точечный индикатор выбора и спокойная общая рамка.',kind:'radio'},
  {name:'Карточки со стрелками',note:'Иконки показывают взаимное направление потоков.',kind:'arrows'},
  {name:'Кнопки с галочкой',note:'Состояние видно по галочке, без крупной плашки.',kind:'check'},
  {name:'Вертикальный список',note:'Две строки с разделителем, как пункты меню.',kind:'list'},
  {name:'Выбор стрелками',note:'Один текущий режим, смена кнопками слева и справа.',kind:'stepper'},
  {name:'Компактный тумблер',note:'Небольшой прямоугольный переключатель между подписями.',kind:'toggle'}
 ];
 const chevron='<svg class="chevron" viewBox="0 0 20 20" aria-hidden="true"><path d="m5 8 5 5 5-5"/></svg>';
 const check='<svg class="check-icon" viewBox="0 0 16 16" aria-hidden="true"><path d="m3 8 3 3 7-7"/></svg>';
 function direction(mode){return `<svg class="direction-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4v16m-3-3 3 3 3-3${mode==='counter'?'M17 20V4m-3 3 3-3 3 3':'M17 4v16m-3-3 3 3 3-3'}"/></svg>`}
 function control(index){
  const {kind}=variants[index],label=`flow-label-${index}`;
  if(kind==='select')return `<div class="flow-ui kind-select"><select aria-labelledby="${label}" data-select><option value="counter">Противоток</option><option value="parallel">Прямоток</option></select>${chevron}</div>`;
  if(kind==='stepper')return `<div class="flow-ui kind-stepper"><button type="button" data-step aria-label="Вариант ${index+1}: предыдущая схема">‹</button><span class="stepper-value" aria-live="polite">Противоток</span><button type="button" data-step aria-label="Вариант ${index+1}: следующая схема">›</button></div>`;
  if(kind==='toggle')return `<div class="flow-ui kind-toggle"><span class="toggle-label" data-label-mode="counter">Противоток</span><button type="button" role="switch" aria-checked="false" aria-label="Вариант ${index+1}: прямоток" data-switch><span></span></button><span class="toggle-label" data-label-mode="parallel">Прямоток</span></div>`;
  return `<div class="flow-ui kind-${kind}" role="radiogroup" aria-labelledby="${label}">${modes.map(([value,name])=>`<button type="button" role="radio" data-mode="${value}" aria-checked="${value==='counter'}" tabindex="${value==='counter'?0:-1}" aria-label="Вариант ${index+1}: ${name}">${kind==='radio'?'<span class="radio-mark" aria-hidden="true"></span>':''}${kind==='arrows'?direction(value):''}${kind==='check'?check:''}<span>${name}</span>${kind==='list'?check:''}</button>`).join('')}</div>`;
 }
 function cards(){return variants.map((v,i)=>`<article class="selector-card" data-variant="${i}" data-current="counter"><header class="variant-caption"><span class="number">${String(i+1).padStart(2,'0')}</span><div><h2>${v.name}</h2><p>${v.note}</p></div></header><div class="construction-preview"><div class="context-heading" aria-hidden="true"><span class="context-step">01</span><strong>Конструкция</strong><svg viewBox="0 0 20 20"><path d="M3 6h14v8H3zM6 3v14m8-14v14"/></svg></div><div class="preview-fields"><div class="context-type" aria-hidden="true"><span class="field-label">Тип теплообменника</span><div class="mock-select">Змеевиковый${chevron}</div></div><div class="selector-field"><span class="field-label" id="flow-label-${i}">Схема движения</span>${control(i)}</div><div class="context-dimensions" aria-hidden="true"><span class="field-label">Размеры теплообменника</span><div class="mock-dimensions"><div><span class="field-label">Длина L</span><div class="mock-input"><strong>1 000</strong><span>мм</span></div></div><div><span class="field-label">Внешний диаметр</span><div class="mock-input"><strong>200</strong><span>мм</span></div></div></div></div></div></div></article>`).join('')}
 function mount(doc){
  const gallery=doc.getElementById('selector-gallery');gallery.innerHTML=cards();
  function select(card,mode){
   card.dataset.current=mode;
   for(const button of card.querySelectorAll('[data-mode]')){const active=button.dataset.mode===mode;button.setAttribute('aria-checked',String(active));button.tabIndex=active?0:-1}
   const select=card.querySelector('[data-select]');if(select)select.value=mode;
   const toggle=card.querySelector('[data-switch]');if(toggle)toggle.setAttribute('aria-checked',String(mode==='parallel'));
   const value=card.querySelector('.stepper-value');if(value)value.textContent=modes.find(item=>item[0]===mode)[1];
  }
  gallery.addEventListener('click',event=>{const card=event.target.closest('[data-variant]');if(!card)return;const mode=event.target.closest('[data-mode]');if(mode)select(card,mode.dataset.mode);else if(event.target.closest('[data-step],[data-switch]'))select(card,card.dataset.current==='counter'?'parallel':'counter')});
  gallery.addEventListener('change',event=>{if(event.target.matches('[data-select]'))select(event.target.closest('[data-variant]'),event.target.value)});
  gallery.addEventListener('keydown',event=>{const button=event.target.closest('[data-mode]');if(!button||!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(event.key))return;event.preventDefault();const card=button.closest('[data-variant]'),mode=event.key==='Home'?'counter':event.key==='End'?'parallel':card.dataset.current==='counter'?'parallel':'counter';select(card,mode);card.querySelector(`[data-mode="${mode}"]`).focus()});
  for(const button of doc.querySelectorAll('[data-all]'))button.addEventListener('click',()=>gallery.querySelectorAll('[data-variant]').forEach(card=>select(card,button.dataset.all)));
  doc.getElementById('context-toggle').addEventListener('click',event=>{const show=event.currentTarget.getAttribute('aria-pressed')!=='true';event.currentTarget.setAttribute('aria-pressed',String(show));doc.body.classList.toggle('compact-comparison',!show)});
 }
 return {variants,control,cards,mount};
});
