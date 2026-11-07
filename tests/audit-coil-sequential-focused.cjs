const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),p=require('../assets/coil-project-method.js'),q=require('../assets/coil-sequential-method.js'),thermal=require('../assets/coil-thermal-method.js'),m=require('../assets/coil-manufacturing.js'),format=require('../assets/coil-sequential-format.js');
const sandbox={module:{exports:{}},require:createRequire(path.join(root,'assets/coil-sequential-method.js')),performance};
vm.runInNewContext(fs.readFileSync(path.join(root,'tests/reference/coil-sequential-v5.js'),'utf8'),sandbox);const old=sandbox.module.exports;
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),validate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');
const base={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:20,tco:40,mh:.5,ph:2,pc:1.2,unknown:'mc','tube-conductivity':16,length:10000,'exchanger-diameter':3000};
const cases=[... [.01,.08,.2,.5,2.5,10].map(mh=>({id:'single-free-'+mh,state:{...base,mh,'single-coil':true,'stock-lengths':false}})),...[.08,.5,2.5].map(mh=>({id:'single-stock-'+mh,state:{...base,mh,'single-coil':true,'stock-lengths':true}})),
 {id:'single-tight-400',state:{...base,length:400,'single-coil':true,'stock-lengths':false}},
 {id:'normal-free-0.5',state:{...base,'stock-lengths':false}},
 {id:'normal-free-2.5',state:{...base,mh:2.5,'stock-lengths':false}},
 {id:'normal-stock-1',state:{...base,mh:1,'stock-lengths':true}},
 {id:'normal-tight-1800',state:{...base,mh:2.5,length:1800}},
 {id:'cooler-50',state:{...base,thi:50,tho:40,tci:10,tco:25,mh:2.5}},
 {id:'hotter-160',state:{...base,thi:160,tho:60,tci:10,tco:100,mh:.5}}];
(async()=>{
 const cp=await(await import(pathToFileURL(path.join(root,'assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.join(root,'assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),original=thermal.calculate;
 const report={created:new Date().toISOString(),algorithms:{current:p.algorithm,previous:old.algorithm,after:q.algorithm},cases:[]};
 for(const example of cases){const pair={...example};
  for(const [side,engine]of [['current',p],['previous',old],['after',q]]){
   const memo=new Map(),props=(...a)=>{const k=JSON.stringify(a);if(!memo.has(k))memo.set(k,cp.PropsSI(...a));return memo.get(k)},target=p.balance(example.state,props),start=performance.now(),seen=new Set();pair.target=target;let calls=0,result;
   try{thermal.calculate=(input,...a)=>{calls++;const k=JSON.stringify(input);assert(!seen.has(k));seen.add(k);return original(input,...a)};result=await engine.select(example.state,target,props)}finally{thermal.calculate=original}
   assert.equal(calls,result.stats.evaluations);assert(calls<=200);
   for(const c of side==='after'?result.acceptedDesigns:result.rows.map(r=>r.design)){const g=c.geometry;validate(g);if(side==='after'){assert(p.inlineLayout(g).allowed);assert(q.gapGeometryAllowed(g))};assert(g.height<=example.state.length);assert(g.diameter<=example.state['exchanger-diameter']);assert(p.meets(original({...p.source(example.state,target),...p.geometryInput(g)},props),target));if(example.state['single-coil'])assert.equal(c.n,1);for(const row of g.rows){assert(p.axialGap(g.tubeDiameter,row.pitch,row.count).allowed);if(example.state['stock-lengths']!==false)assert((side==='current'?m:q).stockFor(m.measure(row,g.leadBendRadius,g.leadStraightLength).totalMM))}}
   pair[side]=format.pack(result,performance.now()-start);
  }
  if(pair.previous.found)assert(pair.after.found,'Retain a source-valid solution even if the trade-off changes');
  report.cases.push(pair);console.log(JSON.stringify({id:pair.id,...Object.fromEntries(['current','previous','after'].map(s=>[s,{h:pair[s].selected?.geometry.height,D:pair[s].selected?.geometry.diameter,calls:pair[s].stats.evaluations}]))}));
 }
 fs.writeFileSync(path.join(root,'docs/audits/coil-sequential-focused-v6.json'),JSON.stringify(report)+'\n');
})().catch(e=>{console.error(e);process.exitCode=1});
