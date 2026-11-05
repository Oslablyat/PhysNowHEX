const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{pathToFileURL}=require('node:url');
const project=require('../assets/coil-project-method.js');
(async()=>{
 const old=require('../docs/audits/coil-selection-v5-150.json').cases.find(c=>c.id==='C-2.5').selected.geometry;
 assert(!project.inlineLayout(old).allowed,'The former radially weighted layout must not be called inline');
 const rows=[70,87,104].map(radius=>({diameter:radius*2,count:10,pitch:220,turns:8,offset:0,phase:0,direction:'right'})),g={diameter:234,height:1774,shellWall:1,coreDiameter:120,coreLength:1774,coreWall:2,tubeDiameter:14,tubeWall:2.5,clearance:3,coreClearance:3,shellClearance:3,rowClearance:3,leadBendRadius:28,leadStraightLength:40,rows};
 assert(project.inlineLayout(g).allowed);
 for(const [key,value]of [['count',9],['turns',7],['pitch',225],['offset',5],['phase',18],['direction','left']])assert(!project.inlineLayout({...g,rows:rows.map((r,i)=>i===1?{...r,[key]:value}:r)}).allowed,key+' mismatch');
 assert(!project.inlineLayout({...g,height:2000}).allowed,'All rows must fill the working shell height');
 assert(!project.inlineLayout({...g,height:g.height+50,rows:rows.map(r=>({...r,offset:50}))}).allowed,'A common top offset must not leave the shell empty');
 const shortened=require('../docs/audits/inline-counts-user-case.json').cases.find(c=>c.id==='cold-inlet-31').selected.geometry;assert(!project.inlineLayout(shortened).allowed,'Reject the stepped partial-height v7 optimum');
 const {designParameters}=await import(pathToFileURL(path.resolve(__dirname,'../assets/coil-3d/design-model.js'))),{leadPath}=await import(pathToFileURL(path.resolve(__dirname,'../assets/coil-3d/lead-path.js'))),p=designParameters(g);
 for(const row of p.rows){const curve=leadPath(p,row).helix;assert(Math.abs(curve.getPoint(0).y+row.centerY-(g.height/2-g.tubeDiameter/2))<1e-7);assert(Math.abs(curve.getPoint(1).y+row.centerY-(-g.height/2+g.tubeDiameter/2))<1e-7,'No row may terminate early in the rendered model');}
 // Intersect the ACTUAL rendered helix centreline with longitudinal half-planes
 // at several arbitrary azimuths. Adjacent radial rows must have identical
 // crossing heights over their complete common active length.
 for(const theta of [0,.37,Math.PI/2,Math.PI,4.7]){
  const levels=p.rows.map(row=>{
   const curve=leadPath(p,row).helix,ys=[];
   for(let j=0;j<row.count;j++)for(let k=-2;k<=row.turns+2;k++){
    const angle=theta-row.phase-2*Math.PI*j/row.count+2*Math.PI*k,u=angle/(2*Math.PI*row.turns);if(u<1e-9||u>1-1e-9)continue;
    const point=curve.getPoint(u),azimuth=Math.atan2(point.z,point.x)+row.phase+2*Math.PI*j/row.count;assert(Math.cos(azimuth-theta)>1-1e-8,'Sample the rendered half-plane, not just a height formula');ys.push(point.y+row.centerY);
   }
   return ys.sort((a,b)=>a-b);
  });
  const top=g.height/2-g.tubeDiameter/2,bottom=top-Math.min(...rows.map(r=>r.turns*r.pitch));
  const common=levels.map(values=>values.filter(y=>y>bottom+1e-7&&y<top-1e-7));
  for(const values of common.slice(1)){assert.equal(values.length,common[0].length);values.forEach((y,i)=>assert(Math.abs(y-common[0][i])<1e-7,'Centrelines must form actual corridors at azimuth '+theta))}
 }
 const cp=await(await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.resolve(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print(){},printErr(){}}),memo=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(memo.has(key))return memo.get(key);const v=cp.PropsSI(...args);if(memo.size<100000)memo.set(key,v);return v};
 const s={flow:'counter','hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',thi:90,tho:60,tci:31,tco:40,mh:2.5,mc:'',ph:.6,pc:.4,unknown:'mc','tube-conductivity':16,length:2000,'exchanger-diameter':600,'coil-thermal-inputs':{arrangement:'staggered'}},target=project.balance(s,props);
 assert.equal(project.source(s,target).arrangement,'inline','Automatic optimum always uses inline correlations');
 const search=project.families(s,target,props);assert(search.list.length);for(const f of search.list)assert(f.rows.every(r=>r.count===f.rows[0].count));
 const r=await project.select(s,target,props);assert.equal(r.rows.length,1);const c=r.rows[0].design;assert(c.rowCount>1,'Exercise a real multi-row selection');assert(project.inlineLayout(c.geometry).allowed);assert.equal(c.thermalSource.arrangement,'inline');assert(project.meets(c.thermal,target));assert(r.stats.evaluations<=200);
 const bad=structuredClone(c.thermal);bad.rows[1].pitch_m*=1.01;assert(!project.meets(bad,target));
 const short=structuredClone(c.thermal);short.rows[1].turns--;assert(!project.meets(short,target));
 const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');assert(app.includes("coilThermalInputs={...coilThermalInputs,arrangement:'inline'}"));
 console.log('Inline passed: rejected weighted and stepped rows; real 3D centrelines align at five azimuths; same starts/turns/pitch/phase/offset/handedness and full shell height; auto source inline; full Teplo and shared budget.');
})().catch(e=>{console.error(e);process.exitCode=1});
