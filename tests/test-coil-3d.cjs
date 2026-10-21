const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
  const {DEFAULTS,validate,measurements,HelixCurve,hollowCylinder,coilGeometry,sectionGeometry,buildModel,disposeModel,exampleParameters,GeometryCache,startSeparation,rowsOf}=await import(pathToFileURL(path.resolve(__dirname,'../assets/coil-3d/model.js')));
  assert.equal(validate(DEFAULTS),'');
  const m=measurements(DEFAULTS);assert.equal(m.coilHeight,1080);assert.equal(m.shellGap,76);assert.equal(m.coreGap,84);assert(Math.abs(m.coilLength-12*Math.hypot(Math.PI*400,90))<1e-9);
  for(const patch of [{tubeWall:16},{coreDiameter:390},{coilDiameter:580},{turns:20},{pitch:32},{coreLength:1400},{height:NaN},{turns:2.5}])assert(validate({...DEFAULTS,...patch}),'Invalid geometry must be rejected: '+JSON.stringify(patch));
  const helix=new HelixCurve(DEFAULTS),start=helix.getPoint(0),end=helix.getPoint(1);assert(Math.abs(end.y-start.y-1080)<1e-8);assert(Math.abs(start.x-end.x)<1e-8);assert(Math.abs(start.z-end.z)<1e-8);
  const cylinder=hollowCylinder(600,8,1400),cut=sectionGeometry(cylinder);assert.equal(cut.loops,2);assert(cut.capTriangles>0);
  assert.equal(cylinder.userData.smoothWalls,true);assert.equal(cylinder.userData.radialSegments,128);
  const cylinderNormals=cylinder.getAttribute('normal');let curvedWalls=0,sharpRims=0;
  for(let i=0;i<cylinderNormals.count;i++){const x=cylinderNormals.getX(i),y=cylinderNormals.getY(i),z=cylinderNormals.getZ(i);assert(Math.abs(Math.hypot(x,y,z)-1)<1e-5);if(Math.abs(y)<1e-6)curvedWalls++;if(Math.abs(y)>.999)sharpRims++;}
  assert(curvedWalls>0&&sharpRims>0,'Cylinder walls are smooth while annular rims stay flat');
  const smoothCoil=coilGeometry(DEFAULTS),sn=smoothCoil.getAttribute('normal');assert.equal(smoothCoil.userData.radialSegments,32);
  let smoothTriangles=0;for(let i=0;i<sn.count;i+=3){const dx=sn.getX(i)-sn.getX(i+2),dy=sn.getY(i)-sn.getY(i+2),dz=sn.getZ(i)-sn.getZ(i+2);if(Math.hypot(dx,dy,dz)>1e-5)smoothTriangles++;}assert(smoothTriangles>sn.count/6,'Curved triangles must interpolate different vertex normals, not faceted face normals');smoothCoil.dispose();
  const cap=cut.caps.getAttribute('position');let area=0;
  for(let i=0;i<cap.count;i+=3){const ax=cap.getX(i),ay=cap.getY(i),bx=cap.getX(i+1),by=cap.getY(i+1),cx=cap.getX(i+2),cy=cap.getY(i+2);area+=Math.abs((bx-ax)*(cy-ay)-(by-ay)*(cx-ax))/2;}
  assert(Math.abs(area-2*8*1400)<.1,'Cylinder section must show two wall strips, not a filled cylinder');
  cylinder.dispose();cut.body.dispose();cut.caps.dispose();
  for(const patch of [{},{turns:1,pitch:120},{turns:24,pitch:45},{tubeWall:4,tubeDiameter:40},{shellDiameter:800,coilDiameter:500,coreDiameter:300},{coreLength:1100,height:1600},{turns:7,coilDiameter:360,pitch:100}]){
    const p={...DEFAULTS,...patch};assert.equal(validate(p),'');
    for(const mode of ['whole','cutaway','section']){
      const group=buildModel(p,mode);assert.equal(group.userData.mode,mode);assert.equal(group.children.length,mode==='whole'?3:mode==='cutaway'?4:6);
      group.traverse(mesh=>{if(!mesh.geometry)return;const vertices=mesh.geometry.getAttribute('position');for(let i=0;i<vertices.array.length;i++)assert(Number.isFinite(vertices.array[i]));if(mode==='section'||mode==='cutaway'&&mesh.name.startsWith('shell'))for(let i=0;i<vertices.count;i++)assert(vertices.getZ(i)<=.001,'Cut geometry must remain behind section plane');});
      if(mode==='section'){const cap=group.getObjectByName('coil-section');assert.equal(cap.userData.loops,p.turns*4,'Each crossing has an outer loop and a hole');assert(cap.userData.triangles>0);}
      disposeModel(group);
    }
  }
  for(let count=1;count<=8;count++){
    const p=exampleParameters(count);assert.equal(validate(p),'');const m=measurements(p);assert.equal(m.rowCount,count);assert(m.coilLength>0);assert(count===1?m.rowGap===null:m.rowGap>0);
    for(const mode of ['whole','cutaway','section']){
      let group;try{group=buildModel(p,mode);}catch(error){throw Error(count+' rows, '+mode+': '+error.message,{cause:error});}assert.equal(group.children.length,mode==='whole'?count+2:mode==='cutaway'?count+3:2*(count+2));
      for(let i=0;i<count;i++){const name=i?'coil-'+(i+1):'coil',coil=group.getObjectByName(name);assert(coil);assert.equal(coil.userData.rowIndex,i);if(i)assert.notEqual(coil.material.color.getHex(),group.getObjectByName('coil').material.color.getHex());if(mode==='section')assert.equal(group.getObjectByName(name+'-section').userData.loops,p.rows[i].turns*4);}
      disposeModel(group);
    }
  }
  const colliding=exampleParameters(3);colliding.rows[1].coilDiameter=colliding.rows[0].coilDiameter+30;assert.match(validate(colliding),/огибающие/);
  const fractional=exampleParameters(3);fractional.rows[1].turns=3.5;assert.match(validate(fractional),/Ряд 2/);
  const tooTall=exampleParameters(3);tooTall.rows[2].pitch=150;assert.match(validate(tooTall),/Ряд 3/);
  assert(validate({...DEFAULTS,rows:[]}));assert(validate({...DEFAULTS,rows:Array(9).fill({coilDiameter:400,turns:12,pitch:90})}));
  const p=exampleParameters(3),cache=new GeometryCache();cache.begin();const a=buildModel(p,'whole',cache),b=buildModel(p,'cutaway',cache);cache.sweep();
  assert.equal(a.getObjectByName('coil').geometry,b.getObjectByName('coil').geometry,'Views share whole coil geometry');
  const original=a.getObjectByName('coil').geometry;let originalDisposed=false;original.addEventListener('dispose',()=>originalDisposed=true);
  const initialBuilds=cache.builds;cache.begin();const c=buildModel(p,'whole',cache),d=buildModel(p,'section',cache);assert.equal(cache.builds-initialBuilds,4,'Only core and 3 coil sections are new');
  disposeModel(a);disposeModel(b);cache.sweep();assert.equal(originalDisposed,false,'Disposing a view must not invalidate shared cached geometry');
  cache.begin();const beforeEdit=cache.builds,q={...p,rows:p.rows.map((row,i)=>i===1?{...row,turns:10}:{...row})},e=buildModel(q,'whole',cache),f=buildModel(q,'section',cache);assert.equal(cache.builds-beforeEdit,2,'Only the edited coil and its section are rebuilt');assert.equal(e.getObjectByName('coil').geometry,original);
  disposeModel(c);disposeModel(d);cache.sweep();assert.equal(cache.records.size,10,'Obsolete row geometry must be released');
  disposeModel(e);disposeModel(f);cache.dispose();assert.equal(cache.records.size,0);assert.equal(originalDisposed,true);
  assert.equal(rowsOf(DEFAULTS)[0].count,1,'Old parameters keep one start');
  assert.equal(startSeparation({...DEFAULTS,count:1}),null);
  const overlappingStarts=exampleParameters(3);overlappingStarts.rows[1].count=3;assert.match(validate(overlappingStarts),/внутри ряда/);
  for(const bad of [0,9,2.5,NaN]){const p=exampleParameters(1);p.rows[0].count=bad;assert(validate(p));}
  for(let count=2;count<=8;count++){
    const p=exampleParameters(1,count),row=p.rows[0],m=measurements(p);assert.equal(validate(p),'');assert.equal(m.coilCount,count);assert.equal(m.coilHeight,row.turns*row.pitch);assert(Math.abs(m.coilLength-count*row.turns*Math.hypot(Math.PI*row.coilDiameter,row.pitch))<1e-8);
    const phase=2*Math.PI/count,base=new HelixCurve({...p,...row}).getPoint(0),shifted=new HelixCurve({...p,...row},phase).getPoint(0);
    assert(Math.abs(base.y-shifted.y)<1e-10);assert(Math.abs(Math.hypot(base.x-shifted.x,base.z-shifted.z)-row.coilDiameter*Math.sin(phase/2))<1e-8);
    const distance=startSeparation(row),radius=row.coilDiameter/2,b=row.pitch/(2*Math.PI);let sampled=Infinity;
    for(let i=0;i<=10000;i++){const v=-2*Math.PI+4*Math.PI*i/10000;sampled=Math.min(sampled,Math.hypot(2*radius*Math.sin((v-phase)/2),b*v));}
    assert(distance<=sampled+1e-8&&sampled-distance<.01,'Numerical helix separation should match dense independent sampling');
    const cache=new GeometryCache();
    for(const mode of ['whole','cutaway','section']){
      cache.begin();let group;try{group=buildModel(p,mode,cache);}catch(error){throw Error(count+' starts, '+mode+': '+error.message,{cause:error});}
      assert.equal(group.children.length,mode==='whole'?count+2:mode==='cutaway'?count+3:2*(count+2));
      for(let j=0;j<count;j++){const name=j?'coil-start-'+(j+1):'coil',mesh=group.getObjectByName(name);assert(mesh);assert.equal(mesh.userData.startIndex,j);assert(Math.abs(mesh.userData.phase-2*Math.PI*j/count)<1e-10);if(mode==='section'){assert.equal(mesh.rotation.y,0);assert(group.getObjectByName(name+'-section').userData.triangles>0);}else assert(Math.abs(mesh.rotation.y+2*Math.PI*j/count)<1e-10);}
      if(mode!=='section')assert.equal(group.getObjectByName('coil').geometry,group.getObjectByName('coil-start-2').geometry,'Starts share base geometry, not duplicate vertices');
      disposeModel(group);cache.sweep();
    }
    cache.dispose();
  }
  const multi=exampleParameters(3,3);assert.equal(measurements(multi).coilCount,9);multi.rows[1].count=2;assert.equal(measurements(multi).coilCount,8);
  const max=exampleParameters(8,8),maxCache=new GeometryCache();assert.equal(validate(max),'');maxCache.begin();const maxModel=buildModel(max,'section',maxCache);assert.equal(measurements(max).coilCount,64);assert.equal(maxModel.children.length,132);disposeModel(maxModel);maxCache.dispose();
  console.log('3D example passed: 1–8 rows × 1–8 starts; phased multi-start geometry and hollow capped sections (including 64 coils); coil totals and lengths; numerical intra-row separation; shared geometry cache and disposal; legacy single coil.');
})().catch(error=>{console.error(error);process.exitCode=1});
