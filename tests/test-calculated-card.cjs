const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const calculate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');
const savedGeometry={diameter:600,height:2000,shellWall:4,coreDiameter:180,tubeDiameter:20,tubeWall:2,clearance:5,rows:[{diameter:300,count:2,turns:10,pitch:60}]};
const currentGeometry={...savedGeometry,diameter:800,height:2500};
const thermal={heat_duty_kw:123},thermalSource={arrangement:'inline'},savedShell={wallMM:4};
const design={calculationId:7,geometry:savedGeometry,thermal,thermalSource,shellCalculation:savedShell};
const calls=[],state={'tube-material':'steel20','stock-lengths':true};
const context={calculateCoilGeometry:calculate,verificationState:currentGeometry,coilProject:{version:'8.0.0'},materialNames:{steel20:'Сталь 20'},fmt:String,
 coilThermalUI:{snapshot:{result:{heat_duty_kw:999},inputs:{arrangement:'staggered'}}},currentVariants:{shellCalculation:{wallMM:8}},
 coilGeometrySourceLabel:()=> 'Редактор',coilManufacturingItems:(...args)=>{calls.push(['manufacturing',...args]);return []},
 coilShellCalculationItems:shell=>{calls.push(['shell',shell]);return []},CoilThermalCard:{sections:(...args)=>{calls.push(['thermal',...args]);return []}}};
vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function coilExchangerCardData('),app.indexOf('function renderExchangerCard(')),context);
const before=JSON.stringify(currentGeometry),groups=context.coilExchangerCardData({design,inputs:state},null,{saved:true});
const items=groups.flatMap(group=>group.items);
assert.equal(items.find(([key])=>key==='Внешний диаметр корпуса')[1],'600');
assert.equal(items.find(([key])=>key==='Рабочая высота корпуса')[1],'2000');
assert.match(items.find(([key])=>key==='Источник геометрии')[1],/№7/);
assert.equal(calls.find(([kind])=>kind==='manufacturing')[1],savedGeometry);
assert.equal(calls.find(([kind])=>kind==='manufacturing')[2],state);
assert.equal(calls.find(([kind])=>kind==='shell')[1],savedShell);
assert.equal(calls.find(([kind])=>kind==='thermal')[1],thermal);
assert.equal(calls.find(([kind])=>kind==='thermal')[2],thermalSource);
assert.equal(JSON.stringify(currentGeometry),before,'Preview leaves manual geometry intact');
calls.length=0;
const live=context.coilExchangerCardData({design,inputs:state},null);
assert.equal(live.flatMap(g=>g.items).find(([key])=>key==='Внешний диаметр корпуса')[1],'800','Main card still follows the editor');
assert.equal(calls.find(([kind])=>kind==='thermal')[1].heat_duty_kw,999);

const messages=[],elements={'exchanger-type':{value:'coil'},'exchanger-card-title':{},'exchanger-card-subtitle':{},'exchanger-card-search':{value:'',focus(){}},'exchanger-card-dialog':{open:false,showModal(){this.open=true}}};
let renders=0;
const preview={
 $:id=>elements[id],coilProject:{id:10,phase:'ready',cardRequest:0,selectionRequest:4,worker:{postMessage:data=>messages.push(data)}},
 currentVariants:{calculations:[{id:7,status:'accepted',geometryKey:'g7'},{id:8,status:'accepted',geometryKey:'g8'}]},
 document:{documentElement:{classList:{add(){}}}},exchangerCardKind:null,exchangerCardSections:[],
 setExchangerCardCategory(){},renderExchangerCard(){renders++},getState:()=>state,currentResult:null,
 CoilProjectMethod:{geometryKey:g=>g===savedGeometry?'g7':'g8'},coilExchangerCardData:()=>groups,
 verificationState:currentGeometry,selectedVariant:'manual',coilVariantBinding:{manual:true}
};
vm.createContext(preview);vm.runInContext(app.slice(app.indexOf('function openCalculatedConstructionCard('),app.indexOf('function openExchangerCard(')),preview);
preview.openCalculatedConstructionCard(7);
assert(elements['exchanger-card-dialog'].open);
assert.equal(messages.at(-1).calculationId,7);assert.equal(messages.at(-1).selectionRequest,-1);
assert.equal(preview.coilProject.selectionRequest,4,'Preview uses a separate request from selection');
assert.equal(preview.receiveCalculatedConstructionCard({id:10,phase:'selected',selectionRequest:-1,design}),true);
assert.equal(renders,1);assert.equal(preview.exchangerCardSections,groups);
assert.equal(preview.verificationState,currentGeometry);assert.equal(preview.selectedVariant,'manual');assert(preview.coilVariantBinding.manual);
elements['exchanger-card-dialog'].open=false;
preview.receiveCalculatedConstructionCard({id:10,phase:'selected',selectionRequest:-1,design});assert.equal(renders,1,'Closed preview ignores late replies');
preview.openCalculatedConstructionCard(8);
preview.receiveCalculatedConstructionCard({id:10,phase:'selected',selectionRequest:-1,design});assert.equal(renders,1,'Previous preview cannot overwrite the new one');
preview.receiveCalculatedConstructionCard({id:9,phase:'selected',selectionRequest:-2,design});assert.equal(renders,1,'Previous sheet cannot supply card data');
assert.equal(preview.receiveCalculatedConstructionCard({id:10,phase:'selected',selectionRequest:4,design}),false,'Normal row selection keeps its own route');
preview.receiveCalculatedConstructionCard({id:10,phase:'selection-error',selectionRequest:-2,message:'Недоступна'});
assert.equal(renders,2);assert.equal(preview.exchangerCardSections[0].items[0][1],'Недоступна');
preview.coilProject.phase='pending';const previous=messages.length;preview.openCalculatedConstructionCard(7);assert.equal(messages.length,previous);
console.log('Calculated card passed: exact variant geometry/manufacturing/thermal data, independent cached preview, manual selection preserved, main editor card unchanged, stale/closed/error replies handled.');
