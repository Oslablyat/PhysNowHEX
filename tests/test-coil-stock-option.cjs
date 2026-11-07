const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js'),manufacturing=require('../assets/coil-manufacturing.js');
(async()=>{
 assert(project.stockLengthsEnabled({}));assert(project.stockLengthsEnabled({'stock-lengths':true}));assert(!project.stockLengthsEnabled({'stock-lengths':false}));assert(project.stockLengthsEnabled({'stock-lengths':true,'single-coil':true}));
 const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
 const restore=vm.runInNewContext(app.slice(app.indexOf('function constructionToggleValue('),app.indexOf('function applyState('))+';constructionToggleValue');
 assert(restore({},'stock-lengths'),'Legacy sheet preserves formerly mandatory stock rules');assert(!restore({'stock-lengths':false},'stock-lengths'));assert(!restore({},'single-coil'));
 const key=vm.runInNewContext(app.slice(app.indexOf('function coilProjectKey('),app.indexOf('function setCalculationIssue('))+';coilProjectKey',{calculationSheets:{activeId:'test'}}),saved={'coil-thermal-inputs':{arrangement:'inline'},'stock-lengths':true};
 assert.notEqual(key(saved),key({...saved,'stock-lengths':false}),'Changing the option must invalidate cached selection');
 assert.equal(restore(JSON.parse(JSON.stringify({'stock-lengths':false})),'stock-lengths'),false,'Explicit off survives serialization');
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),cache=new Map(),props=(...args)=>{const k=JSON.stringify(args);if(!cache.has(k))cache.set(k,cp.PropsSI(...args));return cache.get(k)};
 const state={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:80,tci:20,tco:30,mh:.2,ph:2,pc:1.2,unknown:'mc','area-reserve-percent':0,'tube-conductivity':16,length:2000,'exchanger-diameter':600},target=project.balance(state,props);
 const legacy=await project.select(state,target,props),enabled=await project.select({...state,'stock-lengths':true},target,props);
 assert.deepEqual(enabled.rows,legacy.rows);assert.deepEqual(enabled.stats,legacy.stats);assert.equal(enabled.stockLengthsApplied,true);assert.equal(enabled.rows.length,0);
 const freeState={...state,'stock-lengths':false},search=project.families(freeState,target,props),pool=await project.shortlist(search,freeState,target,props,{geometryChecks:0},{});
 const long=pool.find(l=>l.geometry.rows.some(r=>r.turns*Math.hypot(Math.PI*r.diameter,r.pitch)>6000));assert(long,'Removing stock rules must remove the 6-m generation ceiling');
 const measured=manufacturing.measure(long.geometry.rows.at(-1),long.geometry.leadBendRadius,long.geometry.leadStraightLength);assert(measured.totalMM>6000);
 let calls=0;const original=teplo.calculate,seen=new Set();let free;
 try{teplo.calculate=(input,...args)=>{const k=JSON.stringify(input);assert(!seen.has(k));seen.add(k);calls++;return original(input,...args)};free=await project.select(freeState,target,props)}finally{teplo.calculate=original}
 assert.equal(calls,free.stats.evaluations);assert(calls<=200);assert.equal(free.stockLengthsApplied,false);assert.equal(free.rows.length,1);
 const c=free.rows[0].design;assert(c.stockLimitWaived);assert(c.n>1);assert(project.inlineLayout(c.geometry).allowed);assert(project.meets(original({...project.source(freeState,target),...project.geometryInput(c.geometry)},props),target));
 assert(c.manufacturing.some(m=>!manufacturing.stockFor(m.totalMM)),'Accepted geometry must genuinely violate former stock conditions');for(const m of c.manufacturing){assert.equal(m.stockMM,null);assert.equal(m.wasteMM,null);assert.equal(m.wasteFraction,null)}
 assert(!free.message.includes('остаток ≤20 %'));assert.match(free.message,/без ограничения длины/);
 // Independent flags: a long one-coil assignment is accepted only with stock off.
 const singleState={...state,tho:60,tci:55,tco:70,mh:.047,'single-coil':true,'stock-lengths':false},singleTarget=project.balance(singleState,props),single=await project.select(singleState,singleTarget,props);
 assert.equal(single.stockLengthsApplied,false);assert.equal(single.rows[0].design.n,1);assert(single.rows[0].design.manufacturing[0].totalMM>6000);assert(project.meets(single.rows[0].design.thermal,singleTarget));
 const restricted=await project.select({...singleState,'stock-lengths':true},singleTarget,props);assert.equal(restricted.stockLengthsApplied,true);assert.equal(restricted.rows.length,0);assert(restricted.notifications.some(n=>/отключите учёт заготовок/.test(n.text)));assert(restricted.attempts.every(a=>a.count===1));assert(restricted.stats.evaluations<=200);
 const stockSingle={...state,thi:50,tho:40,tci:10,tco:25,mh:.08,'single-coil':true,'stock-lengths':true},stockTarget=project.balance(stockSingle,props),fit=await project.select(stockSingle,stockTarget,props);
 assert.equal(fit.rows.length,1);assert.equal(fit.stockLengthsApplied,true);assert.equal(fit.rows[0].design.n,1);assert(!fit.rows[0].design.stockLimitWaived);assert(fit.attempts.every(a=>a.count===1));assert(fit.stats.evaluations<=200);assert(project.meets(fit.rows[0].design.thermal,stockTarget));
 for(const m of fit.rows[0].design.manufacturing){assert.equal(manufacturing.stockFor(m.totalMM),m.stockMM);assert(m.wasteFraction<=.2);assert(m.totalMM<m.stockMM)}
 console.log('Stock option passed: all four independent flag combinations; long single coil only with stock off; valid 1-coil stock-on acceptance and useful failure warning; legacy/on equivalence, persistence/cache, exact measured lengths, thermal/axial/Re checks, deduplication and 200 budget.');
})().catch(e=>{console.error(e);process.exitCode=1});
