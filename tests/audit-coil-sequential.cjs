const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..'),project=require('../assets/coil-project-method.js'),sequence=require('../assets/coil-sequential-method.js'),teplo=require('../assets/coil-thermal-method.js'),m=require('../assets/coil-manufacturing.js'),format=require('../assets/coil-sequential-format.js');
const source=JSON.parse(fs.readFileSync(path.join(root,'docs/audits/coil-selection-v9-150.json'),'utf8'));
const requested=process.argv.find(a=>a.startsWith('--cases='))?.slice(8).split(',');
const reportName=requested?'coil-sequential-focused.json':'coil-sequential-150.json';
const app=fs.readFileSync(path.join(root,'app.js'),'utf8'),validate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');
(async()=>{
 const cp=await(await import(pathToFileURL(path.join(root,'assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.join(root,'assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}});
 const report={schema:1,created:new Date().toISOString(),baseline:project.algorithm,experiment:sequence.algorithm,stockCatalogues:{before:[1000,3000,6000],after:sequence.stockLengths},hashes:Object.fromEntries(['coil-project-method.js','coil-sequential-method.js'].map(name=>[name,createHash('sha256').update(fs.readFileSync(path.join(root,'assets',name))).digest('hex')])),cases:[]};
 const original=teplo.calculate;
 for(const example of source.cases){
  if(requested&&!requested.includes(example.id))continue;
  const s=example.state,pair={id:example.id,state:s};
  for(const [side,engine]of [['before',project],['after',sequence]]){
   const memo=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(!memo.has(key))memo.set(key,cp.PropsSI(...args));return memo.get(key)},t=project.balance(s,props),start=performance.now();let calls=0;const seen=new Set();pair.target=t;
   let result;try{teplo.calculate=(input,...args)=>{calls++;const key=JSON.stringify(input);assert(!seen.has(key));seen.add(key);return original(input,...args)};result=await engine.select(s,t,props)}finally{teplo.calculate=original}
   assert(calls<=200);assert.equal(calls,result.stats.evaluations);
   if(result.rows.length){const c=result.rows[0].design,g=c.geometry;validate(g);assert(project.inlineLayout(g).allowed);assert(g.height<=s.length&&g.diameter<=s['exchanger-diameter']);assert(project.meets(original({...project.source(s,t),...project.geometryInput(g)},props),t));for(const [i,row]of g.rows.entries()){const mm=m.measure(row,g.leadBendRadius,g.leadStraightLength),stock=(side==='after'?sequence:m).stockFor(mm.totalMM);assert(stock);assert.equal(c.manufacturing[i].stockMM,stock);assert(c.manufacturing[i].wasteFraction<=.2+1e-9);assert(project.axialGap(g.tubeDiameter,row.pitch,row.count).allowed)}}
   if(side==='after'&&result.rows.length){assert(result.acceptedDesigns.length);assert.equal(result.selection.recommended,result.rows[0].design);const chosen=sequence.chooseDesigns(result.acceptedDesigns);assert.equal(chosen.recommended,result.rows[0].design);assert(result.stats.improvementChecks<=sequence.limits.improvementChecks);for(const c of result.acceptedDesigns){validate(c.geometry);assert(sequence.gapGeometryAllowed(c.geometry));assert(project.inlineLayout(c.geometry).allowed);assert(project.meets(original({...project.source(s,t),...project.geometryInput(c.geometry)},props),t));for(const [i,row]of c.geometry.rows.entries())assert.equal(sequence.stockFor(m.measure(row,c.geometry.leadBendRadius,c.geometry.leadStraightLength).totalMM),c.manufacturing[i].stockMM)}}
   pair[side]=format.pack(result,performance.now()-start);
  }
  report.cases.push(pair);
  if(report.cases.length%10===0){fs.writeFileSync(path.join(root,'docs/audits/'+reportName),JSON.stringify(report)+'\n');console.log(JSON.stringify({...format.summary(report.cases),last:pair.id}))}
 }
 report.summary=format.summary(report.cases);fs.writeFileSync(path.join(root,'docs/audits/'+reportName),JSON.stringify(report)+'\n');
 if(report.cases.length===150)fs.writeFileSync(path.join(root,'assets/coil-sequential-data.json'),JSON.stringify(report)+'\n');
 console.log(JSON.stringify(report.summary,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
