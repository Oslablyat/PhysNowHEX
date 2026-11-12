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
  function ringPath(x,y,outer,inner){
    const contour=radius=>`M${point(x+radius)} ${point(y)}a${point(radius)} ${point(radius)} 0 1 0 ${point(-2*radius)} 0a${point(radius)} ${point(radius)} 0 1 0 ${point(2*radius)} 0Z`;
    return contour(outer)+contour(inner);
  }
  function arrowHead(x,y,dx,dy){
    const bx=x+7*dx,by=y+7*dy;
    return path(`M${point(x)} ${point(y)}L${point(bx-1.25*dy)} ${point(by+1.25*dx)}L${point(bx+1.25*dy)} ${point(by-1.25*dx)}Z`,'drawing-arrow');
  }
  function dimensionX(x1,x2,y,label,originY,secondOriginY=originY){
    const outside=x2-x1<20;
    const line=outside?`M${x1-14} ${y}H${x2+14}`:`M${x1} ${y}H${x2}`;
    const arrows=arrowHead(x1,y,outside?-1:1,0)+arrowHead(x2,y,outside?1:-1,0);
    const extensionEnd=y+(y<originY?-5:5);
    return '<g class="drawing-dimensions">'+
      path(`M${x1} ${originY}V${extensionEnd}M${x2} ${secondOriginY}V${extensionEnd}`,'drawing-extension')+
      path(line,'drawing-dimension')+arrows+
      text((x1+x2)/2,y-6,label,'drawing-dimension-text')+'</g>';
  }
  function dimensionY(x,y1,y2,label,originX){
    const outside=y2-y1<20;
    const line=outside?`M${x} ${y1-14}V${y2+14}`:`M${x} ${y1}V${y2}`;
    const arrows=arrowHead(x,y1,0,outside?-1:1)+arrowHead(x,y2,0,outside?1:-1);
    return '<g class="drawing-dimensions">'+
      path(`M${originX} ${y1}H${x+6}M${originX} ${y2}H${x+6}`,'drawing-extension')+
      path(line,'drawing-dimension')+arrows+
      text(0,0,label,'drawing-dimension-text',`transform="translate(${x-7} ${(y1+y2)/2}) rotate(-90)"`)+'</g>';
  }
  function svg(label,viewBox,content){
    return `<svg viewBox="${viewBox}" role="img" aria-label="${label}"><title>${label}</title>${content}</svg>`;
  }
  function topSvg(g,colors){
    const cx=160,cy=160,scale=228/g.diameter,radius=114;
    let content='<defs><pattern id="apparatus-top-metal-hatch" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="drawing-hatch-line" d="M0 0V4"/></pattern></defs>';
    content+=circle(cx,cy,radius,'drawing-shell')+
      `<path class="drawing-top-hatch" d="${ringPath(cx,cy,radius,g.shellInside/2*scale)}" fill="url(#apparatus-top-metal-hatch)" fill-rule="evenodd"/>`+
      circle(cx,cy,g.shellInside/2*scale,'drawing-shell-inner');
    content+=path('M22 160H298M160 28V293','drawing-axis');
    const coreRadius=g.coreDiameter/2*scale;
    if(g.coreDiameter>0){
      const innerRadius=(g.coreDiameter/2-g.coreWall)*scale;
      content+=circle(cx,cy,coreRadius,'drawing-core')+
        `<path class="drawing-top-hatch" d="${ringPath(cx,cy,coreRadius,innerRadius)}" fill="url(#apparatus-top-metal-hatch)" fill-rule="evenodd"/>`+
        circle(cx,cy,innerRadius,'drawing-top-core-inner');
    }
    const tubeRadius=g.tubeDiameter/2*scale;
    for(const row of g.rows){
      const r=row.diameter/2*scale;
      content+=`<g class="drawing-top-row" style="--row-color:${colors[row.index]}">`;
      content+=circle(cx,cy,r,'drawing-coil-ring drawing-top-coil-axis');
      for(let j=0;j<row.count;j++){
        const angle=2*Math.PI*j/row.count+row.phase*Math.PI/180;
        const x=cx+r*Math.cos(angle),y=cy+r*Math.sin(angle);
        content+=circle(x,y,tubeRadius,'drawing-tube-wall');
      }
      content+='</g>';
    }
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
    const cx=140,top=78,scale=Math.min(180/g.diameter,340/g.height);
    // Keep cross-sections legible on long apparatus by removing only the
    // middle height interval. All remaining positions retain the same scale.
    const broken=g.height/g.diameter>2.5;
    const drawingScale=broken?180/g.diameter:scale;
    const half=152/drawingScale,totalHeight=broken?340:g.height*drawingScale;
    const bottom=top+totalHeight,left=cx-g.diameter/2*drawingScale,right=cx+g.diameter/2*drawingScale;
    // Include tube centres just beyond each curved break edge, so the mask
    // clips the actual circular sections instead of stopping them at a flat cut.
    const padding=g.tubeDiameter/2+12/drawingScale;
    const segments=broken
      ?[{lower:0,upper:half+padding,shift:0},{lower:g.height-half-padding,upper:g.height,shift:36-(g.height-2*half)*drawingScale}]
      :[{lower:0,upper:g.height,shift:0}];
    let content='<defs><pattern id="apparatus-metal-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path class="drawing-hatch-line" d="M0 0V5"/></pattern></defs>';
    content+=`<rect class="drawing-shell" x="${point(left)}" y="${top}" width="${point(right-left)}" height="${point(totalHeight)}"/>`;
    const wallRect=(x,y,width,height)=>`<rect class="drawing-metal-wall" x="${point(x)}" y="${point(y)}" width="${point(width)}" height="${point(height)}" fill="url(#apparatus-metal-hatch)"/>`;
    content+=wallRect(left,top,g.shellWall*drawingScale,totalHeight)+wallRect(right-g.shellWall*drawingScale,top,g.shellWall*drawingScale,totalHeight);
    content+=`<path class="drawing-shell-inner" d="M${point(left+g.shellWall*drawingScale)} ${top}V${bottom}M${point(right-g.shellWall*drawingScale)} ${top}V${bottom}"/>`;
    if(g.coreDiameter>0){
      for(const {lower,upper,shift} of segments){
        const end=Math.min(upper,g.coreLength);
        if(end<=lower)continue;
        const coreLeft=cx-g.coreDiameter/2*drawingScale,coreRight=cx+g.coreDiameter/2*drawingScale;
        const y=top+lower*drawingScale+shift,height=(end-lower)*drawingScale,wall=g.coreWall*drawingScale;
        content+=`<rect class="drawing-core" x="${point(coreLeft)}" y="${point(y)}" width="${point(g.coreDiameter*drawingScale)}" height="${point(height)}"/>`;
        content+=wallRect(coreLeft,y,wall,height)+wallRect(coreRight-wall,y,wall,height);
        content+=path(`M${point(coreLeft+wall)} ${point(y)}v${point(height)}M${point(coreRight-wall)} ${point(y)}v${point(height)}`,'drawing-core-inner');
      }
    }
    content+=path(`M${cx} 18V${bottom+18}`,'drawing-axis');
    for(const row of g.rows){
      content+=`<g class="drawing-section-row" style="--row-color:${colors[row.index]}">`;
      for(const [sign,angle] of [[1,0],[-1,Math.PI]]){
        const x=cx+sign*row.diameter/2*drawingScale;
        for(const {lower,upper,shift} of segments){
          for(const height of sectionLevels(row,angle,g.tubeDiameter,[[lower,upper]])){
            const y=top+height*drawingScale+shift;
            content+=circle(x,y,g.tubeDiameter/2*drawingScale,'drawing-tube-wall')+
              circle(x,y,g.tubeInside/2*drawingScale,'drawing-tube-hole');
          }
        }
      }
      content+='</g>';
    }
    if(broken){
      const a=top+152,b=a+36;
      const wave=(start,end,y,bend=16)=>`C${point(start+(end-start)/3)} ${y-bend} ${point(start+(end-start)/3)} ${y-bend} ${point((start+end)/2)} ${y}S${point(start+2*(end-start)/3)} ${y+bend} ${point(end)} ${y}`;
      content+=path(`M${point(left-2)} ${a}H${point(left)}${wave(left,right,a)}H${point(right+2)}V${b}H${point(right)}${wave(right,left,b,-16)}H${point(left-2)}Z`,'drawing-break-mask');
      content+=path(`M${point(left)} ${a}${wave(left,right,a)}M${point(left)} ${b}${wave(left,right,b)}`,'drawing-break');
    }
    content+=dimensionY(252,top,bottom,format(g.height),right);
    content+=dimensionX(point(left),point(right),18,'Ø'+format(g.diameter)+'×'+format(g.shellWall),top);
    if(g.coreDiameter>0)content+=dimensionX(point(cx-g.coreDiameter/2*drawingScale),point(cx+g.coreDiameter/2*drawingScale),48,'Ø'+format(g.coreDiameter)+'×'+format(g.coreWall),top);
    return svg('Высота корпуса '+format(g.height)+' мм'+(broken?'. С разрывом по высоте':''),'0 0 290 448',content);
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
    if(!heights.length)return svg('Расположение труб','0 0 420 260',text(210,130,'В этой плоскости сечения труб отсутствуют'));
    const minHeight=Math.min(...heights),maxHeight=Math.max(...heights);
    const innerEdge=sections[0].row.diameter/2-d/2,outerEdge=sections.at(-1).row.diameter/2+d/2;
    const scale=Math.min(250/(outerEdge-innerEdge),110/(maxHeight-minHeight+d));
    const xAt=radius=>30+(radius-innerEdge)*scale;
    const radius=d/2*scale,insideRadius=g.tubeInside/2*scale,rightEdge=xAt(outerEdge);
    const firstY=Math.max(82,radius+48),yAt=height=>firstY+(height-minHeight)*scale;
    const yTop=firstY-radius-10,yBottom=yAt(maxHeight)+radius+12;
    let content='<defs>'+sections.map(({row})=>`<pattern id="apparatus-gap-hatch-${row.index}" width="3.5" height="3.5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V3.5" fill="none" stroke="${colors[row.index]}" stroke-width=".5"/></pattern>`).join('')+'</defs>';
    for(const {row,heights:levels} of sections){
      const x=xAt(row.diameter/2);
      content+=`<g data-gap-row="${row.index}" style="--row-color:${colors[row.index]}"><title>Ряд ${row.index+1}. Диаметр навивки ${format(row.diameter)} мм</title>`;
      for(const height of levels){
        const y=yAt(height);
        const ring=ringPath(x,y,radius,insideRadius);
        content+=`<g data-gap-tube data-gap-height="${point(height)}">${circle(x,y,radius,'drawing-tube-wall')}<path class="drawing-tube-hatch" d="${ring}" fill="url(#apparatus-gap-hatch-${row.index})" fill-rule="evenodd"/>${circle(x,y,insideRadius,'drawing-tube-hole drawing-gap-hole')}</g>`;
      }
      content+=path(`M${point(x)} ${point(yTop)}V${point(yBottom)}`,'drawing-axis');
      content+=text(x,yBottom+13,'Ряд '+(row.index+1));
      content+='</g>';
    }
    for(const height of new Set(heights.map(point))){
      const centres=sections.filter(section=>section.heights.some(level=>Math.abs(level-height)<1e-4)).map(section=>xAt(section.row.diameter/2));
      content+=path(`M${point(Math.min(...centres)-radius-10)} ${point(yAt(height))}H${point(Math.max(...centres)+radius+10)}`,'drawing-axis');
    }
    for(let index=1;index<sections.length;index++){
      const left=sections[index-1],right=sections[index];
      const x1=xAt(left.row.diameter/2),x2=xAt(right.row.diameter/2);
      const spacing=(right.row.diameter-left.row.diameter)/2;
      content+=`<g data-gap-dimension="horizontal" data-spacing-mm="${point(spacing)}"><title>Межосевое расстояние между рядами ${left.row.index+1} и ${right.row.index+1}</title>`+
        dimensionX(point(x1),point(x2),24,format(spacing),point(yAt(left.heights[0]??minHeight)),point(yAt(right.heights[0]??minHeight)))+'</g>';
    }
    const vertical=[...sections].reverse().find(section=>section.heights.length===2);
    if(vertical){
      const {row,heights:levels}=vertical;
      const y1=yAt(levels[0]),y2=yAt(levels[1]),x=xAt(row.diameter/2);
      const spacing=levels[1]-levels[0];
      content+=`<g data-gap-dimension="vertical" data-spacing-mm="${point(spacing)}"><title>Межосевое расстояние между соседними трубками ряда ${row.index+1}</title>`+
        dimensionY(rightEdge+27,point(y1),point(y2),format(spacing),point(x))+'</g>';
    }
    const leaderSection=[...sections].reverse().find(section=>section.heights.length);
    const centreX=xAt(leaderSection.row.diameter/2),centreY=yAt(leaderSection.heights[0]);
    const tipX=centreX+radius/Math.SQRT2,tipY=centreY-radius/Math.SQRT2;
    const elbowX=rightEdge+32,elbowY=centreY-radius-25;
    const length=Math.hypot(elbowX-tipX,elbowY-tipY);
    content+='<g class="drawing-tube-leader">'+path(`M${point(tipX)} ${point(tipY)}L${point(elbowX)} ${point(elbowY)}H${point(elbowX+43)}`,'drawing-dimension')+
      arrowHead(tipX,tipY,(elbowX-tipX)/length,(elbowY-tipY)/length)+
      text(elbowX+3,elbowY-5,'Ø'+format(d)+'×'+format(g.tubeWall),'drawing-dimension-text drawing-leader-label')+'</g>';
    const width=rightEdge+84,height=yBottom+30;
    return svg('Межосевые расстояния труб, размеры в миллиметрах',`0 0 ${point(width)} ${point(height)}`,content);
  }
  function markup(g,colors){
    const view=(kind,title,drawing)=>`<figure class="apparatus-view apparatus-view-${kind}"><figcaption><span>${title}</span></figcaption>${drawing}</figure>`;
    return `<div class="apparatus-views">${view('top','Вид сверху',topSvg(g,colors))}${view('side','Высота аппарата',sideSvg(g,colors))}${view('gap','Расположение труб',gapSvg(g,colors))}</div>`;
  }
  return {sectionLevels,gapSections,topSvg,sideSvg,gapSvg,markup};
});
