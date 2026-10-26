/* Isolated SVG comparison: no calculator code, storage, or numerical models. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else{root.PhysNowRectangleVariants=api;api.mount(document)}})(globalThis,function(){
 'use strict';
 const colors={shell:'#171717',fluid:'#3b82f6',opacity:.12,outline:'#626970',hot:'#ef4444',cold:'#3b82f6'};
 // The same smooth coil as the live calculator, rotated through 90 degrees.
 const coilPath='M-92 0C-82 0 -64.3518 -14.3594 -62.1518 0C-59.9518 14.3594 -62.2289 26 -65.5518 26C-68.8746 26 -71.1518 14.3594 -68.9518 0C-66.7518 -14.3594 -60.0746 -26 -52.3518 -26C-44.6289 -26 -37.9518 -14.3594 -35.7518 0C-33.5518 14.3594 -35.8289 26 -39.1518 26C-42.4746 26 -44.7518 14.3594 -42.5518 0C-40.3518 -14.3594 -33.6746 -26 -25.9518 -26C-18.2289 -26 -11.5518 -14.3594 -9.3518 0C-7.1518 14.3594 -9.4289 26 -12.7518 26C-16.0746 26 -18.3518 14.3594 -16.1518 0C-13.9518 -14.3594 -7.2746 -26 0.4482 -26C8.1711 -26 14.8482 -14.3594 17.0482 0C19.2482 14.3594 16.9711 26 13.6482 26C10.3254 26 8.0482 14.3594 10.2482 0C12.4482 -14.3594 19.1254 -26 26.8482 -26C34.5711 -26 41.2482 -14.3594 43.4482 0C45.6482 14.3594 43.3711 26 40.0482 26C36.7254 26 34.4482 14.3594 36.6482 0C38.8482 -14.3594 45.5254 -26 53.2482 -26C60.9711 -26 67.6482 -14.3594 69.8482 0C72.0482 14.3594 82 0 92 0';
 const variants=[
  {name:'Базовый',short:'Умеренные пропорции · мягкий угол',description:'Спокойный прямоугольный корпус с небольшим скруглением. Патрубки вынесены на противоположные боковые грани.',width:184,height:242,radius:8,neck:12,margin:30},
  {name:'Широкий',short:'Больше пространства вокруг змеевика',description:'Более широкий корпус оставляет заметный объём межтрубного пространства по обе стороны от змеевика.',width:228,height:242,radius:8,neck:12,margin:30},
  {name:'Узкий',short:'Вертикальный силуэт · компактная ширина',description:'Вытянутый узкий корпус ближе к силуэту аппарата. Слева внизу — выход, справа вверху — вход.',width:150,height:258,radius:8,neck:12,margin:31},
  {name:'Высокий',short:'Вытянутый корпус · длинная навивка',description:'Выраженная вертикальная компоновка: рабочее пространство и змеевик вытянуты по высоте.',width:184,height:286,radius:8,neck:12,margin:33},
  {name:'Квадратный',short:'Равные стороны · устойчивый силуэт',description:'Прямоугольник с равными сторонами. Компактная по высоте альтернатива исходному кругу.',width:222,height:222,radius:8,neck:12,margin:29},
  {name:'Мягкие углы',short:'Крупное скругление · тот же контур',description:'Плавное скругление смягчает форму, сохраняя прямые боковые стенки и привычную заливку исходного круга.',width:196,height:250,radius:25,neck:12,margin:36},
  {name:'Прямые углы',short:'Строгий прямоугольник · без скругления',description:'Чёткий прямоугольный контур без скругления углов. Все цвета и толщины линий остаются прежними.',width:198,height:250,radius:0,neck:12,margin:30},
  {name:'Длинные патрубки',short:'Явные боковые выводы · удлинённая шейка',description:'Удлинённые боковые шейки делают вход и выход межтрубного потока более различимыми.',width:184,height:242,radius:10,neck:32,margin:30},
  {name:'С фланцами',short:'Две тонкие фланцевые отметки',description:'К боковым патрубкам добавлены тонкие поперечные фланцы. Корпус и змеевик без дополнительных эффектов.',width:192,height:254,radius:10,neck:22,margin:32,flanges:true},
  {name:'Широкие патрубки',short:'Выраженные боковые проёмы',description:'Патрубки шире обычных: соединения читаются как боковые проёмы межтрубного пространства.',width:184,height:242,radius:12,neck:16,margin:31,nozzleRadius:10}
 ];
 // A second, isolated series develops the narrow silhouette (original variant 3).
 const narrowVariants=[8,10].flatMap(nozzleRadius=>[50,65,80,95,110].map(wider=>{
  const nozzleWider=Math.round((nozzleRadius/6-1)*100);
  return {...variants[2],name:`Навивка +${wider}% · ${nozzleRadius===8?'А':'Б'}`,short:`Патрубки +${nozzleWider}% · навивка +${wider}%`,description:`Основа — узкий корпус №3, без изменения пропорций. Ширина красной навивки увеличена на ${wider}%, проём боковых патрубков — на ${nozzleWider}% относительно исходного №3. Толщина линий и цвета сохранены.`,nozzleRadius,coilScale:.9*(1+wider/100)};
 }));
 const coilShapes=[
  {name:'Объёмная классика',short:'Овальные витки · ровный шаг',turns:5.5,amplitude:35.1,depth:18,ramp:.15},
  {name:'Пологий ракурс',short:'Сплюснутые овалы · шесть витков',turns:6,amplitude:35.1,depth:14,ramp:.14},
  {name:'Воздушная спираль',short:'Крупные овалы · свободный шаг',turns:4.5,amplitude:35.1,depth:20,ramp:.17},
  {name:'Глубокий ракурс',short:'Раскрытые овалы · сильнее объём',turns:5,amplitude:35.1,depth:24,ramp:.19},
  {name:'Широкая спираль',short:'Широкий цилиндр · овальная навивка',turns:5.5,amplitude:43,depth:20,ramp:.17},
  {name:'Плотная спираль',short:'Больше витков · компактный цилиндр',turns:6.5,amplitude:31,depth:17,ramp:.17},
  {name:'Симметричные выводы',short:'Объёмная навивка · другая фаза',turns:5,amplitude:35.1,depth:18,ramp:.19,phase:Math.PI/2},
  {name:'Обратная навивка',short:'Зеркальные овалы · мягкие выводы',turns:5.5,amplitude:35.1,depth:18,ramp:.15,mirror:-1},
  {name:'Переменный шаг',short:'Овалы с переменным расстоянием',turns:5.5,amplitude:35.1,depth:18,ramp:.19,variable:true},
  {name:'Бочкообразная',short:'Полнее в центре · уже у выводов',turns:5.5,amplitude:39,depth:20,ramp:.17,barrel:true}
 ];
 const coilVariants=coilShapes.map(shape=>({...narrowVariants[0],name:shape.name,short:shape.short,description:`${shape.short}. Проекция объёмной винтовой линии: витки огибают вертикальную ось. Корпус и все патрубки — из выбранного №1. Меняется только геометрия змеевика, цвет и толщина линии прежние.`,coilShape:shape}));
 // A single C1-continuous line, with vertical endpoint tangents. The quintic
 // envelope eases the coil into/out of its full diameter without a dog-leg.
 function coilSegments(v){
  const s=v.coilShape,h=v.height/2,core=h-20,steps=320,phase=s.phase||0;
  const ease=t=>{const u=Math.max(0,Math.min(1,t));return u*u*u*(10+u*(-15+6*u))};
  function point(t){const envelope=ease(t/s.ramp)*ease((1-t)/s.ramp),profile=s.barrel?.75+.25*Math.sin(Math.PI*t):1,p=s.variable?t+.045*Math.sin(2*Math.PI*t):t,angle=2*Math.PI*s.turns*p+phase;return {x:(s.mirror||1)*s.amplitude*profile*envelope*Math.sin(angle),y:-core+2*core*t+s.depth*profile*envelope*(Math.cos(angle)-Math.cos(phase))}}
  const points=Array.from({length:steps+1},(_,i)=>point(i/steps));
  const tangent=i=>i===0||i===steps?{x:0,y:2*core/steps}:{x:(points[i+1].x-points[i-1].x)/2,y:(points[i+1].y-points[i-1].y)/2};
  const segments=[],start=points[0],end=points[steps],a=tangent(0),b=tangent(steps);
  segments.push({p0:{x:0,y:-h},p1:{x:0,y:-h+8},p2:{x:0,y:start.y-a.y/3},p3:start});
  for(let i=0;i<steps;i++){const p=points[i],q=points[i+1],u=tangent(i),w=tangent(i+1);segments.push({p0:p,p1:{x:p.x+u.x/3,y:p.y+u.y/3},p2:{x:q.x-w.x/3,y:q.y-w.y/3},p3:q})}
  segments.push({p0:end,p1:{x:0,y:end.y+b.y/3},p2:{x:0,y:h-8},p3:{x:0,y:h}});return segments;
 }
 function smoothCoilPath(v){const segments=coilSegments(v),xy=p=>`${Number(p.x.toFixed(4))} ${Number(p.y.toFixed(4))}`;return `M${xy(segments[0].p0)}`+segments.map(s=>`C${xy(s.p1)} ${xy(s.p2)} ${xy(s.p3)}`).join('')}
 function geometry(v){const x=v.width/2,y=v.height/2,r=v.radius,n=v.nozzleRadius||6,direction=v.flowMode==='counter'?-1:1;return {x,y,r,n,leftY:direction*(y-(v.leftMargin??v.margin)),rightY:direction*(-y+(v.rightMargin??v.margin)),leftX:-x-v.neck,rightX:x+v.neck}}
 function shellPath(v){const {x,y,r,n,leftY:l,rightY:t}=geometry(v),neck=v.neck;return `M${-x+r} ${-y}H${x-r}Q${x} ${-y} ${x} ${-y+r}V${t-n}H${x+neck}V${t+n}H${x}V${y-r}Q${x} ${y} ${x-r} ${y}H${-x+r}Q${-x} ${y} ${-x} ${y-r}V${l+n}H${-x-neck}V${l-n}H${-x}V${-y+r}Q${-x} ${-y} ${-x+r} ${-y}Z`}
 const port=(x,y,color)=>`<circle class="diagram-port" cx="${x}" cy="${y}" r="4.5" stroke="${color}"/>`;
 function svg(v,index,small=false){
  const id=(small?'thumb':'detail')+'-'+index,{x,y,n,leftY,rightY,leftX,rightX}=geometry(v),path=shellPath(v),red=colors.hot,blue=colors.cold,coilScale=v.coilScale||.9;
  const marker=(name,color)=>`<marker id="${id}-${name}" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="10" markerHeight="10" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L12 6L0 12Z" fill="${color}"/></marker>`;
  const flows=small?`<path class="diagram-flow" d="M0 ${-y-24}V${-y}" stroke="${red}"/><path class="diagram-flow" d="M0 ${y}V${y+24}" stroke="${red}"/><path class="diagram-flow" d="M${rightX+28} ${rightY}H${rightX+7}" stroke="${blue}" marker-end="url(#${id}-cold)"/><path class="diagram-flow" d="M${leftX} ${leftY}H${leftX-28}" stroke="${blue}" marker-end="url(#${id}-cold)"/>`:
   `<path class="diagram-flow" d="M-280 -175H-190C-55 -175 0 -180 0 ${-y}" stroke="${red}" marker-end="url(#${id}-hot)"/><path class="diagram-flow" d="M280 -125C${rightX+65} -125 ${rightX+60} ${rightY} ${rightX+7} ${rightY}" stroke="${blue}" marker-end="url(#${id}-cold)"/><path class="diagram-flow" d="M${leftX} ${leftY}C${leftX-60} ${leftY} ${leftX-65} 125 -280 125" stroke="${blue}" marker-end="url(#${id}-cold)"/><path class="diagram-flow" d="M0 ${y}C0 180 55 175 280 175" stroke="${red}" marker-end="url(#${id}-hot)"/>`;
  const flange=v.flanges?[-1,1].map(sign=>{const xx=sign*(x+v.neck-6),yy=sign<0?leftY:rightY;return `<path class="diagram-outline" d="M${xx} ${yy-n-6}V${yy+n+6}" fill="none" stroke="${colors.outline}"/>`}).join(''):'';
  const coil=v.coilShape?`<path class="diagram-coil" d="${smoothCoilPath(v)}" stroke="${red}"/>`:`<path class="diagram-coil" d="${coilPath}" transform="rotate(90) scale(${(v.height-36)/184} ${coilScale})" stroke="${red}"/><path class="diagram-coil" d="M0 ${-y}V${-y+18}M0 ${y-18}V${y}" stroke="${red}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${small?'-180 -180 360 360':'-300 -220 600 440'}" role="img" aria-label="${v.name}: прямоугольный корпус, патрубок слева внизу, патрубок справа вверху"><defs>${marker('hot',red)}${marker('cold',blue)}</defs>${flows}<path d="${path}" fill="${colors.shell}"/><path class="diagram-outline" d="${path}" fill="${colors.fluid}" fill-opacity="${colors.opacity}" stroke="${colors.outline}"/>${flange}${coil}${port(0,-y,red)}${port(0,y,red)}${port(leftX,leftY,blue)}${port(rightX,rightY,blue)}${small?'':`<g class="diagram-temperature"><text x="-275" y="-187" fill="#ff6b6b">90 °C</text><text x="235" y="-137" fill="#7d96ff">20 °C</text><text x="-275" y="150" fill="#7d96ff">40 °C</text><text x="235" y="199" fill="#ff6b6b">60 °C</text></g>`}</svg>`;
 }
 function mount(doc){
  const variants=doc.body.dataset.series==='coil'?coilVariants:doc.body.dataset.series==='narrow'?narrowVariants:apiVariants;
  const gallery=doc.getElementById('variants'),scene=doc.getElementById('selected-scene');let selected=0;if(!gallery||!scene)return;
  gallery.innerHTML=variants.map((v,i)=>`<button class="variant" type="button" data-index="${i}" aria-pressed="false" aria-controls="detail" aria-label="Вариант ${i+1}: ${v.name}"><span class="variant-stage">${svg(v,i,true)}</span><span class="variant-copy"><span class="variant-title"><span class="variant-number">${String(i+1).padStart(2,'0')}</span>${v.name}</span><span class="variant-description">${v.short}</span></span></button>`).join('');
  function select(index){selected=(index+variants.length)%variants.length;const v=variants[selected];doc.getElementById('selected-number').textContent=String(selected+1).padStart(2,'0');doc.getElementById('selected-title').textContent=v.name;doc.getElementById('selected-name').textContent=v.name;doc.getElementById('selected-description').textContent=v.description;doc.getElementById('count').textContent=(selected+1)+' / '+variants.length;scene.innerHTML=svg(v,selected);gallery.querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===selected)));}
  gallery.addEventListener('click',event=>{const button=event.target.closest('button[data-index]');if(!button)return;select(Number(button.dataset.index));doc.getElementById('detail').scrollIntoView({block:'start'});});
  gallery.addEventListener('keydown',event=>{const button=event.target.closest('button[data-index]');if(!button||!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const i=Number(button.dataset.index);select(event.key==='Home'?0:event.key==='End'?9:i+(event.key==='ArrowRight'?1:-1));gallery.querySelector(`[data-index="${selected}"]`).focus();});
  doc.getElementById('previous').addEventListener('click',()=>select(selected-1));doc.getElementById('next').addEventListener('click',()=>select(selected+1));select(0);
 }
 const apiVariants=variants;
 return {variants,narrowVariants,coilVariants,coilSegments,smoothCoilPath,colors,coilPath,geometry,shellPath,svg,mount};
});
