const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),p=require('../assets/coil-project-method.js'),thermal=require('../assets/coil-thermal-method.js'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
(async()=>{
 const cp=await(await import(pathToFileURL(path.join(root,'assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.join(root,'assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),memo=new Map(),props=(...a)=>{const k=JSON.stringify(a);if(!memo.has(k))memo.set(k,cp.PropsSI(...a));return memo.get(k)};
 const state={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:21,tco:40,mh:2.5,ph:.6,pc:.4,unknown:'mc','tube-conductivity':16,length:2000,'exchanger-diameter':600,'stock-lengths':true},target=p.balance(state,props),calculate=thermal.calculate;let calls=0,result;
 try{thermal.calculate=(...a)=>{calls++;return calculate(...a)};result=await p.select(state,target,props)}finally{thermal.calculate=calculate}
 assert(calls<=200);assert.equal(calls,result.stats.evaluations);assert(result.acceptedDesigns.length>1);
 assert.equal(result.acceptedDesigns.length,result.calculations.filter(c=>c.status==='accepted').length);
 for(const c of result.acceptedDesigns){assert(p.meets(c.thermal,target));assert.equal(result.calculations.find(r=>r.id===c.calculationId).geometryKey,p.geometryKey(c.geometry))}
 const selected=result.acceptedDesigns.find(c=>c.calculationId!==result.selectedCalculationId);assert(selected);
 const hidden=structuredClone(selected.geometry);hidden.shellHidden=true;hidden.rows.forEach(r=>r.hidden=true);assert.equal(p.geometryKey(hidden),p.geometryKey(selected.geometry),'Display flags do not change physical identity');hidden.height++;assert.notEqual(p.geometryKey(hidden),p.geometryKey(selected.geometry));
 // Exercise the real Worker dispatch with the real solved designs. Selection
 // returns the existing object, without invoking another selector or Teplo.
 const messages=[],self={postMessage:m=>messages.push(structuredClone(m))};let searches=0;
 self.CoilProjectMethod={balance:()=>target,source:()=>({}),select:async()=>{searches++;return structuredClone(result)}};
 const worker=fs.readFileSync(path.join(root,'assets/coil-project-worker.js'),'utf8').replace(/^import .*;\r?\n/gm,'');
 vm.runInNewContext(worker,{self,createCoolProp:async()=>({get_global_param_string:()=> '8.0.0'}),setTimeout,Map});
 await self.onmessage({data:{id:5,state}});const publicResult=messages.find(m=>m.phase==='variants');assert(publicResult);assert(!('acceptedDesigns'in publicResult.variants),'Do not post every full coil array to the page');
 await self.onmessage({data:{id:5,selectCalculation:true,calculationId:selected.calculationId,selectionRequest:1}});const reply=messages.at(-1);assert.equal(reply.phase,'selected');assert.equal(reply.selectionRequest,1);assert.deepEqual(reply.design.geometry,selected.geometry);assert.equal(searches,1);assert.equal(calls,result.stats.evaluations);
 const n=messages.length;await self.onmessage({data:{id:4,selectCalculation:true,calculationId:selected.calculationId,selectionRequest:2}});assert.equal(messages.length,n,'Ignore an old sheet/request');
 await self.onmessage({data:{id:5,selectCalculation:true,calculationId:99999,selectionRequest:3}});assert.equal(messages.at(-1).phase,'selection-error');
 await self.onmessage({data:{id:6,cancel:true}});const afterCancel=messages.length;await self.onmessage({data:{id:5,selectCalculation:true,calculationId:selected.calculationId}});assert.equal(messages.length,afterCancel,'Cancel invalidates the cached geometry');
 const restore=vm.runInNewContext(app.slice(app.indexOf('function restoreCoilVariantBinding('),app.indexOf('function syncCoilVariantNotice('))+';restoreCoilVariantBinding');
 const binding={key:'sheet-key',profile:'calculation-'+selected.calculationId,manual:true,userSelected:true,calculationId:selected.calculationId,geometryKey:p.geometryKey(selected.geometry)};
 assert.equal(JSON.stringify(restore(JSON.parse(JSON.stringify(binding)))),JSON.stringify(binding),'Per-sheet binding survives a JSON roundtrip');
 const loaded=[],context={currentVariants:{inputKey:'sheet-key',calculations:result.calculations,rows:[...result.rows]},coilVariantBinding:{...binding},selectedVariant:'balanced',verificationState:{edited:true},CoilProjectMethod:p,calculateCoilGeometry:()=>true,toast:()=>{throw Error('Unexpected validation failure')},syncVariantSelection(){},syncCalculatedDesignTable(){},save(){},coilThermalUI:{refresh(){}},loadCoilVariant:id=>loaded.push(id)};
 vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function applyCalculatedConstruction('),app.indexOf('function restoreCoilVariantBinding(')),context);
 context.applyCalculatedConstruction(selected,false);assert.deepEqual(loaded,[binding.profile]);assert(context.currentVariants.rows.some(r=>r.id===binding.profile));
 loaded.length=0;context.applyCalculatedConstruction(selected,true);assert.equal(loaded.length,0,'Restoring the table must not replace manually edited geometry');assert(context.verificationState.edited);assert(context.coilVariantBinding.manual);assert.equal(context.selectedVariant,binding.profile);
 console.log('Calculated selection passed: all real accepted geometries retained, stable physical identity, cached Worker selection without recalculation, stale/cancel rejection, compact public result, per-sheet binding and manual-edit preservation.');
})().catch(e=>{console.error(e);process.exitCode=1});
