const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js'),manufacturing=require('../assets/coil-manufacturing.js');
(async()=>{
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}});
 const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),validate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');
 const base={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',ph:2,pc:1.2,unknown:'mc',mc:'','area-reserve-percent':0,'tube-conductivity':16,length:10000,'exchanger-diameter':3000};
 const scenarios=[['C-2.5',90,60,20,40,2.5],['C-0.2',90,60,20,40,.2],['J-0.15',100,80,70,90,.15],['A-2.5',50,40,10,25,2.5]];
 for(const [id,thi,tho,tci,tco,mh] of scenarios){
  const memo=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(memo.has(key))return memo.get(key);const v=cp.PropsSI(...args);if(memo.size<80000)memo.set(key,v);return v},s={...base,thi,tho,tci,tco,mh},t=project.balance(s,props),r=await project.select(s,t,props);
  assert.equal(r.rows.length,1,'Must solve known counterexample '+id);assert(r.stats.evaluations<=200);assert(r.stats.phases.refinement>0);assert(r.searchBudget.firstSuccess<r.stats.evaluations);
  const c=r.rows[0].design;validate(c.geometry);assert(project.meets(c.thermal,t));
  const independently=teplo.calculate({...project.source(s,t),...project.geometryInput(c.geometry)},props);assert(project.meets(independently,t));
  for(const row of c.geometry.rows){const m=manufacturing.measure(row,c.geometry.leadBendRadius,c.geometry.leadStraightLength);assert(manufacturing.stockFor(m.totalMM));assert(Number.isInteger(row.turns))}
  assert(project.inlineLayout(c.geometry).allowed,'Every refined candidate must retain the corridor geometry');
  console.log(id,JSON.stringify({height:c.geometry.height,diameter:c.geometry.diameter,n:c.n,checks:r.stats.evaluations,excessPercent:(c.thermal.heat_duty_kw/t.q-1)*100}));
 }
 const memo=new Map(),props=(...args)=>{const k=JSON.stringify(args);if(memo.has(k))return memo.get(k);const v=cp.PropsSI(...args);if(memo.size<100000)memo.set(k,v);return v},s={...base,thi:90,tho:60,tci:20,tco:40,mh:2.5},t=project.balance(s,props),range=project.tubeCounts(s,t,props);
 assert(range.fallbackCounts.length>0&&range.fallbackCounts.length<=4);assert(new Set(range.fallbackCounts).size===range.fallbackCounts.length);assert(range.fallbackCounts.every(n=>n>=range.min&&n<=range.max&&n!==range.selected));
 const reserve=project.families(s,t,props,range.fallbackCounts);assert(reserve.list.every(f=>range.fallbackCounts.includes(f.n)));
 let cancelled=false,calls=0;const original=teplo.calculate;
 try{
  teplo.calculate=(...args)=>{calls++;return original(...args)};
  const result=await project.select(s,t,props,{cancelled:()=>cancelled,progress:p=>{if(p.phase==='refinement')cancelled=true}});
  assert.equal(result,null);assert(cancelled);assert(calls>0&&calls<200,'Cancellation during refinement must stop full calls');
 }finally{teplo.calculate=original}
 // Suppress the preferred N to exercise the real, shared-budget reserve path.
 calls=0;
 try{
  teplo.calculate=(input,...args)=>{calls++;if(input.coil_rows.reduce((sum,row)=>sum+row.count,0)===range.selected)throw Error('preferred count unavailable');return original(input,...args)};
  const r=await project.select(s,t,props);assert(calls<=200);assert.equal(calls,r.stats.evaluations);assert(r.stats.phases.fallback>0);assert.equal(r.rows.length,1,'Reserve count should recover a feasible case');
  const c=r.rows[0].design;assert(range.fallbackCounts.includes(c.n));assert(project.meets(original({...project.source(s,t),...project.geometryInput(c.geometry)},props),t));
 }finally{teplo.calculate=original}
 console.log('Refined search passed: representative corridor designs; shared pitch/starts/phase retained through refinement; full original verification; stock lengths; bounded reserve counts; cancellation inside refinement.');
})().catch(e=>{console.error(e);process.exitCode=1});
