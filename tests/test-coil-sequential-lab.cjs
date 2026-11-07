const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file)),data=JSON.parse(read('assets/coil-sequential-data.json')),format=require('../assets/coil-sequential-format.js'),q=require('../assets/coil-sequential-method.js');
assert.equal(data.schema,1);assert.equal(data.cases.length,150);assert.equal(new Set(data.cases.map(c=>c.id)).size,150);assert.deepEqual(format.summary(data.cases),data.summary);
// The comparison is a historical v12/v6 snapshot. Freeze its production source
// while the main site evolves independently; the experimental source stays exact.
for(const [name,hash]of Object.entries(data.hashes)){const source=name==='coil-project-method.js'?'tests/reference/coil-project-v12.js':'assets/'+name;assert.equal(createHash('sha256').update(read(source)).digest('hex'),hash,'Historical comparison must retain its exact source');}
assert.deepEqual(data.stockCatalogues,{before:[1000,3000,6000],after:[500,1000,1500,2000,3000,6000]});
const check=c=>{
 for(const side of ['before','after']){const r=c[side];assert(r.stats.evaluations<=200);assert.equal(r.found,!!r.selected);if(!r.found)continue;
  const designs=side==='after'?r.acceptedDesigns:[r.selected];assert(designs.length);
  for(const d of designs){if(side==='after')assert(q.gapGeometryAllowed(d.geometry));assert(d.geometry.height<=c.state.length);assert(d.geometry.diameter<=c.state['exchanger-diameter']);assert(d.thermal.heat_duty_kw>=c.target.q*(1-1e-7));assert(d.thermal.heat_duty_kw<=c.target.q*(1.01+1e-9));for(const tube of d.manufacturing){if(c.state['stock-lengths']===false){assert.equal(tube.stockMM,null)}else{assert(data.stockCatalogues[side].includes(tube.stockMM));assert(tube.totalMM<tube.stockMM);assert(tube.totalMM>=tube.stockMM*.8-1e-7)}}}
  if(side==='after'){assert.deepEqual(r.selection.recommended,r.selected);const expected=q.chooseDesigns(designs);for(const key of ['recommended','compact','economical','simplest'])assert.deepEqual(expected[key],r.selection[key]);assert.equal(r.selection.maxTubeIncrease,.2);assert.equal(r.selection.referenceTubeM,q.tubeMetres(r.selection.simplest));assert(Math.abs(r.selection.tubeLimitM-r.selection.referenceTubeM*1.2)<1e-9);if(r.selected.rowCount>r.selection.simplest.rowCount)assert(q.tubeMetres(r.selected)<=r.selection.tubeLimitM+1e-9);assert.equal(r.firstSuccess,r.attempts.findIndex(a=>a.accepted)+1);assert.equal(r.stats.evaluations,r.attempts.length);assert(r.stats.improvementChecks<=48);assert(r.stats.improvementShapes<=2400)}
 }
};
for(const c of data.cases)check(c);
const previous=JSON.parse(read('docs/audits/coil-sequential-v5-snapshot.json'));assert.equal(createHash('sha256').update(read('tests/reference/coil-sequential-v5.js')).digest('hex'),previous.hashes['coil-sequential-method.js']);
const focused=JSON.parse(read('assets/coil-sequential-focused-data.json'));assert.equal(focused.cases.length,16);for(const c of focused.cases)check(c);
const example=focused.cases.find(c=>c.id==='normal-free-0.5'),s=example.after.selection;
assert(s.recommended.geometry.height<=608);assert.equal(s.recommended.rowCount,1);assert(q.gapGeometryAllowed(s.recommended.geometry));
assert(s.compact.geometry.height<=s.recommended.geometry.height);assert(q.tubeMetres(s.economical)<=q.tubeMetres(s.recommended));
const one=focused.cases.find(c=>c.id==='single-free-0.5').after;assert(one.selected.geometry.height<=398);assert.equal(one.selected.n,1);
console.log('Reasonable lab passed: 150+16 paired inputs, exact source hashes, all accepted alternatives, full tube/count/stock/duty checks, explicit 20% rule and screenshot regression.');
