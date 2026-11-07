const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js'),manufacturing=require('../assets/coil-manufacturing.js');
(async()=>{
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),cache=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(cache.has(key))return cache.get(key);const value=cp.PropsSI(...args);if(cache.size<100000)cache.set(key,value);return value};
 const state={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:31,tco:40,mh:2.5,mc:'',ph:.6,pc:.4,unknown:'mc','area-reserve-percent':0,'tube-conductivity':16,length:1500,'exchanger-diameter':600},target=project.balance(state,props);
 let calls=0;const seen=new Set(),original=teplo.calculate;
 let result;try{
  teplo.calculate=(input,...args)=>{const key=JSON.stringify(input);assert(!seen.has(key),'Diagnostic calls must share deduplication with the normal search');seen.add(key);calls++;return original(input,...args)};
  result=await project.select(state,target,props);
 }finally{teplo.calculate=original}
 assert.equal(result.rows.length,0,'An outside-envelope witness must never become a selected design');assert.equal(result.candidates.length,0);assert.equal(result.searchBudget.firstSuccess,null);
 assert(calls<=200);assert.equal(calls,result.stats.evaluations);assert(result.stats.phases.diagnosis<=24);assert(result.notifications.some(n=>n.level==='error'&&n.code==='length-limit'));assert(!result.notifications.some(n=>n.code==='diameter-limit'));
 const witness=result.dimensionWitness;assert(witness&&witness.geometry.height>1500&&witness.geometry.diameter<=600);assert(project.inlineLayout(witness.geometry).allowed);
 assert(project.meets(teplo.calculate({...project.source(state,target),...project.geometryInput(witness.geometry)},props),target),'Dimension explanation must have a fully verified witness');
 for(const row of witness.geometry.rows){const m=manufacturing.measure(row,witness.geometry.leadBendRadius,witness.geometry.leadStraightLength);assert(manufacturing.stockFor(m.totalMM));}
 const diameterState={...state,length:2000,tci:20,'exchanger-diameter':200},diameterTarget=project.balance(diameterState,props),diameterResult=await project.select(diameterState,diameterTarget,props);
 assert.equal(diameterResult.rows.length,0);assert(diameterResult.notifications.some(n=>n.level==='error'&&n.code==='diameter-limit'));assert(diameterResult.dimensionWitness.geometry.diameter>200);assert(diameterResult.stats.evaluations<=200);
 assert(project.meets(teplo.calculate({...project.source(diameterState,diameterTarget),...project.geometryInput(diameterResult.dimensionWitness.geometry)},props),diameterTarget));
 let cancelled=false;assert.equal(await project.select(state,target,props,{cancelled:()=>cancelled,progress:stats=>{if(stats.phase==='diagnosis')cancelled=true}}),null,'An obsolete dimension diagnosis must be cancelled');
 const minimal={rows:[],countRange:{counts:[54]},attempts:[],stats:{families:1,errors:0},searchBudget:{stopped:'catalogue-exhausted',screened:0}};
 let notes=project.selectionNotifications(minimal,state,target);assert(notes.some(n=>n.code==='layout-stock'));assert(notes.some(n=>n.code==='search-grid'));assert(!notes.some(n=>n.code==='length-limit'||n.code==='diameter-limit'),'Never infer a dimension violation without a verified witness');
 notes=project.selectionNotifications({...minimal,countRange:{counts:[]}},state,target);assert(notes.some(n=>n.code==='tube-count'));
 notes=project.selectionNotifications({...minimal,attempts:[{dutyRatio:.9,blocking:[]}]},state,target);assert(notes.some(n=>n.code==='duty-shortage'));
 notes=project.selectionNotifications({...minimal,attempts:[{dutyRatio:1.1,blocking:[]}]},state,target);assert(notes.some(n=>n.code==='duty-excess'));
 notes=project.selectionNotifications({...minimal,searchBudget:{stopped:'budget-exhausted',screened:1}},state,target);assert(notes.some(n=>n.level==='warning'&&n.code==='search-limit'));assert(!notes.some(n=>n.code==='search-grid'));
 notes=project.selectionNotifications(minimal,state,target,{geometry:{height:1400,diameter:650}});assert(notes.some(n=>n.code==='diameter-limit'));assert(!notes.some(n=>n.code==='length-limit'));
 assert.deepEqual(project.selectionNotifications({...minimal,rows:[{}]},state,target),[],'Success clears prior notices');
 // Exercise the actual renderer: literal text, mixed severities, deduplication,
 // and cleanup; no stale notifications after an input edit or successful rerun.
 const element=()=>({children:[],dataset:{},attributes:{},textContent:'',append(...items){this.children.push(...items)},replaceChildren(){this.children=[]},setAttribute(k,v){this.attributes[k]=v},get childElementCount(){return this.children.length}}),panel=element(),app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
 const context={$:()=>panel,document:{createElement:element}};vm.createContext(context);vm.runInContext(app.slice(app.indexOf('function renderDesignNotifications('),app.indexOf('function renderCoilProjectBalance(')),context);
 context.renderDesignNotifications([{level:'error',code:'x',text:'<img src=x>'},{level:'warning',code:'y',text:'Предел поиска'},{level:'error',code:'x',text:'duplicate'}]);assert.equal(panel.hidden,false);assert.equal(panel.children.length,2);assert.equal(panel.children[0].dataset.level,'error');assert.equal(panel.children[1].dataset.level,'warning');assert.equal(panel.children[0].children[1].textContent,'<img src=x>');
 context.renderDesignNotifications([]);assert.equal(panel.hidden,true);assert.equal(panel.children.length,0);
 console.log('Design notifications passed: true length witness, hard shared budget/deduplication, no automatic geometry replacement, stock and original Teplo checks, explicit uncertainty, error/warning rendering and cleanup.');
})().catch(error=>{console.error(error);process.exitCode=1});
