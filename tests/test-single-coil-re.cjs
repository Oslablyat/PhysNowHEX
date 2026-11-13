const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js'),manufacturing=require('../assets/coil-manufacturing.js');
(async()=>{
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),cache=new Map(),props=(...args)=>{const k=JSON.stringify(args);if(!cache.has(k))cache.set(k,cp.PropsSI(...args));return cache.get(k)};
 const base={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:20,tco:40,mh:.08,ph:.6,pc:.4,unknown:'mc','area-reserve-percent':0,'tube-conductivity':16,length:2000,'exchanger-diameter':600,'single-coil':true,'stock-lengths':false};
 let low,high;
 for(const [mh,stock]of [[.01,false],[.08,false],[.08,true],[2.5,false]]){
  const s={...base,mh,'stock-lengths':stock},t=project.balance(s,props),range=project.tubeCounts(s,t,props);assert(project.singleCoilReUnrestricted(t));assert.deepEqual(range.counts,[1]);assert.equal(range.min,1);assert.equal(range.max,1);assert(!range.fallbackCounts.length);assert(project.families(s,t,props).list.length);
  let calls=0;const original=teplo.calculate;
  let r;try{teplo.calculate=(input,...args)=>{calls++;assert.equal(input.coil_rows.reduce((n,row)=>n+row.count,0),1);return original(input,...args)};r=await project.select(s,t,props)}finally{teplo.calculate=original}
  assert.equal(r.rows.length,1,'One-coil assignment outside former Re bounds: '+mh);assert(calls>0&&calls<=200);assert.equal(calls,r.stats.evaluations);assert(r.stats.testedCounts.every(n=>n===1));
  const c=r.rows[0].design,independent=original({...project.source(s,t),...project.geometryInput(c.geometry)},props),snapshot=structuredClone(independent),check=project.applicability(independent,t);
  assert(project.meets(independent,t));assert(project.dutyAgreement(independent,t).allowed);assert(project.inlineLayout(c.geometry).allowed);assert.equal(c.n,1);assert.deepEqual(independent,snapshot,'Project acceptance must not rewrite source validity or checks');
  assert(independent.coils[0].re_hot<15000||independent.coils[0].re_hot>20000);assert(!r.notifications.some(n=>n.code==='tube-re'));assert.match(r.message,/Re в трубке не ограничен/);
  if(stock)for(const m of c.manufacturing){assert.equal(manufacturing.stockFor(m.totalMM),m.stockMM);assert(m.wasteFraction<=.2)}
  if(mh===.01){low={t,thermal:independent};assert.equal(independent.valid,false);assert.equal(check.fullyValid,false);assert(check.ignored.length);assert(r.notifications.some(n=>n.code==='single-coil-re-method'&&n.level==='warning'));assert.deepEqual(c.ignoredCriteria,check.ignored)}
  else{assert.equal(independent.valid,true);assert.equal(check.ignored.length,0);assert(!r.notifications.some(n=>n.code==='single-coil-re-method'))}
  if(mh===.08&&!stock)high={t,thermal:independent};
  console.log(JSON.stringify({mh,stock,re:independent.coils[0].re_hot,height:c.geometry.height,sourceValid:independent.valid,calls}));
 }
 assert(!project.meets(low.thermal,{...low.t,singleCoil:false}),'Ordinary mode retains both source and project Re criteria');
 assert(!project.meets(low.thermal,{...low.t,projectAlgorithm:'legacy'}),'Legacy metadata cannot activate a waiver');
 for(const message of ['3 < R/d внутреннего диаметра < 12: test','Другой трубный критерий']){const bad=structuredClone(low.thermal);bad.coils[0].tube_checks.push(message);assert(!project.applicability(bad,low.t).allowed)}
 const shell=structuredClone(low.thermal);shell.shell.checks.push('Re межтрубного потока < 100000');shell.shell.valid=false;assert(!project.applicability(shell,low.t).allowed,'Only tube-side Re is waived');
 const multiple=structuredClone(low.thermal);multiple.coils.push(structuredClone(multiple.coils[0]));multiple.rows[0].coil_count=2;assert(!project.applicability(multiple,low.t).allowed,'Flag cannot authorize multiple tubes');
 const unknown=structuredClone(low.thermal);unknown.coils[0].tube_checks=[];assert(!project.applicability(unknown,low.t).allowed,'Do not ignore unexplained valid=false');
 const short=structuredClone(low.thermal);short.coils[0].tube_checks.push('При L/d < 50 нужно 10000 ≤ Re ≤ 1000000: test');assert(project.applicability(short,low.t).allowed,'Both original tube Re checks are waived explicitly');
 const noDuty={...low.thermal,heat_duty_kw:low.t.q*1.02};assert(!project.meets(noDuty,low.t),'Re waiver cannot weaken +1% duty');
 const ordinary={...base,'single-coil':false,mh:.2},target=project.balance(ordinary,props),selected=await project.select(ordinary,target,props);assert(selected.rows.length);const c=selected.rows[0].design;assert(c.n>1);assert(c.thermal.coils.every(coil=>coil.re_hot>=15000&&coil.re_hot<=20000));assert(!project.singleCoilReUnrestricted(target));
 // Execute the production thermal-status renderer with real calculation data.
 // A waived source criterion must remain orange, never a false green Teplo pass.
 const ui=fs.readFileSync(path.resolve(__dirname,'../assets/coil-thermal-ui.js'),'utf8'),renderCode=ui.slice(ui.indexOf('  function render(r){'),ui.indexOf('  function run(){'));
 for(const sample of [low,high,{t:target,thermal:c.thermal}]){
  const tables=[],context={root:{CoilTemperatureChart:{markup:()=>'',bind(){}}},lastInputs:{},cardGroups:()=>'',hooks:{assess:r=>({target:sample.t,meets:project.meets(r,sample.t),applicability:project.applicability(r,sample.t),agreement:project.dutyAgreement(r,sample.t)})},element:{dataset:{}},status:{dataset:{},textContent:''},output:{innerHTML:''},version:'8.0.0',f:v=>String(v),esc:String,metrics:()=>'',table:(title,headers,rows)=>{tables.push({title,rows});return ''},notify(){}};
  vm.runInNewContext(renderCode+';render(data)',{...context,data:sample.thermal});
  if(sample===low){assert.equal(context.status.dataset.kind,'warning');assert.match(context.status.textContent,/применимость.*не подтверждена/i)}
  if(sample===high){assert.equal(context.status.dataset.kind,'valid');assert.match(context.status.textContent,/Re трубного потока не ограничен/)}
  if(sample===low||sample===high)assert(!JSON.stringify(tables).includes('Проектное ограничение: 15000'));
 }
 console.log('Single-coil Re passed: real low/high Re, fixed N=1, independent stock flag, unchanged original valid/checks, explicit source-applicability warning, no waiver of radius/shell/duty/geometry, ordinary-mode Re bounds, original full verification and shared budget.');
})().catch(e=>{console.error(e);process.exitCode=1});
