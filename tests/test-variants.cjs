const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
const model=vm.runInNewContext(app.slice(app.indexOf('function variantProfiles('),app.indexOf('function renderExchangerVariants('))+'\n({selectExchangerVariants,waterProperties,hydraulicEstimate})');
const state={length:2000,'exchanger-diameter':600,'exchanger-type':'shell','hot-fluid':'water','cold-fluid':'water','refine-tubes':false,'tube-diameter':20,'tube-wall':2};
const r={thi:90,tho:60,tci:20,tco:40,mh:2.5,mc:3.75,ph:.6,pc:.4,area:313500/(800*(10/Math.log(50/40)))};r.designArea=r.area*1.1;
const result=model.selectExchangerVariants(state,r);assert.equal(result.rows.length,4);assert(result.candidates.length>100);
for(const c of result.candidates){
 assert(c.area>=r.designArea);assert(c.length<=2&&c.diameter<=.6);assert(Number.isInteger(c.n)&&c.n>0);
 assert(c.dpt>0&&c.dps>0&&c.dpt<r.pc*1e6&&c.dps<r.ph*1e6);assert(c.vt>0&&c.vs>0);
 assert(c.b>=(c.diameter-.01)*.4-1e-10&&c.b<=(c.diameter-.01)*.6+1e-10);
 assert(c.res>=400&&c.res<=1e6);assert(c.ret<=2300||c.ret>=4000&&c.ret<=300000);
}
for(const [id,key]of Object.entries({balanced:'balanced',compact:'volume',hydraulic:'pumping',production:'complexity'})){
 const chosen=result.rows.find(row=>row.id===id).design;assert.equal(chosen[key],Math.min(...result.candidates.map(c=>c[key])));
}
const fixed=model.selectExchangerVariants({...state,'refine-tubes':true,'tube-diameter':25,'tube-wall':2},r);assert.equal(fixed.rows.length,4);assert(fixed.candidates.every(c=>c.dmm===25&&c.wmm===2));
assert.equal(model.selectExchangerVariants({...state,length:50,'exchanger-diameter':50},r).rows.length,0);
assert.equal(model.selectExchangerVariants(state,null).rows.length,0);
assert.equal(model.selectExchangerVariants({...state,'hot-fluid':'custom'},r).rows.length,0);
assert.equal(model.selectExchangerVariants({...state,'exchanger-type':'coil'},r).rows.length,0);
assert.equal(model.selectExchangerVariants(state,{...r,thi:110}).rows.length,0);
assert.equal(model.selectExchangerVariants({...state,'refine-tubes':true,'tube-wall':10},r).rows.length,0);
assert(model.waterProperties(20).rho>998&&model.waterProperties(20).rho<999);
assert.equal(model.waterProperties(20).mu,.001);
assert(model.waterProperties(75).mu<model.waterProperties(20).mu);
// Independent hand-sized reference: 100 tubes, 16 mm bore, 1.8 m active length.
const reference=model.hydraulicEstimate({...r,mc:1},{di:.016,do:.02,n:100,lt:1.8,ds:.4,b:.2,nb:8,water:{rho:1000,mu:.001}},{rho:1000,mu:.001});
assert(reference.dpt>16&&reference.dpt<17);assert(reference.dps>1200&&reference.dps<1300);
const exportRows=vm.runInNewContext(app.slice(app.indexOf('function variantExportRows('),app.indexOf('for(const id of [...thermalIds,...geometryIds])'))+'\nvariantExportRows()', {currentVariants:result});
assert.equal(exportRows.filter(row=>result.rows.some(profile=>profile.name===row[0])).length,4);
assert(exportRows[2].includes('Перепад трубное, кПа'));
console.log(`Variant checks passed: ${result.candidates.length} candidates; thermal surface, envelope, pressure drops, Reynolds limits, four minima, fixed tubes and unavailable states.`);
console.table(result.rows.map(({name,design:c})=>({name,L:c.length*1000,D:c.diameter*1000,N:c.n,tube:`${c.dmm}x${c.wmm}`,F:c.area.toFixed(3),tube_kPa:(c.dpt/1000).toFixed(3),shell_kPa:(c.dps/1000).toFixed(3)})));
