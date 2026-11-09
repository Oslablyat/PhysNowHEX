const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js');
(async()=>{
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print:()=>{},printErr:()=>{}}),props=(...args)=>cp.PropsSI(...args);
 const state={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:20,tco:40,mh:2.5,mc:3.75,ph:.6,pc:.4,unknown:'mc','area-reserve-percent':10,'tube-conductivity':16,length:2000,'exchanger-diameter':600};
 const r=project.balance(state,props);assert(Math.abs(r.heatBalanceError)<1e-6);assert(Math.abs(r.mc-3.75)>.001);assert.equal(r.u,null);assert.equal(r.area,null);assert(r.cph>4&&r.cph<4.3);
 for(const unknown of ['thi','tho','tci','tco','mh','mc']){const s={...state,...r,unknown,mh:r.mh,mc:r.mc,[unknown]:''},got=project.balance(s,props);assert(Math.abs(got.heatBalanceError)<1e-5,unknown);assert(Math.abs(got[unknown]-r[unknown])<1e-7,unknown)}
 for(const [unit,value]of [['kg-s',2.5],['kg-h',9000],['m3-h',r.mh/r.rhoh*3600],['m3-s',r.mh/r.rhoh],['l-s',r.mh/r.rhoh*1000],['l-min',r.mh/r.rhoh*60000],['l-h',r.mh/r.rhoh*3600000]]){const got=project.balance({...state,'hot-flow-unit':unit,mh:value},props);assert(Math.abs(got.mh-r.mh)<1e-9);assert(Math.abs(got.mc-r.mc)<1e-9)}
 for(const unknown of ['thi','tho','tci','tco','mh','mc'])for(const unit of ['kg-s','kg-h','m3-h','m3-s','l-s','l-min','l-h']){
  const convert=(mass,rho)=>unit==='kg-s'?mass:unit==='kg-h'?mass*3600:mass/rho*(unit==='m3-h'?3600:unit==='m3-s'?1:unit==='l-min'?60000:unit==='l-h'?3600000:1000);
  const s={...state,...r,unknown,'hot-flow-unit':unit,'cold-flow-unit':unit,mh:convert(r.mh,r.rhoh),mc:convert(r.mc,r.rhoc),[unknown]:''},got=project.balance(s,props);
  assert(Math.abs(got.heatBalanceError)<1e-5,unknown+' '+unit);for(const key of ['thi','tho','tci','tco','mh','mc'])assert(Math.abs(got[key]-r[key])<1e-7,key+' '+unknown+' '+unit);
 }
 assert.throws(()=>project.balance({...state,flow:'parallel'},props));assert.throws(()=>project.balance({...state,ph:0},props));assert.throws(()=>project.balance({...state,'hot-fluid':'custom'},props));assert.throws(()=>project.balance({...state,thi:''},props));
 const constant=name=>({Dmass:1000,Cpmass:4200,T:450})[name];const exact=project.balance(state,constant);assert.equal(exact.mc,3.75);assert.equal(exact.q,315);
 assert.throws(()=>project.balance({...state,thi:150,tho:60,mh:100,mc:30.3344156798,ph:5,pc:.4,unknown:'tco',tco:''},props),error=>{assert.equal(error.code,'no-balance-solution');assert.deepEqual(error.fields,['tco']);assert.match(error.message,/Невозможно найти температуру холодного потока на выходе/);assert.match(error.message,/диапазоне.*°C/);assert.match(error.hint,/расходы или давление/);return true});
 assert.throws(()=>project.balance({...state,thi:''},props),error=>error.code==='incomplete'&&error.fields.includes('thi'));
 assert.throws(()=>project.balance({...state,unknown:null,mc:1},props),error=>error.code==='unbalanced'&&error.fields.length===6);
 if(process.argv.includes('--probe')){const t=Date.now();await project.select(state,r,props,{progress:s=>console.log(s,Date.now()-t),cancelled:()=>true});return}
 const fixtures=require('./fixtures/teplo-reference.json');for(const c of fixtures.cases){const v=teplo.calculate(c.inputs,props),target={q:v.heat_duty_kw,requiredUA:v.ua_w_k,reservePercent:0,tho:v.t_hot_out_c,tco:v.t_cold_out_c};assert.equal(project.meets(v,target),v.valid);assert(!project.meets({...v,valid:false},target));assert(!project.meets(v,{...target,requiredUA:v.ua_w_k*1.01}))}
 const cache=new Map(),memo=(...args)=>{const key=JSON.stringify(args);if(cache.has(key))return cache.get(key);const value=props(...args);if(cache.size<100000)cache.set(key,value);return value};
 const shell=project.shellSizing(600,.4);assert.equal(shell.gaugeMPa,.4-.101325);assert.equal(shell.corrosionMM,.2);assert.equal(shell.weldFactor,1);assert.equal(shell.allowableMPa,130);assert(Math.abs(shell.rawMM-.88925)<1e-12);assert.equal(shell.wallMM,1);assert.equal(shell.innerMM,598);
 assert.equal(project.shellSizing(600,1).wallMM,3);for(const pressure of [0,.05,.101325])assert.throws(()=>project.shellSizing(600,pressure),/избыточное/);
 const manufacturing=require('../assets/coil-manufacturing.js');
 const singleState={...state,'single-coil':true,'stock-lengths':false,mh:.047,tci:55,tco:70};
 const singleTarget=project.balance(singleState,memo);
 const single=await project.select(singleState,singleTarget,memo);
 const longCoil=single.rows[0]?.design;
 assert(longCoil?.stockLimitWaived,'A feasible one-coil assignment may use tube stock longer than 6 m');
 assert.equal(longCoil.n,1);
 assert.equal(longCoil.geometry.rows.length,1);
 assert(longCoil.manufacturing[0].totalMM>6000);
 assert.equal(longCoil.manufacturing[0].stockMM,null);
 assert(project.meets(longCoil.thermal,singleTarget));
 assert(single.attempts.every(attempt=>attempt.count===1));
 assert(single.stats.evaluations<=200);
 const tooShort=await project.select({...singleState,length:200},singleTarget,memo);
 assert.equal(tooShort.rows.length,0);
 assert(tooShort.notifications.some(item=>item.level==='warning'&&/Увеличьте габаритную длину или выключите/.test(item.text)));
 const singleAtHighFlow=await project.select({...state,'single-coil':true},r,memo);
 assert.equal(singleAtHighFlow.rows.length,0);
 assert(singleAtHighFlow.stats.families>0,'High Re must not prevent forming single-coil geometry');assert(singleAtHighFlow.attempts.every(a=>a.count===1),'Do not fall back to multiple coils');
 assert(!singleAtHighFlow.notifications.some(item=>/числу Рейнольдса/.test(item.text)));
 assert.equal(project.algorithm,'re-stock-single-re-free-v12');assert(!r.ignoreRadiusRatio);
 for(const [length,stock]of [[799.99,null],[800,1000],[999.99,1000],[1000,null],[2399.99,null],[2400,3000],[2999.99,3000],[3000,null],[3200,null],[4800,6000],[5999.99,6000],[6000,null],[6001,null]])assert.equal(manufacturing.stockFor(length),stock,'stock '+length);
 const baseCounts=project.tubeCounts(state,r,memo),higher=project.tubeCounts(state,{...r,mh:5},memo);assert(higher.min>baseCounts.min);assert(higher.max>baseCounts.max);
 const bounds=project.tubeCounts(state,{...r,mh:Math.PI*.009*.001*17500},()=>.001);assert.deepEqual(bounds.target,{min:4,max:4});
 assert.equal(project.compare({geometry:{height:100,diameter:300},wasteMM:100,n:3},{geometry:{height:101,diameter:100},wasteMM:0,n:1})<0,true,'Height has priority over diameter');
 assert(project.compare({geometry:{height:100,diameter:200},wasteMM:100,n:3},{geometry:{height:100,diameter:201},wasteMM:0,n:1})<0);
 assert.throws(()=>project.families({...state,pc:.1},r,memo),/избыточное/);
 assert.throws(()=>project.families({...state,length:100},r,memo),/Границы/);
 assert.throws(()=>project.tubeSize({...state,'refine-tubes':true,'tube-diameter':14,'tube-wall':7}),/диаметр/);
 assert.deepEqual(project.tubeSize({...state,'refine-tubes':true,'tube-diameter':20,'tube-wall':2}),{d:20,w:2,di:16});
 const designState={...state,mh:.2},target=project.balance(designState,memo),family=project.families(designState,target,memo);
 assert(family.list.length>0);
 for(const f of family.list){
  assert.equal(f.rows.reduce((s,row)=>s+row.count,0),f.n);assert(f.rows.every(row=>Number.isInteger(row.count)&&row.count>=1&&row.count<=64));
  assert(f.diameter<=Number(state['exchanger-diameter']));assert.equal(f.shell.wallMM,project.shellSizing(f.diameter,state.pc).wallMM);
  f.rows.forEach((row,i)=>{assert(row.diameter/2/(f.d-2*f.w)>3);assert(row.diameter/2/(f.d-2*f.w)<12);if(i)assert(row.diameter>f.rows[i-1].diameter);assert(row.minPitch/row.count/Math.sqrt(1+(row.minPitch/(Math.PI*row.diameter))**2)>=f.d-1e-8)});
 }
 const started=Date.now(),selected=await project.select(designState,target,memo);console.log('New compact search time:',Date.now()-started,'ms;',selected.stats);
 assert.equal(selected.rows.length,1);assert.equal(selected.rows[0].id,'balanced');assert.equal(selected.candidates.length,1);assert(project.profiles.filter(p=>p.enabled).every(p=>p.id==='balanced'));
 const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),{calculateCoilGeometry}=require('node:vm').runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';({calculateCoilGeometry})');
 const c=selected.rows[0].design;calculateCoilGeometry(c.geometry);
 assert(project.meets(c.thermal,target));assert.equal(c.thermal.valid,true);assert.deepEqual(project.applicability(c.thermal,target).ignored,[]);
 assert(c.geometry.height<designState.length);assert(c.geometry.diameter<designState['exchanger-diameter']);assert.equal(c.n,c.geometry.rows.reduce((s,row)=>s+row.count,0));assert.equal(c.dmm,14);assert.equal(c.wmm,2.5);assert.equal(c.area,c.thermal.area_m2);
 for(const coil of c.thermal.coils){assert(coil.re_hot>=15000&&coil.re_hot<=20000);assert(coil.radius_ratio>3&&coil.radius_ratio<12)}
 for(const [i,row]of c.geometry.rows.entries()){
  assert(Number.isInteger(row.turns));if(i)assert(row.diameter>c.geometry.rows[i-1].diameter);
  const measured=manufacturing.measure(row,c.geometry.leadBendRadius,c.geometry.leadStraightLength),m=c.manufacturing[i];assert(Math.abs(measured.totalMM-m.totalMM)<1e-9);assert.equal(manufacturing.stockFor(m.totalMM),m.stockMM);assert(m.wasteFraction<=.2);assert(m.totalMM>m.windingMM);assert(m.totalMM<6000);
 }
 const independent=teplo.calculate({...project.source(designState,target),...project.geometryInput(c.geometry)},props);assert(project.meets(independent,target));assert(Math.abs(independent.heat_duty_kw-c.thermal.heat_duty_kw)<1e-9);
 for(const re of [14999,20001]){const blocked=structuredClone(independent);blocked.coils[0].re_hot=re;assert(!project.meets(blocked,target))}
 for(const re of [15000,20000]){const allowed=structuredClone(independent);allowed.coils[0].re_hot=re;assert(project.meets(allowed,target))}
 const blocked=structuredClone(independent);blocked.coils[0].tube_checks.push('3 < R/d внутреннего диаметра < 12: искусственная проверка');blocked.valid=false;assert(!project.meets(blocked,{...target,ignoreRadiusRatio:true}),'Legacy waiver cannot bypass reinstated radius criterion');
 const shellBlocked=structuredClone(independent);shellBlocked.shell.checks.push('Re межтрубного потока < 100000');assert(!project.meets(shellBlocked,target));assert(!project.meets(independent,{...target,requiredUA:1e9}));
 assert.equal(await project.select(state,r,memo,{cancelled:()=>true}),null);
 let cancel=false;assert.equal(await project.select(designState,target,memo,{yield:async()=>{cancel=true},cancelled:()=>cancel}),null);
 const impossible=await project.select({...state,mh:10000},{...r,mh:10000},memo);assert.equal(impossible.rows.length,0);assert.match(impossible.message,/Нет конструкции/);
 assert(app.includes("'inline-pareto-v2'"));assert(app.includes('coilManufacturingItems()'));assert(app.includes('конструкция не найдена'));
 console.log('Teplo project passed: balance unknowns/units; pressure/ceil; Re-based counts; strict radius; full stock lengths/20% waste; compact lexicographic selection; inner-to-outer numbering; independent Teplo; guards/cancellation.');
})().catch(e=>{console.error(e);process.exitCode=1});
