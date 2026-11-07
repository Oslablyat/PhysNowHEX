/* Isolated experiment. Production selection and original Teplo are unchanged.
 * Conditional discovery followed by bounded material/row/size trade-offs.
 * No height catalogue: manufacture intervals and calibrated jumps in turn count. */
(function(root,factory){const common=typeof module==='object'&&module.exports,api=factory(common?require('./coil-project-method.js'):root.CoilProjectMethod,common?require('./coil-thermal-method.js'):root.CoilThermalMethod,common?require('./coil-manufacturing.js'):root.CoilManufacturing);if(common)module.exports=api;else root.CoilSequentialMethod=api})(globalThis,function(project,teplo,manufacturing){
 'use strict';
 const algorithm='condition-sequence-reasonable-v5';
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
 const limits=Object.freeze({maxEvaluations:200,maxProposals:512,proposalsPerN:48,proposalsPerRows:24,checksPerN:32,checksPerShape:3,reserveCounts:4,improvementChecks:48,improvementShapes:2400});
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
 function makeFamily(state,target,n,nr,first,pitch){
  const {d,w,di}=project.tubeSize(state),gap=3,k=n/nr,rows=Array.from({length:nr},(_,i)=>({diameter:2*(first+i*(d+gap)),count:k}));
  if(!Number.isInteger(k)||k<1||k>64||n>500||rows.some(r=>!(r.diameter/2/di>3&&r.diameter/2/di<12)))return null;
  for(const r of rows){const chord=k>1?r.diameter*Math.sin(Math.PI/k):Infinity,separation=pitch/k/Math.sqrt(1+(pitch/(Math.PI*r.diameter))**2);if(chord<d+gap-1e-7||separation<d+1e-7)return null}
  const maxD=Number(state['exchanger-diameter']),outerRadius=rows.at(-1).diameter/2;
  let diameter=Math.ceil(2*outerRadius+d+2*gap),shell;
  while(diameter<=maxD){shell=project.shellSizing(diameter,state.pc);if(shell.innerMM>=2*outerRadius+d+2*gap-1e-9)break;diameter++}
  return diameter<=maxD?{d,w,n,rows,diameter,shell,minimum:pitch+d,coreDiameter:2*first-d-2*gap}:null;
 }
 async function select(state,target,props,hooks={}){
  const started=performance.now(),single=state['single-coil']===true,useStock=project.stockLengthsEnabled(state),{d,di}=project.tubeSize(state),maxH=Number(state.length),maxD=Number(state['exchanger-diameter']);
  if(maxH<200||maxH>10000||maxD<200||maxD>3000)throw Error('Границы подбора: L 200…10000 мм, D 200…3000 мм.');
  target={...target,singleCoil:single};
  const range=project.tubeCounts(state,target,props),estimate=project.screeningModel(state,target,props),base=project.source(state,target),seen=new Map(),trace=[],attempts=[],acceptedDesigns=[];
  const stats={evaluations:0,geometryChecks:0,approximateChecks:0,errors:0,testedCounts:[],proposals:0,stockSkips:0,elapsedMS:0,improvementChecks:0,improvementShapes:0,improvements:0};let winner=null,budgetReason=null,localLimitHit=false,firstSuccess=null;
  const cancelled=()=>hooks.cancelled?.(),available=()=>!cancelled()&&stats.evaluations<limits.maxEvaluations;
  async function event(kind,message,extra={}){const entry={step:trace.length+1,kind,message,...extra};trace.push(entry);hooks.progress?.({...stats,phase:kind,message,entry});await(hooks.yield?.()??Promise.resolve())}
  const sizeLimit=project.shellSizing(maxD,state.pc),minR=Math.floor(Math.max(3*di,(d+10)/2))+1,maxR=Math.min(12*di-1e-7,(sizeLimit.innerMM-d-6)/2),snap=r=>minR+Math.max(0,Math.ceil((r-minR-1e-9)/5))*5;
  await event('count',single?'Ровно одна трубка; трубный Re не ограничивает подбор.':'По расходу выбрано N='+range.selected+'; допустимо '+range.min+'…'+range.max+'.');
  const counts=single?[1]:[...new Set([range.selected,...(range.reserveOrder??range.fallbackCounts)])].filter(n=>Number.isInteger(n)&&n>=range.min&&n<=range.max);
  outer:for(const n of counts){
   if(cancelled())return null;
   if(n!==range.selected&&stats.testedCounts.filter(v=>v!==range.selected).length>=limits.reserveCounts)break;
   let countProposals=0;const countCalls=stats.evaluations;
   if(n!==range.selected)await event('reserve','Основное N не дало результата. Пробуем резерв N='+n+'.');
   for(let nr=1;nr<=Math.min(single?1:8,n);nr++){
    if(n%nr||n/nr>64)continue;
    const k=n/nr,maxFirst=maxR-(nr-1)*(d+3),chordR=k>2?(d+3)/(2*Math.sin(Math.PI/k)):(d+3)/2;
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
      const f=makeFamily(state,target,n,nr,radius,pitch);if(!f)continue;
      let ranges;try{ranges=turnRanges(f,pitch,maxH,useStock).ranges}catch{continue}
      if(!ranges.length){stats.stockSkips++;enqueueRadius();continue}
      countProposals++;rowProposals++;
      const at=turns=>{stats.geometryChecks++;return project.unrestrictedLayout(f,pitch,turns)},uaAt=turns=>{const l=at(turns);stats.approximateChecks++;return l?estimate(l.geometry):NaN};
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
        if(!project.inlineLayout(g).allowed)break;
        stats.evaluations++;if(!stats.testedCounts.includes(n))stats.testedCounts.push(n);
        try{
         const thermal=teplo.calculate({...base,...project.geometryInput(g)},props),applicability=project.applicability(thermal,target),accepted=project.meets(thermal,target);
         observation={thermal,applicability,accepted,lengths};seen.set(key,observation);
         const attempt={height:g.height,diameter:g.diameter,count:n,turns,gap,radius,rowCount:nr,accepted,dutyRatio:thermal.heat_duty_kw/target.q,uaRatio:thermal.ua_w_k/target.requiredUA,blocking:applicability.blocking};attempts.push(attempt);
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
       const candidatePitch=k*(d+candidateGap),family=makeFamily(state,target,n,nr,rowBest.radius,candidatePitch);if(!family)continue;
       const layout=project.unrestrictedLayout(family,candidatePitch,rowBest.turns);if(!layout)continue;
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
   const shapes=[],shapeCounts=[...new Set([...stats.testedCounts,...counts])].slice(0,12);
   for(const n of shapeCounts)for(let nr=1;nr<=Math.min(single?1:8,n);nr++){
    if(n%nr||n/nr>64)continue;
    const k=n/nr,maxFirst=maxR-(nr-1)*(d+3);
    for(const gap of project.axialGaps(d)){
     const pitch=k*(d+gap),normalR=k*d/(2*Math.PI*Math.sqrt(1-(d/(d+gap))**2)),chordR=k>2?(d+3)/(2*Math.sin(Math.PI/k)):(d+3)/2;
     for(let radius=snap(Math.max(minR,chordR,normalR+1e-6));radius<=maxFirst;radius+=5){
      if(stats.improvementShapes>=limits.improvementShapes)break;
      stats.improvementShapes++;
      const f=makeFamily(state,target,n,nr,radius,pitch);if(!f)continue;
      let ranges,basis;try{({ranges,basis}=turnRanges(f,pitch,maxH,useStock))}catch{continue}if(!ranges.length)continue;
      const turns=ranges[0][0],layout=project.unrestrictedLayout(f,pitch,turns);stats.geometryChecks++;if(!layout)continue;
      const ua=estimate(layout.geometry);stats.approximateChecks++;if(!(ua>0))continue;
      shapes.push({n,nr,gap,pitch,radius,f,ranges,pipeUnit:basis.reduce((s,b)=>s+k*b.unit,0)/1000,pipeExtra:basis.reduce((s,b)=>s+k*b.extra,0)/1000,unitUA:ua/turns,uaCache:new Map([[turns,ua]])});
     }
    }
    await(hooks.yield?.()??Promise.resolve());if(cancelled())return null;
   }
   let stale=0;
   const tried=new Set(attempts.filter(a=>Number.isFinite(a.turns)).map(a=>[a.count,a.rowCount,a.radius,a.gap,a.turns].join('|')));
   const modelAt=(shape,turns)=>{if(!shape.uaCache.has(turns)){const l=project.unrestrictedLayout(shape.f,shape.pitch,turns);stats.geometryChecks++;stats.approximateChecks++;shape.uaCache.set(turns,l?estimate(l.geometry):NaN)}return shape.uaCache.get(turns)};
   const end=Math.min(limits.maxEvaluations,stats.evaluations+limits.improvementChecks);
   while(available()&&stats.evaluations<end){
    const candidates=[],choice=chooseDesigns(acceptedDesigns);
    const mode=stats.improvementChecks<8?'base':['reasonable','reasonable','base','compact','economical'][(stats.improvementChecks-8)%5];
    for(const shape of shapes){
     if(shape.n!==range.selected&&!stats.testedCounts.includes(shape.n)&&stats.testedCounts.filter(n=>n!==range.selected).length>=limits.reserveCounts)continue;
     const nearby=attempts.filter(a=>Number.isFinite(a.uaRatio)&&!a.error&&!a.blocking?.length&&a.count===shape.n).sort((a,b)=>Math.abs(a.rowCount-shape.nr)*10+Math.abs(a.radius-shape.radius)/5+Math.abs(a.gap-shape.gap)-(Math.abs(b.rowCount-shape.nr)*10+Math.abs(b.radius-shape.radius)/5+Math.abs(b.gap-shape.gap)))[0];
     let correction=1;
     if(nearby){if(nearby.estimatedUA===undefined){const f=makeFamily(state,target,nearby.count,nearby.rowCount,nearby.radius,nearby.count/nearby.rowCount*(d+nearby.gap)),l=f&&project.unrestrictedLayout(f,nearby.count/nearby.rowCount*(d+nearby.gap),nearby.turns);stats.geometryChecks++;stats.approximateChecks++;nearby.estimatedUA=l?estimate(l.geometry):0}if(nearby.estimatedUA>0)correction=nearby.uaRatio*target.requiredUA/nearby.estimatedUA}
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
      const probe=[shape.n,shape.nr,shape.radius,shape.gap,turns].join('|');if(tried.has(probe))continue;
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
    const g=project.unrestrictedLayout(shape.f,shape.pitch,turns)?.geometry;if(!g)continue;
    const key=JSON.stringify(project.geometryInput(g));if(seen.has(key))continue;
    let lengths;try{lengths=g.rows.map((row,i)=>{const m=manufacturing.measure(row,g.leadBendRadius,g.leadStraightLength),stock=useStock?stockFor(m.totalMM):null;if(useStock&&!stock)throw Error('stock');return {row:i+1,count:row.count,...m,stockMM:stock,wasteMM:stock===null?null:stock-m.totalMM,wasteFraction:stock===null?null:(stock-m.totalMM)/stock}})}catch{seen.set(key,{error:'stock'});continue}
    if(!project.inlineLayout(g).allowed){seen.set(key,{error:'geometry'});continue}
    stats.evaluations++;stats.improvementChecks++;if(!stats.testedCounts.includes(shape.n))stats.testedCounts.push(shape.n);
    try{
     const thermal=teplo.calculate({...base,...project.geometryInput(g)},props),applicability=project.applicability(thermal,target),accepted=project.meets(thermal,target);
     seen.set(key,{thermal,applicability,accepted,lengths});
     stats.approximateChecks++;
     const attempt={height:g.height,diameter:g.diameter,count:shape.n,turns,gap:shape.gap,radius:shape.radius,rowCount:shape.nr,accepted,phase:'improvement',estimatedUA:estimate(g),dutyRatio:thermal.heat_duty_kw/target.q,uaRatio:thermal.ua_w_k/target.requiredUA,blocking:applicability.blocking};attempts.push(attempt);
     if(accepted){
      const c={kind:'coil',geometry:g,shellCalculation:shape.f.shell,n:shape.n,rowCount:shape.nr,length:g.height/1000,diameter:g.diameter/1000,dmm:d,wmm:shape.f.w,area:thermal.area_m2,totalLength:thermal.coils.reduce((s,c)=>s+c.length_m,0),thermal,thermalSource:base,manufacturing:lengths,wasteMM:lengths.reduce((s,l)=>s+(l.wasteMM??0)*l.count,0),ignoredCriteria:applicability.ignored,stockLimitWaived:!useStock};
      acceptedDesigns.push(c);firstSuccess??=stats.evaluations;
      const next=chooseDesigns(acceptedDesigns);stale=0;
      if(winner!==next.recommended){winner=next.recommended;stats.improvements++;await event('improved','Разумный вариант: H='+winner.geometry.height+' мм, Ø'+winner.geometry.diameter+' мм; рядов '+winner.rowCount+', всего трубок '+tubeMetres(winner).toFixed(3)+' м. Опорный вариант: '+next.simplest.rowCount+' ряд(а), '+next.referenceTubeM.toFixed(3)+' м; предел для дополнительных рядов '+next.tubeLimitM.toFixed(3)+' м.',attempt)}
     }else{stale++;await event('verification','Уточнение '+stats.improvementChecks+': H='+g.height+' мм, Ø'+g.diameter+' мм; Q='+thermal.heat_duty_kw.toFixed(3)+' кВт.'+(applicability.blocking.length?' '+applicability.blocking[0]:''),attempt)}
    }catch(error){stats.errors++;stale++;seen.set(key,{error:error.message});attempts.push({count:shape.n,error:error.message,phase:'improvement'});await event('error','Teplo: '+error.message)}
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
 return {select,turnRanges,nextTurn,makeFamily,limits,stockLengths,stockFor,tubeMetres,chooseDesigns,selectionPolicy,algorithm};
});
