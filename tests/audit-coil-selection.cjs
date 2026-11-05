/* Reproducible 150-case audit of the production selector.
 * Writes measured evidence, not golden expected success rates. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js'),manufacturing=require('../assets/coil-manufacturing.js');
const flows=[.02,.05,.08,.1,.15,.2,.35,.5,1,2.5,5,10,20,40,80];
const regimes=[
 ['A',50,40,10,25],['B',70,50,15,35],['C',90,60,20,40],
 ['D',90,80,20,30],['E',90,30,20,80],['F',120,70,20,60],
 ['G',150,90,30,70],['H',160,60,10,100],['I',60,35,30,55],
 ['J',100,80,70,90]
];
const base={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',ph:2,pc:1.2,unknown:'mc',mc:'','area-reserve-percent':0,'tube-conductivity':16,length:10000,'exchanger-diameter':3000};
const reportName=process.argv.find(s=>s.startsWith('--output='))?.slice(9)||'coil-selection-v8-150.json';
assert(/^[a-z0-9-]+\.json$/.test(reportName));
const requested=process.argv.find(s=>s.startsWith('--cases='))?.slice(8).split(',');
const output=path.resolve(__dirname,'../docs/audits',reportName);
const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const validate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');
function observation(r,target){
 const app=project.applicability(r,target),duty=project.dutyAgreement(r,target);
 return {q:r.heat_duty_kw,ratio:r.heat_duty_kw/target.q,hot:r.t_hot_out_c,cold:r.t_cold_out_c,re:r.coils[0].re_hot,shellRe:r.shell.re_cold,valid:r.valid,applicable:app.allowed,agreement:duty.allowed,uaOK:r.ua_w_k>=target.requiredUA*(1-1e-9),blocking:app.blocking.filter((s,i,a)=>a.indexOf(s)===i).slice(0,4),dutyChecks:duty.checks};
}
function checkGeometry(c){
 validate(c.geometry);const g=c.geometry;
 assert(project.inlineLayout(g).allowed,'The selected geometry must be physically inline');
 assert(g.height<=base.length&&g.diameter<=base['exchanger-diameter']);
 assert.equal(g.rows.reduce((s,r)=>s+r.count,0),c.n);
 g.rows.forEach((r,i)=>{assert(Number.isInteger(r.turns)&&r.turns<=1000);assert(r.count<=64);assert(r.diameter/2/(g.tubeDiameter-2*g.tubeWall)>3&&r.diameter/2/(g.tubeDiameter-2*g.tubeWall)<12);if(i)assert(Math.abs((r.diameter-g.rows[i-1].diameter)/2-g.tubeDiameter-3)<1e-8);const m=manufacturing.measure(r,g.leadBendRadius,g.leadStraightLength),stock=manufacturing.stockFor(m.totalMM);assert(stock);assert(m.totalMM<stock&&m.totalMM>=stock*.8-1e-7)});
}
(async()=>{
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}});
 const report={algorithm:project.algorithm,created:new Date().toISOString(),base,flows,regimes:regimes.map(([id,thi,tho,tci,tco])=>({id,thi,tho,tci,tco})),cases:[]};
 fs.mkdirSync(path.dirname(output),{recursive:true});
 const save=()=>fs.writeFileSync(output,JSON.stringify(report,null,2)+'\n');
 const original=teplo.calculate;
 for(const [regime,thi,tho,tci,tco] of regimes)for(const mh of flows){
  if(requested&&!requested.includes(regime+'-'+mh))continue;
  const id=regime+'-'+mh,state={...base,thi,tho,tci,tco,mh},cache=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(cache.has(key))return cache.get(key);const v=cp.PropsSI(...args);if(cache.size<80000)cache.set(key,v);return v},start=performance.now();
  const row={id,regime,mh,state,passedAudit:true};let target,actualCalls=0;const observations=[];
  try{
   target=project.balance(state,props);row.target={q:target.q,mc:target.mc,dt:target.dt,requiredUA:target.requiredUA,imbalance:target.imbalance};
   teplo.calculate=(input,p)=>{actualCalls++;try{const r=original(input,p);observations.push(observation(r,target));return r}catch(e){observations.push({error:e.message});throw e}};
   const r=await project.select(state,target,props);row.stats=r.stats;row.budget=r.searchBudget;row.countRange=r.countRange;row.message=r.message;row.found=!!r.rows.length;if(process.argv.includes('--details'))row.attempts=r.attempts;
   assert(actualCalls<=200);assert.equal(actualCalls,r.stats.evaluations);assert(target.imbalance<=.001);
   if(row.found){const c=r.rows[0].design;checkGeometry(c);const independent=original({...project.source(state,target),...project.geometryInput(c.geometry)},props);assert(project.meets(independent,target));assert(Math.abs(independent.heat_duty_kw-c.thermal.heat_duty_kw)<1e-9);row.selected={...observation(independent,target),n:c.n,height:c.geometry.height,diameter:c.geometry.diameter,rowCount:c.rowCount,geometry:c.geometry,manufacturing:c.manufacturing};}
   const valid=observations.filter(o=>o.applicable),close=[...valid].sort((a,b)=>Math.abs(a.ratio-1.005)-Math.abs(b.ratio-1.005));
   row.diagnostics={calls:actualCalls,errors:observations.filter(o=>o.error).length,applicable:valid.length,below:valid.filter(o=>o.ratio<1-1e-7).length,above:valid.filter(o=>o.ratio>1.01+1e-9).length,agreement:valid.filter(o=>o.agreement).length,tubeReFailures:observations.filter(o=>o.blocking?.some(s=>s.includes('15000'))).length,shellReFailures:observations.filter(o=>o.shellRe>=1e5).length,closest:close.slice(0,3)};
   if(process.argv.includes('--details'))row.observations=observations;
  }catch(e){row.passedAudit=false;row.auditError=e.stack||e.message;row.found=false}
  finally{teplo.calculate=original}
  row.elapsedMS=performance.now()-start;report.cases.push(row);
  if(report.cases.length%5===0){save();console.log(JSON.stringify({completed:report.cases.length,found:report.cases.filter(c=>c.found).length,auditFailures:report.cases.filter(c=>!c.passedAudit).length,last:id,ms:Math.round(row.elapsedMS)}))}
 }
 report.summary={total:report.cases.length,found:report.cases.filter(c=>c.found).length,auditFailures:report.cases.filter(c=>!c.passedAudit).length,totalCalls:report.cases.reduce((s,c)=>s+(c.diagnostics?.calls||0),0),totalMS:report.cases.reduce((s,c)=>s+c.elapsedMS,0)};save();console.log(report.summary);if(report.summary.auditFailures)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1});
