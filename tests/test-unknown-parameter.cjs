const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
const model=vm.runInNewContext(app.slice(app.indexOf('function flowUnitName('),app.indexOf('function geometry('))+app.slice(app.indexOf('function waterProperties('),app.indexOf('function hydraulicEstimate('))+'\n({solve,massToFlow,findableParameters,selectedUnknown,flowUnitErrors})',{
 thermalIds:['thi','tho','tci','tco','mh','mc','cph','cpc','u','ph','pc'],fmt:(n,d=2)=>n.toFixed(d)
});
const base={thi:90,tho:60,tci:20,tco:40,mh:2.5,mc:3.75,cph:4.18,cpc:4.18,u:800,ph:.6,pc:.4,flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s'};
const near=(a,b)=>assert(Math.abs(a-b)<1e-7*Math.max(1,Math.abs(b)),`${a} != ${b}`);
let scenarios=0;
for(const scheme of ['counter','parallel'])for(const unit of ['kg-s','kg-h','m3-h','m3-s','l-s']){
 const state={...base,flow:scheme,'hot-flow-unit':unit,'cold-flow-unit':unit,mh:model.massToFlow(2.5,unit,90,'water'),mc:model.massToFlow(3.75,unit,20,'water')};
 for(const unknown of model.findableParameters()){
  const result=model.solve({...state,unknown,[unknown]:''});
  for(const id of model.findableParameters())near(result[id],base[id]);near(result.q,313.5);assert(result.area>0);scenarios++;
 }
 const checked=model.solve({...state,unknown:null});near(checked.imbalance,0);near(checked.q,313.5);
}
assert.equal(model.selectedUnknown({}),'mc');assert.equal(model.selectedUnknown({unknown:null}),null);
assert.throws(()=>model.solve({...base,unknown:null,mc:4.5}),/баланс не сходится/);
assert.throws(()=>model.solve({...base,unknown:'tho',mc:''}),/Заполните/);
assert.throws(()=>model.solve({...base,unknown:'tho',mh:-1}),/расходы/);
assert.throws(()=>model.solve({...base,unknown:'tco',mc:.1}),/напор/);
assert.throws(()=>model.solve({...base,unknown:'thi',thi:'','hot-flow-unit':'m3-h',mh:1,mc:100}),/диапазоне/);
assert.equal(Object.keys(model.flowUnitErrors({...base,unknown:'thi',thi:'','hot-flow-unit':'m3-h'})).length,0);
const changed=model.solve({...base,unknown:'tho',tho:'',mc:4.5});near(changed.tho,54);near(changed.q,376.2);
const feedback=vm.runInNewContext(app.slice(app.indexOf('function numericFieldErrors('),app.indexOf('function clearFieldFeedback('))+'\nnumericFieldErrors',{thermalIds:['thi','tho','tci','tco','mh','mc','cph','cpc','u','ph','pc'],geometryIds:[]});
assert.equal(Object.keys(feedback({...base,unknown:'tho',tho:''})).length,0);
assert(feedback({...base,unknown:'tho',tho:'',mc:''}).mc);
console.log(`${scenarios} unknown-parameter scenarios passed: six unknowns × five flow units × two schemes; all-known balance, density roots, incompatible and missing inputs, legacy default and validation.`);
