const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const p=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js'),m=require('../assets/coil-manufacturing.js');
const root=path.resolve(__dirname,'..'),sandbox={module:{exports:{}},require:createRequire(path.join(root,'assets/coil-project-method.js'))};
vm.runInNewContext(fs.readFileSync(path.join(root,'tests/reference/coil-project-v12.js'),'utf8'),sandbox);const previous=sandbox.module.exports;
const fake=(H,D,rows,n,metres)=>({geometry:{height:H,diameter:D,tubeDiameter:14,rows:Array.from({length:rows},()=>({count:n/rows,pitch:100}))},n,wasteMM:0,manufacturing:[{count:n,totalMM:metres*1000/n}]});
const short=fake(300,300,3,12,35),long=fake(600,150,1,10,20);
for(const [id,expected]of [['length',short],['tube-length',long],['tube-count',long],['rows',long],['volume',long],['diameter',long]])assert.equal([short,long].sort((a,b)=>p.compare(a,b,id))[0],expected,id);
assert.equal(p.objectiveFor({}).id,'length');assert.equal(p.objectiveFor('bad').id,'length');assert.equal(p.fullTubeMetres(long),20);
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const cacheKey=vm.runInNewContext(app.slice(app.indexOf('function coilProjectKey('),app.indexOf('function setCalculationIssue('))+';coilProjectKey',{calculationSheets:{activeId:'objective-test'}}),state={'coil-thermal-inputs':{arrangement:'inline'}};
assert.notEqual(cacheKey(state),cacheKey({...state,'design-objective':'rows'}),'New objective invalidates the previous result');
assert(app.includes("const selectIds = ['design-objective',"));assert(app.includes("'design-objective':'length'"));
for(const o of p.objectives)assert(html.includes('data-value="'+o.id+'"')&&html.includes(o.name));
assert(html.indexOf('id="design-objective"')>html.indexOf('id="flow-choice"')&&html.indexOf('id="design-objective"')<html.indexOf('id="refine-dimensions"'));
const g={diameter:200,height:500,tubeDiameter:14,leadBendRadius:28,leadStraightLength:40,rows:[{diameter:140,count:3,pitch:60,turns:8},{diameter:174,count:3,pitch:60,turns:8}]};
const exact=g.rows.reduce((s,r)=>s+r.count*m.measure(r,28,40).totalMM,0)/1000;assert(Math.abs(p.fullTubeMetres({geometry:g})-exact)<1e-10,'Screen and accepted metric count the same full physical tube');
(async()=>{
 const cp=await(await import(pathToFileURL(path.join(root,'assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.join(root,'assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),cache=new Map(),props=(...a)=>{const k=JSON.stringify(a);if(!cache.has(k))cache.set(k,cp.PropsSI(...a));return cache.get(k)};
 const base={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:20,tco:40,mh:.5,ph:2,pc:1.2,unknown:'mc','tube-conductivity':16,length:2000,'exchanger-diameter':600,'stock-lengths':false};
 let defaultDesign;const outputs=[];
 for(const o of p.objectives){
  const s={...base,'design-objective':o.id},t=p.balance(s,props),seen=new Set(),inputs=[],calculate=teplo.calculate;let calls=0,r;
  try{teplo.calculate=(input,...a)=>{calls++;inputs.push(input);const k=JSON.stringify(input);assert(!seen.has(k));seen.add(k);return calculate(input,...a)};r=await p.select(s,t,props)}finally{teplo.calculate=calculate}
  assert(calls<=200);assert.equal(calls,r.stats.evaluations);assert.equal(r.rows.length,1,o.id);assert.equal(r.objective.id,o.id);
  const c=r.rows[0].design;assert(p.meets(c.thermal,t));assert(p.inlineLayout(c.geometry).allowed);assert.equal(r.objective.value,p.objectiveValue(c,o.id));assert(c.geometry.height<=s.length&&c.geometry.diameter<=s['exchanger-diameter']);
  for(const [i,a]of r.attempts.entries())if(a.accepted){const input=inputs[i],g={height:a.height,diameter:a.diameter,tubeDiameter:14,leadBendRadius:28,leadStraightLength:40,rows:input.coil_rows.map(row=>({diameter:row.radius_m*2000,pitch:row.pitch_m*1000,turns:row.turns,count:row.count}))};assert(p.objectiveValue(c,o.id)<=p.objectiveValue({geometry:g,n:a.count},o.id)+1e-8,'Winner minimizes the chosen metric among all fully accepted candidates')}
  if(o.id==='length')defaultDesign=c;
  if(o.id==='tube-count')assert.equal(r.countRange.selected,r.countRange.min);
  outputs.push({objective:o.id,H:c.geometry.height,D:c.geometry.diameter,N:c.n,rows:c.rowCount,metres:p.fullTubeMetres(c),calls});
 }
 const legacy=await previous.select(base,previous.balance(base,props),props);assert.equal(JSON.stringify(defaultDesign.geometry),JSON.stringify(legacy.rows[0].design.geometry),'Default objective preserves prior accepted geometry');
 assert(new Set(outputs.map(o=>[o.H,o.D,o.N,o.rows].join('|'))).size>=3,'Real objectives must change chosen designs');
 for(const single of [false,true]){const s={...base,mh:.2,'single-coil':single,'stock-lengths':true,'design-objective':'tube-length'},t=p.balance(s,props),r=await p.select(s,t,props);assert(r.stats.evaluations<=200);assert(r.rows.length);const c=r.rows[0].design;if(single)assert.equal(c.n,1);assert(p.meets(c.thermal,t));for(const tube of c.manufacturing){assert(tube.totalMM<tube.stockMM);assert(tube.wasteFraction<=.2+1e-9)}}
 console.table(outputs);console.log('Main-site objectives passed: six distinct criteria, full tube/count/volume metrics, unchanged default, original Teplo/duty/Re/stock/inline constraints, single-coil and real 200-call/dedup budget.');
})().catch(e=>{console.error(e);process.exitCode=1});
