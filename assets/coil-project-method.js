/* Reverse design around the supplied Teplo verification, not a new correlation.
 * Target balance uses inlet-fixed mass and cp at arithmetic mean temperatures.
 * Candidate duty/UA/outlets and applicability always come from Teplo.calculate. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./coil-thermal-method.js'):root.CoilThermalMethod);if(typeof module==='object'&&module.exports)module.exports=api;else root.CoilProjectMethod=api})(globalThis,function(teplo){
 'use strict';
 const temperatures=['thi','tho','tci','tco'],flows=['mh','mc'],unknowns=[...temperatures,...flows];
 const profiles=[{id:'balanced',enabled:true,name:'Оптимальная конструкция',detail:'Первое выполнение задания при добавлении полновысотных рядов снаружи внутрь'},{id:'compact',enabled:false,name:'По габаритам',detail:'Временно отключено'},{id:'production',enabled:false,name:'По сложности производства',detail:'Временно отключено'}];
 const construction=Object.freeze({atmosphereMPa:.101325,allowableMPa:130,corrosionMM:.2,weldFactor:1,gapMM:3,maxRows:8,maxTurns:1000});
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
  for(const unit of Object.values(units))if(!['kg-s','kg-h','m3-h','m3-s','l-s'].includes(unit))throw Error('Неизвестная единица расхода');
  const property=(name,t,p)=>{const value=props(name,'T',t+273.15,'P',p*1e6,'Water');if(!Number.isFinite(value)||value<=0||value>1e100)throw Error('CoolProp: недопустимые свойства воды');return value};
  function mass(v,unit,t,p){if(v<=0)throw Error('Расход должен быть положительным.');return unit==='kg-s'?v:unit==='kg-h'?v/3600:v*(unit==='m3-h'?1/3600:unit==='m3-s'?1:.001)*property('Dmass',t,p)}
  function evaluate(){
   if(n.thi<=n.tho||n.tco<=n.tci)throw inputError('Горячий поток должен охлаждаться, холодный — нагреваться.',n.thi<=n.tho?['thi','tho']:['tci','tco']);
   const cph=property('Cpmass',(n.thi+n.tho)/2,n.ph),cpc=property('Cpmass',(n.tci+n.tco)/2,n.pc),mh=mass(n.mh,units.hot,n.thi,n.ph),mc=mass(n.mc,units.cold,n.tci,n.pc);
   return {cph,cpc,mh,mc,rhoh:property('Dmass',n.thi,n.ph),rhoc:property('Dmass',n.tci,n.pc),qh:mh*cph*(n.thi-n.tho),qc:mc*cpc*(n.tco-n.tci)};
  }
  if(flows.includes(unknown)){
   n[unknown]=1;const probe=evaluate(),hot=unknown==='mh',required=hot?probe.qc/(probe.cph*(n.thi-n.tho)):probe.qh/(probe.cpc*(n.tco-n.tci)),unit=hot?units.hot:units.cold,rho=hot?probe.rhoh:probe.rhoc;
   n[unknown]=unit==='kg-s'?required:unit==='kg-h'?required*3600:required/rho*(unit==='m3-h'?3600:unit==='m3-s'?1:1000);
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
  const dt=Math.abs(d1-d2)<1e-8?(d1+d2)/2:(d1-d2)/Math.log(d1/d2),q=r.qh/1000,reservePercent=finite(state['area-reserve-percent']??10,'запас');if(reservePercent<0)throw Error('Запас не может быть отрицательным.');
  return {...n,mh:r.mh,mc:r.mc,displayFlowHot:n.mh,displayFlowCold:n.mc,cph:r.cph/1000,cpc:r.cpc/1000,rhoh:r.rhoh,rhoc:r.rhoc,q,dt,unknown,flow:'counter',imbalance,heatBalanceError:r.qh-r.qc,requiredUA:r.qh/dt,reservePercent,area:null,designArea:null,u:null,method:'Teplo',ignoreRadiusRatio:true};
 }
 function source(state,r){
  if(state.flow!=='counter')throw Error('Методика Teplo поддерживает только противоток.');
  if(state['hot-fluid']!=='water'||state['cold-fluid']!=='water')throw Error('Для Teplo пока поддерживается вода в обоих контурах.');
  const lw=finite(state['tube-conductivity'],'теплопроводность стенки λw');if(lw<=0)throw Error('Теплопроводность стенки λw должна быть положительной.');
  return {hot_fluid:'Water',cold_fluid:'Water',t_hot_in_c:r.thi,t_cold_in_c:r.tci,p_hot_mpa:r.ph,p_cold_mpa:r.pc,hot_flow_mode:'mass',cold_flow_mode:'mass',mass_flow_hot_kg_s:r.mh,mass_flow_cold_kg_s:r.mc,wall_conductivity_w_mk:lw,arrangement:state['coil-thermal-inputs']?.arrangement==='staggered'?'staggered':'inline'};
 }
 function geometryInput(g){return {row_count:g.rows.length,shell_inner_diameter_m:(g.diameter-2*g.shellWall)/1000,displacer_outer_diameter_m:g.coreDiameter/1000,tube_outer_diameter_m:g.tubeDiameter/1000,tube_wall_thickness_m:g.tubeWall/1000,coil_rows:g.rows.map(r=>({count:r.count,radius_m:r.diameter/2000,pitch_m:r.pitch/1000,turns:r.turns,tube_outer_diameter_m:g.tubeDiameter/1000}))}}
 // Preserve the original Teplo flags/checks. Only the explicitly waived R/di
 // criterion is excluded from project acceptance; it never becomes "valid".
 function applicability(r,target={}){
  const ignored=[],blocking=[];
  for(const c of r.coils)for(const message of c.tube_checks){const item='Змеевик '+c.index+': '+message;(target.ignoreRadiusRatio===true&&message.startsWith('3 < R/d внутреннего диаметра < 12:')?ignored:blocking).push(item)}
  blocking.push(...r.shell.checks);
  return {allowed:!blocking.length&&(r.valid||ignored.length>0),ignored,blocking,fullyValid:r.valid};
 }
 function meets(r,target){return applicability(r,target).allowed&&r.ua_w_k>=target.requiredUA*(1+target.reservePercent/100)*(1-1e-9)&&r.heat_duty_kw>=target.q*(1-1e-7)&&r.t_hot_out_c<=target.tho+.01&&r.t_cold_out_c>=target.tco-.01}
 function shellSizing(diameter,absolutePressure){
  const d=finite(diameter,'наружный диаметр корпуса'),p=finite(absolutePressure,'абсолютное давление межтрубного пространства'),gaugeMPa=p-construction.atmosphereMPa;
  if(d<=0||gaugeMPa<=0)throw Error('Для предварительной толщины корпуса нужно положительное избыточное межтрубное давление: pабс > 0,101325 МПа. Вакуум и внешнее давление этой формулой не проверяются.');
  const rawMM=gaugeMPa*d/(2*construction.allowableMPa*construction.weldFactor)+construction.corrosionMM,wallMM=Math.ceil(rawMM),innerMM=d-2*wallMM;
  if(innerMM<=0)throw Error('Расчётная стенка перекрывает внутренний диаметр корпуса.');
  return {outerMM:d,absoluteMPa:p,gaugeMPa,rawMM,wallMM,innerMM,...construction,formula:'s = ceil(pизб Dнар / (2 [σ] φ) + c)',preliminary:true};
 }
 function sequentialGeometry(state,rowCount){
  const diameter=finite(state['exchanger-diameter'],'наружный диаметр'),height=finite(state.length,'рабочую высоту');
  if(height<200||height>10000||diameter<200||diameter>3000)throw Error('Границы подбора: L 200…10 000 мм, D 200…3 000 мм.');
  if(!Number.isInteger(rowCount)||rowCount<1||rowCount>construction.maxRows)throw Error('Редактор поддерживает от 1 до 8 рядов.');
  const [tubeDiameter,tubeWall]=state['refine-tubes']===true?[finite(state['tube-diameter'],'диаметр трубы'),finite(state['tube-wall'],'стенку трубы')]:[14,2.5];
  if(tubeWall<=0||tubeDiameter<=2*tubeWall||tubeDiameter>100)throw Error('Проверьте диаметр и стенку трубки.');
  const shell=shellSizing(diameter,state.pc),gap=construction.gapMM,outer=shell.innerMM-tubeDiameter-2*gap;
  const rows=Array.from({length:rowCount},(_,i)=>{
   const windingDiameter=outer-2*i*(tubeDiameter+gap),q=(tubeDiameter+gap)/(Math.PI*windingDiameter);
   if(windingDiameter<=0||q>=1)throw Error('Следующий ряд не помещается внутри корпуса.');
   // True normal separation >= do+gap, not merely the axial pitch.
   const minPitch=(tubeDiameter+gap)/Math.sqrt(1-q*q),turns=Math.floor((height-tubeDiameter)/minPitch);
   if(turns<1||turns>construction.maxTurns)throw Error('Полновысотная навивка требует от 1 до 1000 целых витков.');
   const pitch=(height-tubeDiameter)/turns;
   if(2*tubeDiameter>=windingDiameter/2*(1+(pitch/(Math.PI*windingDiameter))**2)*(1-1e-6))throw Error('Для следующего ряда не помещается отвод с радиусом 2d.');
   return {diameter:windingDiameter,count:1,turns,pitch,offset:0,phase:0,direction:'right',hidden:false};
  });
  const coreDiameter=rows.at(-1).diameter-tubeDiameter-2*gap;
  if(coreDiameter<=4)throw Error('Для следующего ряда нет места под вытеснительную трубу со стенкой 2 мм и зазором 3 мм.');
  const geometry={diameter,height,shellWall:shell.wallMM,coreDiameter,coreLength:height,coreWall:2,tubeDiameter,tubeWall,clearance:gap,coreClearance:gap,shellClearance:gap,rowClearance:gap,leadBendRadius:2*tubeDiameter,leadStraightLength:Math.max(40,2*tubeDiameter),rows};
  return {geometry,shell};
 }
 async function select(state,target,props,hooks={}){
  const base=source(state,target),candidates=[],attempts=[],stats={families:0,evaluations:0,errors:0,inapplicable:0,insufficient:0};
  // Validate prescribed dimensions/pressure before reporting a failed search.
  const first=sequentialGeometry(state,1);
  let stop='Достигнут предел редактора: 8 радиальных рядов.';
  for(let nr=1;nr<=construction.maxRows;nr++){
   if(hooks.cancelled?.())return null;
   let layout;
   try{layout=nr===1?first:sequentialGeometry(state,nr)}catch(error){stop=error.message;break}
   const {geometry:g,shell}=layout;
   stats.families++;stats.evaluations++;
   try{
    const thermal=teplo.calculate({...base,...geometryInput(g)},props),check=applicability(thermal,target),accepted=meets(thermal,target);
    attempts.push({rowCount:nr,accepted,duty:thermal.heat_duty_kw,ua:thermal.ua_w_k,fullyValid:thermal.valid,ignored:check.ignored,blocking:check.blocking});
    if(!check.allowed)stats.inapplicable++;else if(!accepted)stats.insufficient++;
    if(accepted){
     const totalLength=thermal.coils.reduce((sum,c)=>sum+c.length_m,0),totalTurns=g.rows.reduce((sum,r)=>sum+r.turns,0);
     candidates.push({kind:'coil',geometry:g,shellCalculation:shell,length:g.height/1000,diameter:g.diameter/1000,dmm:g.tubeDiameter,wmm:g.tubeWall,n:nr,area:thermal.area_m2,externalArea:Math.PI*g.tubeDiameter/1000*totalLength,totalLength,rowCount:nr,totalTurns,thermal,thermalSource:base,ignoredCriteria:check.ignored});
    }
   }catch(error){stats.errors++;attempts.push({rowCount:nr,accepted:false,error:error.message})}
   hooks.progress?.({...stats,accepted:candidates.length});
   await (hooks.yield?.()??Promise.resolve());
   if(hooks.cancelled?.())return null;
   if(candidates.length)break;
  }
  const result={kind:'coil',inputKey:JSON.stringify([state,target.requiredUA]),algorithm:'sequential-full-height-v1',rows:[],candidates,attempts,stats,shellCalculation:first.shell,message:''};
  const exception='Условие 3 < R/dᵢ < 12 временно исключено из отбора; исходные предупреждения Teplo сохранены. Это не полное подтверждение применимости и не расчёт прочности. Δp не рассчитывается.';
  if(!candidates.length){
   const last=attempts.at(-1),reason=last?.error||last?.blocking?.join('; ')||'Не выполнены тепловое задание или запас UA.';
   result.message='Нет конструкции в последовательности полновысотных рядов. '+stop+' '+reason+' '+exception;return result;
  }
  result.rows=[{...profiles[0],design:candidates[0]}];
  result.message='Первое выполнение задания и запаса UA '+target.reservePercent+' %: '+candidates[0].rowCount+' ряд(а), по одному полновысотному змеевику. Остальные неотключённые критерии выполнены. '+exception;
  return result;
 }
 return {balance,source,geometryInput,applicability,meets,shellSizing,sequentialGeometry,select,profiles,construction};
});
