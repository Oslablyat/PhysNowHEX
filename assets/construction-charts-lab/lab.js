(function(){
 'use strict';
 const D=CoilChartLabData,$=id=>document.getElementById(id),W=640,H=340;
 const palette=['#85baff','#edb679','#74d3b2','#c4a0ee'],criteriaColors=['#85baff','#edb679','#74d3b2','#c4a0ee','#e58da7'];
 const groups={size:'Габариты',material:'Труба и заготовки',choice:'Выбор и компромиссы',thermal:'Тепловые показатели'};
 const state={selected:[...D.initial],group:'all',open:null,weight:35,maxL:2100,maxD:210};
 const fmt=(n,d=1)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(n);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const p=n=>Number(n.toFixed(3)),color=r=>palette[state.selected.indexOf(r.id)]||'#687c94';
 const distinctColor=r=>state.selected.includes(r.id)?color(r):`hsl(${r.id*137.5%360} 48% 64%)`;
 const chosen=()=>state.selected.map(id=>D.rows.find(r=>r.id===id));
 const extent=(rows,key,zero=false)=>{const values=rows.map(r=>r[key]),min=zero?0:Math.min(...values),max=Math.max(...values),pad=(max-min||1)*.09;return [zero?0:min-pad,max+pad]};
 const scale=(domain,a,b)=>value=>a+(value-domain[0])/(domain[1]-domain[0]||1)*(b-a);
 const text=(x,y,t,cls='',anchor='middle')=>`<text x="${p(x)}" y="${p(y)}" class="${cls}" text-anchor="${anchor}">${esc(t)}</text>`;
 const line=(x1,y1,x2,y2,stroke='#647386',width=1,extra='')=>`<line x1="${p(x1)}" y1="${p(y1)}" x2="${p(x2)}" y2="${p(y2)}" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
 const rect=(x,y,w,h,fill,extra='')=>`<rect x="${p(x)}" y="${p(y)}" width="${p(Math.max(0,w))}" height="${p(Math.max(0,h))}" fill="${fill}" ${extra}/>`;
 const dot=(x,y,r,fill,extra='')=>`<circle cx="${p(x)}" cy="${p(y)}" r="${p(r)}" fill="${fill}" ${extra}/>`;
 const path=(points,stroke,width=2,extra='')=>`<path d="${points.map(([x,y],i)=>(i?'L':'M')+p(x)+' '+p(y)).join(' ')}" fill="none" stroke="${stroke}" stroke-width="${width}" ${extra}/>`;
 function mark(row,content,detail=''){
  const tip=`${row.label}${row.id===D.recommendation.id?' · рекомендация примера':''}\n${detail||`Длина ${fmt(row.height,0)} мм · Ø${row.diameter} мм\nЗакупка ${row.stockMetres} м · трубок ${row.count} · рядов ${row.rowCount}`}`;
  return `<g class="point" data-candidate="${row.id}" data-tip="${esc(tip)}"><title>${esc(tip)}</title>${content}</g>`;
 }
 function legend(){return chosen().map((r,i)=>dot(65+i*145,324,4,color(r))+text(76+i*145,329,r.label+(r.id===D.recommendation.id?' ★':''),'tiny','start')).join('')}
 function frame(xLabel,yLabel,xd,yd){
  const x=scale(xd,65,590),y=scale(yd,250,45);let out='';
  for(let i=0;i<=4;i++){
   const xv=xd[0]+(xd[1]-xd[0])*i/4,yv=yd[0]+(yd[1]-yd[0])*i/4;
   out+=`<line class="grid" x1="65" x2="590" y1="${p(y(yv))}" y2="${p(y(yv))}"/>`;
   out+=text(54,y(yv)+5,fmt(yv,Math.abs(yd[1])<10?1:0),'tiny','end')+text(x(xv),271,fmt(xv,Math.abs(xd[1])<10?1:0),'tiny');
  }
  out+=line(65,250,590,250)+text(65,24,yLabel,'axis-title','start')+text(330,300,xLabel,'axis-title');
  return {x,y,out};
 }
 function scatter(xKey,yKey,xLabel,yLabel,options={}){
  const xd=options.xd||extent(D.rows,xKey),yd=options.yd||extent(D.rows,yKey),a=frame(xLabel,yLabel,xd,yd);let out=a.out;
  if(options.band){const[b0,b1]=options.band;out+=rect(65,a.y(b1),525,a.y(b0)-a.y(b1),'#74d3b2','opacity=".10"')+line(65,a.y(b0),590,a.y(b0),'#74d3b2',1,'stroke-dasharray="5 4"')+line(65,a.y(b1),590,a.y(b1),'#74d3b2',1,'stroke-dasharray="5 4"')}
  if(options.xband){const[b0,b1]=options.xband;out+=rect(a.x(b0),45,a.x(b1)-a.x(b0),205,'#74d3b2','opacity=".10"')}
  if(options.constraints){const lx=Math.min(590,a.x(state.maxL)),ly=Math.max(45,a.y(state.maxD));out+=rect(65,ly,lx-65,250-ly,'#74d3b2','opacity=".08"')+line(lx,45,lx,250,'#74d3b2',1.5,'stroke-dasharray="6 4"')+line(65,ly,590,ly,'#74d3b2',1.5,'stroke-dasharray="6 4"');out+=text(585,23,`В габаритах ${D.rows.filter(r=>r.height<=state.maxL&&r.diameter<=state.maxD).length} / 40`,'chart-note','end')}
  const ordered=[...D.rows].sort((a,b)=>Number(state.selected.includes(a.id))-Number(state.selected.includes(b.id)));
  for(const r of ordered){
   const selected=state.selected.includes(r.id),x=a.x(r[xKey]),y=a.y(r[yKey]),radius=options.bubble?17*Math.sqrt(r[options.bubble]/Math.max(...D.rows.map(v=>v[options.bubble]))):selected?6:3.8;
   const opacity=options.constraints&&(r.height>state.maxL||r.diameter>state.maxD)?.13:selected?1:.5;
   let shape=dot(x,y,radius,color(r),`opacity="${opacity}" stroke="${r.front?'#8ebcad':'#191c20'}" stroke-width="${r.front?1.5:1}"`);
   if(selected)shape+=text(x+radius+3,y-7,r.label,'label','start').replace('<text ','<text style="fill:'+color(r)+'" ');
   if(options.star&&r.id===D.recommendation.id)shape+=text(x-11,y-9,'★','value','end');
   out+=mark(r,shape,`${xLabel}: ${fmt(r[xKey],3)}\n${yLabel}: ${fmt(r[yKey],3)}`);
  }
  return out+legend();
 }
 function normalizedMax(){return Math.max(1,...chosen().flatMap(r=>r.losses))}
 function parallel(){
  const max=normalizedMax(),y=scale([0,max],255,50),xs=D.metrics.map((m,i)=>75+i*122);let out='';
  for(let k=0;k<=4;k++){const value=max*k/4;out+=line(65,y(value),575,y(value),'#303842',1,'stroke-dasharray="3 5"')+text(53,y(value)+4,fmt(value*100,0)+' %','tiny','end')}
  D.metrics.forEach((m,i)=>{out+=line(xs[i],50,xs[i],255,'#4a596b')+text(xs[i],282,m.label,'axis-title')});
  for(const r of D.front)out+=path(r.losses.map((v,i)=>[xs[i],y(v)]),'#48586a',1,'opacity=".28"');
  for(const r of chosen())out+=mark(r,path(r.losses.map((v,i)=>[xs[i],y(v)]),color(r),2.8)+r.losses.map((v,i)=>dot(xs[i],y(v),4,color(r))).join(''));
  return text(65,24,'Отставание от лучшего на фронте · ниже лучше','chart-note','start')+out+legend();
 }
 function radar(){
  const max=normalizedMax(),cx=320,cy=160,R=108,angle=i=>-Math.PI/2+2*Math.PI*i/5,xy=(v,i)=>[cx+Math.cos(angle(i))*R*v,cy+Math.sin(angle(i))*R*v];let out='';
  for(let k=1;k<=4;k++)out+=`<polygon points="${D.metrics.map((m,i)=>xy(k/4,i).map(p).join(',')).join(' ')}" fill="none" stroke="#354151"/>`;
  D.metrics.forEach((m,i)=>{const [x,y]=xy(1.22,i),end=xy(1,i);out+=line(cx,cy,...end,'#354151')+text(x,y+4,m.label,'axis-title')});
  for(const r of chosen())out+=mark(r,`<polygon points="${r.losses.map((v,i)=>xy(v/max,i).map(p).join(',')).join(' ')}" fill="${color(r)}" fill-opacity=".08" stroke="${color(r)}" stroke-width="2.2"/>`);
  return text(320,22,`Внешний контур: ${fmt(max*100,0)} % отставания`,'chart-note')+out+legend();
 }
 function heatColor(v){const t=Math.max(0,Math.min(1,v));return `rgb(${Math.round(35+84*t)} ${Math.round(78-13*t)} ${Math.round(69-16*t)})`}
 function matrix(){
  const list=[...new Set([...chosen(),...D.ranked])].slice(0,9);let out='';
  D.metrics.forEach((m,i)=>{out+=text(190+i*86,32,m.label,'tiny')+text(190+i*86,47,m.unit,'tiny')});
  list.forEach((r,j)=>{const y=61+j*25;out+=text(115,y+17,r.label+(r.id===D.recommendation.id?' ★':''),'label','end');D.metrics.forEach((m,i)=>{out+=mark(r,rect(150+i*86,y,80,23,heatColor(D.loss(r,m.key)),'rx="3"')+text(190+i*86,y+16,fmt(r[m.key],1),'value'),`${m.label}: ${fmt(r[m.key],3)} ${m.unit}\nОтставание ${fmt(D.loss(r,m.key)*100)} %`)})});
  return out+text(320,324,'Цвет: от меньшего к большему отставанию','chart-note');
 }
 function bars(list,valueFn,unit,domainMax){
  const top=list.slice(0,12),max=domainMax||Math.max(...top.map(valueFn))*1.12,x=scale([0,max],125,580),step=19;let out=text(125,24,unit,'axis-title','start');
  [0,.25,.5,.75,1].forEach(t=>{const xx=x(t*max);out+=line(xx,40,xx,275,'#303842',1,'stroke-dasharray="3 5"')+text(xx,296,fmt(t*max,max<10?2:0),'tiny')});
  top.forEach((r,i)=>{const y=46+i*step,v=valueFn(r);out+=mark(r,text(110,y+12,r.label+(r.id===D.recommendation.id?' ★':''),'tiny','end')+rect(125,y,x(v)-125,13,color(r),'rx="2"')+text(x(v)+6,y+12,fmt(v,max<10?3:0),'tiny','start'),`${fmt(v,3)} ${unit}`)});
  return out+legend();
 }
 function silhouettes(){
  const list=chosen(),s=Math.min(205/Math.max(...list.map(r=>r.height)),78/Math.max(...list.map(r=>r.diameter)));let out=line(60,265,600,265,'#445366');
  list.forEach((r,i)=>{const cx=110+i*140,w=r.diameter*s,h=r.height*s;out+=mark(r,rect(cx-w/2,265-h,w,h,color(r),`fill-opacity=".12" stroke="${color(r)}" stroke-width="2"`)+text(cx,252-h,'Ø'+r.diameter,'tiny')+text(cx,286,r.label,'value')+text(cx,308,fmt(r.height,0)+' мм','tiny'))});
  return text(65,23,'Один масштаб для ширины и высоты','chart-note','start')+out;
 }
 function stockBars(){
  const max=Math.max(...chosen().map(r=>r.stockMetres))*1.12,x=scale([0,max],130,565);let out=text(130,23,'Закупка, м = фактическая труба + остаток','chart-note','start');
  for(const[r,i]of chosen().map((r,i)=>[r,i])){const y=52+i*53;out+=mark(r,text(115,y+19,r.label,'label','end')+rect(130,y,x(r.tubeMetres)-130,27,color(r),'rx="3"')+rect(x(r.tubeMetres),y,x(r.stockMetres)-x(r.tubeMetres),27,'#414b58')+text(x(r.stockMetres)+6,y+19,fmt(r.stockMetres,0),'value','start'),`Фактическая труба ${fmt(r.tubeMetres,3)} м\nЗакупка ${r.stockMetres} м\nОстаток ${fmt(r.stockMetres-r.tubeMetres,3)} м`)}
  return out+dot(140,300,4,'#8bb9e9')+text(150,305,'Труба','tiny','start')+dot(280,300,4,'#414b58')+text(290,305,'Остаток','tiny','start');
 }
 function weakest(){
  const max=normalizedMax(),x=scale([0,max],145,565);let out=text(145,23,'Нормированное отставание, %','chart-note','start');
  for(let k=0;k<=4;k++){const xx=x(max*k/4);out+=line(xx,45,xx,270,'#303842',1,'stroke-dasharray="3 5"')+text(xx,292,fmt(max*k*25,0),'tiny')}
  chosen().forEach((r,i)=>{const y=65+i*53;out+=text(128,y+5,r.label,'label','end')+line(x(0),y,x(r.worst),y,'#536477',2);r.losses.forEach((v,k)=>{out+=mark(r,dot(x(v),y+(k-2)*4,4.5,criteriaColors[k]),`${D.metrics[k].label}: отставание ${fmt(v*100)} %`)})});
  D.metrics.forEach((m,i)=>{out+=dot(65+i*112,324,4,criteriaColors[i])+text(74+i*112,329,m.label,'tiny','start')});return out;
 }
 function pairwise(){
  const list=chosen(),startX=205,startY=77,cell=64;let out='';
  list.forEach((r,i)=>{out+=text(startX+i*cell+cell/2,53,r.label,'label')+text(182,startY+i*cell+40,r.label,'label','end');list.forEach((other,j)=>{const v=D.metrics.filter(m=>r[m.key]<other[m.key]).length;out+=mark(r,rect(startX+j*cell,startY+i*cell,61,61,i===j?'#252c35':heatColor(1-v/5),'rx="4"')+text(startX+j*cell+30,startY+i*cell+38,i===j?'—':v+' / 5','value'),`${r.label} лучше ${other.label} по ${v} из 5 критериев`)})});return out;
 }
 function dimensionPanels(){
  let out='';[['height','Длина, мм'],['diameter','Диаметр, мм']].forEach(([key,label],k)=>{const l=70+k*300,right=l+240,max=Math.max(...chosen().map(r=>r[key]))*1.1,x=scale([0,max],l+34,right),best=Math.min(...D.front.map(r=>r[key]));out+=text((l+right)/2,25,label,'axis-title')+line(x(best),45,x(best),250,'#74d3b2',1,'stroke-dasharray="5 4"');chosen().forEach((r,i)=>{const y=70+i*48;out+=mark(r,text(l+22,y+5,r.label,'tiny','end')+line(x(best),y,x(r[key]),y,color(r),2)+dot(x(r[key]),y,5,color(r))+text(x(r[key]),y-10,fmt(r[key],0),'tiny'))});out+=line(l+34,265,right,265,'#647386')+text(l+34,285,'0','tiny')+text(right,285,fmt(max,0),'tiny')});return out+legend();
 }
 function relative(){
  const max=normalizedMax(),x=scale([0,max],160,575),other=chosen().filter(r=>r.id!==D.recommendation.id);let out=text(160,22,'Серая точка — рекомендация · ниже отставание лучше','chart-note','start');
  D.metrics.forEach((m,i)=>{const y=60+i*44,base=D.loss(D.recommendation,m.key);out+=text(140,y+5,m.label,'tiny','end')+line(160,y,575,y,'#303842')+dot(x(base),y,5,'#c1cad4');other.forEach((r,j)=>{const yy=y+(j-(other.length-1)/2)*7;out+=mark(r,line(x(base),yy,x(D.loss(r,m.key)),yy,color(r),1.5)+dot(x(D.loss(r,m.key)),yy,4,color(r)),`${m.label}: отставание ${fmt(D.loss(r,m.key)*100)} %\nРекомендация: ${fmt(base*100)} %`)})});return out+legend();
 }
 function score(r,w){return w*D.loss(r,'stockMetres')+(1-w)/4*D.metrics.filter(m=>m.key!=='stockMetres').reduce((sum,m)=>sum+D.loss(r,m.key),0)}
 function sensitivity(){
  const a=frame('Вес закупки, %','Минимальная взвешенная сумма',[0,100],[0,1]),steps=Array.from({length:41},(_,i)=>{const w=i/40,best=[...D.front].sort((a,b)=>score(a,w)-score(b,w)||a.id-b.id)[0];return {w,best,value:score(best,w)}});let out=a.out;
  chosen().forEach(r=>out+=path(steps.map(s=>[a.x(s.w*100),a.y(score(r,s.w))]),color(r),1,'opacity=".3"'));
  steps.slice(0,-1).forEach((s,i)=>{const next=steps[i+1];out+=mark(s.best,line(a.x(s.w*100),a.y(s.value),a.x(next.w*100),a.y(next.value),distinctColor(s.best),3),`Вес закупки ${fmt(s.w*100,0)} %\nЛучший вариант ${s.best.label}\nБаллы ${fmt(s.value,3)}`)});
  const winners=[...new Set(steps.map(s=>s.best))];winners.slice(0,6).forEach((r,i)=>{out+=dot(65+i*93,324,4,distinctColor(r))+text(74+i*93,329,r.label,'tiny','start')});
  return out;
 }
 function quantile(values,t){const ordered=[...values].sort((a,b)=>a-b),index=(ordered.length-1)*t,lo=Math.floor(index),hi=Math.ceil(index);return ordered[lo]+(ordered[hi]-ordered[lo])*(index-lo)}
 function boxes(){
  const x=scale([0,6.5],140,575);let out=text(140,23,'Полная длина одной трубки, м','axis-title','start');
  [0,1,2,3,4,5,6].forEach(v=>{out+=line(x(v),43,x(v),270,'#303842',1,'stroke-dasharray="3 5"')+text(x(v),294,v,'tiny')});
  chosen().forEach((r,i)=>{const y=68+i*53,min=Math.min(...r.tubeLengths),max=Math.max(...r.tubeLengths),q1=quantile(r.tubeLengths,.25),q3=quantile(r.tubeLengths,.75),median=quantile(r.tubeLengths,.5);out+=mark(r,text(125,y+5,r.label,'label','end')+line(x(min),y,x(max),y,color(r),2)+line(x(min),y-8,x(min),y+8,color(r),2)+line(x(max),y-8,x(max),y+8,color(r),2)+rect(x(q1),y-12,x(q3)-x(q1),24,color(r),'fill-opacity=".3"')+line(x(median),y-12,x(median),y+12,color(r),3),`Минимум ${fmt(min,3)} м\nМедиана ${fmt(median,3)} м\nМаксимум ${fmt(max,3)} м`)});return out+legend();
 }
 function chart(id){
  let content='';switch(id){
   case 1:content=scatter('height','diameter','Длина, мм','Диаметр, мм',{star:true});break;
   case 2:content=scatter('diameter','stockMetres','Диаметр, мм','Закупка трубы, м',{bubble:'count'});break;
   case 3:content=scatter('height','stockMetres','Длина, мм','Закупка трубы, м');break;
   case 4:content=scatter('volume','stockMetres','Габаритный объём, л','Закупка трубы, м');break;
   case 5:content=scatter('count','stockMetres','Трубок, шт.','Закупка трубы, м');break;
   case 6:content=parallel();break;
   case 7:content=radar();break;
   case 8:content=matrix();break;
   case 9:content=bars([...D.rows].sort((a,b)=>a.height-b.height),r=>r.height,'Длина, мм');break;
   case 10:content=silhouettes();break;
   case 11:content=stockBars();break;
   case 12:content=weakest();break;
   case 13:content=bars(D.ranked,r=>r.worst*100,'Максимальное отставание, %',100);break;
   case 14:content=pairwise();break;
   case 15:content=dimensionPanels();break;
   case 16:content=relative();break;
   case 17:content=bars([...D.front].sort((a,b)=>score(a,state.weight/100)-score(b,state.weight/100)||a.id-b.id),r=>score(r,state.weight/100),'Взвешенная сумма · закупка '+state.weight+' %',1);break;
   case 18:content=sensitivity();break;
   case 19:content=scatter('height','diameter','Длина, мм','Диаметр, мм',{xd:[0,3500],yd:[0,300],constraints:true});break;
   case 20:content=scatter('area','duty','Тепловая поверхность, м²','Мощность, кВт',{yd:[196,206],band:[198,203.94]});break;
   case 21:content=scatter('reHot','reCold','Трубный Re','Межтрубный Re',{xd:[14000,21000],yd:[0,35000],xband:[15000,20000]});break;
   case 22:content=scatter('tubeMetres','ua','Фактическая труба, м','UA, Вт/К');break;
   case 23:content=boxes();break;
   case 24:content=scatter('rowCount','count','Рядов','Трубок, шт.',{xd:[.5,4.5],yd:[6,13],bubble:'volume'});break;
  }
  const example=D.examples.find(e=>e.id===id);
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(example.title)}"><title>${esc(example.title)} · демонстрационные данные</title>${content}</svg>`;
 }
 function toggleCandidate(id){
  if(state.selected.includes(id)){if(state.selected.length===1){$('selection-hint').textContent='Оставьте хотя бы одну конструкцию для сравнения.';return}state.selected=state.selected.filter(v=>v!==id)}
  else{if(state.selected.length===4)state.selected.shift();state.selected.push(id)}
  $('selection-hint').textContent='Цвет варианта одинаков на всех графиках. При выборе пятой конструкции она заменяет самую раннюю.';
  $('chart-tooltip').hidden=true;render();
 }
 function render(){
  $('selection-chips').innerHTML=chosen().map(r=>`<button type="button" data-toggle="${r.id}" style="--color:${color(r)}" title="Убрать из сравнения">${r.label}${r.id===D.recommendation.id?' ★':''} <span aria-hidden="true">×</span></button>`).join('');
  $('candidate-list').innerHTML=D.rows.map(r=>`<button type="button" data-toggle="${r.id}" aria-pressed="${state.selected.includes(r.id)}" style="--color:${color(r)}">${r.label}${r.id===D.recommendation.id?' ★':''}<small>${fmt(r.height,0)} × Ø${r.diameter} мм</small></button>`).join('');
  $('gallery').innerHTML=D.examples.map(e=>`<article class="chart-card ${e.recommended?'recommended':''}" data-example="${e.id}" ${state.group!=='all'&&state.group!==e.group?'hidden':''}><header class="chart-card-header"><div class="chart-kicker"><span>${String(e.id).padStart(2,'0')} / ${groups[e.group]}</span>${e.recommended?'<span class="star">★ Начать с этого</span>':''}</div><h3>${esc(e.title)}</h3><p>${esc(e.subtitle)}</p></header><div class="chart-preview">${chart(e.id)}</div><footer class="chart-card-footer"><span>${[17,19].includes(e.id)?'Есть настройка сценария':'Нажмите на вариант для сравнения'}</span><button type="button" class="expand-button" data-open="${e.id}" aria-label="Увеличить график ${String(e.id).padStart(2,'0')}: ${esc(e.title)}">Увеличить ↗</button></footer></article>`).join('');
  const count=D.examples.filter(e=>state.group==='all'||e.group===state.group).length;
  $('gallery-title').textContent=state.group==='all'?'24 способа сравнения':groups[state.group]+' · '+count+' примеров';
  if(state.open)$('dialog-chart').innerHTML=chart(state.open);
 }
 function openExample(id){
  const e=D.examples.find(e=>e.id===id);if(!e)return;
  state.open=id;$('dialog-title').textContent=e.title;$('dialog-number').textContent='ПРИМЕР '+String(e.id).padStart(2,'0')+' / '+groups[e.group].toLocaleUpperCase('ru');
  $('dialog-purpose').textContent=e.purpose;$('dialog-reading').textContent=e.reading;$('dialog-limit').textContent=e.limit;
  const controls=$('dialog-controls');controls.hidden=![17,19].includes(id);
  controls.innerHTML=id===17?`<label>Вес закупки <input id="weight-slider" type="range" min="0" max="100" step="5" value="${state.weight}"><output for="weight-slider">${state.weight} %</output></label>`:id===19?`<label>Макс. длина <input id="length-slider" type="range" min="500" max="3500" step="100" value="${state.maxL}"><output for="length-slider">${state.maxL} мм</output></label><label>Макс. диаметр <input id="diameter-slider" type="range" min="100" max="300" step="5" value="${state.maxD}"><output for="diameter-slider">${state.maxD} мм</output></label>`:'';
  $('dialog-chart').innerHTML=chart(id);$('chart-dialog').append($('chart-tooltip'));$('chart-dialog').showModal();$('close-dialog').focus();
 }
 document.addEventListener('click',event=>{
  const opener=event.target.closest('[data-open]');if(opener){openExample(Number(opener.dataset.open));return}
  const selector=event.target.closest('[data-toggle],[data-candidate]');if(selector){toggleCandidate(Number(selector.dataset.toggle||selector.dataset.candidate));return}
  const filter=event.target.closest('[data-group]');if(filter){state.group=filter.dataset.group;document.querySelectorAll('[data-group]').forEach(b=>b.setAttribute('aria-pressed',String(b===filter)));render()}
 });
 $('reset-selection').addEventListener('click',()=>{state.selected=[...D.initial];render()});
 $('close-dialog').addEventListener('click',()=>$('chart-dialog').close());
 $('chart-dialog').addEventListener('close',()=>{state.open=null;$('chart-tooltip').hidden=true;document.body.append($('chart-tooltip'))});
 $('chart-dialog').addEventListener('click',event=>{if(event.target!==event.currentTarget)return;const r=event.currentTarget.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.currentTarget.close()});
 $('dialog-controls').addEventListener('input',event=>{const keys={'weight-slider':'weight','length-slider':'maxL','diameter-slider':'maxD'},key=keys[event.target.id];if(!key)return;state[key]=Number(event.target.value);event.target.nextElementSibling.textContent=event.target.value+(key==='weight'?' %':' мм');render()});
 document.addEventListener('pointermove',event=>{
  const target=event.target.closest('[data-tip]'),tip=$('chart-tooltip');if(!target){tip.hidden=true;return}
  tip.textContent=target.dataset.tip;tip.hidden=false;tip.style.left=Math.max(8,Math.min(event.clientX+14,innerWidth-285))+'px';tip.style.top=Math.max(8,Math.min(event.clientY+14,innerHeight-125))+'px';
 });
 window.addEventListener('scroll',()=>$('chart-tooltip').hidden=true,{passive:true});
 render();
 const initial=Number(new URLSearchParams(location.search).get('chart'));if(initial>=1&&initial<=24)openExample(initial);
})();
