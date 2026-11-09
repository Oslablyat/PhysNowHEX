/* Main-site discrete search. Only complete Teplo calculations can enter the table. */
(function(root,factory){
 const common=typeof module==='object'&&module.exports;
 const api=factory(common?require('./coil-project-method.js'):root.CoilProjectMethod,
  common?require('./coil-manufacturing.js'):root.CoilManufacturing,
  common?require('./coil-thermal-method.js'):root.CoilThermalMethod);
 if(common)module.exports=api;else root.CoilMulticriteria=api;
})(globalThis,function(project,manufacturing,teplo){
 'use strict';
 const config=project.multicriteria,limits=project.construction,epsilon=1e-7;
 const metrics=['height','diameter','materialMetres','count','rowCount'];
 const keyOrder=(a,b)=>a.geometryKey<b.geometryKey?-1:a.geometryKey>b.geometryKey?1:0;

 function rankAccepted(rows){
  const confirmed=rows.filter(row=>!row.warning),eligible=confirmed.length?confirmed:rows;
  const ordered=[...eligible].sort((a,b)=>{
   for(const key of metrics)if(a[key]!==b[key])return a[key]-b[key];
   return keyOrder(a,b);
  });
  const front=[];
  // With this lexicographic order, a later point cannot dominate an earlier one.
  for(const row of ordered){
   if(!front.some(a=>metrics.every(key=>a[key]<=row[key])&&metrics.some(key=>a[key]<row[key])))front.push(row);
  }
  if(!front.length)return front;
  const bounds=metrics.map(key=>{
   let min=Infinity,max=-Infinity;
   for(const row of front){min=Math.min(min,row[key]);max=Math.max(max,row[key])}
   return {key,min,max};
  });
  for(const row of front){
   const losses=bounds.map(({key,min,max})=>max===min?0:(row[key]-min)/(max-min));
   row.worstLoss=Math.max(...losses);row.totalLoss=losses.reduce((a,b)=>a+b,0);
  }
  front.sort((a,b)=>a.worstLoss-b.worstLoss||a.totalLoss-b.totalLoss||keyOrder(a,b));
  front.forEach((row,i)=>{row.rank=i+1});
  return front;
 }

 function spread(values,limit){
  if(values.length<=limit)return values;
  return Array.from({length:limit},(_,i)=>values[Math.floor(i*(values.length-1)/Math.max(1,limit-1))]);
 }
 // Count and unrank radial gap vectors under the radial envelope. This permits
 // sampling throughout even a large grid without constructing its Cartesian product.
 function gapPatterns(gaps,pairs,extraSteps,cap){
  if(!pairs)return {vectors:[[]],sampled:false};
  const last=gaps.length-1,budget=Math.min(extraSteps,last*pairs),ways=[Array(budget+1).fill(1)];
  for(let k=1;k<=pairs;k++){
   const prev=ways[k-1],next=[];let sum=0;
   for(let j=0;j<=budget;j++){sum+=prev[j];if(j>last)sum-=prev[j-last-1];next.push(sum)}
   ways.push(next);
  }
  const total=ways[pairs][budget],vectors=new Map();
  function add(steps){vectors.set(steps.join(','),steps.map(i=>gaps[i]))}
  function at(rank){
   const steps=[];let left=budget;
   for(let k=pairs;k>0;k--){
    let i=0;
    while(i<Math.min(last,left)&&rank>=ways[k-1][left-i]){rank-=ways[k-1][left-i];i++}
    steps.push(i);left-=i;
   }
   add(steps);
  }
  if(total<=cap){for(let i=0;i<total;i++)at(i)}
  else{
   const uniform=Array.from({length:Math.min(last,Math.floor(budget/pairs))+1},(_,i)=>i);
   for(const i of spread(uniform,cap))add(Array(pairs).fill(i));
   for(let i=0;i<cap;i++)at(Math.floor(i*(total-1)/Math.max(1,cap-1)));
  }
  return {vectors:[...vectors.values()],sampled:vectors.size<total};
 }

 function intersect(a,b){
  const result=[];
  for(const [lo,hi] of a)for(const [min,max] of b){
   const left=Math.max(lo,min),right=Math.min(hi,max);
   if(left<=right)result.push([left,right]);
  }
  return result;
 }
 function rowTerms(diameter,pitch,d,cache){
  const key=diameter+'|'+pitch;
  if(!cache.has(key)){
   let terms=null;
   try{
    const leads=manufacturing.measure({diameter,pitch,turns:0},2*d,Math.max(40,2*d));
    const unit=Math.hypot(Math.PI*diameter,pitch);
    const bands=[1000,3000,6000].map(stock=>[
     Math.ceil((stock*.8-epsilon-leads.totalMM)/unit),
     Math.ceil((stock-epsilon-leads.totalMM)/unit)-1
    ]);
    terms={leads,unit,bands};
   }catch{/* The bend does not fit on this cylinder. */}
   cache.set(key,terms);
  }
  return cache.get(key);
 }
 function measuredRows(series,turns,useStock){
  return series.terms.map(({leads,unit},i)=>{
   const windingMM=turns*unit,totalMM=windingMM+leads.bendsMM+leads.straightMM;
   const stockMM=useStock?manufacturing.stockFor(totalMM):null,wasteMM=useStock?stockMM-totalMM:null;
   return {row:i+1,count:series.f.rows[i].count,windingMM,bendsMM:leads.bendsMM,straightMM:leads.straightMM,
    totalMM,axialEnvelopeMM:turns*series.pitch+leads.axialEnvelopeMM,stockMM,wasteMM,wasteFraction:useStock?wasteMM/stockMM:null};
  });
 }
 function dimensions(state){
  const height=Number(state.length),diameter=Number(state['exchanger-diameter']);
  if(!(height>=200&&height<=10000&&diameter>=200&&diameter<=3000))throw Error('Границы подбора: L 200…10 000 мм, D 200…3 000 мм.');
  return {height,diameter};
 }
 function family(radii,k,d,w,pc,shells,maxD){
  const required=2*radii.at(-1)+d+2*limits.gapMM;
  if(!shells.has(required)){
   let shell=null;
   for(let outer=Math.ceil(required);outer<=maxD;outer++){
    const candidate=project.shellSizing(outer,pc);
    if(candidate.innerMM>=required){shell=candidate;break}
   }
   shells.set(required,shell);
  }
  const shell=shells.get(required);if(!shell)return null;
  const rows=radii.map(r=>({diameter:2*r,count:k}));
  const gaps=radii.slice(1).map((r,i)=>r-radii[i]-d);
  return {rows,d,w,n:k*rows.length,diameter:shell.outerMM,shell,coreDiameter:2*radii[0]-d-2*limits.gapMM,
   rowGap:gaps.length?Math.min(...gaps):limits.gapMM};
 }
 async function catalogue(state,target,range,estimate,stats,hooks,outside=null){
  const {height,diameter}=dimensions(state),{d,w,di}=project.tubeSize(state);
  const useStock=project.stockLengthsEnabled(state),limit=project.shellSizing(diameter,state.pc);
  const gaps=project.radialGaps(d),axial=project.axialGaps(d),groups=[];
  const firstMin=Math.floor(Math.max(3*di,(d+2*limits.gapMM+4)/2))+1;
  const lastMax=Math.min(12*di-epsilon,(limit.innerMM-d-2*limits.gapMM)/2);
  for(let n=range.min;n<=range.max;n++)for(let nr=1;nr<=Math.min(limits.maxRows,n);nr++){
   const k=n/nr;if(!Number.isInteger(k)||k>64||!axial.length||(nr>1&&!gaps.length))continue;
   const firsts=[],span=(nr-1)*(d+(gaps[0]??0));
   for(let r=firstMin;r+span<=lastMax+1e-9;r++){
    if(k===1||2*r*Math.sin(Math.PI/k)>=d+limits.gapMM-epsilon)firsts.push(r);
   }
   if(firsts.length)groups.push({n,nr,k,firsts,span,series:[],factors:[],neighbours:[],neighbourIndex:0});
  }
  // Bound the cheap catalogue separately from the number of real verifications.
  const seriesPerGroup=Math.max(1,Math.floor(65000/Math.max(1,groups.length)));
  const termsCache=new Map(),shells=new Map();
  let lastYield=Date.now();
  for(const group of groups){
   const {nr,k,span,firsts}=group;
   const radialSlots=nr===1?1:2;
   const firstLimit=Math.max(1,Math.floor(Math.sqrt(seriesPerGroup*firsts.length/(axial.length*radialSlots))));
   const radiiGrid=spread(firsts,firstLimit);
   const axialGrid=spread(axial,Math.max(1,Math.floor(seriesPerGroup/(radiiGrid.length*radialSlots))));
   if(radiiGrid.length<firsts.length||axialGrid.length<axial.length)stats.sampled=true;
   const cap=Math.max(radialSlots,Math.floor(seriesPerGroup/(radiiGrid.length*axialGrid.length)));
   for(const first of radiiGrid){
    const steps=Math.floor((lastMax-first-span)*2+1e-8);
    const patterns=gapPatterns(gaps,nr-1,steps,cap);
    if(patterns.sampled)stats.sampled=true;
    for(const gapsVector of patterns.vectors){
     if(hooks.cancelled?.())return null;
     if(Date.now()-lastYield>=75){
      hooks.progress?.({...stats,phase:outside?'diagnosis':'catalogue'});await hooks.yield?.();lastYield=Date.now();
      if(hooks.cancelled?.())return null;
     }
     const radii=[first];for(const g of gapsVector)radii.push(radii.at(-1)+d+g);
     const f=family(radii,k,d,w,state.pc,shells,diameter);if(!f)continue;
     let made=false;
     const siblings=new Map();
     for(const clearance of axialGrid){
      const pitch=k*(d+clearance),upper=Math.min(limits.maxTurns,Math.floor((height-d)/pitch+1e-10));
      const lower=outside&&f.diameter<=outside.diameter?Math.max(1,Math.floor((outside.height-d)/pitch+1e-10)+1):1;
      if(lower>upper||pitch/k/Math.hypot(1,pitch/(2*Math.PI*first))<d-epsilon)continue;
      let bands=[[lower,upper]];const terms=[];
      for(const row of f.rows){
       const t=rowTerms(row.diameter,pitch,d,termsCache);if(!t){bands=[];break}
       terms.push(t);
       if(useStock){bands=intersect(bands,t.bands);if(!bands.length)break}
      }
      if(!bands.length)continue;
      const probeTurns=Math.min(8,bands[0][1]),probeRows=f.rows.map(r=>({...r,pitch,turns:probeTurns}));
      // The fixed-temperature estimate predicts only an order; zero estimates
      // still get a place in the catalogue and are eligible for full verification.
      const approx=estimate({diameter:f.diameter,shellWall:f.shell.wallMM,coreDiameter:f.coreDiameter,tubeDiameter:d,tubeWall:w,rows:probeRows});
      const unitRatio=Number.isFinite(approx)&&approx>0?approx/(probeTurns*target.requiredUA):0;
      const series={f,pitch,bands,terms,unitRatio,siblings,used:new Set(),index:group.series.length};
      siblings.set(clearance,series);series.clearance=clearance;
      group.series.push(series);made=true;
      stats.screened+=bands.reduce((sum,[lo,hi])=>sum+hi-lo+1,0);
     }
     if(made)stats.families++;
    }
   }
  }
  return groups.filter(g=>g.series.length);
 }

 // Each heap entry owns one integer interval. Its two cursors move outwards
 // from the predicted duty, so millions of candidate turn counts need no array.
 class Queue{
  constructor(){this.items=[]}
  before(a,b){return a.visits<b.visits||a.visits===b.visits&&(a.error<b.error||a.error===b.error&&(a.s.index<b.s.index||a.s.index===b.s.index&&a.turn<b.turn))}
  push(item){
   const a=this.items;let i=a.length;a.push(item);
   while(i){const parent=(i-1)>>1;if(!this.before(item,a[parent]))break;a[i]=a[parent];i=parent}a[i]=item;
  }
  pop(){
   const a=this.items,first=a[0],last=a.pop();if(!a.length)return first;
   let i=0;
   while(2*i+1<a.length){
    let child=2*i+1;if(child+1<a.length&&this.before(a[child+1],a[child]))child++;
    if(!this.before(a[child],last))break;a[i]=a[child];i=child;
   }
   a[i]=last;return first;
  }
 }
 function advance(entry,coverage){
  const {s,lo,hi,aim}=entry;
  while(entry.left>=lo&&s.used.has(entry.left))entry.left--;
  while(entry.right<=hi&&s.used.has(entry.right))entry.right++;
  if(entry.left<lo&&entry.right>hi)return false;
  const leftError=entry.left<lo?Infinity:Math.abs(Math.log(entry.left/aim));
  const rightError=entry.right>hi?Infinity:Math.abs(Math.log(entry.right/aim));
  entry.turn=leftError<=rightError?entry.left--:entry.right++;
  entry.error=Math.min(leftError,rightError);entry.visits=coverage?s.used.size:0;
  return true;
 }
 // Build a small table of predicted compromises independently for each N and
 // row count. Bins prevent hundreds of near-identical windings from taking all
 // the verification slots. Only the subsequent full calculation accepts a row.
 function offerCandidate(bins,s,turn,ratio,useStock){
  if(s.used.has(turn)||ratio<.92||ratio>1.14)return;
  const f=s.f,height=turn*s.pitch+f.d;
  const bin=Math.floor(Math.log(height)/.045)+'/'+Math.floor(Math.log(f.diameter)/.035);
  let material=0;
  for(const t of s.terms){
   const length=t.unit*turn+t.leads.totalMM;
   const metres=useStock?manufacturing.stockFor(length):length;
   if(metres===null)return;
   material+=metres*f.rows[0].count/1000;
  }
  const error=Math.abs(Math.log(ratio/1.02)),outside=Math.max(1-ratio,ratio-1.05,0);
  const old=bins.get(bin);
  if(old&&(old.outside<outside||old.outside===outside&&(old.materialMetres<material||old.materialMetres===material&&(old.height<height||old.height===height&&old.error<=error))))return;
  bins.set(bin,{s,turn,error,outside,height,diameter:f.diameter,materialMetres:material,count:f.n,rowCount:f.rows.length,geometryKey:s.index+'/'+turn});
 }
 function prepare(group,phase,useStock){
  const coverage=phase==='coverage',bins=new Map();
  group.queue=new Queue();
  const factors=group.factors.sort((a,b)=>a-b),factor=factors.length?factors[factors.length>>1]:1;
  for(const s of group.series){
   for(const [lo,hi] of s.bands){
    const ratio=s.measuredRatio??s.unitRatio*factor;
    const aim=ratio>0?1.02/ratio:(lo+hi)/2;
    if(phase==='refinement'&&ratio>0){
     // Search the lower edge as well as the middle of the estimated duty band.
     for(const target of [1,1.02,1.05]){
      const turn=Math.max(lo,Math.min(hi,Math.round(target/ratio)));
      offerCandidate(bins,s,turn,turn*ratio,useStock);
     }
    }
    const left=Math.min(hi,Math.max(lo-1,Math.floor(aim)));
    const entry={s,lo,hi,aim,left,right:left+1};
    if(advance(entry,coverage))group.queue.push(entry);
   }
  }
  const representatives=[...bins.values()];
  const front=rankAccepted(representatives);
  group.priority=[...front,...representatives.filter(r=>!r.rank).sort((a,b)=>a.error-b.error)];
  group.priorityIndex=0;
 }
 function nextInGroup(group,phase){
  const pick=group.pick++;
  if(phase==='refinement'&&pick%4<2){
   while(group.priorityIndex<group.priority.length){
    const r=group.priority[group.priorityIndex++];if(!r.s.used.has(r.turn))return [r.s,r.turn];
   }
  }
  if(phase==='refinement'&&group.neighbourIndex<group.neighbours.length&&pick%8===2){
   while(group.neighbourIndex<group.neighbours.length){
    const pair=group.neighbours[group.neighbourIndex++];if(!pair[0].used.has(pair[1]))return pair;
   }
  }
  const queue=group.queue,coverage=phase==='coverage';
  while(queue.items.length){
   const entry=queue.pop(),{s,turn}=entry,used=s.used.has(turn);
   if(advance(entry,coverage))queue.push(entry);
   if(!used)return [s,turn];
  }
  return null;
 }
 function addNeighbours(group,s,turns){
  if(s.hasNeighbours)return;s.hasNeighbours=true;
  for(const [other,wanted] of [[s,turns-1],[s,turns+1],[s.siblings.get(s.clearance-1),turns],[s.siblings.get(s.clearance+1),turns]]){
   if(other&&!other.used.has(wanted)&&other.bands.some(([lo,hi])=>wanted>=lo&&wanted<=hi))group.neighbours.push([other,wanted]);
  }
 }

 // All hydraulic/thermal fields in the source method are shared by starts
 // on the same cylinder. Preserve the exact position fields of every start.
 function packThermal(result){
  const {coils,...summary}=result;
  const firstByRow=[],positions=[];
  for(const c of coils){
   if(!firstByRow[c.row-1])firstByRow[c.row-1]=c;
   positions.push([c.row,c.index,c.position,c.theta_deg,c.x_m,c.y_m]);
  }
  return {summary,firstByRow,positions};
 }
 function materialize(design){
  if(!design?.packedThermal)return design;
  const {packedThermal,...rest}=design,{summary,firstByRow,positions}=packedThermal;
  const coils=positions.map(([row,index,position,theta_deg,x_m,y_m])=>({...firstByRow[row-1],index,position,theta_deg,x_m,y_m}));
  return {...rest,thermal:{...summary,coils}};
 }

 async function select(state,target,props,hooks={}){
  if(hooks.cancelled?.())return null;
  state={...state,'design-objective':config.id};
  target={...target,projectAlgorithm:config.algorithm,singleCoil:state['single-coil']===true};
  const base=project.source(state,target),bounds=dimensions(state),useStock=project.stockLengthsEnabled(state);
  const range=project.tubeCounts(state,target,props),estimate=project.screeningModel(state,target,props);
  const stats={evaluations:0,maxEvaluations:config.maxEvaluations,errors:0,accepted:0,inapplicable:0,insufficient:0,
   screened:0,families:0,sampled:false,phases:{},testedCounts:[]};
  const calculations=[],acceptedDesigns=[],seen=new Set();
  let witness=null,firstError='',lowestDuty=Infinity,highestDuty=-Infinity,lastProgress=Date.now();
  let tubeReFailures=0,shellReFailures=0;
  function verify(s,turns,group,phase){
   if(stats.evaluations>=config.maxEvaluations)return;
   s.used.add(turns);
   const layout=project.unrestrictedLayout(s.f,s.pitch,turns);if(!layout)return;
   const g=layout.geometry;g.rowClearance=s.f.rowGap;
   const input=project.geometryInput(g),key=JSON.stringify(input);
   if(seen.has(key))return;
   const lengths=measuredRows(s,turns,useStock);
   if(useStock&&lengths.some(r=>r.stockMM===null))return;
   seen.add(key);
   const id=++stats.evaluations;stats.phases[phase]=(stats.phases[phase]??0)+1;
   if(!stats.testedCounts.includes(s.f.n))stats.testedCounts.push(s.f.n);
   let thermal;
   try{thermal=teplo.calculate({...base,...input},props)}
   catch(error){stats.errors++;if(!firstError)firstError=error.message;return}
   const ratio=thermal.ua_w_k/(s.unitRatio*turns*target.requiredUA);
   const measured=thermal.ua_w_k/target.requiredUA,error=Math.abs(Math.log(measured/1.02));
   if(error<(s.measurementError??Infinity)){s.measurementError=error;s.measuredRatio=measured/turns}
   if(group.factors.length<2000&&Number.isFinite(ratio)&&ratio>0)group.factors.push(ratio);
   const check=project.applicability(thermal,target);
   if(!check.allowed){
    stats.inapplicable++;
    if(phase!=='diagnosis'){
     if(check.blocking.some(text=>text.includes('15000 ≤ Re ≤ 20000')))tubeReFailures++;
     if(!thermal.shell.valid)shellReFailures++;
    }
    return;
   }
   if(phase!=='diagnosis'){lowestDuty=Math.min(lowestDuty,thermal.heat_duty_kw);highestDuty=Math.max(highestDuty,thermal.heat_duty_kw)}
   if(!project.meets(thermal,target,check)){stats.insufficient++;return}
   if(phase==='diagnosis'){witness={geometry:g,q:thermal.heat_duty_kw,valid:thermal.valid};return}
   const totalLength=thermal.coils.reduce((sum,c)=>sum+c.length_m,0);
   const tubeMetres=lengths.reduce((sum,m)=>sum+m.totalMM*m.count,0)/1000;
   const stockMetres=useStock?lengths.reduce((sum,m)=>sum+m.stockMM*m.count,0)/1000:null;
   calculations.push({id,status:'accepted',geometryKey:project.geometryKey(g),height:g.height,diameter:g.diameter,count:s.f.n,rowCount:g.rows.length,
    materialMetres:stockMetres??tubeMetres,stockMetres,tubeMetres,lengthSpread:(Math.max(...lengths.map(m=>m.totalMM))-Math.min(...lengths.map(m=>m.totalMM)))/1000,
    volumeLitres:Math.PI*g.diameter**2*g.height/4e6,area:thermal.area_m2,duty:thermal.heat_duty_kw,
    excessPercent:(thermal.heat_duty_kw/target.q-1)*100,reHot:Math.min(...thermal.coils.map(c=>c.re_hot)),
    reCold:thermal.shell.re_cold,ua:thermal.ua_w_k,k:thermal.overall_u_w_m2k,hotOut:thermal.t_hot_out_c,coldOut:thermal.t_cold_out_c,warning:!thermal.valid});
   acceptedDesigns.push({kind:'coil',calculationId:id,geometry:g,shellCalculation:s.f.shell,length:g.height/1000,diameter:g.diameter/1000,
    dmm:s.f.d,wmm:s.f.w,n:s.f.n,rowCount:g.rows.length,totalTurns:turns*s.f.n,area:thermal.area_m2,externalArea:Math.PI*s.f.d/1000*totalLength,
    totalLength,manufacturing:lengths,wasteMM:lengths.reduce((sum,m)=>sum+(m.wasteMM??0)*m.count,0),
    stockLimitWaived:!useStock,packedThermal:packThermal(thermal),thermalSource:base,ignoredCriteria:check.ignored});
   stats.accepted++;if(phase!=='polish')addNeighbours(group,s,turns);
  }
  // Use verified front points as workshop drawings. Contract the bundle or a
  // single radial gap, or reduce the axial spacing, then recheck all limits.
  async function polish(groups,end,seedCount=24){
   const front=rankAccepted(calculations.map(r=>({...r})));
   if(!front.length)return;
   const seeds=[front[0],...spread(front.slice(1),seedCount-1)];
   const designs=new Map(acceptedDesigns.map(c=>[c.calculationId,c]));
   const shells=new Map(),leads=new Map();
   for(const [shift,tighten,axial] of [[-1,0,0],[-2,0,0],[0,.5,0],[-1,.5,0],[0,0,1],[-1,1,0],[-3,0,0],[1,1,1]]){
    for(const seed of seeds){
     if(stats.evaluations>=end||hooks.cancelled?.())return;
     const g=designs.get(seed.id).geometry,row=g.rows[0],k=row.count,d=g.tubeDiameter,di=d-2*g.tubeWall;
     const pitch=row.pitch-axial*k,radii=g.rows.map((r,i)=>r.diameter/2+shift-i*tighten);
     const first=radii[0];
     if(!project.axialGap(d,pitch,k).allowed||first<=3*di||radii.at(-1)>=12*di||2*first-d-2*limits.gapMM<=4)continue;
     if(k>1&&2*first*Math.sin(Math.PI/k)<d+limits.gapMM-epsilon)continue;
     if(pitch/k/Math.hypot(1,pitch/(2*Math.PI*first))<d-epsilon)continue;
     if(radii.some((r,i)=>i&&r-radii[i-1]<1.1*d-epsilon))continue;
     const f=family(radii,k,d,g.tubeWall,state.pc,shells,bounds.diameter);if(!f)continue;
     const terms=f.rows.map(r=>rowTerms(r.diameter,pitch,d,leads));if(terms.some(t=>!t))continue;
     const group=groups.find(x=>x.n===seed.count&&x.nr===seed.rowCount);
     verify({f,pitch,terms,used:new Set(),unitRatio:0},row.turns,group,'polish');
     if(Date.now()-lastProgress>=100){hooks.progress?.({...stats,phase:'polish'});await hooks.yield?.();lastProgress=Date.now()}
    }
   }
  }
  async function run(groups,end,phase){
   for(const group of groups){
    group.pick=0;prepare(group,phase,useStock);
    if(Date.now()-lastProgress>=100){hooks.progress?.({...stats,phase});await hooks.yield?.();lastProgress=Date.now()}
    if(hooks.cancelled?.())return;
   }
   let active=[...groups];
   while(active.length&&stats.evaluations<end&&!witness){
    const remaining=[];
    for(const group of active){
     if(hooks.cancelled?.()||stats.evaluations>=end||witness)break;
     const pair=nextInGroup(group,phase);
     if(pair){verify(...pair,group,phase);remaining.push(group)}
     if(Date.now()-lastProgress>=100){
      hooks.progress?.({...stats,phase});await hooks.yield?.();lastProgress=Date.now();
     }
    }
    active=remaining;if(hooks.cancelled?.())return;
   }
  }
  const groups=await catalogue(state,target,range,estimate,stats,hooks);
  if(!groups||hooks.cancelled?.())return null;
  for(const [phase,end] of [['discovery',100],['refinement',450],['refinement',700],['coverage',800]]){
   await run(groups,end,phase);
   if(hooks.cancelled?.())return null;
   if(stats.screened<=end||!groups.some(g=>g.queue.items.length))break;
  }
  if(calculations.length&&stats.evaluations<config.maxEvaluations){
   await polish(groups,Math.min(config.maxEvaluations,stats.evaluations+100));
   await polish(groups,config.maxEvaluations-24);
   // Re-rank after each contraction. The final recommendation may only have
   // appeared during polishing of another front point.
   await polish(groups,config.maxEvaluations-12,2);
   await polish(groups,config.maxEvaluations,2);
  }
  if(hooks.cancelled?.())return null;
  if(stats.evaluations<config.maxEvaluations&&groups.some(g=>g.queue.items.length))await run(groups,config.maxEvaluations,'coverage');
  const searched=stats.screened;
  if(!stats.accepted&&stats.evaluations<config.maxEvaluations&&range.min<=range.max&&(bounds.height<10000||bounds.diameter<3000)){
   const expanded={...state,length:Math.min(10000,Math.max(bounds.height+500,bounds.height*1.5)),
    'exchanger-diameter':Math.min(3000,Math.max(bounds.diameter+100,bounds.diameter*1.5))};
   const outside=await catalogue(expanded,target,range,estimate,stats,hooks,bounds);
   if(!outside||hooks.cancelled?.())return null;
   await run(outside,Math.min(config.maxEvaluations,stats.evaluations+24),'diagnosis');
  }
  if(hooks.cancelled?.())return null;
  const front=rankAccepted(calculations),best=materialize(acceptedDesigns.find(c=>c.calculationId===front[0]?.id));
  const notifications=[],add=(code,text,level='warning')=>notifications.push({code,text,level});
  let message='Поверок Teplo: '+stats.evaluations.toLocaleString('ru-RU')+'. Подходящих конструкций: '+stats.accepted+'. На фронте Парето: '+front.length+'.';
  if(best){
   message+=' Рекомендована №'+best.calculationId+' по длине, диаметру, '+(useStock?'закупке трубы':'полной длине труб')+', числу трубок и рядов.';
   if(!best.thermal.valid)add('single-coil-re-method','Рекомендация с исключением по Re одного змеевика. Применимость трубной корреляции Teplo не подтверждена.');
  }else{
   message+=' '+(stats.evaluations>=config.maxEvaluations?'Достигнут лимит 1 000 поверок.':'Среди проверенных конструкций подходящей не найдено.');
   if(range.min>range.max)add('tube-count','При заданном расходе нет целого числа трубок для предварительного Re 15 000…20 000.','error');
   else if(!searched)add('layout-grid',useStock?'В проверенной сетке нет компоновки, удовлетворяющей габаритам, навивке и заготовкам.':'В проверенной сетке нет компоновки с заданными габаритами и навивкой.');
   else if(highestDuty<target.q&&Number.isFinite(highestDuty))add('duty-shortage','Максимум среди проверенных применимых вариантов '+highestDuty.toFixed(2)+' кВт при задании '+target.q.toFixed(2)+' кВт.');
   else if(lowestDuty>1.03*target.q&&Number.isFinite(lowestDuty))add('duty-excess','Все проверенные применимые варианты превысили допуск +3 % по мощности.');
   if(witness?.geometry.height>bounds.height)add('length-limit','За пределом длины найден вариант '+witness.geometry.height+' мм при заданном максимуме '+bounds.height+' мм.');
   if(witness?.geometry.diameter>bounds.diameter)add('diameter-limit','За пределом диаметра найден вариант Ø'+witness.geometry.diameter+' мм при заданном максимуме Ø'+bounds.diameter+' мм.');
   if(!witness&&tubeReFailures)add('tube-re','Проверка Re каждой трубки 15 000…20 000 отклонила вариантов: '+tubeReFailures+'.');
   if(!witness&&shellReFailures)add('shell-re','За областью применимости по межтрубному Re оказалось вариантов: '+shellReFailures+'.');
   if(stats.errors)add('verification-errors','Ошибок поверки: '+stats.errors+'. '+firstError);
   if(!notifications.length)add('no-design',message);
  }
  stats.front=front.length;
  if(firstError)stats.firstError=firstError;
  return {kind:'coil',algorithm:config.algorithm,objective:config,rows:best?[{...project.profiles[0],detail:config.detail,design:best}]:[],
   candidates:best?[best]:[],calculations,acceptedDesigns,selectedCalculationId:best?.calculationId??null,
   stats,countRange:range,stockLengthsApplied:useStock,shellCalculation:best?.shellCalculation??null,dimensionWitness:witness,
   searchBudget:{maxEvaluations:config.maxEvaluations,screened:searched,stopped:stats.evaluations>=config.maxEvaluations?'budget-exhausted':'catalogue-exhausted'},message,notifications};
 }
 return {select,rankAccepted,materialize};
});
