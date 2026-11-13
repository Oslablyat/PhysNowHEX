const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),solver=require('../assets/coil-project-multicriteria.js'),teplo=require('../assets/coil-thermal-method.js');
assert.deepEqual(project.tubeSizes({}),[{d:14,w:2.5,di:9}]);
assert.deepEqual(project.tubeSizes({'refine-tubes':true,'tube-diameter':16,'tube-wall':2}),[{d:16,w:2,di:12}]);
const state={flow:'counter','hot-fluid':'water','cold-fluid':'water',thi:90,tho:60,tci:20,tco:40,mh:.2,ph:2,pc:1.2,unknown:'mc','tube-conductivity':16,length:2000,'exchanger-diameter':600,'design-objective':'pareto','refine-tubes':true,'tube-diameter':14,'tube-wall':2.5,'stock-lengths':false,'tube-sizes':[{d:14,w:2.5},{d:16,w:2.5},{d:14,w:2.5}]};
assert.equal(project.tubeSizes(state).length,2);
for(const rows of [[],[{d:14,w:7}],[{d:14,w:''}],[{d:NaN,w:2}],Array(21).fill({d:14,w:2})])assert.throws(()=>project.tubeSizes({...state,'tube-sizes':rows}));
(async()=>{
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}});
 const cache=new Map(),props=(...a)=>{const key=JSON.stringify(a);if(!cache.has(key))cache.set(key,cp.PropsSI(...a));return cache.get(key)};
 const before=JSON.stringify(state),target=project.balance(state,props),original=teplo.calculate,seen=new Set(),sizes=new Set();let calls=0,result;
 try{
  teplo.calculate=(input,...args)=>{const key=JSON.stringify(input);assert(!seen.has(key),'No repeated full thermal inputs');seen.add(key);sizes.add(input.tube_outer_diameter_m);calls++;return original(input,...args)};
  result=await solver.select(state,target,props);
 }finally{teplo.calculate=original}
 assert.deepEqual([...sizes].sort(),[.014,.016]);assert(calls>0&&calls<=1000);assert.equal(result.stats.evaluations,calls);assert.equal(JSON.stringify(state),before);
 assert(result.calculations.length>0);
 const eligible=result.calculations.some(c=>!c.warning)?result.calculations.filter(c=>!c.warning):result.calculations,keys=['height','diameter','materialMetres','count','rowCount'];
 const front=eligible.filter(a=>!eligible.some(b=>keys.every(k=>b[k]<=a[k])&&keys.some(k=>b[k]<a[k])));
 assert.deepEqual(result.calculations.filter(c=>c.rank).map(c=>c.id).sort(),front.map(c=>c.id).sort());
 assert.equal(result.selectedCalculationId,result.calculations.find(c=>c.rank===1).id);
 for(const design of result.acceptedDesigns){const full=solver.materialize(design);assert([14,16].includes(full.geometry.tubeDiameter));assert.equal(full.geometry.tubeWall,2.5);assert(project.meets(full.thermal,target))}
 console.log('Multiple tube sizes passed: both diameters verified, one shared '+calls+'/1000 budget, unique inputs, joint Pareto ranking, valid cached designs, validation and legacy input migration.');
})().catch(error=>{console.error(error);process.exitCode=1});
