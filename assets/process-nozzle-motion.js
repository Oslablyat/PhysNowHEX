/* Selected motion 1: both nozzles move together with smooth easing. No thermal state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ProcessNozzleMotion=api})(globalThis,function(){
 'use strict';
 const duration=750,clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
 function progress(t){const value=smooth(t);return {left:value,right:value}}
 function create(options={}){
  const request=options.requestFrame||(callback=>requestAnimationFrame(callback)),cancel=options.cancelFrame||(id=>cancelAnimationFrame(id)),reduced=options.reducedMotion||(()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches);
  let draw=options.draw||(()=>{}),left=0,right=0,target=null,raf=0;
  function finish(){cancel(raf);raf=0;if(target!==null){left=right=target;draw(left,right)}}
  function update(next){
   next=next?1:0;if(target===null){target=left=right=next;draw(left,right);return}
   if(next===target){draw(left,right);return}cancel(raf);raf=0;target=next;
   if(reduced()){finish();return}const fromLeft=left,fromRight=right;let start;
   function tick(time){if(start===undefined)start=time;const t=clamp((time-start)/duration),p=progress(t);left=fromLeft+(target-fromLeft)*p.left;right=fromRight+(target-fromRight)*p.right;draw(left,right);if(t<1)raf=request(tick);else finish()}
   raf=request(tick);
  }
  return {update,finish,setDraw(fn){draw=fn},reset(){cancel(raf);raf=0;target=null},getState(){return {left,right,target,animating:!!raf}}};
 }
 return {duration,progress,create};
});
