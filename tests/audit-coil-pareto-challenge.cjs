// Independent winding generator for the 14 x 2.5 mm audit tube. Searches use
// the production verification physics, but never its catalogue or scheduler.
const fs=require('node:fs'),path=require('node:path');
const {assignment,properties,reference,dominates,keys,validate}=require('./audit-coil-pareto-50.cjs');
const p=require('../assets/coil-project-method.js'),t=require('../assets/coil-thermal-method.js'),m=require('../assets/coil-manufacturing.js');
const dir=path.join(__dirname,'../docs/audits');
function profile(r){return r&&{metrics:keys.map(k=>r[k]),radii:r.radii,pitch:r.pitch,turns:r.turns,duty:r.duty,hot:r.hot,cold:r.cold,warning:r.warning,geometryKey:r.geometryKey}}
function generate(state,range,bound,single){
 const rows=[],leads=new Map(),stock=state['stock-lengths'];
 for(let n=range.min;n<=Math.min(range.max,bound?.count??500);n++)for(let nr=1;nr<=Math.min(n,bound?.rowCount??(single?1:2),2);nr++){
  const k=n/nr;if(!Number.isInteger(k)||k>64)continue;
  for(let r=28;r<108;r++)for(let gap=1.5;gap<=(nr===1?1.5:7);gap+=.5){
   const radii=nr===1?[r]:[r,r+14+gap];if(radii.at(-1)>=108||k>1&&2*r*Math.sin(Math.PI/k)<17-1e-9)continue;
   const needed=2*radii.at(-1)+20;let diameter=Math.ceil(needed),wall=0;
   do{wall=Math.ceil((state.pc-.101325)*diameter/260+.2);if(diameter-2*wall>=needed)break;diameter++}while(diameter<=state['exchanger-diameter']);
   if(diameter>Math.min(state['exchanger-diameter'],bound?.diameter??Infinity))continue;
   for(let axial=2;axial<=14;axial++){
    const pitch=k*(14+axial),separation=(14+axial)/Math.sqrt(1+(pitch/(2*Math.PI*r))**2);if(separation<14-1e-9)continue;
    const terms=radii.map(radius=>{const key=radius+'/'+pitch;if(!leads.has(key)){try{leads.set(key,m.measure({diameter:2*radius,pitch,turns:0},28,40).totalMM)}catch{leads.set(key,Infinity)}}return leads.get(key)});
    if(!terms.every(Number.isFinite))continue;
    for(let turns=1;turns*pitch+14<=Math.min(state.length,bound?.height??Infinity);turns++){
     const winding=radii.map(x=>turns*Math.hypot(2*Math.PI*x,pitch)),lengths=winding.map((l,i)=>l+terms[i]);
     const stocks=lengths.map(l=>[1000,3000,6000].find(x=>l>=.8*x-1e-7&&l<x-1e-7));
     if(stock&&!stocks.every(Boolean))continue;
     const height=turns*pitch+14,materialMetres=(stock?stocks:lengths).reduce((a,b)=>a+k*b,0)/1000;
     if(materialMetres>(bound?.materialMetres??Infinity)+1e-10)continue;
     const candidate={height,diameter,materialMetres,count:n,rowCount:nr,radii,pitch,turns,wall,clearance:Math.max(0,Math.min(3,separation-14)),gap:nr===1?3:gap,winding:winding.reduce((a,b)=>a+k*b,0)};
     if(single||!bound||dominates(candidate,bound))rows.push(candidate);
    }
   }
  }
 }
 return rows;
}
function geometry(r){
 return {diameter:r.diameter,height:r.height,shellWall:r.wall,coreDiameter:2*r.radii[0]-20,coreLength:r.height,coreWall:2,tubeDiameter:14,tubeWall:2.5,clearance:r.clearance,coreClearance:3,shellClearance:3,rowClearance:r.gap,leadBendRadius:28,leadStraightLength:40,
  rows:r.radii.map(x=>({diameter:2*x,count:r.count/r.rowCount,turns:r.turns,pitch:r.pitch,phase:0,offset:0,direction:'right',hidden:false}))};
}
// Rebuild the selected drawing directly in SI and independently check the
// engineering limits. All selected examples in this audit are inside Teplo's validity range.
function verifyDrawing(id,c,props){
 const state=assignment(id),target=p.balance(state,props),[h,d,metres,n,nr]=c.metrics;
 const wall=Math.ceil((state.pc-.101325)*d/260+.2),k=n/nr,axial=c.pitch/k-14;
 const gaps=c.radii.slice(1).map((r,i)=>r-c.radii[i]-14);
 const input={...p.source(state,target),arrangement:'inline',shell_inner_diameter_m:(d-2*wall)/1000,
  displacer_outer_diameter_m:(2*c.radii[0]-20)/1000,tube_outer_diameter_m:.014,tube_wall_thickness_m:.0025,row_count:nr,
  coil_rows:c.radii.map(r=>({radius_m:r/1000,pitch_m:c.pitch/1000,count:k,turns:c.turns,tube_outer_diameter_m:.014}))};
 const v=t.calculate(input,props),lo=Math.min(...v.coils.map(x=>x.re_hot)),hi=Math.max(...v.coils.map(x=>x.re_hot));
 const lengths=c.radii.map(r=>m.measure({diameter:2*r,pitch:c.pitch,turns:c.turns},28,40).totalMM);
 const stock=lengths.map(l=>[1000,3000,6000].find(x=>l>=.8*x-1e-7&&l<x-1e-7));
 const actual=(state['stock-lengths']?stock:lengths).reduce((s,x)=>s+k*x,0)/1000;
 const ok=v.valid&&v.ua_w_k>=target.requiredUA*(1-1e-9)&&v.heat_duty_kw>=target.q*(1-1e-7)&&v.heat_duty_kw<=target.q*(1.03+1e-9)
  &&v.t_hot_out_c<=state.tho+.01&&v.t_hot_out_c>=state.tho-.03*(state.thi-state.tho)-.01
  &&v.t_cold_out_c>=state.tco-.01&&v.t_cold_out_c<=state.tco+.03*(state.tco-state.tci)+.01
  &&(state['single-coil']?n===1:lo>=15000&&hi<=20000)&&c.radii.every(r=>r/9>3&&r/9<12)
  &&gaps.every(g=>g>=1.4&&g<=7&&Number.isInteger(2*g))&&Number.isInteger(axial)&&axial>=2&&axial<=14
  &&h===14+c.turns*c.pitch&&h<=state.length&&d<=state['exchanger-diameter']&&Math.abs(actual-metres)<1e-8&&Math.abs(v.heat_duty_kw-c.duty)<1e-8;
 if(!ok)throw Error('Independent drawing verification failed for '+id);
 return {verified:true,reHotMin:lo,reHotMax:hi,reCold:v.shell.re_cold,UA:v.ua_w_k,requiredUA:target.requiredUA,lengthsMM:lengths};
}
// Replay the calls an interval search would make, using measured duties only
// when a probe is requested. The full grid is the answer key, not a filter.
function bracket(rows,q){
 const families=new Map(),visited=new Set(),kept=[];
 for(const row of rows){const k=[row.radii,row.pitch,row.count].join('|');if(!families.has(k))families.set(k,[]);families.get(k).push(row)}
 let reversals=0;
 for(const family of families.values()){
  const f=family.sort((a,b)=>a.turns-b.turns);
  function probe(i){const r=f[i];visited.add(r);if(!Number.isFinite(r.duty))throw Error('no duty');return r.duty}
  function first(predicate){let l=0,h=f.length;while(l<h){const i=(l+h)>>1;if(predicate(probe(i)))h=i;else l=i+1}return l}
  let lo=0,hi=f.length;
  try{lo=first(v=>v>=q*(1-1e-7));hi=first(v=>v>q*(1.03+1e-9))}catch{lo=0;hi=f.length}
  for(let i=lo;i<hi;i++){visited.add(f[i]);if(f[i].ok)kept.push(f[i])}
  if(f.some((v,i)=>i&&v.duty<f[i-1].duty-1e-8))reversals++;
 }
 const expected=rows.filter(r=>r.ok),ids=new Set(kept.map(r=>r.geometryKey));
 return {calls:visited.size,kept:kept.length,missed:expected.filter(r=>!ids.has(r.geometryKey)).length,reversals,families:families.size};
}
async function challenge(id,baseline,props){
 const state=assignment(id),target=p.balance(state,props),base=p.source(state,target),single=state['single-coil'],old=baseline.geometry;
 const bound=old&&Object.fromEntries(keys.map((k,i)=>[k,old.metrics[i]]));
 const range=single?{min:1,max:1}:p.tubeCounts(state,target,props);
 const pool=generate(state,range,single?null:bound,single);
 if(!single){
  const length=old?old.g.rows.reduce((a,row)=>a+row.count*row.turns*Math.hypot(Math.PI*row.diameter,row.pitch),0):target.requiredUA/(1700*Math.PI*.0115)*1000;
  pool.sort((a,b)=>Math.abs(a.winding-length)-Math.abs(b.winding-length));
 }
 const subset=single?pool:pool.slice(0,old?1200:4000);if(subset.length>10000)throw Error('Independent budget exceeded');
 let calls=0,errors=0,invalid=0;const accepted=[];
 for(const row of subset){
  const g=geometry(row);try{validate(g)}catch{invalid++;continue}
  calls++;let th;try{th=t.calculate({...base,...p.geometryInput(g)},props)}catch{errors++;continue}
  row.duty=th.heat_duty_kw;
  if(!p.meets(th,target))continue;
  Object.assign(row,{ok:true,geometryKey:p.geometryKey(g),warning:!th.valid,duty:th.heat_duty_kw,hot:th.t_hot_out_c,cold:th.t_cold_out_c});
  accepted.push(row);
 }
 const best=reference(accepted).best,siteGrid=reference(accepted.filter(r=>(r.radii[0]-28)%5===0));
 // Replay an exact front-only branch bound on the fully evaluated single-coil grid.
 const kept=[],ready=[];let skipped=0;
 if(single){for(const r of subset.slice().sort((a,b)=>a.height-b.height||a.diameter-b.diameter)){
  if(ready.some(v=>dominates(v,r))){skipped++;continue}
  if(r.ok){kept.push(r);if(!r.warning)ready.push(r)}
 }}
 const keptFront=reference(kept),front=reference(accepted),expectedKeys=new Set(front.front.map(r=>r.geometryKey));
 return {id,single,pool:pool.length,tried:subset.length,calls,errors,invalid,accepted:accepted.length,front:front.front.length,
  chosen:profile(best),siteGridCount:siteGrid.front.length,siteGridBest:profile(siteGrid.best),siteGridAccepted:accepted.filter(r=>(r.radii[0]-28)%5===0).length,
  superior:profile(accepted.find(r=>old&&(!old.valid||!r.warning)&&dominates(r,bound))),
  bracket:single?bracket(subset,target.q):null,
  prune:single?{skipped,remaining:subset.length-skipped,exact:keptFront.front.length===expectedKeys.size&&keptFront.front.every(r=>expectedKeys.has(r.geometryKey))}:null};
}
async function ordinaryBracket(ids){
 const solver=require('../assets/coil-project-multicriteria.js'),out=[];
 for(const id of ids){
  const state=assignment(id),props=await properties(),target=p.balance(state,props),rows=[],original=t.calculate;let result;
  try{
   t.calculate=(input,...args)=>{
    const coils=input.coil_rows,row={radii:coils.map(c=>c.radius_m),pitch:coils[0].pitch_m,count:coils.reduce((sum,c)=>sum+c.count,0),turns:coils[0].turns};
    rows.push(row);const thermal=original(input,...args);row.duty=thermal.heat_duty_kw;return thermal;
   };
   result=await solver.select(state,target,props);
  }finally{t.calculate=original}
  if(result.searchBudget.stopped!=='catalogue-exhausted'||result.stats.phases.diagnosis||result.stats.evaluations!==rows.length)throw Error('Not a complete in-bounds catalogue: '+id);
  for(const accepted of result.calculations)Object.assign(rows[accepted.id-1],{ok:true,geometryKey:accepted.geometryKey});
  const replay=bracket(rows,target.q);out.push({id,full:rows.length,accepted:result.calculations.length,...replay});console.log(id,replay);
 }
 fs.writeFileSync(path.join(dir,'coil-pareto-bracket.json'),JSON.stringify(out,null,1));
}
async function main(){
 if(process.argv[2]==='bracket')return ordinaryBracket(process.argv.slice(3).map(Number));
 if(process.argv[2]==='verify'){
  const file=path.join(dir,'coil-pareto-challenges.json'),results=JSON.parse(fs.readFileSync(file)),props=await properties();
  for(const r of results)if(r.chosen)r.verification=verifyDrawing(r.id,r.chosen,props);
  fs.writeFileSync(file,JSON.stringify(results,null,1));return;
 }
 const requested=process.argv.slice(2).map(Number);
 const ids=requested.length?requested:[1,3,4,6,7,9,11,16,19,21,34,49],props=await properties(),results=[];
 for(const id of ids){const baseline=JSON.parse(fs.readFileSync(path.join(dir,'coil-pareto-50.json'))).find(r=>r.id===id);if(!baseline)throw Error('Missing baseline '+id);
  const result=await challenge(id,baseline,props);if(result.chosen)result.verification=verifyDrawing(id,result.chosen,props);results.push(result);console.log(id,result.calls,result.accepted,result.superior?.metrics,result.prune)}
 fs.writeFileSync(path.join(dir,'coil-pareto-challenges.json'),JSON.stringify(results,null,1));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1});
