const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url'),m=require('../assets/coil-manufacturing.js');
(async()=>{
 const {leadPath}=await import(pathToFileURL(path.resolve(__dirname,'../assets/coil-3d/lead-path.js')));
 for(const diameter of [56,58,98,166,400])for(const count of [1,3])for(const pitch of [count*20,count*60])for(const straight of [0,40,120]){
  const row={diameter,pitch,turns:7,count},measured=m.measure(row,28,straight);
  const curve=leadPath({leadBendRadius:28,leadStraightLength:straight,tubeDiameter:14,stepsPerTurn:60},{index:0,coilDiameter:diameter,turns:7,pitch});
  assert(Math.abs(curve.getLength()-measured.totalMM)<1e-8);
  assert(measured.totalMM>measured.windingMM);assert.equal(measured.straightMM,2*straight);
  // Independent polyline check across the drawn curve, not just two consumers
  // calling the same integral. Segment boundaries are sampled separately.
  let sampled=0;for(const segment of curve.segments){let prev=segment.point(0,new (await import(pathToFileURL(path.resolve(__dirname,'../assets/vendor/three-0.186.1/three.module.min.js')))).Vector3());for(let i=1;i<=1500;i++){const next=segment.point(i/1500,prev.clone());sampled+=next.distanceTo(prev);prev=next}}
  assert(Math.abs(sampled-measured.totalMM)/measured.totalMM<.0001);
 }
 const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8'),worker=fs.readFileSync(path.resolve(__dirname,'../assets/coil-project-worker.js'),'utf8');
 assert(html.indexOf('assets/coil-manufacturing.js')<html.indexOf('assets/coil-project-method.js'));assert(worker.includes("import './coil-manufacturing.js"));assert(app.includes('...coilManufacturingItems()'));assert(app.includes("title:'Заготовки · полная длина с отводами'"));
 console.log('Manufacturing passed: full tube lengths match actual 3D centreline/polyline; both bends and both leads; stock display/export and worker dependency.');
})().catch(e=>{console.error(e);process.exitCode=1});
