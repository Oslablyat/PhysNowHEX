const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js'),manufacturing=require('../assets/coil-manufacturing.js');
(async()=>{
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),cache=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(cache.has(key))return cache.get(key);const v=cp.PropsSI(...args);if(cache.size<100000)cache.set(key,v);return v};
 const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),validate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');
 const base={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tco:40,mh:2.5,mc:'',ph:.6,pc:.4,unknown:'mc','area-reserve-percent':0,'tube-conductivity':16,length:2000,'exchanger-diameter':600},report={algorithm:project.algorithm,cases:[]};
 for(const tci of [20,21,31]){
  const state={...base,tci},target=project.balance(state,props),range=project.tubeCounts(state,target,props);
  assert(range.fallbackCounts.length<=4);assert(range.fallbackCounts.every(n=>n>=range.min&&n<=range.max&&n!==range.selected));
  for(const n of range.fallbackCounts)assert(project.families(state,target,props,[n]).list.length>0,'Do not waste a reserve slot on impossible radial rows: '+n);
  if(tci===31){assert.equal(range.selected,54);assert(range.fallbackCounts.includes(56));assert(!range.fallbackCounts.includes(53));assert(!range.fallbackCounts.includes(47));}
  const result=await project.select(state,target,props);assert.equal(result.rows.length,1,'Must solve cold inlet '+tci);assert(result.stats.evaluations<=200);
  assert(result.stats.testedCounts.filter(n=>n!==range.selected).length<=4,'Only four reserve counts may reach full Teplo');
  const c=result.rows[0].design;assert(project.inlineLayout(c.geometry).allowed);validate(c.geometry);assert(c.geometry.height<=2000&&c.geometry.diameter<=600);
  for(const row of c.geometry.rows){assert.equal(row.turns,c.geometry.rows[0].turns);assert(Math.abs(row.turns*row.pitch+c.geometry.tubeDiameter-c.geometry.height)<1e-7,'Every radial row must fill the complete shell working height');}
  const independent=teplo.calculate({...project.source(state,target),...project.geometryInput(c.geometry)},props);assert(project.meets(independent,target));
  for(const row of c.geometry.rows){const measured=manufacturing.measure(row,c.geometry.leadBendRadius,c.geometry.leadStraightLength);assert(manufacturing.stockFor(measured.totalMM));}
  const selected={q:independent.heat_duty_kw,hot:independent.t_hot_out_c,cold:independent.t_cold_out_c,re:independent.coils[0].re_hot,shellRe:independent.shell.re_cold,valid:independent.valid,geometry:c.geometry};
  report.cases.push({id:'cold-inlet-'+tci,state,target:{q:target.q,mc:target.mc},found:true,selected,range,stats:result.stats});
  console.log(JSON.stringify({tci,preferred:range.selected,reserve:range.fallbackCounts,chosen:c.n,height:c.geometry.height,diameter:c.geometry.diameter,target:target.q,actual:selected.q,excessPercent:(selected.q/target.q-1)*100,calls:result.stats.evaluations}));
 }
 // Pure preliminary count tests: bounded reserve generation must neither invoke
 // extra property calls nor include a count outside the target Re interval.
 for(const mh of [.02,.05,.1,.2,.5,1,2.5,5,10,40]){
  const state={...base,tci:31,mh};let calls=0;const target=project.balance(state,props),range=project.tubeCounts(state,target,(...args)=>{calls++;return props(...args)});assert.equal(calls,1);assert(range.fallbackCounts.length<=4);
  assert(new Set(range.fallbackCounts).size===range.fallbackCounts.length);for(const n of range.fallbackCounts)assert(project.families(state,target,props,[n]).list.length>0);
 }
 if(process.argv.includes('--report'))fs.writeFileSync(path.resolve(__dirname,'../docs/audits/full-height-user-cases-v8.json'),JSON.stringify(report,null,2)+'\n');
 console.log('Inline reserve counts passed: screenshot case recovered; only feasible row multiples; at most four reserves; one viscosity evaluation; unchanged geometry, stock, Re, duty and 200-call guards.');
})().catch(e=>{console.error(e);process.exitCode=1});
