// Run from the repository root. Each child owns one assignment and one CoolProp cache.
const fs=require('node:fs'),path=require('node:path'),{fork}=require('node:child_process'),{pathToFileURL}=require('node:url'),vm=require('node:vm');
const p=require('../assets/coil-project-method.js'),s=require('../assets/coil-project-multicriteria.js'),t=require('../assets/coil-thermal-method.js'),m=require('../assets/coil-manufacturing.js');
const root=path.resolve(__dirname,'..');
const settings=[
 [90,60,20,40,.2,2,1.2],[90,60,20,40,.5,2,1.2],[90,60,20,40,2.5,.6,.4],
 [65,52,12,25,.12,.5,.3],[78,56,18,35,.32,.8,.45],[105,75,32,58,.8,1.6,.9],
 [55,46,15,31,.06,.35,.25],[115,80,25,52,1.4,2,1],[85,65,30,50,.01,.6,.4],[95,70,10,45,.08,.75,.5]
];
function assignment(id){
 if(id>50){
  const a=Math.floor((id-51)/4),j=(id-51)%4,b=(a+j)%5,s=assignment(5*a+b+1);
  const rounded=(n)=>Number(n.toFixed(5));
  return {...s,thi:s.thi+[-6,-2,3,7][j],tho:s.tho+[-3,-1,1,3][j],tci:s.tci+[1,-2,2,3][j],tco:s.tco+[-1,-3,1,4][j],
   mh:rounded(s.mh*[.84,.94,1.08,1.21][j]),ph:rounded(s.ph+[.04,.08,.12,.16][j]),pc:rounded(s.pc+[.02,.04,.06,.08][j])};
 }
 const a=Math.floor((id-1)/5),b=(id-1)%5,[thi,tho,tci,tco,mh,ph,pc]=settings[a];
 const envelope=[[2000,600],[a<3?2000:850, a<3?600:240],[250,200],[700,250],[350,200]][b];
 return {flow:'counter','hot-fluid':'water','cold-fluid':'water',thi,tho,tci,tco,mh,ph,pc,unknown:'mc','tube-conductivity':16,
  'design-objective':'pareto','single-coil':b>=3,'stock-lengths':[0,2,3].includes(b),length:envelope[0],'exchanger-diameter':envelope[1]};
}
const keys=['height','diameter','materialMetres','count','rowCount'];
function dominates(a,b){return keys.every(k=>a[k]<=b[k])&&keys.some(k=>a[k]<b[k])}
function reference(rows){
 const valid=rows.some(r=>!r.warning);let front=[];
 for(const r of rows){if(valid&&r.warning||front.some(f=>dominates(f,r)))continue;front=front.filter(f=>!dominates(r,f));front.push(r)}
 const ranges=keys.map(k=>[Math.min(...front.map(r=>r[k])),Math.max(...front.map(r=>r[k]))]);
 function scores(r){const v=keys.map((k,i)=>{const [l,h]=ranges[i];return l===h?0:(r[k]-l)/(h-l)});return [Math.max(...v),v.reduce((x,y)=>x+y,0)]}
 const sorted=front.map(r=>({r,score:scores(r)})).sort((a,b)=>a.score[0]-b.score[0]||a.score[1]-b.score[1]||(a.r.geometryKey<b.r.geometryKey?-1:a.r.geometryKey>b.r.geometryKey?1:0));
 return {front,best:sorted[0]?.r};
}
async function properties(){
 const vendor=path.join(root,'assets/vendor/coolprop'),cp=await(await import(pathToFileURL(path.join(vendor,'coolprop.js')))).default({wasmBinary:fs.readFileSync(path.join(vendor,'coolprop.wasm')),print(){},printErr(){}});
 const cache=new Map();return (...args)=>{const k=JSON.stringify(args);if(cache.has(k))return cache.get(k);const v=cp.PropsSI(...args);if(cache.size>=150000)cache.clear();cache.set(k,v);return v};
}
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),validate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');
async function audit(id){
 const state=assignment(id),props=await properties(),target=p.balance(state,props),original=t.calculate,seen=new Set();
 let calls=0,errors=0,result;
 try{t.calculate=(input,...rest)=>{calls++;seen.add(JSON.stringify(input));try{return original(input,...rest)}catch(e){errors++;throw e}};result=await s.select(state,target,props)}finally{t.calculate=original}
 const rows=result.calculations,ref=reference(rows),full=new Set(ref.front.map(r=>r.geometryKey)),winner=result.rows[0]?.design;
 const issues=[];
 if(errors!==result.stats.errors||calls!==seen.size||calls!==result.stats.evaluations||calls>p.multicriteria.maxEvaluations)issues.push('accounting');
 if((ref.best?.id??null)!==result.selectedCalculationId||rows.some(r=>full.has(r.geometryKey)!==!!r.rank))issues.push('ranking');
 for(const record of result.acceptedDesigns){try{validate(record.geometry)}catch(e){issues.push('geometry '+record.calculationId+': '+e.message);break}}
 let geometry=null;
 if(winner){
  const g=winner.geometry,thermal=original({...p.source(state,target),...p.geometryInput(g)},props);
  const lengths=g.rows.map(row=>m.measure(row,g.leadBendRadius,g.leadStraightLength).totalMM);
  const material=g.rows.reduce((sum,row,i)=>sum+row.count*(state['stock-lengths']?m.stockFor(lengths[i]):lengths[i]),0)/1000;
  if(!p.meets(thermal,target)||Math.abs(thermal.heat_duty_kw-winner.thermal.heat_duty_kw)>1e-9||Math.abs(material-ref.best.materialMetres)>1e-8||!p.inlineLayout(g).allowed||state['stock-lengths']&&lengths.some(l=>!m.stockFor(l)))issues.push('winner verification');
  geometry={g,meters:material,duty:thermal.heat_duty_kw,valid:thermal.valid,metrics:keys.map(k=>ref.best[k]),key:ref.best.geometryKey};
 }
 const budgets=[100,250,500,800,1000].map(limit=>{const shortlist=reference(rows.filter(r=>r.id<=limit));return {limit,calls:Math.min(calls,limit),found:!!shortlist.best,same:!!ref.best&&ref.best.geometryKey===shortlist.best?.geometryKey,retained:shortlist.front.filter(r=>full.has(r.geometryKey)).length}});
 return {id,algorithm:result.algorithm,frontMetrics:ref.front.map(r=>({metrics:keys.map(k=>r[k]),warning:r.warning})),state,target:target.q,calls,errors,accepted:rows.length,front:full.size,sampled:result.stats.sampled,stop:result.searchBudget.stopped,issues,geometry,budgets,notes:result.notifications};
}
async function main(){
 const extra=process.argv[2]==='extended',file=path.join(root,'docs/audits/coil-pareto-1000'+(extra?'-extra':'')+'.json');
 const results=[];let next=extra?51:1;const last=extra?90:50;
 async function lane(){while(next<=last){const id=next++;const item=await new Promise((ok,fail)=>{const child=fork(__filename,['case',String(id)],{stdio:['ignore','inherit','inherit','ipc']});let value;child.on('message',v=>value=v);child.on('error',fail);child.on('exit',code=>code===0&&value?ok(value):fail(Error('case '+id+' exit '+code)))});results.push(item);results.sort((a,b)=>a.id-b.id);fs.writeFileSync(file,JSON.stringify(results,null,1));console.log(results.length,id,item.calls,item.accepted,item.front,item.issues)}}
 await Promise.all(Array.from({length:5},lane));
}
module.exports={assignment,properties,reference,dominates,keys,validate};
if(require.main===module)(process.argv[2]==='case'?audit(Number(process.argv[3])).then(r=>process.send(r)):main()).catch(e=>{console.error(e);process.exitCode=1});
