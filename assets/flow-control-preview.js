/* Preview only: same production nozzle controller, new rectangular tab appearance. */
(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory(require('./rectangle-variants.js'),require('./process-nozzle-motion.js'));else{const api=factory(root.PhysNowRectangleVariants,root.ProcessNozzleMotion);api.mount(document)}})(globalThis,function(diagram,motion){
 'use strict';
 const base=diagram.narrowVariants[0];
 function geometryAt(left,right){return {...base,leftMargin:31+196*left,rightMargin:31+196*right}}
 function mount(doc){
  const tabs=doc.querySelector('.preview-tabs'),buttons=[...tabs.querySelectorAll('[data-mode]')],scene=doc.getElementById('preview-scene');let mode='counter';
  scene.innerHTML=diagram.svg({...base,flowMode:'counter'},200,false);const svg=scene.querySelector('svg'),shell=svg.querySelector(`path[fill="${diagram.colors.shell}"]`),outline=svg.querySelector('.diagram-outline'),flows=svg.querySelectorAll('.diagram-flow'),ports=svg.querySelectorAll('.diagram-port');
  const animation=motion.create({draw(left,right){const v=geometryAt(left,right),g=diagram.geometry(v),d=diagram.shellPath(v);shell.setAttribute('d',d);outline.setAttribute('d',d);flows[1].setAttribute('d',`M280 -125C${g.rightX+65} -125 ${g.rightX+60} ${g.rightY} ${g.rightX+7} ${g.rightY}`);flows[2].setAttribute('d',`M${g.leftX} ${g.leftY}C${g.leftX-60} ${g.leftY} ${g.leftX-65} 125 -280 125`);ports[2].setAttribute('cx',g.leftX);ports[2].setAttribute('cy',g.leftY);ports[3].setAttribute('cx',g.rightX);ports[3].setAttribute('cy',g.rightY)}});
  function select(value,snap=false){mode=value;tabs.dataset.current=mode;for(const button of buttons){const active=button.dataset.mode===mode;button.setAttribute('aria-selected',String(active));button.tabIndex=active?0:-1}if(snap)animation.reset();animation.update(mode==='counter');const description=mode==='counter'?'Противоток · левый патрубок сверху, правый снизу':'Прямоток · левый патрубок снизу, правый сверху';doc.getElementById('preview-mode-note').textContent=description;svg.setAttribute('aria-label',description)}
  for(const button of buttons){button.addEventListener('click',()=>select(button.dataset.mode));button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();select(event.key==='Home'?'counter':event.key==='End'?'parallel':mode==='counter'?'parallel':'counter');buttons.find(button=>button.dataset.mode===mode).focus()})}
  doc.getElementById('preview-repeat').addEventListener('click',()=>{const target=mode;tabs.classList.add('is-snap');select(mode==='counter'?'parallel':'counter',true);void tabs.offsetWidth;requestAnimationFrame(()=>{tabs.classList.remove('is-snap');select(target)})});
  doc.addEventListener('visibilitychange',()=>{if(doc.hidden)animation.finish()});matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches)animation.finish()});select(mode,true);
 }
 return {base,geometryAt,mount,duration:motion.duration};
});
