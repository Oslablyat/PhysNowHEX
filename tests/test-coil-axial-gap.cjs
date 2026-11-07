const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js');
(async()=>{
 assert.deepEqual(project.axialGaps(14),Array.from({length:13},(_,i)=>i+2));
 assert.deepEqual(project.axialGaps(20),Array.from({length:19},(_,i)=>i+2));
 assert.deepEqual(project.axialGaps(14.5),Array.from({length:13},(_,i)=>i+2));
 for(const [d,a,allowed]of [[14,15,false],[14,15.4,false],[14,16,true],[14,28,true],[14,29,false],[20,22,true],[20,21,false],[14.5,16.5,true],[14.5,17,false]])assert.equal(project.axialGap(d,a*5,5).allowed,allowed,`${d}, ${a}`);
 const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),validate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),cache=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(!cache.has(key))cache.set(key,cp.PropsSI(...args));return cache.get(key)};
 const base={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:20,tco:40,mh:2.5,mc:'',ph:.6,pc:.4,unknown:'mc','area-reserve-percent':0,'tube-conductivity':16,length:2000,'exchanger-diameter':600};
 // Every discrete catalogue entry, including non-default/fractional diameters,
 // must pass the actual application's independent collision/height validator.
 for(const d of [14,14.5,20]){
  const state={...base,mh:.2*(d-5)/9,'refine-tubes':true,'tube-diameter':d,'tube-wall':2.5},target=project.balance(state,props),search=project.families(state,target,props),pool=await project.shortlist(search,state,target,props,{geometryChecks:0},{});
  assert(pool.length>0,'Catalogue for do='+d);
  for(const l of pool){validate(l.geometry);assert(project.inlineLayout(l.geometry).allowed);for(const row of l.geometry.rows){const gap=project.axialGap(d,row.pitch,row.count);assert(gap.allowed);assert(Number.isInteger(row.turns));assert(Math.abs(row.turns*row.pitch+d-l.geometry.height)<1e-7)}}
 }
 // A height can have multiple valid whole-turn / whole-gap constructions.
 // Keep both: collapsing them by height alone loses different heating areas.
 const f={d:14,w:2.5,n:1,diameter:86,shell:{wallMM:1,innerMM:84},coreDiameter:44,minimum:30,rows:[{diameter:64,count:1,minPitch:16}],pitches:project.axialGaps(14).map(s=>14+s)};
 const dense=project.compactGeometry(f,446,6000,27),open=project.compactGeometry(f,446,6000,24);
 assert(dense&&open);assert.equal(dense.geometry.rows[0].pitch,16);assert.equal(open.geometry.rows[0].pitch,18);
 assert(project.compare({geometry:dense.geometry,wasteMM:100,n:1},{geometry:open.geometry,wasteMM:0,n:1})<0,'For equal dimensions prefer the smaller axial gap');
 const target=project.balance(base,props),calls=[],original=teplo.calculate;
 try{
  teplo.calculate=(input,...args)=>{for(const row of input.coil_rows)assert(project.axialGap(row.tube_outer_diameter_m*1000,row.pitch_m*1000,row.count).allowed,'Every full Teplo call must use the discrete axial rule');calls.push(input);return original(input,...args)};
  for(const state of [base,{...base,tci:31,length:1500},{...base,'single-coil':true,'stock-lengths':false,mh:.047,tci:55,tco:70}]){
   const t=project.balance(state,props),r=await project.select(state,t,props);assert(r.stats.evaluations<=200);
   if(state.length===1500){assert(!r.rows.length);assert(r.dimensionWitness);assert(r.notifications.some(n=>n.code==='length-limit'))}
   else{assert(r.rows.length);const g=r.rows[0].design.geometry;validate(g);assert(project.meets(original({...project.source(state,t),...project.geometryInput(g)},props),t));assert(project.axialGap(g.tubeDiameter,g.rows[0].pitch,g.rows[0].count).allowed)}
  }
 }finally{teplo.calculate=original}
 assert(calls.length>0);
 const accepted=await project.select({...base,mh:.2},project.balance({...base,mh:.2},props),props),thermal=structuredClone(accepted.rows[0].design.thermal);
 thermal.rows.forEach(row=>{row.pitch_m=row.coil_count*.0154});
 assert(!project.applicability(thermal,project.balance({...base,mh:.2},props)).allowed,'A fractional axial clear gap cannot pass final project acceptance');
 // New packing/stock constraints can remove former broad-pitch solutions.
 // Never restore one by bypassing the requested gap or the +1% duty limit.
 for(const mh of [.2,.5]){
  const state={...base,tho:80,tco:30,mh,ph:2,pc:1.2,length:10000,'exchanger-diameter':3000},r=await project.select(state,project.balance(state,props),props);
  assert(!r.rows.length);assert.equal(r.searchBudget.stopped,'budget-exhausted');assert.equal(r.stats.evaluations,200);
 }
 console.log('Axial gaps passed: 1.1do…2do; integer clear mm; starts vs turns; fractional tube diameters; real collision validation of entire catalogues; equal-height alternatives; final Teplo guard; single coil/diagnostics/budget; strict refusal of former broad-pitch cases.');
})().catch(error=>{console.error(error);process.exitCode=1});
