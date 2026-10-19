const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
const model=vm.runInNewContext(app.slice(app.indexOf('function flowUnitName('),app.indexOf('function geometry('))+app.slice(app.indexOf('function waterProperties('),app.indexOf('function hydraulicEstimate('))+'\n({flowToMass,massToFlow,flowUnitErrors,solve})',{
 thermalIds:['thi','tho','tci','tco','mh','cph','cpc','u','ph','pc']
});
const near=(actual,expected)=>assert(Math.abs(actual-expected)<1e-9*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`);
const base={thi:90,tho:60,tci:20,tco:40,mh:2.5,cph:4.18,cpc:4.18,u:800,ph:.6,pc:.4,flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s'};
const reference=model.solve(base);near(reference.q,313.5);near(reference.mc,3.75);
near(model.flowToMass(3600,'kg-h',20,'water'),1);
near(model.massToFlow(1,'kg-h',20,'water'),3600);
assert(Math.abs(model.flowToMass(1,'l-s',4,'water')-1)<.00001);
assert(Math.abs(model.flowToMass(1,'m3-h',20,'water')-998.2/3600)<.0001);
for(const unit of ['kg-s','kg-h','m3-h','m3-s','l-s']){
 const input=model.massToFlow(2.5,unit,90,'water');near(model.flowToMass(input,unit,90,'water'),2.5);
 const result=model.solve({...base,mh:input,'hot-flow-unit':unit});near(result.mh,2.5);near(result.q,reference.q);near(result.mc,reference.mc);near(result.area,reference.area);
 const cold=model.massToFlow(result.mc,unit,20,'water');near(model.flowToMass(cold,unit,20,'water'),result.mc);
}
assert.throws(()=>model.flowToMass(1,'m3-h',20,'custom'),/воды/);
assert.throws(()=>model.flowToMass(1,'m3-h','', 'water'),/температуру/);
assert.throws(()=>model.flowToMass(1,'m3-h',120,'water'),/температуру/);
assert(model.flowUnitErrors({...base,'hot-flow-unit':'m3-h',thi:''}).thi);
assert(model.flowUnitErrors({...base,'cold-flow-unit':'l-s',tci:-5}).tci);
near(model.solve({...base,thi:120,tho:90}).q,313.5); // Mass units retain the existing thermal domain.
console.log('Flow checks passed: five units, kg/h and water-volume reference values, unchanged heat balance/area, output conversion and unsupported density cases.');
