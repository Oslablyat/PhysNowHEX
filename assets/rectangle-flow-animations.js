/* Motion prototypes only. Fixed selected shell, winding, nozzle offsets and colors. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./rectangle-variants.js'));else{const api=factory(root.PhysNowRectangleVariants);root.PhysNowFlowAnimations=api;api.mount(document)}})(globalThis,function(diagram){
 'use strict';
 const base=diagram.narrowVariants[0];
 const motions=[
  {name:'Плавный сдвиг',note:'Оба патрубка одновременно, мягкий старт и остановка.',duration:750,kind:'smooth'},
  {name:'Быстро и чётко',note:'Короткий переход без задержек.',duration:320,kind:'quick'},
  {name:'Спокойный переход',note:'Медленный, равномерно плавный обмен уровнями.',duration:1400,kind:'sine'},
  {name:'Лёгкая пружина',note:'Небольшой перелёт и мягкое возвращение на место.',duration:950,kind:'spring'},
  {name:'Сначала левый',note:'Левый начинает движение, затем подключается правый.',duration:1100,kind:'left'},
  {name:'Сначала правый',note:'То же движение, но первым идёт правый патрубок.',duration:1100,kind:'right'},
  {name:'Убрать и выдвинуть',note:'Шейки убираются в стенку и появляются на новом уровне.',duration:1000,kind:'retract'},
  {name:'С затуханием',note:'Во время перемещения синие соединения слегка растворяются.',duration:950,kind:'fade'},
  {name:'Пауза в центре',note:'Перемещение через середину с короткой остановкой.',duration:1350,kind:'pause'},
  {name:'Мгновенно с акцентом',note:'Положение меняется сразу, затем плавно проявляется синий поток.',duration:600,kind:'instant'}
 ];
 const clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
 function frame(index,t){
  t=clamp(t);if(t===0||t===1)return {left:t,right:t,neck:1,opacity:1};
  const kind=motions[index].kind;let left=smooth(t),right=left,neck=1,opacity=1;
  if(kind==='quick')left=right=1-Math.pow(1-t,3);
  if(kind==='sine')left=right=(1-Math.cos(Math.PI*t))/2;
  if(kind==='spring'){const u=t-1;left=right=1+1.7*u*u*u+.7*u*u}
  if(kind==='left'){left=smooth(t/.7);right=smooth((t-.3)/.7)}
  if(kind==='right'){left=smooth((t-.3)/.7);right=smooth(t/.7)}
  if(kind==='retract'){left=right=t<.5?0:1;neck=Math.abs(2*t-1);opacity=smooth(Math.abs(2*t-1))}
  if(kind==='fade')opacity=.2+.8*Math.abs(2*t-1);
  if(kind==='pause')left=right=t<.4?.5*smooth(t/.4):t<=.6?.5:.5+.5*smooth((t-.6)/.4);
  if(kind==='instant'){left=right=1;opacity=.3+.7*smooth(t)}
  return {left,right,neck,opacity};
 }
 function geometryAt(left,right,neck=1){return {...base,leftMargin:31+196*left,rightMargin:31+196*right,neck:base.neck*neck}}
 function cards(){return motions.map((m,i)=>`<article class="motion-card" data-motion="${i}"><header><span class="number">${String(i+1).padStart(2,'0')}</span><h2>${m.name}</h2><span class="duration">${m.duration/1000} с</span></header><div class="animation-scene">${diagram.svg(base,100+i,true)}</div><div class="motion-controls"><button type="button" data-mode="0" aria-pressed="true" aria-label="Вариант ${i+1}: прямоток">Прямоток</button><button type="button" data-mode="1" aria-pressed="false" aria-label="Вариант ${i+1}: противоток">Противоток</button><button type="button" data-replay aria-label="Повторить вариант ${i+1}" title="Повторить">↻</button></div><p>${m.note}</p><span class="motion-status" aria-live="polite">Прямоток · слева ниже, справа выше</span></article>`).join('')}
 function mount(doc){
  const gallery=doc.getElementById('motion-gallery');gallery.innerHTML=cards();const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const states=[...gallery.querySelectorAll('[data-motion]')].map((card,index)=>{
   const scene=card.querySelector('svg'),shell=scene.querySelector(`path[fill="${diagram.colors.shell}"]`),outline=scene.querySelector('.diagram-outline'),flows=scene.querySelectorAll('.diagram-flow'),ports=scene.querySelectorAll('.diagram-port');
   const state={card,index,left:0,right:0,target:0,raf:0};
   function draw(left,right,neck=1,opacity=1){
    state.left=left;state.right=right;const v=geometryAt(left,right,neck),g=diagram.geometry(v),d=diagram.shellPath(v);shell.setAttribute('d',d);outline.setAttribute('d',d);
    flows[2].setAttribute('d',`M${g.rightX+28} ${g.rightY}H${g.rightX+7}`);flows[3].setAttribute('d',`M${g.leftX} ${g.leftY}H${g.leftX-28}`);
    for(const [node,x,y]of [[ports[2],g.leftX,g.leftY],[ports[3],g.rightX,g.rightY]]){node.setAttribute('cx',x);node.setAttribute('cy',y);node.setAttribute('opacity',opacity)}for(const node of [flows[2],flows[3]])node.setAttribute('opacity',opacity);
   }
   function finish(){cancelAnimationFrame(state.raf);state.raf=0;draw(state.target,state.target);card.removeAttribute('aria-busy');card.querySelector('.motion-status').textContent=state.target?'Противоток · слева выше, справа ниже':'Прямоток · слева ниже, справа выше'}
   function play(target,replay=false){
    cancelAnimationFrame(state.raf);state.target=target;
    for(const button of card.querySelectorAll('[data-mode]'))button.setAttribute('aria-pressed',String(Number(button.dataset.mode)===target));
    scene.setAttribute('aria-label',`${index+1}. ${motions[index].name}: ${target?'противоток, левый патрубок сверху, правый снизу':'прямоток, левый патрубок снизу, правый сверху'}`);
    if(reduced.matches){finish();return}const fromLeft=replay?1-target:state.left,fromRight=replay?1-target:state.right;if(fromLeft===target&&fromRight===target){finish();return}
    let start;card.setAttribute('aria-busy','true');card.querySelector('.motion-status').textContent='Переключение…';
    function tick(time){if(start===undefined)start=time;const t=Math.min(1,(time-start)/motions[index].duration),f=frame(index,t);draw(fromLeft+(target-fromLeft)*f.left,fromRight+(target-fromRight)*f.right,f.neck,f.opacity);if(t<1)state.raf=requestAnimationFrame(tick);else finish()}
    state.raf=requestAnimationFrame(tick);
   }
   for(const button of card.querySelectorAll('[data-mode]'))button.addEventListener('click',()=>play(Number(button.dataset.mode)));card.querySelector('[data-replay]').addEventListener('click',()=>play(state.target,true));state.play=play;state.finish=finish;return state;
  });
  for(const button of doc.querySelectorAll('[data-all-mode]'))button.addEventListener('click',()=>states.forEach(state=>state.play(Number(button.dataset.allMode))));
  doc.getElementById('repeat-all').addEventListener('click',()=>states.forEach(state=>state.play(state.target,true)));
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)states.forEach(state=>state.finish())});reduced.addEventListener('change',()=>{if(reduced.matches)states.forEach(state=>state.finish())});
 }
 return {base,motions,frame,geometryAt,cards,mount};
});
