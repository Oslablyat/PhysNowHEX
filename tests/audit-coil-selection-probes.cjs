/* Offline counterexamples only. Does not change production files or its 200-call cap. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createRequire}=require('node:module'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js'),teplo=require('../assets/coil-thermal-method.js');
const root=path.resolve(__dirname,'..'),report=require('../docs/audits/coil-selection-150.json'),original=fs.readFileSync(path.join(root,'assets/coil-project-method.js'),'utf8');
const context={module:{exports:{}},require:createRequire(path.join(root,'assets/coil-project-method.js')),auditN:null};
const needle='counts:selected?[selected]:[]';assert.equal(original.split(needle).length,2);
vm.runInNewContext(original.replace(needle,'counts:globalThis.auditN?[globalThis.auditN]:(selected?[selected]:[])'),context);
const alternate=context.module.exports;
const out=path.join(root,'docs/audits/coil-selection-probes.json');
const results=fs.existsSync(out)?JSON.parse(fs.readFileSync(out,'utf8')):{note:'Supplementary offline probes; production selector and 200-call budget unchanged.',probes:[]};
const wide=process.argv.includes('--wide');
function summary(r,t,g){return {q:r.heat_duty_kw,ratio:r.heat_duty_kw/t.q,hot:r.t_hot_out_c,cold:r.t_cold_out_c,re:r.coils[0].re_hot,shellRe:r.shell.re_cold,valid:r.valid,geometry:g}}
(async()=>{
 const cp=await(await import(pathToFileURL(path.join(root,'assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.join(root,'assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}});
 for(const id of process.argv.slice(2).filter(s=>!s.startsWith('--'))){
  const c=report.cases.find(c=>c.id===id);assert(c,id);const memo=new Map(),props=(...args)=>{const k=JSON.stringify(args);if(memo.has(k))return memo.get(k);const v=cp.PropsSI(...args);if(memo.size<100000)memo.set(k,v);return v},s=c.state,t=project.balance(s,props),p={id,productionFound:c.found,diagnosticCalls:0};
  const search=project.families(s,t,props),pool=await project.shortlist(search,s,t,props,{geometryChecks:0},{}),source=project.source(s,t),valid=[];
  p.catalogue=pool.length;
  // Continue unchanged catalogue after the exact production stopping index.
  if(!c.found&&c.budget.stopped==='budget-exhausted'){
   for(let i=200;i<Math.min(pool.length,1200);i++){
    p.diagnosticCalls++;try{const r=teplo.calculate({...source,...project.geometryInput(pool[i].geometry)},props);if(project.meets(r,t)){p.afterBudget={index:i+1,...summary(r,t,pool[i].geometry)};break}}catch{}
   }
  }
  // Refine heights near the closest valid examples without changing N/radii/counts/stock rules.
  if(!c.found&&!p.afterBudget){
   for(const l of pool.slice(0,200)){
    try{const r=teplo.calculate({...source,...project.geometryInput(l.geometry)},props);p.diagnosticCalls++;if(project.applicability(r,t).allowed)valid.push({l,delta:Math.abs(r.heat_duty_kw/t.q-1.005)})}catch{p.diagnosticCalls++}
   }
   valid.sort((a,b)=>a.delta-b.delta);const seen=new Set();
   outer:for(const {l}of valid.slice(0,8))for(let delta=wide?-160:-40;delta<=(wide?160:40);delta+=wide?2:1){
    const height=l.geometry.height+delta,cap=Math.max(...l.lengths.map(m=>m.stockMM));if(height<l.f.minimum||height>s.length)continue;
    const compact=project.compactGeometry(l.f,height,cap);if(!compact)continue;
    const key=height+'|'+JSON.stringify(compact.geometry.rows);if(seen.has(key))continue;seen.add(key);p.diagnosticCalls++;
    try{const r=teplo.calculate({...source,...project.geometryInput(compact.geometry)},props);if(project.meets(r,t)){p.heightRefinement={delta,...summary(r,t,compact.geometry)};break outer}}catch{}
   }
  }
  // Try a handful of alternative N values already inside the initial Re interval.
  if(!c.found&&!p.afterBudget&&!p.heightRefinement&&c.countRange.selected){
   p.alternativeCounts=[];const range=c.countRange,ns=[range.selected-1,range.selected+1,range.min,range.max];
   for(const n of [...new Set(ns)].filter(n=>n>=range.min&&n<=range.max&&n!==range.selected)){
    context.auditN=n;const af=alternate.families(s,t,props),ap=await alternate.shortlist(af,s,t,props,{geometryChecks:0},{});p.alternativeCounts.push({n,families:af.list.length,catalogue:ap.length});
    for(const l of ap.slice(0,200)){p.diagnosticCalls++;try{const r=teplo.calculate({...source,...project.geometryInput(l.geometry)},props);if(project.meets(r,t)){p.alternativeN={n,...summary(r,t,l.geometry)};break}}catch{}}
    if(p.alternativeN)break;
   }
  }
  // Check shorter members of the existing catalogue on selected successful cases.
  if(c.found){
   const shorter=pool.filter(l=>l.geometry.height<c.selected.height).sort((a,b)=>Math.abs(a.ratio-1.005)-Math.abs(b.ratio-1.005));
   p.shorterCatalogue=shorter.length;
   for(const l of shorter.slice(0,200)){p.diagnosticCalls++;try{const r=teplo.calculate({...source,...project.geometryInput(l.geometry)},props);if(project.meets(r,t)){p.shorterWinner=summary(r,t,l.geometry);break}}catch{}}
  }
  results.probes=results.probes.filter(r=>r.id!==id);results.probes.push(p);fs.writeFileSync(out,JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify({id,calls:p.diagnosticCalls,afterBudget:!!p.afterBudget,height:!!p.heightRefinement,alternativeN:p.alternativeN?.n,shorter:p.shorterWinner?.geometry.height}));
 }
})().catch(e=>{console.error(e);process.exitCode=1});
