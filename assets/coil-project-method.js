/* Reverse design around the supplied Teplo verification, not a new correlation.
 * Target balance uses inlet-fixed mass and cp at arithmetic mean temperatures.
 * Candidate duty/UA/outlets and applicability always come from Teplo.calculate. */
(function(root,factory){const common=typeof module==='object'&&module.exports,api=factory(common?require('./coil-thermal-method.js'):root.CoilThermalMethod,common?require('./coil-manufacturing.js'):root.CoilManufacturing);if(common)module.exports=api;else root.CoilProjectMethod=api})(globalThis,function(teplo,manufacturing){
 'use strict';
 const temperatures=['thi','tho','tci','tco'],flows=['mh','mc'],unknowns=[...temperatures,...flows];
 const algorithm='re-stock-full-height-v8';
 const profiles=[{id:'balanced',enabled:true,name:'Оптимальная конструкция',detail:'Re 15000…20000; заготовки 1/3/6 м; сначала длина, затем диаметр корпуса'},{id:'compact',enabled:false,name:'По габаритам',detail:'Временно отключено'},{id:'production',enabled:false,name:'По сложности производства',detail:'Временно отключено'}];
 const construction=Object.freeze({atmosphereMPa:.101325,allowableMPa:130,corrosionMM:.2,weldFactor:1,gapMM:3,maxRows:8,maxTurns:1000,reMin:15000,reMax:20000,maxWaste:.2,radiusStepMM:5,firstBatch:20,maxEvaluations:200,dutyExcessFraction:.01,outletNumericalToleranceC:.01});
 const parameterNames={thi:'температуру горячего потока на входе',tho:'температуру горячего потока на выходе',tci:'температуру холодного потока на входе',tco:'температуру холодного потока на выходе',mh:'расход горячего потока',mc:'расход холодного потока',ph:'абсолютное давление трубного пространства',pc:'абсолютное давление межтрубного пространства'};
 function inputError(message,fields=[],hint='',code='invalid-input'){const error=Error(message);error.fields=fields;error.hint=hint;error.code=code;return error}
 const finite=(v,label)=>{if(v===''||v==null||!Number.isFinite(Number(v)))throw inputError('Заполните '+(parameterNames[label]||label),parameterNames[label]?[label]:[],'Введите известные параметры, а для одного неизвестного выберите «Найти».','incomplete');return Number(v)};
 function balance(state,props){
  if(state.flow!=='counter')throw Error('Методика Teplo поддерживает только противоток.');
  if(state['hot-fluid']!=='water'||state['cold-fluid']!=='water')throw Error('Проектировочный расчёт Teplo пока поддерживает воду в обоих контурах.');
  const unknown=state.unknown===null?null:unknowns.includes(state.unknown)?state.unknown:'mc',n={};
  for(const key of [...unknowns,'ph','pc'])if(key!==unknown)n[key]=finite(state[key],key);
  if(n.ph<=0||n.pc<=0)throw inputError('Абсолютные давления должны быть положительными.',['ph','pc'].filter(k=>n[k]<=0));
  const units={hot:state['hot-flow-unit']||'kg-s',cold:state['cold-flow-unit']||'kg-s'};
  for(const unit of Object.values(units))if(!['kg-s','kg-h','m3-h','m3-s','l-s','l-min','l-h'].includes(unit))throw Error('Неизвестная единица расхода');
  const property=(name,t,p)=>{const value=props(name,'T',t+273.15,'P',p*1e6,'Water');if(!Number.isFinite(value)||value<=0||value>1e100)throw Error('CoolProp: недопустимые свойства воды');return value};
  function mass(v,unit,t,p){if(v<=0)throw Error('Расход должен быть положительным.');return unit==='kg-s'?v:unit==='kg-h'?v/3600:v*(unit==='m3-h'?1/3600:unit==='m3-s'?1:unit==='l-min'?1/60000:unit==='l-h'?1/3600000:.001)*property('Dmass',t,p)}
  function evaluate(){
   if(n.thi<=n.tho||n.tco<=n.tci)throw inputError('Горячий поток должен охлаждаться, холодный — нагреваться.',n.thi<=n.tho?['thi','tho']:['tci','tco']);
   const cph=property('Cpmass',(n.thi+n.tho)/2,n.ph),cpc=property('Cpmass',(n.tci+n.tco)/2,n.pc),mh=mass(n.mh,units.hot,n.thi,n.ph),mc=mass(n.mc,units.cold,n.tci,n.pc);
   return {cph,cpc,mh,mc,rhoh:property('Dmass',n.thi,n.ph),rhoc:property('Dmass',n.tci,n.pc),qh:mh*cph*(n.thi-n.tho),qc:mc*cpc*(n.tco-n.tci)};
  }
  if(flows.includes(unknown)){
   n[unknown]=1;const probe=evaluate(),hot=unknown==='mh',required=hot?probe.qc/(probe.cph*(n.thi-n.tho)):probe.qh/(probe.cpc*(n.tco-n.tci)),unit=hot?units.hot:units.cold,rho=hot?probe.rhoh:probe.rhoc;
   n[unknown]=unit==='kg-s'?required:unit==='kg-h'?required*3600:required/rho*(unit==='m3-h'?3600:unit==='m3-s'?1:unit==='l-min'?60000:unit==='l-h'?3600000:1000);
  }else if(temperatures.includes(unknown)){
   const eps=1e-6,hot=unknown==='thi'||unknown==='tho',p=hot?n.ph:n.pc;
   const saturation=props('T','P',p*1e6,'Q',0,'Water')-273.15;
   let lo,hi;if(unknown==='thi'){lo=Math.max(n.tho,n.tco)+eps;hi=saturation-.01}else if(unknown==='tho'){lo=n.tci+eps;hi=n.thi-eps}else if(unknown==='tci'){lo=.01;hi=Math.min(n.tco,n.tho)-eps}else{lo=n.tci+eps;hi=n.thi-eps}
   const temperatureError=()=>inputError('Невозможно найти '+parameterNames[unknown]+': тепловой баланс не имеет решения в допустимом диапазоне'+(hi>lo?' '+lo.toLocaleString('ru-RU',{maximumFractionDigits:2})+'…'+hi.toLocaleString('ru-RU',{maximumFractionDigits:2})+' °C':'')+' при текущих температурах, расходах и давлениях.',[unknown],'Измените известные температуры, расходы или давление либо выберите другой неизвестный параметр.','no-balance-solution');
   lo=Math.max(.01,lo);hi=Math.min(saturation-.01,hi);if(!(hi>lo))throw temperatureError();
   const residual=t=>{n[unknown]=t;const r=evaluate();return r.qh-r.qc};
   let a=lo,b=hi,fa=residual(a),fb=residual(b);if(fa*fb>0)throw temperatureError();
   for(let i=0;i<80;i++){const mid=(a+b)/2,fm=residual(mid);if(Math.abs(fm)<1e-7||b-a<1e-10)break;if((fa<0)===(fm<0)){a=mid;fa=fm}else{b=mid;fb=fm}}
  }
  const r=evaluate(),imbalance=Math.abs(r.qh-r.qc)/Math.max(r.qh,r.qc);if(imbalance>.001)throw inputError('Тепловой баланс Teplo не сходится: '+(imbalance*100).toFixed(4)+' %.',[...unknowns],'Выберите один неизвестный параметр кнопкой «Найти» или исправьте известные температуры и расходы.','unbalanced');
  const d1=n.thi-n.tco,d2=n.tho-n.tci;if(d1<=0||d2<=0)throw Error('Температурные напоры противотока должны быть положительными.');
  const dt=Math.abs(d1-d2)<1e-8?(d1+d2)/2:(d1-d2)/Math.log(d1/d2),q=r.qh/1000,reservePercent=0; // Owner: test nominal duty with no UA reserve.
  return {...n,mh:r.mh,mc:r.mc,displayFlowHot:n.mh,displayFlowCold:n.mc,cph:r.cph/1000,cpc:r.cpc/1000,rhoh:r.rhoh,rhoc:r.rhoc,q,dt,unknown,flow:'counter',imbalance,heatBalanceError:r.qh-r.qc,requiredUA:r.qh/dt,reservePercent,area:null,designArea:null,u:null,method:'Teplo',projectAlgorithm:algorithm,reMin:construction.reMin,reMax:construction.reMax};
 }
 function source(state,r){
  if(state.flow!=='counter')throw Error('Методика Teplo поддерживает только противоток.');
  if(state['hot-fluid']!=='water'||state['cold-fluid']!=='water')throw Error('Для Teplo пока поддерживается вода в обоих контурах.');
  const lw=finite(state['tube-conductivity'],'теплопроводность стенки λw');if(lw<=0)throw Error('Теплопроводность стенки λw должна быть положительной.');
  return {hot_fluid:'Water',cold_fluid:'Water',t_hot_in_c:r.thi,t_cold_in_c:r.tci,p_hot_mpa:r.ph,p_cold_mpa:r.pc,hot_flow_mode:'mass',cold_flow_mode:'mass',mass_flow_hot_kg_s:r.mh,mass_flow_cold_kg_s:r.mc,wall_conductivity_w_mk:lw,arrangement:'inline'};
 }
 function geometryInput(g){return {row_count:g.rows.length,shell_inner_diameter_m:(g.diameter-2*g.shellWall)/1000,displacer_outer_diameter_m:g.coreDiameter/1000,tube_outer_diameter_m:g.tubeDiameter/1000,tube_wall_thickness_m:g.tubeWall/1000,coil_rows:g.rows.map(r=>({count:r.count,radius_m:r.diameter/2000,pitch_m:r.pitch/1000,turns:r.turns,tube_outer_diameter_m:g.tubeDiameter/1000}))}}
 // Project constraints are additional checks; the supplied Teplo stays unchanged.
 function applicability(r,target={}){
  const ignored=[],blocking=[];
  for(const c of r.coils){for(const message of c.tube_checks)blocking.push('Змеевик '+c.index+': '+message);if(target.projectAlgorithm===algorithm&&!(c.re_hot>=construction.reMin&&c.re_hot<=construction.reMax))blocking.push('Змеевик '+c.index+': требуется 15000 ≤ Re ≤ 20000; Re='+c.re_hot.toFixed(2))}
  blocking.push(...r.shell.checks);
  if(target.projectAlgorithm===algorithm&&r.rows.some(row=>row.coil_count!==r.rows[0].coil_count||row.turns!==r.rows[0].turns||Math.abs(row.pitch_m-r.rows[0].pitch_m)>1e-10))blocking.push('Коридорная компоновка на полную высоту требует одинакового числа змеевиков, витков и общего шага во всех рядах.');
  return {allowed:!blocking.length&&r.valid,ignored,blocking,fullyValid:r.valid};
 }
 function dutyAgreement(r,target){
  const excess=construction.dutyExcessFraction,tol=construction.outletNumericalToleranceC,checks=[],fraction=r.heat_duty_kw/target.q-1;
  const hotTolerance=(target.thi-target.tho)*excess,coldTolerance=(target.tco-target.tci)*excess;
  if(!Number.isFinite(fraction)||fraction < -1e-7||fraction>excess+1e-9)checks.push('Мощность должна быть от задания до +1 %; отклонение '+(fraction*100).toFixed(4)+' %.');
  if(!(r.t_hot_out_c<=target.tho+tol&&r.t_hot_out_c>=target.tho-hotTolerance-tol))checks.push('Горячий выход вне допустимого диапазона задания: '+(target.tho-hotTolerance).toFixed(4)+'…'+target.tho.toFixed(4)+' °C.');
  if(!(r.t_cold_out_c>=target.tco-tol&&r.t_cold_out_c<=target.tco+coldTolerance+tol))checks.push('Холодный выход вне допустимого диапазона задания: '+target.tco.toFixed(4)+'…'+(target.tco+coldTolerance).toFixed(4)+' °C.');
  return {allowed:!checks.length,checks,fraction,hotTolerance,coldTolerance};
 }
 function meets(r,target){return applicability(r,target).allowed&&r.ua_w_k>=target.requiredUA*(1+target.reservePercent/100)*(1-1e-9)&&r.heat_duty_kw>=target.q*(1-1e-7)&&r.t_hot_out_c<=target.tho+.01&&r.t_cold_out_c>=target.tco-.01&&(target.projectAlgorithm!==algorithm||dutyAgreement(r,target).allowed)}
 function shellSizing(diameter,absolutePressure){
  const d=finite(diameter,'наружный диаметр корпуса'),p=finite(absolutePressure,'абсолютное давление межтрубного пространства'),gaugeMPa=p-construction.atmosphereMPa;
  if(d<=0||gaugeMPa<=0)throw Error('Для предварительной толщины корпуса нужно положительное избыточное межтрубное давление: pабс > 0,101325 МПа. Вакуум и внешнее давление этой формулой не проверяются.');
  const rawMM=gaugeMPa*d/(2*construction.allowableMPa*construction.weldFactor)+construction.corrosionMM,wallMM=Math.ceil(rawMM),innerMM=d-2*wallMM;
  if(innerMM<=0)throw Error('Расчётная стенка перекрывает внутренний диаметр корпуса.');
  return {outerMM:d,absoluteMPa:p,gaugeMPa,rawMM,wallMM,innerMM,...construction,formula:'s = ceil(pизб Dнар / (2 [σ] φ) + c)',preliminary:true};
 }
 function tubeSize(state){
  const [d,w]=state['refine-tubes']===true?[finite(state['tube-diameter'],'диаметр трубы'),finite(state['tube-wall'],'стенку трубы')]:[14,2.5];
  if(w<=0||d<=2*w||d>100)throw Error('Проверьте диаметр и стенку трубки.');
  return {d,w,di:d-2*w};
 }
 function tubeCounts(state,target,props){
  const {di}=tubeSize(state),mu=props('VISCOSITY','T',(target.thi+target.tho)/2+273.15,'P',target.ph*1e6,'Water');
  if(!Number.isFinite(mu)||mu<=0)throw Error('CoolProp: недопустимая вязкость');
  const factor=4*target.mh/(Math.PI*di/1000*mu),min=Math.max(1,Math.ceil(factor/construction.reMax)),max=Math.min(500,Math.floor(factor/construction.reMin));
  const selected=min<=max?Math.max(min,Math.min(max,Math.round(factor/17500))):null;
  // Keep the preferred count, with at most four bounded reserve counts. Actual
  // Re is always checked by the unchanged full verification.
  const range={target:{min,max},min,max,selected,estimatedRe:selected?factor/selected:null,counts:selected?[selected]:[],fallbackCounts:[]};
  range.fallbackCounts=inlineReserveCounts(state,range,factor);return range;
 }
 function inlineReserveCounts(state,range,factor){
  if(!range.selected)return [];
  const {d,di}=tubeSize(state),height=Number(state.length),diameter=Number(state['exchanger-diameter']),pressure=Number(state.pc),gap=construction.gapMM;
  if(!Number.isFinite(height)||!Number.isFinite(diameter)||height<=d||diameter<=0||!(pressure>construction.atmosphereMPa))return [];
  const inside=shellSizing(diameter,pressure).innerMM,firstMin=Math.floor(Math.max(3*di,(d+2*gap+4)/2))+1,lastMax=Math.min(12*di-1e-7,(inside-d-2*gap)/2),spacing=d+gap,eligible=new Set();
  // Derive a few multiples of each row count. No heat calculations or geometry
  // catalogue per N: capacity and height bounds are analytic at the largest
  // permitted inner radius on the existing grid.
  for(let rows=1;rows<=construction.maxRows;rows++){
   const upper=lastMax-(rows-1)*spacing,first=firstMin+Math.floor((upper-firstMin)/construction.radiusStepMM)*construction.radiusStepMM;if(first<firstMin)continue;
   const chord=Math.floor(Math.PI/Math.asin(Math.min(1,spacing/(2*first)))),span=height-d;
   const axial=Math.floor(span/(spacing*Math.sqrt(1+(span/(2*Math.PI*first))**2))+1e-10);
   const min=Math.max(1,Math.ceil(range.min/rows)),max=Math.min(64,chord,axial,Math.floor(range.max/rows));if(min>max)continue;
   const preferred=Math.max(min,Math.min(max,Math.round(range.selected/rows)));
   for(const count of [preferred,preferred-1,preferred+1,min,max])if(count>=min&&count<=max){const n=count*rows;if(n!==range.selected)eligible.add(n)}
  }
  const score=n=>Math.abs(factor/n-17500),ordered=[...eligible].sort((a,b)=>score(a)-score(b)||a-b);
  // Retain feasible old choices, then fill vacant slots with compatible counts.
  // Previously empty slots were wasted on primes that cannot form radial rows.
  const reserves=[...new Set([range.selected-1,range.selected+1,range.min,range.max])].filter(n=>eligible.has(n));
  for(const n of ordered)if(reserves.length<4&&!reserves.includes(n))reserves.push(n);
  range.reserveOrder=[...reserves,...ordered.filter(n=>!reserves.includes(n))];
  return reserves.slice(0,4);
 }
 function families(state,target,props,counts=null){
  const {d,w,di}=tubeSize(state),maxHeight=finite(state.length,'предельную длину'),maxDiameter=finite(state['exchanger-diameter'],'предельный диаметр');
  if(maxHeight<200||maxHeight>10000||maxDiameter<200||maxDiameter>3000)throw Error('Границы подбора: L 200…10 000 мм, D 200…3 000 мм.');
  const limit=shellSizing(maxDiameter,state.pc),range=tubeCounts(state,target,props),list=[],seen=new Set(),gap=construction.gapMM;
  const minR=Math.floor(Math.max(3*di,(d+2*gap+4)/2))+1,maxR=Math.min(12*di-1e-7,(limit.innerMM-d-2*gap)/2);
  for(const n of counts??range.counts){if(n<range.min||n>range.max||!Number.isInteger(n))continue;const spacing=d+gap;
   for(let nr=1;nr<=Math.min(construction.maxRows,n);nr++){
    if(n%nr!==0||n/nr>64)continue;
    for(let first=minR;first+(nr-1)*spacing<=maxR;first+=construction.radiusStepMM){
     const radii=Array.from({length:nr},(_,i)=>first+i*spacing);
     const capacities=radii.map(r=>Math.min(64,Math.floor(Math.PI/Math.asin(Math.min(1,(d+gap)/(2*r))))));
     {
      const counts=radii.map(()=>n/nr);if(counts.some((count,i)=>count>capacities[i]))continue;
      const key=radii.join(',')+';'+counts.join(',');if(seen.has(key))continue;seen.add(key);
      const rows=radii.map((r,i)=>{const q=counts[i]*(d+gap)/(2*Math.PI*r);return {diameter:2*r,count:counts[i],minPitch:q<1?counts[i]*(d+gap)/Math.sqrt(1-q*q):Infinity}});
      if(rows.some(r=>!Number.isFinite(r.minPitch)||r.minPitch+d>maxHeight))continue;
      let diameter=Math.ceil(2*radii.at(-1)+d+2*gap),shell;
      while(diameter<=maxDiameter){shell=shellSizing(diameter,state.pc);if(shell.innerMM+1e-9>=2*radii.at(-1)+d+2*gap)break;diameter++}
      if(diameter>maxDiameter)continue;
      const minimum=Math.max(...rows.map(r=>r.minPitch+d));
      list.push({rows,n,diameter,shell,minimum,coreDiameter:2*radii[0]-d-2*gap,d,w});
     }
    }
   }
  }
  list.sort((a,b)=>a.diameter-b.diameter||a.n-b.n);
  return {list,range,maxHeight,maxDiameter};
 }
 function rowAtHeight(spec,height,d,cap){
  const span=height-d,bend=2*d,straight=Math.max(40,2*d),circ=Math.PI*spec.diameter;
  for(const stock of [6000,3000,1000].filter(s=>s<=cap)){
   let turns=Math.min(construction.maxTurns,Math.floor(span/spec.minPitch+1e-10),Math.floor(Math.sqrt(Math.max(0,(stock-2*straight)**2-span**2))/circ));
   for(;turns>=1;turns--){
    const row={diameter:spec.diameter,count:spec.count,turns,pitch:span/turns,offset:0,phase:0,direction:'right',hidden:false};
    // Cheap screen, followed by exactly the same 256-step integral as the 3D.
    const estimate=manufacturing.lengthFast(row,bend,straight);
    if(!Number.isFinite(estimate)||estimate>=stock+.1)continue;
    if(estimate<stock*.8-.1)break;
    let m;try{m=manufacturing.measure(row,bend,straight)}catch{continue}
    if(m.totalMM>=stock-1e-7)continue;
    if(m.totalMM<stock*.8-1e-7)break;
    return {row,stockMM:stock,...m,wasteMM:stock-m.totalMM,wasteFraction:(stock-m.totalMM)/stock};
   }
  }
  return null;
 }
 function compactGeometry(f,height,cap){
  if(height<f.minimum)return null;
  const span=height-f.d,capAt=i=>Array.isArray(cap)?cap[i]:cap,minPitch=Math.max(...f.rows.map(row=>row.minPitch));
  const straight=Math.max(40,2*f.d),bend=2*f.d;
  const bound=Math.min(construction.maxTurns,Math.floor(span/minPitch+1e-10),...f.rows.map((row,i)=>Math.floor(Math.sqrt(Math.max(0,(capAt(i)-2*straight)**2-span**2))/(Math.PI*row.diameter))));
  let lengths=null;
  // One common integer turn count and pitch: both ends of EVERY winding are
  // on the same levels. Stock constraints must never shorten individual rows.
  for(let turns=bound;turns>=1;turns--){
   const pitch=span/turns;
   const trial=f.rows.map((spec,i)=>{
    const row={diameter:spec.diameter,count:spec.count,turns,pitch,offset:0,phase:0,direction:'right',hidden:false},estimate=manufacturing.lengthFast(row,bend,straight);
    if(![1000,3000,6000].some(stock=>stock<=capAt(i)&&estimate>=stock*.8-.1&&estimate<stock+.1))return null;
    let measured;try{measured=manufacturing.measure(row,bend,straight)}catch{return null}
    const stock=manufacturing.stockFor(measured.totalMM);if(!stock||stock>capAt(i))return null;
    return {row,stockMM:stock,...measured,wasteMM:stock-measured.totalMM,wasteFraction:(stock-measured.totalMM)/stock};
   });
   if(trial.every(Boolean)){lengths=trial;break}
  }
  if(!lengths)return null;
  const geometry=buildGeometry(f,height,lengths.map(m=>m.row));
  if(!geometry)return null;
  return {geometry,lengths:lengths.map(({row,...m},i)=>({row:i+1,count:row.count,...m}))};
 }
 function buildGeometry(f,height,rows){
  const winding=rows.reduce((sum,row)=>sum+row.count*row.turns*Math.hypot(Math.PI*row.diameter,row.pitch),0);
  if(f.d**2*winding>=(f.shell.innerMM**2-f.coreDiameter**2)*height)return null;
  const gap=construction.gapMM;
  return {diameter:f.diameter,height,shellWall:f.shell.wallMM,coreDiameter:f.coreDiameter,coreLength:height,coreWall:2,tubeDiameter:f.d,tubeWall:f.w,clearance:gap,coreClearance:gap,shellClearance:gap,rowClearance:gap,leadBendRadius:2*f.d,leadStraightLength:Math.max(40,2*f.d),rows};
 }
 function rowAtPitch(spec,pitch,maxTurns,d,cap){
  if(pitch<spec.minPitch-1e-9)return null;
  const bend=2*d,straight=Math.max(40,2*d),unit=Math.hypot(Math.PI*spec.diameter,pitch);
  for(const stock of [6000,3000,1000].filter(s=>s<=cap)){
   const limit=Math.min(construction.maxTurns,maxTurns,Math.floor((stock-2*straight)/unit));
   for(let turns=limit;turns>=1;turns--){
    const row={diameter:spec.diameter,count:spec.count,turns,pitch,offset:0,phase:0,direction:'right',hidden:false};
    const estimate=manufacturing.lengthFast(row,bend,straight);if(!Number.isFinite(estimate)||estimate>=stock+.1)continue;if(estimate<stock*.8-.1)break;
    let m;try{m=manufacturing.measure(row,bend,straight)}catch{continue}
    if(m.totalMM>=stock-1e-7)continue;if(m.totalMM<stock*.8-1e-7)break;
    return {row,stockMM:stock,...m,wasteMM:stock-m.totalMM,wasteFraction:(stock-m.totalMM)/stock};
   }
  }
  return null;
 }
 function inlineLayout(g){
  const first=g?.rows?.[0],checks=[];
  if(!first)return {allowed:false,checks:['Не заданы ряды змеевиков.']};
  for(const [i,row]of g.rows.entries()){
   if(row.count!==first.count||row.turns!==first.turns||Math.abs(row.pitch-first.pitch)>1e-7||Math.abs(row.offset??0)>1e-7||Math.abs((row.phase??0)-(first.phase??0))>1e-7||(row.direction??'right')!==(first.direction??'right'))checks.push('Ряд '+(i+1)+': нужны одинаковые число змеевиков и витков, шаг, начальный угол и направление, нулевое смещение; все навивки должны занимать полную рабочую высоту.');
   if(Number.isFinite(g.height)&&Number.isFinite(g.tubeDiameter)&&Math.abs((row.offset??0)+row.turns*row.pitch+g.tubeDiameter-g.height)>1e-7)checks.push('Ряд '+(i+1)+': навивка должна доходить до нижнего края рабочей высоты корпуса.');
  }
  return {allowed:!checks.length,checks,axialPitchMM:first.pitch/first.count};
 }
 function compare(a,b){return a.geometry.height-b.geometry.height||a.geometry.diameter-b.geometry.diameter||a.wasteMM-b.wasteMM||a.n-b.n}
 // A single property evaluation at the assignment means is used ONLY to rank
 // geometries. No iterative Teplo call, constant K or acceptance in this screen.
 function screeningModel(state,target,props){
  const th=(target.thi+target.tho)/2,tc=(target.tci+target.tco)/2,tw=(th+tc)/2;
  const prop=(name,t,p)=>props(name,'T',t+273.15,'P',p*1e6,'Water');
  const hot={mu:prop('VISCOSITY',th,target.ph),pr:prop('PRANDTL',th,target.ph),lambda:prop('CONDUCTIVITY',th,target.ph)},cold={mu:prop('VISCOSITY',tc,target.pc),pr:prop('PRANDTL',tc,target.pc),lambda:prop('CONDUCTIVITY',tc,target.pc)};
  const eh=(hot.pr/prop('PRANDTL',tw,target.ph))**.25,ec=(cold.pr/prop('PRANDTL',tw,target.pc))**.25,lw=Number(state['tube-conductivity']),inline=true;
  return g=>{
   const d=g.tubeDiameter/1000,di=(g.tubeDiameter-2*g.tubeWall)/1000,n=g.rows.reduce((s,r)=>s+r.count,0),re=4*target.mh/(Math.PI*di*hot.mu*n);
   const annulus=Math.PI/4*(((g.diameter-2*g.shellWall)/1000)**2-(g.coreDiameter/1000)**2),free=Math.min(...g.rows.map(r=>annulus-Math.PI*r.diameter/1000*d)),rec=target.mc*d/(cold.mu*free);
   if(!(free>0))return 0;
   let area=0,weightedAngle=0,weightedHot=0;
   for(const r of g.rows){
    const length=r.turns*Math.hypot(Math.PI*r.diameter,r.pitch)/1000*r.count,f=Math.PI*(d+di)/2*length,angle=Math.atan(Math.PI*r.diameter/r.pitch)*180/Math.PI;
    const count=r.count*r.turns,b=inline?.9:.7,correction=(.6+b*Number(count>=2)+Math.max(0,count-2))/count;
    const angleCorrection=teplo.interp(angle,[10,20,30,40,50,60,70,80,90],[.42,.52,.67,.78,.88,.94,.98,1,1]);
    const ah=.021*re**.8*hot.pr**.43*(1+1.77*di/(r.diameter/2000))*eh*hot.lambda/di;
    area+=f;weightedAngle+=f*correction*angleCorrection;weightedHot+=f*ah;
   }
   const pitch=g.rows.reduce((s,r)=>s+r.pitch,0)/g.rows.length/1000,spacing=g.rows.length>1?(g.rows.at(-1).diameter-g.rows[0].diameter)/(2*(g.rows.length-1))/1000:null,ratio=spacing===null?null:spacing/pitch;
   const es=ratio===null?1:inline?ratio**.15:ratio<2?1:ratio**.167,low=rec<1000;
   const ac=(low?.56:inline?.26:.41)*rec**(low?.5:inline?.65:.6)*cold.pr**(low?.36:.33)*ec*weightedAngle/area*(low?1:es)*cold.lambda/d;
   const ah=weightedHot/area,linear=Math.PI/(1/(ac*d)+Math.log(d/di)/(2*lw)+1/(ah*di));
   return linear*area/(Math.PI*(d+di)/2);
  };
 }
 async function shortlist(search,state,target,props,stats,hooks){
  const estimate=screeningModel(state,target,props),pool=[],seen=new Set(),required=target.requiredUA*(1+target.reservePercent/100);
  for(let i=0;i<search.list.length;i++){
   const f=search.list[i];
   for(const cap of [1000,3000,6000]){
    const heights=new Set([Math.ceil(f.minimum),Math.floor(search.maxHeight)]);
    for(const utilization of [.82,.9,.98]){
     const rowHeights=f.rows.map(row=>{
      const available=cap*utilization-2*Math.max(40,2*f.d)-Math.PI*2*f.d;
      const turns=Math.max(1,Math.floor(available/Math.hypot(Math.PI*row.diameter,row.minPitch)));
      return Math.ceil(turns*row.minPitch+f.d);
     });
     for(const h of rowHeights){heights.add(h);heights.add(h+10)}
     heights.add(Math.max(...rowHeights));
    }
    for(const height of heights){
     if(height<f.minimum||height>search.maxHeight)continue;
     stats.geometryChecks++;const layout=compactGeometry(f,height,cap);if(!layout)continue;
     const key=JSON.stringify(geometryInput(layout.geometry));if(seen.has(key))continue;seen.add(key);
     const ua=estimate(layout.geometry);if(!Number.isFinite(ua)||ua<=0)continue;
     pool.push({...layout,f,cap,estimatedUA:ua,ratio:ua/required});
    }
   }
   if(i%4===0){hooks.progress?.({...stats,accepted:0,phase:'screening'});await(hooks.yield?.()??Promise.resolve());if(hooks.cancelled?.())return null}
  }
  // First prefer likely sufficient geometries with a moderate UA margin.
  // This is a heuristic screen, not a proof or a thermal result for the UI.
  pool.sort((a,b)=>{
   const penalty=c=>Math.abs(Math.log(c.ratio/1.005));
   return penalty(a)-penalty(b)||a.geometry.height-b.geometry.height||a.geometry.diameter-b.geometry.diameter;
  });
  return pool;
 }
 async function select(state,target,props,hooks={}){
  if(hooks.cancelled?.())return null;
  const singleCoil=state['single-coil']===true;
  const base=source(state,target),search=families(state,target,props,singleCoil?[1]:null),stats={families:search.list.length,evaluations:0,errors:0,inapplicable:0,insufficient:0,geometryChecks:0,tubeCount:singleCoil?1:search.range.selected,maxEvaluations:construction.maxEvaluations,phases:{},testedCounts:[]},attempts=[];
  const pool=singleCoil?[]:await shortlist(search,state,target,props,stats,hooks);if(!pool||hooks.cancelled?.())return null;
  const estimate=screeningModel(state,target,props),required=target.requiredUA,seen=new Set(),records=[],localCache=new Map();
  let best=null,firstSuccess=null,fallbackPool=[],outsideBest=null,singleScreened=0;
  const key=l=>JSON.stringify(geometryInput(l.geometry));
  const familyKey=l=>l.f.n+'|'+JSON.stringify(l.f.rows)+'|'+l.lengths.map(m=>m.stockMM).join(',');
  const waste=l=>l.lengths.reduce((s,m)=>s+m.wasteMM*m.count,0);
  const improves=l=>!best||compare({geometry:l.geometry,wasteMM:l.lengths?waste(l):0,n:l.f.n},best)<0;
  const available=()=>!hooks.cancelled?.()&&stats.evaluations<construction.maxEvaluations;
  // Only order estimates are calibrated. No predicted value can accept a design.
  function calibration(){
   const near=[...records].sort((a,b)=>Math.abs(Math.log(a.thermal.ua_w_k/required))-Math.abs(Math.log(b.thermal.ua_w_k/required))).slice(0,10);
   const factors=near.map(r=>r.thermal.ua_w_k/r.layout.estimatedUA).filter(v=>Number.isFinite(v)&&v>0).sort((a,b)=>a-b);
   return factors.length?factors[Math.floor(factors.length/2)]:1;
  }
  async function verify(layout,phase,diagnostic=false){
   if(!available()||seen.has(key(layout))||!inlineLayout(layout.geometry).allowed)return false;
   seen.add(key(layout));const f=layout.f,g=layout.geometry;stats.evaluations++;stats.phases[phase]=(stats.phases[phase]||0)+1;
   if(!stats.testedCounts.includes(f.n))stats.testedCounts.push(f.n);
   try{
    const thermal=teplo.calculate({...base,...geometryInput(g)},props),check=applicability(thermal,target),accepted=meets(thermal,target);
    records.push({layout,thermal});
    if(!check.allowed)stats.inapplicable++;else if(!accepted)stats.insufficient++;
    attempts.push({height:g.height,diameter:g.diameter,count:f.n,phase,accepted:accepted&&!diagnostic,diagnostic,dutyRatio:thermal.heat_duty_kw/target.q,uaRatio:thermal.ua_w_k/required,estimatedRatio:layout.ratio,blocking:check.blocking.slice(0,3)});
    if(accepted){
     const totalLength=thermal.coils.reduce((s,c)=>s+c.length_m,0),wasteMM=layout.lengths.reduce((s,l)=>s+l.wasteMM*l.count,0);
     const c={kind:'coil',geometry:g,shellCalculation:f.shell,length:g.height/1000,diameter:g.diameter/1000,dmm:f.d,wmm:f.w,n:f.n,rowCount:g.rows.length,totalTurns:g.rows.reduce((s,r)=>s+r.turns*r.count,0),area:thermal.area_m2,externalArea:Math.PI*f.d/1000*totalLength,totalLength,manufacturing:layout.lengths,wasteMM,thermal,thermalSource:base,ignoredCriteria:[]};
     if(singleCoil)c.stockLimitWaived=true;
     if(diagnostic){if(!outsideBest||compare(c,outsideBest)<0)outsideBest=c}
     else{if(firstSuccess===null)firstSuccess=stats.evaluations;if(!best||compare(c,best)<0)best=c}
    }
   }catch(error){stats.errors++;attempts.push({height:g.height,diameter:g.diameter,count:f.n,phase,error:error.message})}
   hooks.progress?.({...stats,accepted:best?1:0,phase});
   await(hooks.yield?.()??Promise.resolve());return true;
  }
  async function batch(candidates,count,phase,ordered=false){
   let choices=candidates.filter(l=>!seen.has(key(l))&&improves(l));
   if(ordered){const factor=calibration();choices.sort((a,b)=>Math.abs(Math.log(a.ratio*factor/1.005))-Math.abs(Math.log(b.ratio*factor/1.005))||a.geometry.height-b.geometry.height||a.geometry.diameter-b.geometry.diameter)}
   let calls=0;for(const l of choices){if(!available()||calls>=count)break;if(!improves(l))continue;if(await verify(l,phase))calls++}
  }
  // Local, bounded geometry sampling around promising catalogue points. Integer
  // turns, complete stock lengths and every original geometry rule still apply.
  async function refine(count){
   const end=Math.min(construction.maxEvaluations,stats.evaluations+count);
   while(available()&&stats.evaluations<end){
    const factor=calibration(),seeds=[],familiesSeen=new Set();
    const ordered=[...records].sort((a,b)=>Math.abs(Math.log(a.thermal.ua_w_k/required))-Math.abs(Math.log(b.thermal.ua_w_k/required)));
    function seed(layout,scale){const k=familyKey(layout);if(familiesSeen.has(k))return;familiesSeen.add(k);seeds.push({layout,scale})}
    for(const r of ordered){seed(r.layout,r.thermal.ua_w_k/r.layout.estimatedUA);if(seeds.length>=6)break}
    const raw=[...pool,...fallbackPool].sort((a,b)=>Math.abs(Math.log(a.ratio*factor/1.005))-Math.abs(Math.log(b.ratio*factor/1.005)));
    for(const l of raw){seed(l,factor);if(seeds.length>=10)break}
    let queue=[];
    for(const [seedIndex,{layout,scale}]of seeds.entries()){
     if(hooks.cancelled?.())return;
     // Retain each row's actual stock ceiling: a 1-m row must not suddenly
     // jump to a 3-m blank when a tiny height change makes it fit.
     const h=layout.geometry.height,span=Math.min(500,Math.max(160,Math.ceil(h*.15))),step=Math.max(2,Math.floor(span/60)),cap=layout.lengths.map(m=>m.stockMM);
     const local=[];
     function at(height){
      if(height<layout.f.minimum||height>search.maxHeight)return;
      const ck=familyKey(layout)+'|'+height;let l=localCache.get(ck);
      if(l===undefined){stats.geometryChecks++;const compact=compactGeometry(layout.f,height,cap);const ua=compact?estimate(compact.geometry):0;l=compact&&Number.isFinite(ua)&&ua>0?{...compact,f:layout.f,cap,estimatedUA:ua,ratio:ua/required}:null;localCache.set(ck,l)}
      if(l&&!seen.has(key(l))&&improves(l))local.push({l,penalty:Math.abs(Math.log(l.ratio*scale/1.003))});
     }
     for(let delta=-span;delta<=span;delta+=step)at(Math.round(h+delta));
     local.sort((a,b)=>a.penalty-b.penalty||a.l.geometry.height-b.l.geometry.height);
     const centre=local[0]?.l.geometry.height;if(centre!==undefined)for(let d=-step;d<=step;d++)at(centre+d);
     local.sort((a,b)=>a.penalty-b.penalty||a.l.geometry.height-b.l.geometry.height);
     queue.push(...local.slice(0,3).map((candidate,slot)=>({...candidate,slot,seedIndex})));
    }
    // Give each promising family a turn. A very accurate-looking estimate for
    // one family must not starve a measured near miss in another family.
    queue.sort((a,b)=>a.slot-b.slot||a.seedIndex-b.seedIndex||a.penalty-b.penalty);
    const before=stats.evaluations;
    for(const {l}of queue){if(!available()||stats.evaluations>=end||stats.evaluations-before>=8)break;if(improves(l))await verify(l,'refinement')}
    if(before===stats.evaluations)break;
    await(hooks.yield?.()??Promise.resolve());
   }
  }
  if(singleCoil){
   let options=[];
   for(const f of search.list){
    const spec=f.rows[0],maxHeight=Math.floor(search.maxHeight);
    const maxTurns=Math.min(construction.maxTurns,Math.floor((maxHeight-f.d)/spec.minPitch));
    for(let turns=1;turns<=maxTurns;turns++){
     const minHeight=Math.ceil(f.d+turns*spec.minPitch);
     const sample=height=>{
      stats.geometryChecks++;
      const row={diameter:spec.diameter,count:1,turns,pitch:(height-f.d)/turns,offset:0,phase:0,direction:'right',hidden:false};
      const geometry=buildGeometry(f,height,[row]);if(!geometry)return null;
      const estimatedUA=estimate(geometry),ratio=estimatedUA/required;
      if(!Number.isFinite(ratio)||ratio<=0)return null;
      const layout={geometry,f,estimatedUA,ratio};
      if(ratio>=.85&&ratio<=1.15)options.push(layout);
      return layout;
     };
     const heights=[...new Set([minHeight,Math.round((minHeight+maxHeight)/2),maxHeight])];
     const samples=heights.map(sample);
     // Interpolate promising pitches at a fixed turn count. Verification still uses Teplo.
     for(let i=1;i<samples.length;i++){
      const a=samples[i-1],b=samples[i];if(!a||!b||a.ratio===b.ratio)continue;
      for(const ratio of [.98,1.005,1.03]){
       const fraction=(ratio-a.ratio)/(b.ratio-a.ratio);
       if(fraction>0&&fraction<1)sample(Math.round(heights[i-1]+fraction*(heights[i]-heights[i-1])));
      }
     }
    }
    await(hooks.yield?.()??Promise.resolve());if(hooks.cancelled?.())return null;
   }
   // Keep all complete checks in the shared budget. Measure leads only for
   // candidates sent to Teplo, because stock lengths do not screen this mode.
   singleScreened=options.length;
   while(available()&&options.length){
    options=options.filter(layout=>!seen.has(key(layout))&&improves(layout));
    if(!options.length)break;
    const factor=calibration();
    const penalty=layout=>Math.abs(Math.log(layout.ratio*factor/1.005));
    options.sort((a,b)=>penalty(b)-penalty(a)||b.geometry.height-a.geometry.height||b.geometry.diameter-a.geometry.diameter);
    const layout=options.pop(),g=layout.geometry;
    let measured;
    try{measured=manufacturing.measure(g.rows[0],g.leadBendRadius,g.leadStraightLength)}catch{continue}
    layout.lengths=[{row:1,count:1,...measured,stockMM:null,wasteMM:null,wasteFraction:null}];
    await verify(layout,'single-coil');
   }
  }else{
   await batch(pool,construction.firstBatch,'initial');
   await refine(24);
   // Preserve broad discovery, then reserve calls for actual local improvement.
   await batch(pool,60,'catalogue',!!best);
   await refine(24);
   if(!best&&available()&&search.range.fallbackCounts.length){
    const groups=[],factor=calibration();stats.reserveScreenedCounts=[];
    for(const n of search.range.reserveOrder??search.range.fallbackCounts){
     if(hooks.cancelled?.())return null;
     const fallback=families(state,target,props,[n]);stats.families+=fallback.list.length;stats.reserveScreenedCounts.push(n);
     const candidates=await shortlist(fallback,state,target,props,stats,hooks);if(!candidates||hooks.cancelled?.())return null;
     // Full-height stock compatibility is coupled across ALL radii. An N with
     // no complete manufacturable layout must not occupy a thermal reserve slot.
     if(candidates.length){const score=Math.min(...candidates.map(l=>Math.abs(Math.log(l.ratio*factor/1.005))));groups.push({n,candidates,score})}
    }
    // Wide allowed dimensions can make a poor N manufacturable only as a long
    // apparatus. Rank complete catalogues cheaply before assigning the four
    // thermal slots, so those long layouts do not hide a suitable shorter N.
    groups.sort((a,b)=>a.score-b.score||Math.abs(a.n-search.range.selected)-Math.abs(b.n-search.range.selected));
    const selected=groups.slice(0,4);search.range.fallbackCounts=selected.map(g=>g.n);fallbackPool=selected.flatMap(g=>g.candidates);
    await batch(fallbackPool,24,'fallback',true);
    await refine(16);
   }
   // First success is a starting point, not an early exit. Verify promising
   // shorter candidates (then smaller diameter) with the remaining shared budget.
   await batch([...pool,...fallbackPool],Math.max(0,construction.maxEvaluations-stats.evaluations-16),best?'improvement':'catalogue',!!best);
   await refine(16);
   if(!best)await batch([...pool,...fallbackPool],construction.maxEvaluations,'catalogue',true);
   // A dimension error needs a verified counterexample outside the requested
   // envelope, not a guess from an approximate UA. Use only spare calls from
   // the SAME 200-call budget, and never install this diagnostic geometry.
   if(!best&&available()&&(search.maxHeight<10000||search.maxDiameter<3000)){
    const expanded={...state,length:Math.min(10000,Math.max(search.maxHeight+500,Math.ceil(search.maxHeight*1.5/100)*100)),'exchanger-diameter':Math.min(3000,Math.max(search.maxDiameter+100,Math.ceil(search.maxDiameter*1.5/100)*100))};
    const counts=[search.range.selected,...stats.testedCounts].filter((n,i,all)=>n&&all.indexOf(n)===i);
    const relaxed=families(expanded,target,props,counts),catalogue=await shortlist(relaxed,expanded,target,props,stats,hooks);
    if(!catalogue||hooks.cancelled?.())return null;
    const outside=l=>l.geometry.height>search.maxHeight||l.geometry.diameter>search.maxDiameter;
    const options=catalogue.filter(outside),seeded=new Set(),factor=calibration();
    for(const f of relaxed.list)for(const extra of [100,200,500]){
     const height=search.maxHeight+extra;if(height>relaxed.maxHeight)continue;
     stats.geometryChecks++;const compact=compactGeometry(f,height,6000);if(!compact||!outside(compact))continue;
     const ua=estimate(compact.geometry);if(ua>0&&Number.isFinite(ua))options.push({...compact,f,cap:6000,estimatedUA:ua,ratio:ua/required});
    }
    for(const layout of [...options].sort((a,b)=>Math.abs(Math.log(a.ratio*factor/1.005))-Math.abs(Math.log(b.ratio*factor/1.005)))){
     const fk=familyKey(layout);if(seeded.has(fk))continue;if(seeded.size>=6)break;seeded.add(fk);
     const cap=layout.lengths.map(m=>m.stockMM),h=layout.geometry.height;
     for(let height=Math.max(Math.ceil(layout.f.minimum),Math.round(h-500));height<=Math.min(relaxed.maxHeight,h+500);height+=10){
      stats.geometryChecks++;const compact=compactGeometry(layout.f,height,cap);if(!compact||!outside(compact))continue;
      const ua=estimate(compact.geometry);if(ua>0&&Number.isFinite(ua))options.push({...compact,f:layout.f,cap,estimatedUA:ua,ratio:ua/required});
     }
    }
    const end=Math.min(construction.maxEvaluations,stats.evaluations+24);
    while(available()&&stats.evaluations<end){
     const scale=calibration();options.sort((a,b)=>Math.abs(Math.log(a.ratio*scale/1.005))-Math.abs(Math.log(b.ratio*scale/1.005))||a.geometry.height-b.geometry.height);
     const layout=options.find(l=>!seen.has(key(l))&&(!outsideBest||compare({geometry:l.geometry,wasteMM:waste(l),n:l.f.n},outsideBest)<0));if(!layout)break;
     await verify(layout,'diagnosis',true);
    }
   }
  }
  if(hooks.cancelled?.())return null;
  const stopped=best?(stats.evaluations===construction.maxEvaluations?'budget-success':'improved-success'):stats.evaluations===construction.maxEvaluations?'budget-exhausted':'catalogue-exhausted';
  const result={kind:'coil',inputKey:JSON.stringify([algorithm,state,target.requiredUA]),algorithm,rows:[],candidates:best?[best]:[],attempts,stats,shellCalculation:best?.shellCalculation??null,countRange:search.range,searchGrid:{radiusMM:construction.radiusStepMM,radialGapMM:construction.gapMM,tubeCounts:stats.testedCounts,allocation:'equal starts per row; common pitch and phase',height:singleCoil?'single winding pitch samples':'stock-derived events + bounded local refinement'},searchBudget:{firstBatch:construction.firstBatch,maxEvaluations:construction.maxEvaluations,screened:singleCoil?singleScreened:pool.length+fallbackPool.length,stopped,firstSuccess},message:''};
  if(best){result.rows=[{...profiles[0],design:best}];result.message='Проверено '+stats.evaluations+' из максимум 200. Подобрано '+best.n+' трубок, '+best.rowCount+' ряд(а). Мощность от задания до +1 %, выходы в допуске; запас UA 0 %. Лучшая длина, затем диаметр среди проверенных вариантов. Re 15000…20000; 3 < R/dᵢ < 12; остаток ≤20 %; зазор 3 мм.'}
  else result.message=stopped==='budget-exhausted'?'Достигнут лимит 200 проверок Teplo. Подходящий вариант не найден; это не доказывает отсутствие решения.':'Нет конструкции в сокращённом наборе компоновок. '+(!search.range.counts.length?'Нет целого числа трубок для предварительного Re 15000…20000.':'Предварительно выбрано '+search.range.selected+' трубок. Итоговые Re, заготовки или тепловое задание не выполнены.');
  result.dimensionWitness=outsideBest?{geometry:outsideBest.geometry,manufacturing:outsideBest.manufacturing,q:outsideBest.thermal.heat_duty_kw,hot:outsideBest.thermal.t_hot_out_c,cold:outsideBest.thermal.t_cold_out_c,re:outsideBest.thermal.coils[0].re_hot,shellRe:outsideBest.thermal.shell.re_cold,valid:outsideBest.thermal.valid}:null;
  result.notifications=selectionNotifications(result,state,target,outsideBest);
  if(singleCoil){
   if(best)result.message='Подобран один змеевик. Полная длина трубы '+(best.manufacturing[0].totalMM/1000).toLocaleString('ru-RU',{maximumFractionDigits:2})+' м. Тепловое задание и критерии Teplo выполнены.';
   else{
    const reOutside=search.range.min>1||search.range.max<1;
    result.message=reOutside
     ?'Один змеевик не подходит по числу Рейнольдса для заданного расхода. Выключите настройку «Только один змеевик».'
     :'В текущих габаритах вариант с одним змеевиком не найден. Увеличьте габаритную длину или выключите настройку «Только один змеевик».';
    result.notifications=[{level:'warning',code:'single-coil-unavailable',text:result.message},...result.notifications.filter(item=>item.code==='search-limit')];
   }
  }
  return result;
 }
 function selectionNotifications(result,state,target,outsideBest=null){
  if(result.rows.length)return [];
  const messages=[],add=(level,code,text)=>messages.push({level,code,text}),format=n=>Number(n).toLocaleString('ru-RU',{maximumFractionDigits:2});
  if(outsideBest){
   if(outsideBest.geometry.height>Number(state.length))add('error','length-limit','Превышена габаритная длина: найден вариант '+format(outsideBest.geometry.height)+' мм при пределе '+format(state.length)+' мм.');
   if(outsideBest.geometry.diameter>Number(state['exchanger-diameter']))add('error','diameter-limit','Превышен габаритный диаметр: найден вариант Ø'+format(outsideBest.geometry.diameter)+' мм при пределе Ø'+format(state['exchanger-diameter'])+' мм.');
   return messages;
  }
  if(!result.countRange.counts.length)add('error','tube-count','Нельзя подобрать целое число трубок для Re 15 000…20 000 при заданном расходе.');
  else{
   add('error','no-design','Подходящая конструкция не найдена при заданных условиях.');
   const checked=result.attempts.filter(a=>!a.error&&!a.blocking?.length&&!a.diagnostic),ratios=checked.map(a=>a.dutyRatio).filter(Number.isFinite);
   if(ratios.length&&Math.max(...ratios)<1)add('warning','duty-shortage','Проверенным вариантам не хватает мощности: максимум '+format(Math.max(...ratios)*target.q)+' из '+format(target.q)+' кВт.');
   else if(ratios.length&&Math.min(...ratios)>1.01)add('warning','duty-excess','Проверенные варианты превышают допустимую мощность: разрешено от задания до +1 %.');
   else if(ratios.length)add('warning','duty-match','Проверенные варианты не прошли допуски по мощности, выходным температурам или UA.');
   else if(!result.searchBudget.screened){
    if(!result.stats.families)add('warning','layout-constraints','Не найдена компоновка с заданными габаритами, радиусом навивки и зазорами 3 мм.');
    else add('warning','layout-stock','Не найдена полная компоновка с зазорами 3 мм и остатком заготовок не более 20 %.');
   }
   const blocks=result.attempts.flatMap(a=>a.blocking||[]);
   if(blocks.some(s=>s.includes('15000 ≤ Re ≤ 20000')))add('warning','tube-re','Часть вариантов не проходит Re в трубках: требуется 15 000…20 000.');
   if(blocks.some(s=>s.includes('Re межтрубного')))add('warning','shell-re','Часть вариантов выходит за предел методики: Re межтрубного потока должен быть меньше 100 000.');
  }
  if(result.searchBudget.stopped==='budget-exhausted')add('warning','search-limit','Достигнут лимит 200 проверок. Отсутствие решения не доказано.');
  else add('warning','search-grid','Подбор выполнен по сокращённой сетке; отсутствие решения не доказано.');
  if(result.stats.errors)add('warning','verification-errors','Не удалось рассчитать '+format(result.stats.errors)+' из проверенных вариантов.');
  return messages;
 }
 return {balance,source,geometryInput,applicability,dutyAgreement,meets,shellSizing,tubeSize,tubeCounts,inlineReserveCounts,families,compactGeometry,rowAtHeight,rowAtPitch,inlineLayout,compare,screeningModel,shortlist,select,selectionNotifications,profiles,construction,algorithm};
});
