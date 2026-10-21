/* Geometry-only detail views. Dimensions are millimetres; no thermal/hydraulic model. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.PhysNowCoilLayout=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const format=n=>n==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
 function measurements(g,index=0){
  const row=g.rows[Math.max(0,Math.min(index,g.rows.length-1))],sorted=[...g.rows].sort((a,b)=>a.diameter-b.diameter),position=sorted.findIndex(r=>r.index===row.index),neighbour=sorted[position+1]||sorted[position-1]||null;
  const ax=neighbour?Math.abs(neighbour.diameter-row.diameter)/2:null,ay=row.turns*row.count>=1?row.pitch/row.count:null;
  return {rowIndex:row.index,neighbourIndex:neighbour?.index??null,diameter:g.tubeDiameter,inside:g.tubeInside,wall:g.tubeWall,ax,ay,sx:ax==null?null:ax-g.tubeDiameter,sy:ay==null?null:ay-g.tubeDiameter,normalGap:row.separation-g.tubeDiameter,requiredX:g.rowClearance,requiredY:g.clearance};
 }
 function tubeSvg(g){
  const radius=67,inside=radius*g.tubeInside/g.tubeDiameter;
  return '<title>Сечение трубы</title><circle class="layout-tube-wall" cx="145" cy="112" r="'+radius+'"/><circle class="layout-tube-hole" cx="145" cy="112" r="'+inside+'"/><path class="layout-dimension" d="M78 179v26m134-26v26M78 197h134m-127-4-7 4 7 4m120-8 7 4-7 4M192 65l40-27h39"/><text class="layout-svg-label" x="145" y="226" text-anchor="middle">dₙ = '+format(g.tubeDiameter)+' мм</text><text class="layout-svg-label" x="145" y="117" text-anchor="middle">dᵢ = '+format(g.tubeInside)+'</text><text class="layout-svg-label" x="247" y="28" text-anchor="middle">δ = '+format(g.tubeWall)+' мм</text>';
 }
 function gapSvg(m){
  const d=m.diameter,ax=m.ax??d*2.7,ay=m.ay??d*2.5,scale=Math.min(245/(ax+d),194/(ay+d)),radius=d/2*scale,inner=radius*m.inside/d,dx=ax*scale,dy=ay*scale,x1=210-dx/2,x2=210+dx/2,y1=160-dy/2,y2=160+dy/2;
  const number=n=>Number(n.toFixed(3)),circle=(x,y,ghost)=>'<g'+(ghost?' class="layout-ghost"':'')+'><circle data-gap-tube class="layout-tube-wall" cx="'+number(x)+'" cy="'+number(y)+'" r="'+number(radius)+'"/><circle class="layout-tube-hole" cx="'+number(x)+'" cy="'+number(y)+'" r="'+number(inner)+'"/></g>';
  const arrowX=(a,b,y)=>'M'+number(a)+' '+y+'H'+number(b)+'m'+number(a-b+6)+' -3-6 3 6 3m'+number(b-a-12)+' -6 6 3-6 3';
  const arrowY=(x,a,b)=>'M'+x+' '+number(a)+'V'+number(b)+'m-3 '+number(a-b+6)+' 3-6 3 6m-6 '+number(b-a-12)+' 3 6 3-6';
  const sx1=x1+radius,sx2=x2-radius,sy1=y1+radius,sy2=y2-radius;
  let out='<title>Четыре трубы: зазоры sₓ и sᵧ и межосевые расстояния aₓ и aᵧ</title>'+circle(x1,y1,false)+circle(x2,y1,m.ax==null)+circle(x1,y2,m.ay==null)+circle(x2,y2,m.ax==null||m.ay==null);
  out+='<path class="layout-axis" d="M'+number(x1-radius-12)+' '+number(y1)+'H'+number(x2+radius+12)+'M'+number(x1-radius-12)+' '+number(y2)+'H'+number(x2+radius+12)+'M'+number(x1)+' '+number(y1-radius-12)+'V'+number(y2+radius+12)+'M'+number(x2)+' '+number(y1-radius-12)+'V'+number(y2+radius+12)+'"/>';
  if(m.ax!=null)out+='<path class="layout-dimension" d="M'+number(sx1)+' '+number(y1)+'V35M'+number(sx2)+' '+number(y1)+'V35'+arrowX(sx1,sx2,43)+'M'+number(x1)+' '+number(y2+radius+5)+'V304M'+number(x2)+' '+number(y2+radius+5)+'V304'+arrowX(x1,x2,295)+'"/>';
  if(m.ay!=null)out+='<path class="layout-dimension" d="M'+number(x2)+' '+number(sy1)+'H361M'+number(x2)+' '+number(sy2)+'H361'+arrowY(352,sy1,sy2)+'M'+number(x1-radius-5)+' '+number(y1)+'H39M'+number(x1-radius-5)+' '+number(y2)+'H39'+arrowY(48,y1,y2)+'"/>';
  out+='<text class="layout-svg-label" x="210" y="25" text-anchor="middle">sₓ = '+format(m.sx)+' мм</text><text class="layout-svg-label" transform="translate(389 160) rotate(-90)" text-anchor="middle">sᵧ = '+format(m.sy)+' мм</text><text class="layout-svg-label layout-center-label" transform="translate(21 160) rotate(-90)" text-anchor="middle">aᵧ = '+format(m.ay)+' мм</text><text class="layout-svg-label layout-center-label" x="210" y="325" text-anchor="middle">aₓ = '+format(m.ax)+' мм</text>';
  return out;
 }
 return {measurements,tubeSvg,gapSvg};
});
