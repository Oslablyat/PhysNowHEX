const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js');
(async()=>{
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),memo=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(memo.has(key))return memo.get(key);const value=cp.PropsSI(...args);if(memo.size<100000)memo.set(key,value);return value};
 const base={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:21,tco:40,mh:2.5,mc:3.75,ph:.6,pc:.4,unknown:'mc','area-reserve-percent':0,'tube-conductivity':16,length:2000,'exchanger-diameter':600};
 let muCalls=0;const count=project.tubeCounts(base,{mh:2.5,thi:90,tho:60,ph:.6},()=>{muCalls++;return .0004});assert.equal(muCalls,1);assert.equal(count.counts.length,1);assert(count.estimatedRe>=15000&&count.estimatedRe<=20000);
 for(const state of [{...base,mh:.2,tci:20},base]){
  const target=project.balance(state,props),started=Date.now(),result=await project.select(state,target,props);
  console.log('Budget scenario',state.mh,'kg/s:',result.stats.evaluations,'checks;',Date.now()-started,'ms;',result.message);
  assert(result.stats.evaluations<=200);assert(result.searchBudget.firstSuccess>0&&result.searchBudget.firstSuccess<=200,'Initial success must stay inside the shared budget, including reserve counts');assert(result.stats.evaluations>result.searchBudget.firstSuccess,'Continue improvement after first success');assert.equal(result.rows.length,1,'A known feasible assignment should remain solvable');
  const c=result.rows[0].design;assert(result.stats.testedCounts.includes(c.n));assert.equal(result.countRange.counts.length,1);assert(project.meets(c.thermal,target));
  assert.equal(target.reservePercent,0);assert(c.thermal.heat_duty_kw>=target.q*(1-1e-7));assert(c.thermal.heat_duty_kw<=target.q*1.01+1e-7);assert(project.dutyAgreement(c.thermal,target).allowed);
  console.log('Duty agreement:',{assignment:target.q,actual:c.thermal.heat_duty_kw,excessPercent:(c.thermal.heat_duty_kw/target.q-1)*100,hotOut:c.thermal.t_hot_out_c,coldOut:c.thermal.t_cold_out_c});
  const exact={...c.thermal,heat_duty_kw:target.q,t_hot_out_c:target.tho,t_cold_out_c:target.tco};assert(project.meets(exact,target));
  assert(project.meets({...exact,heat_duty_kw:target.q*1.01},target),'Exactly +1% is inclusive');
  for(const ratio of [.999,1.01001,1.09])assert(!project.meets({...exact,heat_duty_kw:target.q*ratio},target),'Reject power ratio '+ratio);
  assert(!project.meets({...exact,t_hot_out_c:target.tho-(target.thi-target.tho)*.01-.011},target),'Reject excessive hot outlet deviation');
  assert(!project.meets({...exact,t_cold_out_c:target.tco+(target.tco-target.tci)*.01+.011},target),'Reject excessive cold outlet deviation');
  c.geometry.rows.slice(1).forEach((r,i)=>assert(Math.abs((r.diameter-c.geometry.rows[i].diameter)/2-c.geometry.tubeDiameter-3)<1e-9));
  const independently=teplo.calculate({...project.source(state,target),...project.geometryInput(c.geometry)},props);assert(project.meets(independently,target));
  const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),validate=require('node:vm').runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');validate(c.geometry);
 }
 const legacy=project.balance({...base,'area-reserve-percent':10},props);assert.equal(legacy.reservePercent,0,'Temporarily ignore saved legacy UA reserve in matched-duty mode');
 const overState={...base,mh:.2,tci:20},overTarget=project.balance(overState,props),search=project.families(overState,overTarget,props),dummy={geometryChecks:0},pool=await project.shortlist(search,overState,overTarget,props,dummy,{}),over=pool.find(c=>c.ratio>1.2&&c.ratio<1.4);assert(over);
 const oversized=teplo.calculate({...project.source(overState,overTarget),...project.geometryInput(over.geometry)},props);assert(oversized.valid,'Oversized comparison must pass original methodology, so the duty limit is what rejects it');assert(project.inlineLayout(over.geometry).allowed);assert(oversized.heat_duty_kw>overTarget.q*1.01);assert(!project.meets(oversized,overTarget),'A real Teplo result above +1% must not be accepted');
 // Count actual calls, including exceptions: the bound must be enforced in the
 // solver, not just in a progress counter or by truncating returned attempts.
 const original=teplo.calculate;let calls=0;const seen=new Set();
 try{
  teplo.calculate=input=>{const key=JSON.stringify(input);assert(!seen.has(key),'Full verification must not repeat identical geometry');seen.add(key);calls++;throw Error('forced full verification failure')};
  const state={...base,mh:.2,tci:20},target=project.balance(state,props),r=await project.select(state,target,props);
  assert(r.stats.geometryChecks>200);assert.equal(calls,200);assert.equal(r.stats.evaluations,200);assert.equal(r.stats.errors,200);assert.equal(r.rows.length,0);assert.equal(r.searchBudget.stopped,'budget-exhausted');assert.match(r.message,/не доказывает отсутствие решения/);
 }finally{teplo.calculate=original}
 console.log('Search budget passed: one preferred count; bounded stock-compatible reserves; exact radial 3-mm gap; improvement after success; actual hard shared 200-call limit including failures; no duplicates; independent original Teplo.');
})().catch(e=>{console.error(e);process.exitCode=1});
