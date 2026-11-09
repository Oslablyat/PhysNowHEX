const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {pathToFileURL}=require('node:url');
const p=require('../assets/coil-project-method.js'),solver=require('../assets/coil-project-multicriteria.js');
const teplo=require('../assets/coil-thermal-method.js'),manufacturing=require('../assets/coil-manufacturing.js');
const root=path.resolve(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const validate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');
const keys=['height','diameter','materialMetres','count','rowCount'];
const point=(geometryKey,values,warning=false)=>({...Object.fromEntries(keys.map((key,i)=>[key,values[i]])),geometryKey,warning});
const tradeoffs=[point('short',[1,5,7,4,2]),point('narrow',[5,1,7,4,2]),point('middle-b',[3,3,7,4,2]),
 point('middle-a',[3,3,7,4,2]),point('dominated',[4,5,7,4,2]),point('waiver',[1,1,1,1,1],true)];
assert.deepEqual(solver.rankAccepted(tradeoffs).map(r=>r.geometryKey),['middle-a','middle-b','narrow','short']);
assert.equal(tradeoffs[2].worstLoss,.5);
assert.equal(solver.rankAccepted([tradeoffs[5]])[0].worstLoss,0,'A constant metric has zero regret');
assert.deepEqual(p.radialGaps(14),Array.from({length:12},(_,i)=>1.5+i/2));
assert.deepEqual(p.radialGaps(14.5),p.radialGaps(14));

(async()=>{
 const cp=await(await import(pathToFileURL(path.join(root,'assets/vendor/coolprop/coolprop.js')))).default({
  wasmBinary:fs.readFileSync(path.join(root,'assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}
 });
 const cache=new Map(),props=(...args)=>{const k=JSON.stringify(args);if(!cache.has(k))cache.set(k,cp.PropsSI(...args));return cache.get(k)};
 const state={flow:'counter','hot-fluid':'water','cold-fluid':'water',thi:90,tho:60,tci:20,tco:40,mh:.2,ph:2,pc:1.2,
  unknown:'mc','tube-conductivity':16,length:2000,'exchanger-diameter':600,'design-objective':'pareto'};
 const target=p.balance(state,props);assert.equal(target.projectAlgorithm,p.multicriteria.algorithm);
 const edge={heat_duty_kw:target.q*1.03,t_hot_out_c:59.09,t_cold_out_c:40.61};
 assert(p.dutyAgreement(edge,target).allowed);
 for(const change of [{heat_duty_kw:target.q*.999},{heat_duty_kw:target.q*1.03001},{t_hot_out_c:59.0899},{t_hot_out_c:60.0101},{t_cold_out_c:40.6101},{t_cold_out_c:39.9899}]){
  assert(!p.dutyAgreement({...edge,...change},target).allowed,JSON.stringify(change));
 }
 assert(!p.dutyAgreement(edge,{...target,projectAlgorithm:p.algorithm}).allowed);
 const original=teplo.calculate,inputs=new Set();let result,calls=0;
 try{
  teplo.calculate=(input,...args)=>{calls++;inputs.add(JSON.stringify(input));return original(input,...args)};
  result=await solver.select(state,target,props);
 }finally{teplo.calculate=original}
 assert.equal(calls,result.stats.evaluations);assert.equal(inputs.size,calls);
 assert.equal(result.searchBudget.stopped,'budget-exhausted');assert.equal(calls,1000);assert(result.searchBudget.screened>calls);
 assert.equal(result.stockLengthsApplied,true,'Legacy sheets with no stock flag use purchase lengths');
 assert(result.stats.accepted>result.stats.front&&result.stats.front>1);
 assert.equal(result.calculations.length,result.acceptedDesigns.length);
 const table=result.calculations,front=table.filter(a=>!table.some(b=>keys.every(k=>b[k]<=a[k])&&keys.some(k=>b[k]<a[k])));
 assert.deepEqual(table.filter(r=>r.rank).map(r=>r.id).sort(),front.map(r=>r.id).sort(),'Front agrees with an independent exhaustive dominance check');
 const best=result.rows[0].design;
 assert.equal(best.calculationId,table.find(r=>r.rank===1).id);
 const binding={key:'current-sheet',geometryKey:p.geometryKey(best.geometry),manual:false};
 const context={CoilProjectMethod:p,coilProject:{phase:'ready',key:'current-sheet',version:'8.0.0'},
  currentVariants:{...result,inputKey:'current-sheet'},selectedVariant:'balanced',verificationState:best.geometry,coilVariantBinding:binding};
 const cached=vm.runInNewContext(app.slice(app.indexOf('function cachedCoilVerification('),app.indexOf('function initializeCoilThermalMethod('))+';cachedCoilVerification',context);
 const currentInputs={...p.source(state,target),...p.geometryInput(best.geometry)};
 assert.equal(cached(currentInputs).result.coils,best.thermal.coils);
 const volumeInputs={...currentInputs,cold_flow_mode:'volume',volume_flow_cold_m3_h:best.thermal.volume_flow_cold_inlet_m3_h};
 assert.equal(cached(volumeInputs).result.cold_flow_mode,'volume');
 assert.equal(cached({...volumeInputs,volume_flow_cold_m3_h:volumeInputs.volume_flow_cold_m3_h*1.001}),null);
 assert.equal(cached({...currentInputs,arrangement:'staggered'}),null);
 binding.manual=true;assert.equal(cached(currentInputs),null);binding.manual=false;
 const syntheticRows=[0,.0155,.033].map(radius_m=>({...best.thermal.rows[0],radius_m:radius_m+.04}));
 assert(p.applicability({...best.thermal,rows:syntheticRows},target).allowed);
 syntheticRows[1].radius_m+=.0001;
 assert(!p.applicability({...best.thermal,rows:syntheticRows},target).allowed,'Off-grid radial gaps block project acceptance');
 assert(table.some(r=>r.excessPercent>1),'The new 3% tolerance admits real results outside the historical band');
 for(const record of result.acceptedDesigns){
  const c=solver.materialize(record),g=c.geometry,row=table.find(r=>r.id===c.calculationId);
  validate(g);assert(p.inlineLayout(g).allowed);
  const independent=original({...p.source(state,target),...p.geometryInput(g)},props);
  assert.deepEqual(c.thermal,independent,'All individual tube fields must survive the private cache');
  assert(p.meets(independent,target));assert.equal(row.geometryKey,p.geometryKey(g));
  let purchase=0;
  for(const [i,r] of g.rows.entries()){
   const exact=manufacturing.measure(r,g.leadBendRadius,g.leadStraightLength),saved=c.manufacturing[i];
   assert(Math.abs(exact.totalMM-saved.totalMM)<1e-8);
   assert.equal(saved.stockMM,manufacturing.stockFor(exact.totalMM));purchase+=r.count*saved.stockMM/1000;
  }
  assert.equal(row.materialMetres,purchase);assert.equal(row.stockMetres,purchase);
 }
 // Stress the real scheduler and accounting without making 1,000 expensive
 // property solves in every regression run. Every injected failure costs a call.
 const free={...state,mh:.5,'stock-lengths':false},freeTarget=p.balance(free,props);
 let failed=0,mixed=false,allInline=true;const distinct=new Set();
 try{
  teplo.calculate=input=>{
   failed++;distinct.add(JSON.stringify(input));allInline&&=input.arrangement==='inline';
   const rows=input.coil_rows,gaps=rows.slice(1).map((r,i)=>Math.round(2000*(r.radius_m-rows[i].radius_m-r.tube_outer_diameter_m))/2);
   if(new Set(gaps).size>1)mixed=true;
   throw Error('injected verification failure');
  };
  const limited=await solver.select(free,freeTarget,props);
  assert.equal(failed,1000);assert.equal(distinct.size,failed);assert(allInline&&mixed);
  assert.deepEqual(limited.stats.phases,{discovery:100,refinement:600,coverage:300});
  assert.equal(limited.stats.evaluations,limited.stats.errors);assert.equal(limited.searchBudget.stopped,'budget-exhausted');
  assert.equal(limited.selectedCalculationId,null);assert.equal(limited.stats.firstError,'injected verification failure');
  const before=failed;assert.equal(await solver.select(free,freeTarget,props,{cancelled:()=>failed>=before+3}),null);
  assert.equal(failed,before+3,'Stop promptly when the sheet changes');
 }finally{teplo.calculate=original}
 const noRange={...state,mh:.0001},empty=await solver.select(noRange,p.balance(noRange,props),props);
 assert.equal(empty.stats.evaluations,0);assert.equal(empty.selectedCalculationId,null);assert(empty.notifications.some(n=>n.code==='tube-count'));
 const tight={...state,length:200,'exchanger-diameter':200},diagnosis=await solver.select(tight,target,props);
 assert.equal(diagnosis.selectedCalculationId,null);assert.equal(diagnosis.calculations.length,0);
 assert(diagnosis.notifications.some(n=>n.code==='length-limit'));
 assert(diagnosis.stats.phases.diagnosis>0&&diagnosis.stats.phases.diagnosis<=24);
 assert(diagnosis.dimensionWitness.geometry.height>tight.length);
 const witness=original({...p.source(tight,target),...p.geometryInput(diagnosis.dimensionWitness.geometry)},props);
 assert(p.meets(witness,target));
 const finer={...state,thi:55,tho:46,tci:15,tco:31,mh:.06,ph:.35,pc:.25,length:700,'exchanger-diameter':250,'single-coil':true};
 const refined=await solver.select(finer,p.balance(finer,props),props);
 assert(refined.stats.evaluations<=1000);
 assert(refined.acceptedDesigns.some(d=>d.geometry.rows[0].diameter===60&&d.geometry.height===222),'Recover the independently verified R30 drawing');
 console.log('Multicriteria selection passed: real stock catalogue, original Teplo snapshots, Pareto dominance/minimax/ties, duty and radial grids, warnings, shared budget, deduplication and cancellation.');
})().catch(error=>{console.error(error);process.exitCode=1});
