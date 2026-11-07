const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto'),{pathToFileURL}=require('node:url');
(async()=>{
 const root=path.resolve(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p)),data=JSON.parse(read('assets/coil-audit-data.json'));
 const {changeKind,resultReason,matches,axialGap,windingArea}=await import(pathToFileURL(path.join(root,'assets/coil-audit-utils.js')));
 const {designParameters}=await import(pathToFileURL(path.join(root,'assets/coil-3d/design-model.js')));
 assert.equal(data.schema,1);assert.equal(data.cases.length,150);assert.equal(new Set(data.cases.map(c=>c.id)).size,150);assert(read('assets/coil-audit-data.json').length<1024*1024);
 for(const [side,file]of [['before','coil-selection-v8-150.json'],['after','coil-selection-v9-150.json']]){
  const bytes=read('docs/audits/'+file),source=JSON.parse(bytes);assert.equal(data.sources[side].reportSHA256,createHash('sha256').update(bytes).digest('hex'));
  for(const c of data.cases){const original=source.cases.find(r=>r.id===c.id);assert.deepEqual(c.inputs,original.state);assert.deepEqual(c.target,original.target);assert.equal(c[side].found,original.found);assert.equal(c[side].checks,original.stats.evaluations);if(!original.found){assert.equal(c[side].selected,null);assert(resultReason(c[side]).length>20);continue}
   assert.deepEqual(c[side].selected,original.selected,'Never approximate audit geometries or thermal results for display');
   const g=c[side].selected.geometry,p=designParameters(g);assert.equal(p.height,g.height);assert.equal(p.shellDiameter,g.diameter);assert.equal(p.totalCount,c[side].selected.n);
   const light=designParameters(g,{stepsPerTurn:48,radialSegments:16});assert.equal(light.stepsPerTurn,48);assert.equal(light.radialSegments,16);assert.deepEqual(light.rows,p.rows);assert.equal(light.height,p.height);assert.equal(light.shellDiameter,p.shellDiameter);
   p.rows.forEach((r,i)=>{assert.equal(r.coilDiameter,g.rows[i].diameter);assert.equal(r.turns,g.rows[i].turns);assert.equal(r.pitch,g.rows[i].pitch);assert.equal(r.count,g.rows[i].count)});
   assert(windingArea(g)>0);assert(Number.isFinite(axialGap(g)));if(side==='after')assert(axialGap(g)>=2-1e-7&&axialGap(g)<=14+1e-7);
  }
 }
 const tally=data.cases.reduce((m,c)=>(m[changeKind(c)]=(m[changeKind(c)]||0)+1,m),{});assert.deepEqual(tally,{none:95,shorter:37,longer:4,lost:12,gained:2});
 assert.equal(data.cases.filter(c=>matches(c,'lost','')).length,12);assert.equal(data.cases.filter(c=>matches(c,'gained','')).length,2);assert.equal(data.cases.filter(c=>matches(c,'both','')).length,41);
 assert.equal(data.cases.filter(c=>matches(c,'all','C-2,5'))[0].id,'C-2.5');assert.equal(data.cases.filter(c=>matches(c,'all','No such case')).length,0);
 const lost=data.cases.find(c=>c.id==='D-0.2');assert(lost.before.found&&!lost.after.found);assert.match(resultReason(lost.after),/200.*не доказано/);
 const noCount=data.cases.find(c=>c.id==='A-0.02');assert.match(resultReason(noCount.after),/Нет целого числа трубок/);
 const reference=data.cases.find(c=>c.id==='C-2.5');assert.equal(reference.before.selected.height,1948);assert.equal(reference.after.selected.height,1574);assert.equal(axialGap(reference.after.selected.geometry),6);
 console.log('Audit comparison passed: exact paired inputs and source hashes; all 150 cases / 96 accepted geometries; original 3D parameters unchanged; thermal/stock details retained; category filters, decimal search, missing-design reasons and measured reference dimensions.');
})().catch(e=>{console.error(e);process.exitCode=1});
