/* Isolated experiment. Production selection and original Teplo are unchanged.
 * Conditional discovery followed by bounded material/row/size trade-offs.
 * No height catalogue: manufacture intervals and calibrated jumps in turn count. */
(function(root,factory){const common=typeof module==='object'&&module.exports,api=factory(common?require('./coil-project-method.js'):root.CoilProjectMethod,common?require('./coil-thermal-method.js'):root.CoilThermalMethod,common?require('./coil-manufacturing.js'):root.CoilManufacturing);if(common)module.exports=api;else root.CoilSequentialMethod=api})(globalThis,function(project,teplo,manufacturing){
 'use strict';
 const algorithm='condition-sequence-variable-gaps-v6';
 const selectionPolicy=Object.freeze({maxTubeIncrease:.2});
 const tubeMetres=c=>c.manufacturing.reduce((sum,t)=>sum+t.totalMM*t.count,0)/1000;
 const sizeCompare=(a,b)=>a.geometry.height-b.geometry.height||a.geometry.diameter-b.geometry.diameter||a.rowCount-b.rowCount||tubeMetres(a)-tubeMetres(b);
 function chooseDesigns(designs){
  if(!designs.length)return null;
  const simplest=[...designs].sort((a,b)=>a.rowCount-b.rowCount||sizeCompare(a,b))[0],referenceTubeM=tubeMetres(simplest),tubeLimitM=referenceTubeM*(1+selectionPolicy.maxTubeIncrease);
  const eligible=designs.filter(c=>c.rowCount===simplest.rowCount||tubeMetres(c)<=tubeLimitM+1e-9);
  return {recommended:[...eligible].sort(sizeCompare)[0],simplest,compact:[...designs].sort(sizeCompare)[0],economical:[...designs].sort((a,b)=>tubeMetres(a)-tubeMetres(b)||a.rowCount-b.rowCount||sizeCompare(a,b))[0],referenceTubeM,tubeLimitM,maxTubeIncrease:selectionPolicy.maxTubeIncrease,acceptedCount:designs.length};
 }
 // Experimental stock catalogue only. Production manufacturing remains 1/3/6 m.
 const stockLengths=Object.freeze([500,1000,1500,2000,3000,6000]);
 function stockFor(lengthMM){return stockLengths.find(stock=>lengthMM>=stock*.8-1e-7&&lengthMM<stock-1e-7)??null}
 function gapRanges(d){const values=project.axialGaps(d);return {radial:values,shell:[...values],core:[...values]}}
 function geometryGaps(g){return {radial:g.rows.slice(1).map((r,i)=>(r.diameter-g.rows[i].diameter)/2-g.tubeDiameter),shell:(g.diameter-2*g.shellWall-g.rows.at(-1).diameter-g.tubeDiameter)/2,core:(g.rows[0].diameter-g.tubeDiameter-g.coreDiameter)/2}}
 function gapGeometryAllowed(g){const r=gapRanges(g.tubeDiameter),a=geometryGaps(g),eps=1e-7;return r.shell.includes(g.shellClearance)&&r.core.includes(g.coreClearance)&&Math.abs(a.core-g.coreClearance)<eps&&a.shell>=g.shellClearance-eps&&a.shell<=r.shell.at(-1)+eps&&a.radial.every(v=>project.axialGap(g.tubeDiameter,g.tubeDiameter+v,1).allowed&&Math.abs(v-g.rowClearance)<eps)}
 const limits=Object.freeze({maxEvaluations:200,maxProposals:512,proposalsPerN:48,proposalsPerRows:24,checksPerN:32,checksPerShape:3,reserveCounts:4,improvementChecks:48,improvementShapes:2400,baseShapes:1600,gapShapes:800});
 function intersect(a,b){const out=[];for(const [x,y]of a)for(const [u,v]of b){const lo=Math.max(x,u),hi=Math.min(y,v);if(lo<=hi)out.push([lo,hi])}return out.sort((a,b)=>a[0]-b[0])}
 function turnRanges(f,pitch,maxHeight,useStock){
  const cap=Math.min(1000,Math.floor((maxHeight-f.d)/pitch+1e-10));if(cap<1)return {ranges:[],basis:[]};
  let ranges=[[1,cap]];const basis=[];
  for(const spec of f.rows){
   const row={...spec,pitch,turns:1},m=manufacturing.measure(row,2*f.d,Math.max(40,2*f.d)),unit=Math.hypot(Math.PI*spec.diameter,pitch),extra=m.bendsMM+m.straightMM;basis.push({unit,extra});
   if(useStock){const allowed=stockLengths.map(stock=>[Math.max(1,Math.ceil((stock*.8-extra-1e-7)/unit)),Math.ceil((stock-extra-1e-7)/unit)-1]).filter(([a,b])=>a<=b);ranges=intersect(ranges,allowed);if(!ranges.length)break}
  }
  return {ranges,basis};
 }
 function nextTurn(ranges,wanted,direction=0){
  if(!ranges.length)return null;
  wanted=direction<0?Math.floor(wanted):direction>0?Math.ceil(wanted):Math.round(wanted);
  const candidates=ranges.map(([a,b])=>Math.max(a,Math.min(b,wanted))).filter(n=>direction<=0||n>=wanted).filter(n=>direction>=0||n<=wanted);
  if(!candidates.length)return null;
  return candidates.sort((a,b)=>Math.abs(a-wanted)-Math.abs(b-wanted)||a-b)[0];
 }
 function makeFamily(state,target,n,nr,first,pitch,gaps={}){
  const {d,w,di}=project.tubeSize(state),{radialGap=3,shellGap=3,coreGap=3}=gaps,k=n/nr,rows=Array.from({length:nr},(_,i)=>({diameter:2*(first+i*(d+radialGap)),count:k}));
  if(![radialGap,shellGap,coreGap].every(v=>Number.isFinite(v)&&v>=0))return null;
  if(nr>1&&!project.axialGap(d,d+radialGap,1).allowed)return null;
  const coreDiameter=2*first-d-2*coreGap;if(coreDiameter<=4)return null;
  if(!Number.isInteger(k)||k<1||k>64||n>500||rows.some(r=>!(r.diameter/2/di>3&&r.diameter/2/di<12)))return null;
  for(const r of rows){const chord=k>1?r.diameter*Math.sin(Math.PI/k):Infinity,separation=pitch/k/Math.sqrt(1+(pitch/(Math.PI*r.diameter))**2);if(chord<d+3-1e-7||separation<d+1e-7)return null}
  const maxD=Number(state['exchanger-diameter']),outerRadius=rows.at(-1).diameter/2;
  let diameter=Math.ceil(2*outerRadius+d+2*shellGap),shell;
  while(diameter<=maxD){shell=project.shellSizing(diameter,state.pc);if(shell.innerMM>=2*outerRadius+d+2*shellGap-1e-9)break;diameter++}
  return diameter<=maxD?{d,w,n,rows,diameter,shell,minimum:pitch+d,coreDiameter,radialGap,shellGap,coreGap}:null;
 }
 function layoutAt(f,pitch,turns){const l=project.unrestrictedLayout(f,pitch,turns);if(l)Object.assign(l.geometry,{rowClearance:f.radialGap,coreClearance:f.coreGap,shellClearance:f.shellGap});return l}
 async function select(state,target,props,hooks={}){
  const started=performance.now(),single=state['single-coil']===true,useStock=project.stockLengthsEnabled(state),{d,di}=project.tubeSize(state),maxH=Number(state.length),maxD=Number(state['exchanger-diameter']);
  if(maxH<200||maxH>10000||maxD<200||maxD>3000)throw Error('Границы подбора: L 200…10000 мм, D 200…3000 мм.');
  target={...target,singleCoil:single};
  const range=project.tubeCounts(state,target,props),estimate=project.screeningModel(state,target,props),base=project.source(state,target),seen=new Map(),trace=[],attempts=[],acceptedDesigns=[];
  const rangesForGaps=gapRanges(d),seed=values=>values.includes(3)?3:values[0],seedGaps={radialGap:seed(rangesForGaps.radial),shellGap:seed(rangesForGaps.shell),coreGap:seed(rangesForGaps.core)};
  const stats={evaluations:0,geometryChecks:0,approximateChecks:0,errors:0,testedCounts:[],proposals:0,stockSkips:0,elapsedMS:0,improvementChecks:0,improvementShapes:0,improvements:0,gapProposals:0,testedRadialGaps:[],testedShellGaps:[],testedCoreGaps:[]};let winner=null,budgetReason=null,localLimitHit=false,firstSuccess=null;
  const cancelled=()=>hooks.cancelled?.(),available=()=>!cancelled()&&stats.evaluations<limits.maxEvaluations;
  async function event(kind,message,extra={}){const entry={step:trace.length+1,kind,message,...extra};trace.push(entry);hooks.progress?.({...stats,phase:kind,message,entry});await(hooks.yield?.()??Promise.resolve())}
  const sizeLimit=project.shellSizing(maxD,state.pc),minR=Math.floor(Math.max(3*di,(d+2*Math.min(...rangesForGaps.core)+4)/2))+1,maxR=Math.min(12*di-1e-7,(sizeLimit.innerMM-d-2*Math.min(...rangesForGaps.shell))/2),snap=r=>minR+Math.max(0,Math.ceil((r-minR-1e-9)/5))*5;
  const gapRecord=f=>({radialGap:f.radialGap,shellGap:f.shellGap,coreGap:f.coreGap});
  const countGaps=f=>{for(const [key,v]of [['testedRadialGaps',f.rows.length>1?f.radialGap:null],['testedShellGaps',f.shellGap],['testedCoreGaps',f.coreGap]])if(v!==null&&!stats[key].includes(v))stats[key].push(v)};
  await event('count',single?'Ровно одна трубка; трубный Re не ограничивает подбор.':'По расходу выбрано N='+range.selected+'; допустимо '+range.min+'…'+range.max+'.');
  await event('gaps','Радиальные зазоры между рядами, до корпуса и вытеснителя подбираются независимо: '+rangesForGaps.radial[0]+'…'+rangesForGaps.radial.at(-1)+' мм. Вертикальный зазор подбирается отдельно.');
  // Production reserves assume 3 mm. Also retain counts that only fit at the
  // experimental minimum radial gap; keep the same four verified reserve cap.
  const extraCounts=[];
  if(!single&&range.selected)for(let nr=1;nr<=8;nr++){
   const upper=maxR-(nr-1)*(d+rangesForGaps.radial[0]),radius=minR+Math.floor((upper-minR)/5)*5;if(radius<minR)continue;
   const capacity=Math.min(64,Math.floor(Math.PI/Math.asin(Math.min(1,(d+3)/(2*radius))))),lo=Math.max(1,Math.ceil(range.min/nr)),hi=Math.min(capacity,Math.floor(range.max/nr)),preferred=Math.round(range.selected/nr);
   for(const k of [preferred,preferred-1,preferred+1,lo,hi])if(k>=lo&&k<=hi&&k*(d+rangesForGaps.radial[0])+d<=maxH)extraCounts.push(k*nr);
  }
  extraCounts.sort((a,b)=>Math.abs(range.selected*range.estimatedRe/a-17500)-Math.abs(range.selected*range.estimatedRe/b-17500)||a-b);
  const counts=single?[1]:[...new Set([range.selected,...(range.reserveOrder??range.fallbackCounts),...extraCounts])].filter(n=>Number.isInteger(n)&&n>=range.min&&n<=range.max);
  outer:for(const n of counts){
   if(cancelled())return null;
   if(n!==range.selected&&stats.testedCounts.filter(v=>v!==range.selected).length>=limits.reserveCounts)break;
   let countProposals=0;const countCalls=stats.evaluations;
   if(n!==range.selected)await event('reserve','Основное N не дало результата. Пробуем резерв N='+n+'.');
   for(let nr=1;nr<=Math.min(single?1:8,n);nr++){
    if(n%nr||n/nr>64)continue;
    const k=n/nr,maxFirst=maxR-(nr-1)*(d+seedGaps.radialGap),chordR=k>2?(d+3)/(2*Math.sin(Math.PI/k)):(d+3)/2;
    if(snap(Math.max(minR,chordR))>maxFirst){await event('capacity',nr+' ряд(а): '+k+' трубок в ряду не помещаются по хорде.');continue}
    let rowProposals=0,rowBest=null;
    await event('rows','Пробуем '+nr+' ряд(а), по '+k+' трубок; начинаем с минимального целого зазора.');
    const gapQueue=project.axialGaps(d);
    for(let gapIndex=0;gapIndex<gapQueue.length;gapIndex++){
     const gap=gapQueue[gapIndex];
     const pitch=k*(d+gap),normalR=k*d/(2*Math.PI*Math.sqrt(1-(d/(d+gap))**2)),first=snap(Math.max(minR,chordR,normalR+1e-6));
     if(first>maxFirst||pitch+d>maxH)continue;
     // Start compact. Subsequent radii are directed by the measured UA error,
     // rather than a prebuilt radius/height catalogue.
     const anchor=rowBest&&rowBest.radius>=first&&rowBest.radius<=maxFirst?rowBest.radius:first;
     const radiusQueue=[...new Set([anchor,first])],visitedRadii=new Set(),lastRadius=minR+Math.floor((maxFirst-minR)/5)*5;
     for(let radiusIndex=0;radiusIndex<radiusQueue.length&&radiusIndex<12;radiusIndex++){
      const radius=radiusQueue[radiusIndex];visitedRadii.add(radius);let feedback=null;
      const enqueueRadius=()=>{
       const add=r=>{if(r>=first&&r<=maxFirst&&!radiusQueue.includes(r))radiusQueue.push(r)};
       // Near a fit, stock boundaries make UA non-monotone in radius: retain
       // both adjacent points instead of jumping over a narrow feasible band.
       if(feedback&&Math.abs(Math.log(feedback))<.1){add(radius-5);add(radius+5);return}
       let desired=feedback?Math.min(lastRadius,snap(radius*Math.pow(feedback,1/.65))):radius+5;
       if(desired<first||radiusQueue.includes(desired))desired=radius+5;while(radiusQueue.includes(desired))desired+=5;add(desired);
      };
      if(cancelled())return null;
      if(!available()){budgetReason='verification-budget';break outer}
      if(stats.proposals>=limits.maxProposals){budgetReason='geometry-budget';break outer}
      if(countProposals>=limits.proposalsPerN||rowProposals>=limits.proposalsPerRows||stats.evaluations-countCalls>=limits.checksPerN)break;
      stats.proposals++;
      const f=makeFamily(state,target,n,nr,radius,pitch,seedGaps);if(!f)continue;
      let ranges;try{ranges=turnRanges(f,pitch,maxH,useStock).ranges}catch{continue}
      if(!ranges.length){stats.stockSkips++;enqueueRadius();continue}
      countProposals++;rowProposals++;
      const at=turns=>{stats.geometryChecks++;return layoutAt(f,pitch,turns)},uaAt=turns=>{const l=at(turns);stats.approximateChecks++;return l?estimate(l.geometry):NaN};
      const lo=ranges[0][0],hi=ranges.at(-1)[1],u1=uaAt(lo),u2=uaAt(hi);if(!(u1>0&&u2>0)){enqueueRadius();continue}
      const factor=(u1/lo+u2/hi)/2;
      let turns=nextTurn(ranges,target.requiredUA*1.003/factor),lower=null,upper=null;
      const visited=new Set();
      await event('shape','N='+n+', рядов '+nr+', R₁='+radius+' мм, зазор '+gap+' мм. По оценке нужно '+turns+' витков.',{n,nr,radius,gap,turns});
      for(let check=0;check<limits.checksPerShape&&turns!==null;check++){
       if(cancelled())return null;
       if(!available()){budgetReason='verification-budget';break outer}
       if(stats.evaluations-countCalls>=limits.checksPerN)break;
       if(visited.has(turns))break;visited.add(turns);
       const layout=at(turns);if(!layout)break;const g=layout.geometry,key=JSON.stringify(project.geometryInput(g));let observation=seen.get(key);
       if(!observation){
        let lengths;try{lengths=g.rows.map((row,i)=>{const m=manufacturing.measure(row,g.leadBendRadius,g.leadStraightLength),stock=useStock?stockFor(m.totalMM):null;if(useStock&&!stock)throw Error('stock');return {row:i+1,count:row.count,...m,stockMM:stock,wasteMM:stock===null?null:stock-m.totalMM,wasteFraction:stock===null?null:(stock-m.totalMM)/stock}})}catch{break}
        if(!project.inlineLayout(g).allowed||!gapGeometryAllowed(g))break;
        stats.evaluations++;countGaps(f);if(!stats.testedCounts.includes(n))stats.testedCounts.push(n);
        try{
         const thermal=teplo.calculate({...base,...project.geometryInput(g)},props),applicability=project.applicability(thermal,target),accepted=project.meets(thermal,target);
         observation={thermal,applicability,accepted,lengths};seen.set(key,observation);
         const attempt={height:g.height,diameter:g.diameter,count:n,turns,gap,radius,rowCount:nr,...gapRecord(f),accepted,dutyRatio:thermal.heat_duty_kw/target.q,uaRatio:thermal.ua_w_k/target.requiredUA,blocking:applicability.blocking};attempts.push(attempt);
         await event(accepted?'accepted':'verification','Проверка '+stats.evaluations+': Q='+thermal.heat_duty_kw.toFixed(3)+' кВт, '+(attempt.dutyRatio*100).toFixed(3)+' % задания; H='+g.height+' мм.'+(accepted?' Все условия приёмки выполнены.':''),attempt);
        }catch(error){stats.errors++;seen.set(key,{error:error.message});attempts.push({count:n,error:error.message});await event('error','Teplo: '+error.message);break}
       }
       if(observation.error)break;
       const {thermal,accepted,applicability,lengths}=observation;
       const onlyRe=applicability.blocking.every(message=>/Reкр|требуется 15000|Re межтрубного|При L\/d < 50/.test(message));
       if(!applicability.blocking.length||onlyRe){const ratio=thermal.ua_w_k/target.requiredUA;if(feedback===null||Math.abs(Math.log(ratio))<Math.abs(Math.log(feedback)))feedback=ratio}
       if(!applicability.blocking.length&&(!rowBest||Math.abs(Math.log(thermal.ua_w_k/target.requiredUA))<Math.abs(Math.log(rowBest.ua/target.requiredUA))))rowBest={radius,turns,gap,ua:thermal.ua_w_k,estimate:estimate(g)};
       if(accepted){
        const totalLength=thermal.coils.reduce((sum,c)=>sum+c.length_m,0),wasteMM=lengths.reduce((sum,l)=>sum+(l.wasteMM??0)*l.count,0);
        firstSuccess=stats.evaluations;winner={kind:'coil',geometry:g,shellCalculation:f.shell,n,rowCount:nr,length:g.height/1000,diameter:g.diameter/1000,dmm:d,wmm:f.w,area:thermal.area_m2,totalLength,thermal,thermalSource:base,manufacturing:lengths,wasteMM,ignoredCriteria:applicability.ignored,stockLimitWaived:!useStock};acceptedDesigns.push(winner);break outer;
       }
       if(applicability.blocking.length&&(!onlyRe||Math.abs(Math.log(thermal.ua_w_k/target.requiredUA))<.01)){await event('constraint','Кандидат не проходит критерии: '+applicability.blocking[0]+'. Меняем геометрию.');break}
       if(thermal.ua_w_k<target.requiredUA){lower={turns,ua:thermal.ua_w_k};await event('grow','Мощности не хватает: увеличиваем число витков, сохраняя радиус и зазор.')}
       else{upper={turns,ua:thermal.ua_w_k};await event('shrink','Теплопередача избыточна: уменьшаем число витков.')}
       let proposed=lower&&upper?Math.round(lower.turns+(target.requiredUA*1.003-lower.ua)*(upper.turns-lower.turns)/(upper.ua-lower.ua)):Math.round(turns*target.requiredUA*1.003/thermal.ua_w_k);
       const direction=thermal.ua_w_k<target.requiredUA?1:-1;if(proposed===turns)proposed+=direction;
       let next=nextTurn(ranges,proposed,direction);if(next===null||visited.has(next))next=nextTurn(ranges,turns+direction,direction);
       if(next===null||visited.has(next)||(lower&&next<=lower.turns)||(upper&&next>=upper.turns)){await event('discrete','Между допустимыми числами витков нет точного попадания. Меняем радиус или зазор.');break}
       turns=next;
      }
      enqueueRadius();
     }
     // Mutate the closest measured shape rather than restarting from scratch.
     // A one-dimensional cheap step estimate picks the next whole gap; it never
     // accepts a result or changes the original Teplo formula.
     if(rowBest&&gapIndex+1<gapQueue.length){
      let bestGap=null,bestPenalty=Infinity;
      for(const candidateGap of gapQueue.slice(gapIndex+1)){
       const candidatePitch=k*(d+candidateGap),family=makeFamily(state,target,n,nr,rowBest.radius,candidatePitch,seedGaps);if(!family)continue;
       const layout=layoutAt(family,candidatePitch,rowBest.turns);if(!layout)continue;
       stats.geometryChecks++;stats.approximateChecks++;
       const ratio=estimate(layout.geometry)*rowBest.ua/rowBest.estimate/target.requiredUA,penalty=Math.abs(Math.log(ratio));
       if(Number.isFinite(penalty)&&penalty<bestPenalty){bestPenalty=penalty;bestGap=candidateGap}
      }
      if(bestGap!==null){const index=gapQueue.indexOf(bestGap);gapQueue.splice(index,1);gapQueue.splice(gapIndex+1,0,bestGap)}
     }
     if(countProposals>=limits.proposalsPerN||rowProposals>=limits.proposalsPerRows||stats.evaluations-countCalls>=limits.checksPerN)break;
    }
    if(rowProposals>=limits.proposalsPerRows)localLimitHit=true;
    if(countProposals>=limits.proposalsPerN||stats.evaluations-countCalls>=limits.checksPerN){localLimitHit=true;await event('local-budget','Локальный предел изменений для N='+n+'; переходим к резервному количеству.');break}
   }
  }
  // The estimate orders a small radius/gap grid, never accepts a construction.
  // Integer turns are solved analytically, not scanned along the whole height.
  if(available()&&counts.length){
   await event('improvement',winner?'Первый вариант найден. Уточняем простую компоновку и компромиссы: дополнительные ряды при росте общей длины трубок не более 20 %.':'Проверяем ограниченные резервные формы по измеренной теплопередаче.');
   const shapes=[],shapeKeys=new Set(),expanded=new Set(),shapeCounts=[...new Set([...stats.testedCounts,...counts])].slice(0,12);
   const addShape=(n,nr,radius,gap,gaps,isGap=false)=>{
    const key=[n,nr,radius,gap,gaps.radialGap,gaps.shellGap,gaps.coreGap].join('|');if(shapeKeys.has(key))return;shapeKeys.add(key);
    if(stats.improvementShapes>=limits.improvementShapes||isGap&&stats.gapProposals>=limits.gapShapes)return;
    stats.improvementShapes++;if(isGap)stats.gapProposals++;
    const k=n/nr,pitch=k*(d+gap),f=makeFamily(state,target,n,nr,radius,pitch,gaps);if(!f)return;
    let ranges,basis;try{({ranges,basis}=turnRanges(f,pitch,maxH,useStock))}catch{return}if(!ranges.length)return;
      const turns=ranges[0][0],layout=layoutAt(f,pitch,turns);stats.geometryChecks++;if(!layout||!gapGeometryAllowed(layout.geometry))return;
    const ua=estimate(layout.geometry);stats.approximateChecks++;if(!(ua>0))return;
    shapes.push({n,nr,gap,pitch,radius,f,ranges,...gapRecord(f),pipeUnit:basis.reduce((s,b)=>s+k*b.unit,0)/1000,pipeExtra:basis.reduce((s,b)=>s+k*b.extra,0)/1000,unitUA:ua/turns,uaCache:new Map([[turns,ua]])});
   };
   // Vary one clearance at a time around measured shapes. Do not form the
   // Cartesian product of radial, shell, core, axial, radius and turn grids.
   const expandGaps=shape=>{
    const key=[shape.n,shape.nr,shape.radius,shape.gap,shape.radialGap,shape.shellGap,shape.coreGap].join('|');if(expanded.has(key))return;expanded.add(key);
    const current={radialGap:shape.radialGap??3,shellGap:shape.shellGap??seedGaps.shellGap,coreGap:shape.coreGap??seedGaps.coreGap};
    const fields=[['radialGap',shape.nr>1?rangesForGaps.radial:[]],['shellGap',rangesForGaps.shell],['coreGap',rangesForGaps.core]];
    for(let i=0;i<Math.max(...fields.map(([,values])=>values.length));i++)for(const [field,values]of fields){
     const value=values[i];if(value===undefined||value===current[field])continue;
     const gaps={...current,[field]:value},upper=Math.min(12*di-1e-7,(sizeLimit.innerMM-d-2*gaps.shellGap)/2)-(shape.nr-1)*(d+gaps.radialGap),lower=Math.max(3*di,(d+2*gaps.coreGap+4)/2),last=minR+Math.floor((upper-minR)/5)*5;
     const radius=Math.min(last,snap(Math.max(shape.radius,Math.floor(lower)+1)));if(!(radius>lower&&radius<=upper))continue;
     addShape(shape.n,shape.nr,radius,shape.gap,gaps,true);
     if((field==='shellGap'&&value===rangesForGaps.shell[0]||field==='radialGap'&&value===rangesForGaps.radial[0])&&last>radius)addShape(shape.n,shape.nr,last,shape.gap,gaps,true);
    }
   };
   for(const n of shapeCounts)for(let nr=1;nr<=Math.min(single?1:8,n);nr++){
    if(n%nr||n/nr>64)continue;
    const k=n/nr,maxFirst=maxR-(nr-1)*(d+seedGaps.radialGap);
    for(const gap of project.axialGaps(d)){
     const pitch=k*(d+gap),normalR=k*d/(2*Math.PI*Math.sqrt(1-(d/(d+gap))**2)),chordR=k>2?(d+3)/(2*Math.sin(Math.PI/k)):(d+3)/2;
     for(let radius=snap(Math.max(minR,chordR,normalR+1e-6));radius<=maxFirst;radius+=5){
      if(stats.improvementShapes>=limits.baseShapes)break;
      addShape(n,nr,radius,gap,seedGaps);
     }
    }
    await(hooks.yield?.()??Promise.resolve());if(cancelled())return null;
   }
   // Boundary seeds also reach layouts that cannot exist at the 3 mm seed.
   const tightGaps={radialGap:rangesForGaps.radial[0],shellGap:rangesForGaps.shell[0],coreGap:rangesForGaps.core[0]};
   tightSeeds:for(const n of shapeCounts)for(let nr=1;nr<=Math.min(single?1:8,n);nr++){
    if(n%nr||n/nr>64)continue;
    const k=n/nr,upper=maxR-(nr-1)*(d+tightGaps.radialGap),last=minR+Math.floor((upper-minR)/5)*5,chordR=k>2?(d+3)/(2*Math.sin(Math.PI/k)):(d+3)/2;
    for(const gap of project.axialGaps(d)){
     const normalR=k*d/(2*Math.PI*Math.sqrt(1-(d/(d+gap))**2)),first=snap(Math.max(minR,chordR,normalR+1e-6));
     if(first<=last)for(const radius of new Set([first,last])){if(stats.gapProposals>=200)break tightSeeds;addShape(n,nr,radius,gap,tightGaps,true)}
    }
   }
   for(const a of [...attempts].filter(a=>Number.isFinite(a.uaRatio)&&!a.blocking?.length).sort((a,b)=>Math.abs(Math.log(a.uaRatio))-Math.abs(Math.log(b.uaRatio))).slice(0,12))expandGaps({n:a.count,nr:a.rowCount,radius:a.radius,gap:a.gap,...gapRecord(a)});
   let stale=0;
   const tried=new Set(attempts.filter(a=>Number.isFinite(a.turns)).map(a=>[a.count,a.rowCount,a.radius,a.gap,a.radialGap,a.shellGap,a.coreGap,a.turns].join('|')));
   const modelAt=(shape,turns)=>{if(!shape.uaCache.has(turns)){const l=layoutAt(shape.f,shape.pitch,turns);stats.geometryChecks++;stats.approximateChecks++;shape.uaCache.set(turns,l?estimate(l.geometry):NaN)}return shape.uaCache.get(turns)};
   const end=Math.min(limits.maxEvaluations,stats.evaluations+limits.improvementChecks);
   while(available()&&stats.evaluations<end){
    const candidates=[],choice=chooseDesigns(acceptedDesigns);
    const mode=stats.improvementChecks<8?'base':['reasonable','reasonable','base','compact','economical'][(stats.improvementChecks-8)%5];
    for(const shape of shapes){
     if(shape.n!==range.selected&&!stats.testedCounts.includes(shape.n)&&stats.testedCounts.filter(n=>n!==range.selected).length>=limits.reserveCounts)continue;
     const distance=a=>Math.abs(a.rowCount-shape.nr)*10+Math.abs(a.radius-shape.radius)/5+Math.abs(a.gap-shape.gap)+Math.abs(a.radialGap-shape.radialGap)+Math.abs(a.shellGap-shape.shellGap)+Math.abs(a.coreGap-shape.coreGap);
     const nearby=attempts.filter(a=>Number.isFinite(a.uaRatio)&&!a.error&&!a.blocking?.length&&a.count===shape.n).sort((a,b)=>distance(a)-distance(b))[0];
     let correction=1;
     if(nearby){if(nearby.estimatedUA===undefined){const f=makeFamily(state,target,nearby.count,nearby.rowCount,nearby.radius,nearby.count/nearby.rowCount*(d+nearby.gap),gapRecord(nearby)),l=f&&layoutAt(f,nearby.count/nearby.rowCount*(d+nearby.gap),nearby.turns);stats.geometryChecks++;stats.approximateChecks++;nearby.estimatedUA=l?estimate(l.geometry):0}if(nearby.estimatedUA>0)correction=nearby.uaRatio*target.requiredUA/nearby.estimatedUA}
     let wanted=target.requiredUA*1.003/(shape.unitUA*correction);
     // Short bundles have a turn-dependent row correction: UA at one turn
     // cannot be scaled linearly to dozens of turns. Re-evaluate the estimate.
     for(let pass=0;pass<3;pass++){const t=nextTurn(shape.ranges,wanted),u=modelAt(shape,t);if(!(u>0))break;wanted=t*target.requiredUA*1.003/(u*correction)}
     const center=nextTurn(shape.ranges,wanted);
     const turnsSet=new Set([center,nextTurn(shape.ranges,Math.floor(wanted),-1),nextTurn(shape.ranges,Math.ceil(wanted),1)]);
     for(const turns of turnsSet){
      if(turns===null)continue;
      const height=turns*shape.pitch+d;
      const pipeM=shape.pipeUnit*turns+shape.pipeExtra;
      // Retain longer simple/material-saving options; only truly dominated
      // four-criterion points are discarded before spending a Teplo call.
      if(acceptedDesigns.some(c=>c.geometry.height<=height&&c.geometry.diameter<=shape.f.diameter&&c.rowCount<=shape.nr&&tubeMetres(c)<=pipeM+1e-9))continue;
      const basePotential=!choice||shape.nr<choice.simplest.rowCount||shape.nr===choice.simplest.rowCount&&(height<choice.simplest.geometry.height||height===choice.simplest.geometry.height&&shape.f.diameter<choice.simplest.geometry.diameter);
      const withinBudget=!choice||shape.nr<=choice.simplest.rowCount||pipeM<=choice.tubeLimitM+1e-9;
      const probe=[shape.n,shape.nr,shape.radius,shape.gap,shape.radialGap,shape.shellGap,shape.coreGap,turns].join('|');if(tried.has(probe))continue;
      const penalty=Math.abs(Math.log(modelAt(shape,turns)*correction/target.requiredUA));
      candidates.push({shape,height,probe,turns,penalty,pipeM,basePotential,withinBudget});
     }
    }
    if(!candidates.length)break;
    // Start near the measured duty, then favour H/D. A short invalid apparatus
    // is not allowed to consume the whole budget ahead of plausible candidates.
    const preferred=candidates.filter(c=>mode==='base'?c.basePotential:mode==='reasonable'?c.withinBudget:mode==='economical'?!choice||c.pipeM<tubeMetres(choice.economical):!choice||c.height<=choice.compact.geometry.height);
    const pool=preferred.length?preferred:candidates;
    pool.sort((a,b)=>Math.floor(a.penalty/.012)-Math.floor(b.penalty/.012)||(mode==='base'?a.shape.nr-b.shape.nr:mode==='economical'?a.pipeM-b.pipeM:0)||a.height-b.height||a.shape.f.diameter-b.shape.f.diameter||a.penalty-b.penalty);
    const {shape,probe,turns}=pool[0];tried.add(probe);stats.geometryChecks++;
    const g=layoutAt(shape.f,shape.pitch,turns)?.geometry;if(!g)continue;
    const key=JSON.stringify(project.geometryInput(g));if(seen.has(key))continue;
    let lengths;try{lengths=g.rows.map((row,i)=>{const m=manufacturing.measure(row,g.leadBendRadius,g.leadStraightLength),stock=useStock?stockFor(m.totalMM):null;if(useStock&&!stock)throw Error('stock');return {row:i+1,count:row.count,...m,stockMM:stock,wasteMM:stock===null?null:stock-m.totalMM,wasteFraction:stock===null?null:(stock-m.totalMM)/stock}})}catch{seen.set(key,{error:'stock'});continue}
    if(!project.inlineLayout(g).allowed||!gapGeometryAllowed(g)){seen.set(key,{error:'geometry'});continue}
    stats.evaluations++;stats.improvementChecks++;countGaps(shape.f);if(!stats.testedCounts.includes(shape.n))stats.testedCounts.push(shape.n);
    try{
     const thermal=teplo.calculate({...base,...project.geometryInput(g)},props),applicability=project.applicability(thermal,target),accepted=project.meets(thermal,target);
     seen.set(key,{thermal,applicability,accepted,lengths});
     stats.approximateChecks++;
     const attempt={height:g.height,diameter:g.diameter,count:shape.n,turns,gap:shape.gap,radius:shape.radius,rowCount:shape.nr,...gapRecord(shape.f),accepted,phase:'improvement',estimatedUA:estimate(g),dutyRatio:thermal.heat_duty_kw/target.q,uaRatio:thermal.ua_w_k/target.requiredUA,blocking:applicability.blocking};attempts.push(attempt);
     if(accepted){
      const c={kind:'coil',geometry:g,shellCalculation:shape.f.shell,n:shape.n,rowCount:shape.nr,length:g.height/1000,diameter:g.diameter/1000,dmm:d,wmm:shape.f.w,area:thermal.area_m2,totalLength:thermal.coils.reduce((s,c)=>s+c.length_m,0),thermal,thermalSource:base,manufacturing:lengths,wasteMM:lengths.reduce((s,l)=>s+(l.wasteMM??0)*l.count,0),ignoredCriteria:applicability.ignored,stockLimitWaived:!useStock};
      acceptedDesigns.push(c);firstSuccess??=stats.evaluations;
      const next=chooseDesigns(acceptedDesigns);stale=0;
      if(winner!==next.recommended){winner=next.recommended;stats.improvements++;await event('improved','Разумный вариант: H='+winner.geometry.height+' мм, Ø'+winner.geometry.diameter+' мм; рядов '+winner.rowCount+', всего трубок '+tubeMetres(winner).toFixed(3)+' м. Опорный вариант: '+next.simplest.rowCount+' ряд(а), '+next.referenceTubeM.toFixed(3)+' м; предел для дополнительных рядов '+next.tubeLimitM.toFixed(3)+' м.',attempt)}
     }else{stale++;await event('verification','Уточнение '+stats.improvementChecks+': H='+g.height+' мм, Ø'+g.diameter+' мм; Q='+thermal.heat_duty_kw.toFixed(3)+' кВт.'+(applicability.blocking.length?' '+applicability.blocking[0]:''),attempt)}
    }catch(error){stats.errors++;stale++;seen.set(key,{error:error.message});attempts.push({count:shape.n,error:error.message,phase:'improvement'});await event('error','Teplo: '+error.message)}
    expandGaps(shape);
    if(winner&&stale>=20)break;
   }
  }
  if(cancelled())return null;
  stats.elapsedMS=performance.now()-started;
  const stopped=winner?'improved-success':budgetReason??(!counts.length?'no-tube-count':localLimitHit?'local-budget':'sequence-exhausted');
  const selection=chooseDesigns(acceptedDesigns);winner=selection?.recommended??null;
  await event('finish',winner?'Выбрана минимальная длина, затем диаметр с ограничением +20 % трубы для дополнительных рядов относительно найденной простой компоновки. Альтернативы сохранены.':stopped==='no-tube-count'?'Нет допустимого целого N по расходу.':'Последовательный поиск остановлен. Отсутствие решения не доказано.');
  return {algorithm,projectAlgorithm:project.algorithm,rows:winner?[{id:'sequence',name:'Разумная конструкция',design:winner}]:[],selection,acceptedDesigns,stats,attempts,trace,countRange:range,stopped,limits,firstSuccess,message:trace.at(-1).message};
 }
 return {select,turnRanges,nextTurn,makeFamily,layoutAt,gapRanges,geometryGaps,gapGeometryAllowed,limits,stockLengths,stockFor,tubeMetres,chooseDesigns,selectionPolicy,algorithm};
});
