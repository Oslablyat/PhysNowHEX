/* Offline diagnosis only; extra verification calls do not change the site budget. */
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js');
(async()=>{
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),cache=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(cache.has(key))return cache.get(key);const value=cp.PropsSI(...args);if(cache.size<100000)cache.set(key,value);return value};
 const state={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:31,tco:40,mh:2.5,mc:'',ph:.6,pc:.4,unknown:'mc','area-reserve-percent':0,'tube-conductivity':16,length:Number(process.argv[2])||1800,'exchanger-diameter':600};
 const target=project.balance(state,props),range=project.tubeCounts(state,target,props),production=await project.select(state,target,props),estimate=project.screeningModel(state,target,props);
 const report={algorithm:project.algorithm,state,target,range,production,counts:[]},file=path.resolve(__dirname,'../docs/audits/full-height-limit-'+state.length+'.json');
 // Compare the same previously verified full-height layout without confusing
 // thermal applicability with the additional manufacturing acceptance rules.
 const reference=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../docs/audits/full-height-user-cases-v8.json'),'utf8')).cases.find(c=>c.state.tci===31).selected.geometry;
 const manufacturing=require('../assets/coil-manufacturing.js');report.sameLayoutAtHeight=[];
 for(const height of [...new Set([state.length,1837,1955])]){
  const geometry=structuredClone(reference);geometry.height=geometry.coreLength=height;geometry.rows.forEach(row=>row.pitch=(height-geometry.tubeDiameter)/row.turns);
  const result=teplo.calculate({...project.source(state,target),...project.geometryInput(geometry)},props);
  report.sameLayoutAtHeight.push({height,diameter:geometry.diameter,withinHeightLimit:height<=state.length,q:result.heat_duty_kw,deviationPercent:(result.heat_duty_kw/target.q-1)*100,thermalPass:project.meets(result,target),manufacturing:geometry.rows.map(row=>{const measured=manufacturing.measure(row,geometry.leadBendRadius,geometry.leadStraightLength);return {radiusMM:row.diameter/2,lengthMM:measured.totalMM,stockMM:manufacturing.stockFor(measured.totalMM),wasteFromThreeMetres:(3000-measured.totalMM)/3000}})});
 }
 fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({production:production.stats,stop:production.searchBudget,found:!!production.rows.length,range}));
 if(process.argv.includes('--production-only'))return;
 for(let n=range.min;n<=range.max;n++){
  const families=project.families(state,target,props,[n]),row={n,families:families.list.length,geometries:0,calls:0,accepted:[],closest:null,maximum:null},seen=new Set();
  for(const f of families.list){
   const choices=[];
   for(let height=Math.ceil(f.minimum);height<=state.length;height+=5){
    for(const cap of [1000,3000,6000]){
     const layout=project.compactGeometry(f,height,cap);if(!layout)continue;
     const key=JSON.stringify(project.geometryInput(layout.geometry));if(seen.has(key))continue;seen.add(key);row.geometries++;
     const ratio=estimate(layout.geometry)/target.requiredUA;choices.push({layout,ratio});
    }
   }
   // Check near-target estimates, and the maximum available heat-transfer UA.
   choices.sort((a,b)=>Math.abs(Math.log(a.ratio/1.005))-Math.abs(Math.log(b.ratio/1.005)));
   const selected=[...choices.slice(0,5),...choices.sort((a,b)=>b.ratio-a.ratio).slice(0,1)];
   for(const {layout,ratio}of selected){
    row.calls++;
    try{
     const thermal=teplo.calculate({...project.source(state,target),...project.geometryInput(layout.geometry)},props),value={q:thermal.heat_duty_kw,ratio:thermal.heat_duty_kw/target.q,uaRatio:thermal.ua_w_k/target.requiredUA,estimate:ratio,hot:thermal.t_hot_out_c,cold:thermal.t_cold_out_c,re:thermal.coils[0].re_hot,valid:thermal.valid,blocking:project.applicability(thermal,target).blocking,geometry:layout.geometry};
     if(project.applicability(thermal,target).allowed){if(!row.closest||Math.abs(value.ratio-1.005)<Math.abs(row.closest.ratio-1.005))row.closest=value;if(!row.maximum||value.q>row.maximum.q)row.maximum=value;}
     if(project.meets(thermal,target))row.accepted.push(value);
    }catch(error){row.error=error.message;}
   }
  }
  report.counts.push(row);fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...row,accepted:row.accepted.length,closest:row.closest&&{...row.closest,geometry:undefined},maximum:row.maximum?.ratio}));
 }
})().catch(error=>{console.error(error);process.exitCode=1});
