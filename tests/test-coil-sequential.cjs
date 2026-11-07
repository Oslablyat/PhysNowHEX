const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const p=require('../assets/coil-project-method.js'),q=require('../assets/coil-sequential-method.js'),teplo=require('../assets/coil-thermal-method.js'),m=require('../assets/coil-manufacturing.js');
(async()=>{
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),cache=new Map(),props=(...args)=>{const k=JSON.stringify(args);if(!cache.has(k))cache.set(k,cp.PropsSI(...args));return cache.get(k)};
 const base={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:20,tco:40,mh:2.5,ph:2,pc:1.2,unknown:'mc','tube-conductivity':16,length:10000,'exchanger-diameter':3000},app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),validate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry');
 assert.equal(q.nextTurn([[2,4],[8,10]],5,1),8);assert.equal(q.nextTurn([[2,4],[8,10]],7,-1),4);assert.equal(q.nextTurn([[2,4]],5,1),null);
 const fake=(height,diameter,rowCount,metres)=>({geometry:{height,diameter},rowCount,manufacturing:[{totalMM:metres*1000,count:1}]});
 const simple=fake(608,230,1,24),wasteful=fake(334,226,5,43.92),boundary=fake(450,225,2,28.8),over=fake(449,225,2,28.80001);
 assert.equal(q.chooseDesigns([wasteful,simple]).recommended,simple,'Reject 83% extra tube for extra rows');
 assert.equal(q.chooseDesigns([simple,boundary,over,wasteful]).recommended,boundary,'Exactly +20% is eligible, just above is not');
 assert.equal(q.chooseDesigns([wasteful,simple]).compact,wasteful,'Keep compact option visible');
 assert.equal(q.chooseDesigns([simple,wasteful]).economical,simple);
 assert.equal(q.chooseDesigns([boundary,simple,over,wasteful]).recommended,boundary,'Selection is independent of discovery order');
 assert.equal(q.chooseDesigns([fake(398,210,1,14.2),fake(942,78,1,10.46)]).recommended.geometry.height,398,'The extra-row rule does not force a long single-row design');
 assert.equal(q.tubeMetres({manufacturing:[{totalMM:2000,count:11}]}),22,'Count every parallel tube, including its leads');
 assert.equal(q.chooseDesigns([]),null);
 for(const radialGap of [2,3,14]){const f=q.makeFamily(base,p.balance(base,props),4,2,38,48,{radialGap,shellGap:3,coreGap:3});assert(f);const g=q.layoutAt(f,48,12).geometry;validate(g);assert.equal((g.rows[1].diameter-g.rows[0].diameter)/2-g.tubeDiameter,radialGap);assert.equal(g.rowClearance,radialGap);assert.equal((g.rows[0].diameter-g.tubeDiameter-g.coreDiameter)/2,3);assert.equal((g.diameter-2*g.shellWall-g.rows.at(-1).diameter-g.tubeDiameter)/2,3)}
 for(const radialGap of [1,15,2.5])assert.equal(q.makeFamily(base,p.balance(base,props),4,2,38,48,{radialGap}),null);
 for(const shellGap of [2,7,14])for(const coreGap of [2,9,14]){
  const f=q.makeFamily(base,p.balance(base,props),4,2,38,48,{radialGap:2,shellGap,coreGap}),g=q.layoutAt(f,48,12).geometry;
  validate(g);assert(q.gapGeometryAllowed(g));assert.equal(q.geometryGaps(g).shell,shellGap);assert.equal(q.geometryGaps(g).core,coreGap);
  assert(!q.gapGeometryAllowed({...g,coreClearance:coreGap+1}),'Actual core gap must agree with metadata');
 }
 for(const shellGap of [1,15,2.5]){const f=q.makeFamily(base,p.balance(base,props),4,2,38,48,{shellGap});assert(f);assert(!q.gapGeometryAllowed(q.layoutAt(f,48,12).geometry))}
 for(const coreGap of [1,15,2.5]){const f=q.makeFamily(base,p.balance(base,props),4,2,38,48,{coreGap});assert(f);assert(!q.gapGeometryAllowed(q.layoutAt(f,48,12).geometry))}
 assert.deepEqual(q.stockLengths,[500,1000,1500,2000,3000,6000]);
 for(const stock of q.stockLengths){assert.equal(q.stockFor(stock*.8),stock);assert.equal(q.stockFor(stock-0.001),stock);assert.equal(q.stockFor(stock),null);assert.equal(q.stockFor(stock*.8-0.001),null)}
 for(const length of [450,1300,1800]){assert(q.stockFor(length));assert.equal(m.stockFor(length),null,'Production stock catalogue must stay unchanged')}
 // Analytic manufacturing intervals must agree with the exact shared integral.
 const coveredStocks=new Set();
 for(const [n,nr,radius,gap]of [[1,1,28,2],[1,1,38,2],[4,1,78,3],[24,2,83,7],[52,2,88,6]]){
  const pitch=n/nr*(14+gap),f=q.makeFamily(base,p.balance(base,props),n,nr,radius,pitch);assert(f);
  for(const stock of [true,false]){const {ranges}=q.turnRanges(f,pitch,2000,stock),cap=Math.floor((2000-14)/pitch);for(let turns=1;turns<=cap;turns++){
   const actual=f.rows.every(r=>{try{const mm=m.measure({...r,turns,pitch},28,40),blank=q.stockFor(mm.totalMM);if(stock&&blank)coveredStocks.add(blank);return !stock||!!blank}catch{return false}});assert.equal(ranges.some(([lo,hi])=>turns>=lo&&turns<=hi),actual,`${n}/${nr}/${radius}/${gap}, turns=${turns}, stock=${stock}`);
  }}
 }
 for(const stock of [500,1500,2000])assert(coveredStocks.has(stock),`Exact measurement must exercise the new ${stock} mm intervals`);
 const oldSelect=p.select,oldFamilies=p.families,oldShortlist=p.shortlist,original=teplo.calculate;
 try{
  p.select=p.families=p.shortlist=()=>{throw Error('Experiment must not call production catalogue/selector')};
  for(const change of [{},{mh:.2},{mh:.5},{'stock-lengths':false},{'single-coil':true,'stock-lengths':false},{mh:.5,'single-coil':true,'stock-lengths':false}]){
   const s={...base,...change},target=p.balance(s,props);let calls=0;const seen=new Set();
   teplo.calculate=(input,...args)=>{
    calls++;const key=JSON.stringify(input);assert(!seen.has(key));seen.add(key);
    const d=input.tube_outer_diameter_m*1000,rows=input.coil_rows;
    const actual=[(input.shell_inner_diameter_m/2-rows.at(-1).radius_m)*1000-d/2,(rows[0].radius_m-input.displacer_outer_diameter_m/2)*1000-d/2,...rows.slice(1).map((r,i)=>(r.radius_m-rows[i].radius_m)*1000-d)];
    for(const gap of actual){assert(gap>=Math.ceil(.1*d)-1e-7&&gap<=Math.floor(d)+1e-7);assert(Math.abs(gap-Math.round(gap))<1e-7,'Every Teplo probe uses an allowed whole-mm physical gap')}
    return original(input,...args)
   };
   const result=await q.select(s,target,props);assert.equal(result.stats.evaluations,calls);assert(calls<=200);assert(result.stats.proposals<=q.limits.maxProposals);assert.equal(result.rows.length,1);
   const c=result.rows[0].design,g=c.geometry;validate(g);assert(q.gapGeometryAllowed(g));assert(p.inlineLayout(g).allowed);assert(p.meets(original({...p.source(s,target),...p.geometryInput(g)},props),target));assert(result.attempts.some(a=>a.accepted));assert.equal(result.stopped,'improved-success');assert(result.firstSuccess<=result.stats.evaluations);assert(result.stats.improvementChecks<=q.limits.improvementChecks);assert(result.stats.improvementShapes<=q.limits.improvementShapes);assert(result.trace.some(e=>e.kind==='shape'));assert(result.trace.some(e=>e.kind==='verification'||e.kind==='accepted'));
   if(s.mh===.5&&!s['single-coil'])assert(c.manufacturing.some(tube=>tube.stockMM===2000),'A real Teplo-accepted solution must use the added 2 m stock');
   assert.equal(result.selection.recommended,c);assert.equal(q.chooseDesigns(result.acceptedDesigns).recommended,c);if(c.rowCount>result.selection.simplest.rowCount)assert(q.tubeMetres(c)<=result.selection.tubeLimitM+1e-9);
   if(s.mh===.5&&s['single-coil']){assert(g.height<=398);assert(q.gapGeometryAllowed(g));assert.equal(result.firstSuccess,3);assert(result.stats.improvements>0)}
   if(s['single-coil'])assert.equal(c.n,1);for(const [i,row]of g.rows.entries()){assert(p.axialGap(g.tubeDiameter,row.pitch,row.count).allowed);assert.equal(row.turns,g.rows[0].turns);if(s['stock-lengths']!==false){const stock=q.stockFor(m.measure(row,g.leadBendRadius,g.leadStraightLength).totalMM);assert(stock);assert.equal(c.manufacturing[i].stockMM,stock);assert(c.manufacturing[i].wasteFraction<=.2+1e-9)}}
  }
  let cancelled=false;const cancelledResult=await q.select(base,p.balance(base,props),props,{cancelled:()=>cancelled,progress:stats=>{if(stats.evaluations)cancelled=true}});assert.equal(cancelledResult,null);
  const one={...base,mh:.5,'single-coil':true,'stock-lengths':false};let interruptedCalls=0;
  teplo.calculate=(...args)=>{if(++interruptedCalls>3)throw Error('forced improvement failure');return original(...args)};
  const retained=await q.select(one,p.balance(one,props),props);assert.equal(retained.rows[0].design.geometry.height,942);assert(retained.stats.errors>0);assert.equal(retained.stats.evaluations,interruptedCalls);assert(interruptedCalls<=200);
  teplo.calculate=()=>{throw Error('forced verification failure')};const failed=await q.select(base,p.balance(base,props),props);assert(!failed.rows.length);assert.equal(failed.stats.errors,failed.stats.evaluations);assert(failed.stats.evaluations<=200);assert.match(failed.message,/не доказано/);
 }finally{p.select=oldSelect;p.families=oldFamilies;p.shortlist=oldShortlist;teplo.calculate=original}
 console.log('Sequential experiment passed: exact analytic stock intervals; no catalogue/production-selector calls; directed original Teplo; first solution retained; bounded H/D improvement; true geometry/stock/duty/Re acceptance; independent single/stock flags; deduplication, cancellation and bounded failures.');
})().catch(error=>{console.error(error);process.exitCode=1});
