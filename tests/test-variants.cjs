const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
const {calculateCoilGeometry}=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';({calculateCoilGeometry})');
const model=vm.runInNewContext(app.slice(app.indexOf('function variantProfiles('),app.indexOf('function renderExchangerVariants('))+'\n({selectExchangerVariants,waterProperties,hydraulicEstimate})',{CoilDesignVariants:require('../assets/coil-design-variants.js'),calculateCoilGeometry});
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
assert.equal(model.selectExchangerVariants({...state,'exchanger-type':'coil'},r).rows.length,3);
assert.equal(model.selectExchangerVariants(state,{...r,thi:110}).rows.length,0);
assert.equal(model.selectExchangerVariants({...state,'refine-tubes':true,'tube-wall':10},r).rows.length,0);
assert(model.waterProperties(20).rho>998&&model.waterProperties(20).rho<999);
assert.equal(model.waterProperties(20).mu,.001);
assert(model.waterProperties(75).mu<model.waterProperties(20).mu);
// Independent hand-sized reference: 100 tubes, 16 mm bore, 1.8 m active length.
const reference=model.hydraulicEstimate({...r,mc:1},{di:.016,do:.02,n:100,lt:1.8,ds:.4,b:.2,nb:8,water:{rho:1000,mu:.001}},{rho:1000,mu:.001});
assert(reference.dpt>16&&reference.dpt<17);assert(reference.dps>1200&&reference.dps<1300);
const exportSource=app.slice(app.indexOf('function variantExportRows('),app.indexOf('for(const id of [...thermalIds,...geometryIds])'));
const exportRows=vm.runInNewContext(exportSource+'\nvariantExportRows(state)', {currentVariants:result,state});
assert.equal(exportRows.filter(row=>result.rows.some(profile=>profile.name===row[0])).length,4);
assert(exportRows[2].includes('Перепад трубное, кПа'));
assert(exportRows[2].includes('Перегородок, шт.'),'Shell-and-tube export retains its real construction parameters');
for(const type of ['coil','double']){const rows=vm.runInNewContext(exportSource+'\nvariantExportRows(state)',{currentVariants:model.selectExchangerVariants({...state,'exchanger-type':type},r),state:{...state,'exchanger-type':type}});assert(!JSON.stringify(rows).toLowerCase().includes('перегород'));assert(!JSON.stringify(rows).includes('Керна'));if(type==='double')assert(rows.some(row=>row[0]==='Подбор недоступен'));else{assert(rows.some(row=>row[0]==='Оптимальная конструкция'));assert(!rows.flat().includes('Перепад трубное, кПа'));}}
const html=fs.readFileSync(require('node:path').join(__dirname,'..','index.html'),'utf8'),header=html.slice(html.indexOf('class="variant-row variant-header"'),html.indexOf('id="variant-rows"'));assert(!header.includes('Перегородок'));assert.equal((header.match(/class="num"/g)||[]).length,8);
// A fresh page/new sheet starts with coils; an explicitly saved type still wins.
const defaultState=vm.runInNewContext(app.slice(app.indexOf('const defaults ='),app.indexOf('\n',app.indexOf('const defaults =')))+';defaults');
assert.equal(defaultState['exchanger-type'],'coil');
assert(html.includes('id="type-dropdown-value">Змеевиковый</span>'));
assert(html.includes('id="exchanger-type" value="coil"'));
assert(/id="type-option-coil"[^>]*aria-selected="true"/.test(html));
assert(/id="type-option-shell"[^>]*aria-selected="false"/.test(html));
const makeSheet=vm.runInNewContext(app.slice(app.indexOf('function createCalculationSheet('),app.indexOf('function renameCalculationSheet('))+';createCalculationSheet',{defaults:defaultState,crypto:{randomUUID:()=> 'test-sheet'},calculationSheets:{nextNumber:1}});
assert.equal(makeSheet({}).state['exchanger-type'],'coil');
for(const type of ['shell','double','coil'])assert.equal(makeSheet({'exchanger-type':type}).state['exchanger-type'],type);
console.log(`Variant checks passed: ${result.candidates.length} candidates; thermal surface, envelope, pressure drops, Reynolds limits, four minima, fixed tubes, coil defaults and saved type preservation.`);
console.table(result.rows.map(({name,design:c})=>({name,L:c.length*1000,D:c.diameter*1000,N:c.n,tube:`${c.dmm}x${c.wmm}`,F:c.area.toFixed(3),tube_kPa:(c.dpt/1000).toFixed(3),shell_kPa:(c.dps/1000).toFixed(3)})));
