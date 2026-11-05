/* Geometry-only drawings of the current validated apparatus. Dimensions in mm. */
(function(root,factory){
  const common=typeof module==='object'&&module.exports;
  const api=factory();
  if(common)module.exports=api;else root.PhysNowApparatusDrawing=api;
})(globalThis,function(){
  'use strict';
  const format=value=>value==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  const point=value=>Number(value.toFixed(4));
  const path=(d,kind)=>`<path class="${kind}" d="${d}"/>`;
  const circle=(x,y,r,kind)=>`<circle class="${kind}" cx="${point(x)}" cy="${point(y)}" r="${point(r)}"/>`;
  const text=(x,y,value,kind='drawing-label',extra='')=>`<text class="${kind}" x="${point(x)}" y="${point(y)}" ${extra}>${value}</text>`;
  function dimensionX(x1,x2,y,label,originY){
    const outside=x2-x1<20;
    const line=outside?`M${x1-14} ${y}H${x2+14}`:`M${x1} ${y}H${x2}`;
    const arrows=outside
      ?`M${x1-5} ${y-2.5}l5 2.5-5 2.5M${x2+5} ${y-2.5}l-5 2.5 5 2.5`
      :`M${x1+5} ${y-2.5}l-5 2.5 5 2.5M${x2-5} ${y-2.5}l5 2.5-5 2.5`;
    return '<g class="drawing-dimensions">'+
      path(`M${x1} ${originY}V${y+6}M${x2} ${originY}V${y+6}`,'drawing-extension')+
      path(line+arrows,'drawing-dimension')+
      text((x1+x2)/2,y-6,label,'drawing-dimension-text')+'</g>';
  }
  function dimensionY(x,y1,y2,label,originX){
    const outside=y2-y1<20;
    const line=outside?`M${x} ${y1-14}V${y2+14}`:`M${x} ${y1}V${y2}`;
    const arrows=outside
      ?`M${x-2.5} ${y1-5}l2.5 5 2.5-5M${x-2.5} ${y2+5}l2.5-5 2.5 5`
      :`M${x-2.5} ${y1+5}l2.5-5 2.5 5M${x-2.5} ${y2-5}l2.5 5 2.5-5`;
    return '<g class="drawing-dimensions">'+
      path(`M${originX} ${y1}H${x+6}M${originX} ${y2}H${x+6}`,'drawing-extension')+
      path(line+arrows,'drawing-dimension')+
      text(0,0,label,'drawing-dimension-text',`transform="translate(${x+14} ${(y1+y2)/2}) rotate(-90)"`)+'</g>';
  }
  function svg(label,viewBox,content){
    return `<svg viewBox="${viewBox}" role="img" aria-label="${label}"><title>${label}</title>${content}</svg>`;
  }
  function topSvg(g,colors){
    const cx=160,cy=160,scale=228/g.diameter,radius=114;
    let content=circle(cx,cy,radius,'drawing-shell')+circle(cx,cy,g.shellInside/2*scale,'drawing-shell-inner');
    content+=path('M22 160H298M160 28V293','drawing-axis');
    if(g.coreDiameter>0)content+=circle(cx,cy,g.coreDiameter/2*scale,'drawing-core')+
      text(cx,cy-4,'Вытеснитель')+text(cx,cy+12,'Ø '+format(g.coreDiameter));
    for(const row of g.rows){
      const r=row.diameter/2*scale;
      const marker=Math.min(8,Math.max(3.5,g.tubeDiameter/2*scale),row.count>1?r*Math.sin(Math.PI/row.count)*.82:8);
      content+=`<g class="drawing-top-row" style="--row-color:${colors[row.index]}">`;
      content+=circle(cx,cy,r,'drawing-coil-ring');
      for(let j=0;j<row.count;j++){
        const angle=2*Math.PI*j/row.count+row.phase*Math.PI/180;
        const x=cx+r*Math.cos(angle),y=cy+r*Math.sin(angle);
        content+=circle(x,y,marker,'drawing-tube-wall');
      }
      content+='</g>';
    }
    content+=dimensionX(cx-radius,cx+radius,300,'Корпус Ø'+format(g.diameter)+' / внутри Ø'+format(g.shellInside),cy+radius);
    return svg('Вид сверху. Расположение змеевиков', '0 0 320 322',content);
  }
  function sectionLattice(row,azimuth,tubeDiameter){
    const tau=2*Math.PI,hand=row.direction==='left'?-1:1;
    const base=row.offset+tubeDiameter/2,step=row.pitch/row.count;
    const phase=(row.phase||0)/360*tau;
    let fraction=((hand*(azimuth-phase)/tau*row.count)%1+1)%1;
    if(fraction<1e-9||1-fraction<1e-9)fraction=0;
    return {first:base+fraction*step,step,last:base+row.turns*row.pitch};
  }
  // Intersections of the helix centreline with the two rays of a vertical
  // diametral plane. Restrict k analytically to the visible height intervals.
  function sectionLevels(row,azimuth,tubeDiameter,intervals,maxPerInterval=400){
    // Equally phased parallel coils form one axial lattice on this ray.
    const {first,step,last}=sectionLattice(row,azimuth,tubeDiameter);
    const heights=new Set();
    for(const [lower,upper] of intervals){
      const min=Math.max(0,Math.ceil((lower-first)/step-1e-9));
      const max=Math.floor((Math.min(upper,last)-first)/step+1e-9);
      const stride=Math.max(1,Math.ceil((max-min+1)/maxPerInterval));
      for(let index=min;index<=max;index+=stride)heights.add(point(first+index*step));
    }
    return [...heights].sort((a,b)=>a-b);
  }
  function sideSvg(g,colors){
    const cx=140,top=32,scale=Math.min(180/g.diameter,340/g.height);
    // Keep cross-sections legible on long apparatus by removing only the
    // middle height interval. All remaining positions retain the same scale.
    const broken=g.height/g.diameter>2.5;
    const drawingScale=broken?180/g.diameter:scale;
    const half=152/drawingScale,totalHeight=broken?340:g.height*drawingScale;
    const bottom=top+totalHeight,left=cx-g.diameter/2*drawingScale,right=cx+g.diameter/2*drawingScale;
    const intervals=broken?[[0,half],[g.height-half,g.height]]:[[0,g.height]];
    const yAt=z=>top+(broken&&z>half?z-(g.height-2*half)+36/drawingScale:z)*drawingScale;
    let content=`<rect class="drawing-shell" x="${point(left)}" y="${top}" width="${point(right-left)}" height="${point(totalHeight)}"/>`;
    content+=`<path class="drawing-shell-inner" d="M${point(left+g.shellWall*drawingScale)} ${top}V${bottom}M${point(right-g.shellWall*drawingScale)} ${top}V${bottom}"/>`;
    if(g.coreDiameter>0){
      for(const [lower,upper] of intervals){
        const end=Math.min(upper,g.coreLength);
        if(end<=lower)continue;
        content+=`<rect class="drawing-core" x="${point(cx-g.coreDiameter/2*drawingScale)}" y="${point(yAt(lower))}" width="${point(g.coreDiameter*drawingScale)}" height="${point((end-lower)*drawingScale)}"/>`;
      }
    }
    content+=path(`M${cx} 18V${bottom+18}`,'drawing-axis');
    for(const row of g.rows){
      content+=`<g class="drawing-section-row" style="--row-color:${colors[row.index]}">`;
      for(const [sign,angle] of [[1,0],[-1,Math.PI]]){
        const x=cx+sign*row.diameter/2*drawingScale;
        for(const height of sectionLevels(row,angle,g.tubeDiameter,intervals)){
          content+=circle(x,yAt(height),g.tubeDiameter/2*drawingScale,'drawing-tube-wall')+
            circle(x,yAt(height),g.tubeInside/2*drawingScale,'drawing-tube-hole');
        }
      }
      content+='</g>';
    }
    if(broken){
      const a=top+152,b=a+36,width=right-left;
      content+=`<rect x="${left-2}" y="${a}" width="${width+4}" height="36" fill="#191919"/>`;
      content+=path(`M${left} ${a}l${width*.25}-4 ${width*.25} 8 ${width*.25}-8 ${width*.25} 4M${left} ${b}l${width*.25}-4 ${width*.25} 8 ${width*.25}-8 ${width*.25} 4`,'drawing-break');
      content+=text(cx,a+21,'Разрыв по высоте');
    }
    content+=dimensionY(252,top,bottom,'H = '+format(g.height),right);
    content+=dimensionX(point(left),point(right),bottom+28,'Ø'+format(g.diameter),bottom);
    content+=text(140,bottom+48,'Условное продольное сечение');
    return svg('Высота корпуса '+format(g.height)+' мм'+(broken?'. С разрывом по высоте':''),'0 0 290 432',content);
  }
  function gapSections(g){
    const rows=[...g.rows].sort((a,b)=>a.diameter-b.diameter);
    const lattices=rows.map(row=>sectionLattice(row,0,g.tubeDiameter));
    const reference=Math.max(...lattices.map(line=>line.first));
    return rows.map((row,index)=>{
      const line=lattices[index],lastIndex=Math.floor((line.last-line.first)/line.step+1e-9);
      if(lastIndex<0)return {row,heights:[]};
      const start=Math.max(0,Math.min(lastIndex-1,Math.floor((reference-line.first)/line.step)));
      const heights=[line.first+start*line.step];
      if(start<lastIndex)heights.push(heights[0]+line.step);
      return {row,heights};
    });
  }
  function gapSvg(g,colors){
    const sections=gapSections(g),d=g.tubeDiameter;
    const heights=sections.flatMap(section=>section.heights);
    if(!heights.length)return svg('Зазоры между трубами','0 0 420 260',text(210,130,'В этой плоскости сечения труб отсутствуют'));
    const minHeight=Math.min(...heights),maxHeight=Math.max(...heights);
    const innerEdge=sections[0].row.diameter/2-d/2,outerEdge=sections.at(-1).row.diameter/2+d/2;
    const scale=Math.min(250/(outerEdge-innerEdge),110/(maxHeight-minHeight+d));
    const xAt=radius=>30+(radius-innerEdge)*scale;
    const head=52,yAt=height=>head+25+(height-minHeight)*scale;
    const radius=d/2*scale,rightEdge=xAt(outerEdge);
    const yTop=head-4,yBottom=yAt(maxHeight)+radius+12;
    let content='';
    for(const {row,heights:levels} of sections){
      const x=xAt(row.diameter/2);
      content+=`<g data-gap-row="${row.index}" style="--row-color:${colors[row.index]}"><title>Ряд ${row.index+1}. Диаметр навивки ${format(row.diameter)} мм</title>`;
      content+=path(`M${x} ${yTop}V${yBottom}`,'drawing-axis');
      for(const height of levels)content+=`<g data-gap-tube data-gap-height="${point(height)}">${circle(x,yAt(height),radius,'drawing-tube-wall')}${circle(x,yAt(height),g.tubeInside/2*scale,'drawing-tube-hole')}</g>`;
      content+=text(x,yBottom+13,'Ряд '+(row.index+1));
      content+='</g>';
    }
    if(sections.length>1){
      const left=sections.at(-2),right=sections.at(-1);
      const x1=xAt(left.row.diameter/2),x2=xAt(right.row.diameter/2);
      const gap=(right.row.diameter-left.row.diameter)/2-d;
      const origin=yAt(left.heights[0]??minHeight);
      content+=`<g data-gap-dimension="horizontal"><title>Зазор между рядами ${left.row.index+1} и ${right.row.index+1}</title>`+
        dimensionX(point(x1+radius),point(x2-radius),head-18,format(gap)+' мм',origin)+'</g>';
    }
    const vertical=[...sections].reverse().find(section=>section.heights.length===2);
    if(vertical){
      const {row,heights:levels}=vertical;
      const y1=yAt(levels[0]),y2=yAt(levels[1]),x=xAt(row.diameter/2);
      const gap=levels[1]-levels[0]-d;
      content+=`<g data-gap-dimension="vertical"><title>Зазор между соседними трубками ряда ${row.index+1}</title>`+
        dimensionY(rightEdge+23,point(y1+radius),point(y2-radius),format(gap)+' мм',x)+'</g>';
    }
    const width=rightEdge+62,height=yBottom+30;
    return svg('Зазоры между рядами и соседними трубками',`0 0 ${point(width)} ${point(height)}`,content);
  }
  function markup(g,colors){
    const view=(kind,title,letter,drawing,action='')=>`<figure class="apparatus-view apparatus-view-${kind}"><figcaption><span>${title}</span>${letter?'<small>'+letter+'</small>':''}${action}</figcaption>${drawing}</figure>`;
    return `<div class="apparatus-views">${view('top','Вид сверху','Вид А',topSvg(g,colors))}${view('side','Высота аппарата','Сечение Б',sideSvg(g,colors),'<button type="button" class="apparatus-enlarge" data-drawing-enlarge>Крупно ↗</button>')}${view('gap','Зазоры между трубами','',gapSvg(g,colors))}</div>
      <div class="apparatus-drawing-summary"><span>Высота <strong>${format(g.height)}</strong></span><span>Труба <strong>${format(g.tubeDiameter)} × ${format(g.tubeWall)}</strong></span><span>Рядов <strong>${g.rows.length}</strong></span></div>
      <p class="apparatus-drawing-note">Размеры в мм. Зазоры — между наружными стенками труб. Маркеры на виде сверху увеличены для читаемости.${g.rows.some(r=>r.count*r.turns>400)?' На плотных участках продольного сечения показана часть труб.':''}</p>`;
  }
  return {sectionLevels,gapSections,topSvg,sideSvg,gapSvg,markup};
});
