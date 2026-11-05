/* Offline diagnosis. Extra calls here do not enlarge production's 200 limit. */
const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js');
const root=path.resolve(__dirname,'..'),audit=require('../docs/audits/coil-selection-v6-150.json'),old=require('../docs/audits/coil-selection-v5-150.json');
const screen={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:31,tco:40,mh:2.5,mc:'',ph:.6,pc:.4,unknown:'mc','area-reserve-percent':0,'tube-conductivity':16,length:2000,'exchanger-diameter':600};
const file=path.join(root,'docs/audits/inline-failure-diagnosis.json'),report=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{cases:[]};
function value(r,t,g){return {q:r.heat_duty_kw,ratio:r.heat_duty_kw/t.q,hot:r.t_hot_out_c,cold:r.t_cold_out_c,re:r.coils[0].re_hot,shellRe:r.shell.re_cold,valid:r.valid,applicable:project.applicability(r,t).allowed,accepted:project.meets(r,t),geometry:g}}
(async()=>{
 const cp=await(await import(pathToFileURL(path.join(root,'assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.join(root,'assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}});
 const ids=process.argv.slice(2);if(!ids.length)ids.push('screen',...old.cases.filter(c=>c.found&&!audit.cases.find(a=>a.id===c.id).found).map(c=>c.id));
 for(const id of ids){
  const s=id.startsWith('screen')?{...screen,tci:Number(id.slice(6))||31}:audit.cases.find(c=>c.id===id).state,cache=new Map(),props=(...args)=>{const k=JSON.stringify(args);if(cache.has(k))return cache.get(k);const v=cp.PropsSI(...args);if(cache.size<100000)cache.set(k,v);return v},t=project.balance(s,props),range=project.tubeCounts(s,t,props),r=await project.select(s,t,props);
  const row={id,algorithm:project.algorithm,state:s,target:{q:t.q,dt:t.dt,mc:t.mc,requiredUA:t.requiredUA},range,production:{found:!!r.rows.length,stats:r.stats,budget:r.searchBudget,attempts:r.attempts},oldInline:id.startsWith('screen')?null:project.inlineLayout(old.cases.find(c=>c.id===id).selected.geometry).allowed,counts:[],calls:0};
  const ns=Array.from({length:Math.max(0,range.max-range.min+1)},(_,i)=>range.min+i).sort((a,b)=>Math.abs(a-range.selected)-Math.abs(b-range.selected)||a-b);
  for(const n of ns){
   const f=project.families(s,t,props,[n]),pool=f.list.length?await project.shortlist(f,s,t,props,{geometryChecks:0},{}):[],item={n,families:f.list.length,catalogue:pool.length,calls:0,applicable:0,below:0,above:0,closest:null};
   for(const l of pool.slice(0,400)){
    item.calls++;row.calls++;try{
     const v=value(teplo.calculate({...project.source(s,t),...project.geometryInput(l.geometry)},props),t,l.geometry);
     if(v.applicable){item.applicable++;if(v.ratio<1)item.below++;if(v.ratio>1.01)item.above++;if(!item.closest||Math.abs(v.ratio-1.005)<Math.abs(item.closest.ratio-1.005))item.closest=v}
     if(v.accepted){row.counterexample={n,...v};break}
    }catch{}
   }
   row.counts.push(item);if(row.counterexample)break;
  }
  report.cases=report.cases.filter(c=>c.id!==id);report.cases.push(row);fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({id,range,production:row.production.found,calls:row.calls,recovered:row.counterexample?{n:row.counterexample.n,q:row.counterexample.q,H:row.counterexample.geometry.height,D:row.counterexample.geometry.diameter}:null,counts:row.counts.map(c=>({n:c.n,f:c.families,checked:c.calls,closest:c.closest?.ratio}))}));
 }
})().catch(e=>{console.error(e);process.exitCode=1});
