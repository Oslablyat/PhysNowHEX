// Publish only the measured audit data needed by the isolated comparison page.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..'),load=name=>{const bytes=fs.readFileSync(path.join(root,'docs/audits',name));return {report:JSON.parse(bytes),sha256:createHash('sha256').update(bytes).digest('hex')}};
const before=load('coil-selection-v8-150.json'),after=load('coil-selection-v9-150.json');
for(const {report}of [before,after]){assert.equal(report.cases.length,150);assert.equal(report.summary.auditFailures,0)}
function side(c){return {found:c.found,checks:c.stats.evaluations,errors:c.stats.errors,stop:c.budget.stopped,countRange:c.countRange.target,families:c.stats.families,screened:c.budget.screened,closest:c.diagnostics.closest[0]??null,selected:c.found?c.selected:null}}
const cases=after.report.cases.map(a=>{const b=before.report.cases.find(b=>b.id===a.id);assert(b);assert.deepEqual(a.state,b.state);return {id:a.id,regime:a.regime,inputs:a.state,target:a.target,before:side(b),after:side(a)}});
const data={schema:1,date:'2026-11-05',generatedAt:new Date().toISOString(),sources:Object.fromEntries([['before',before],['after',after]].map(([key,r])=>[key,{algorithm:r.report.algorithm,commit:r.report.engineSource.commit,engineSHA256:r.report.engineSource.sha256,reportSHA256:r.sha256,summary:r.report.summary}])),cases};
const output=path.join(root,'assets/coil-audit-data.json');fs.writeFileSync(output,JSON.stringify(data)+'\n');
console.log('Comparison data: '+cases.length+' cases; '+fs.statSync(output).size+' bytes; source geometries unchanged.');
