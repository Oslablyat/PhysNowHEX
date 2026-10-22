import * as THREE from '../vendor/three-0.186.1/three.module.min.js';

export const DEFAULTS = Object.freeze({shellDiameter:600,height:1400,shellWall:8,coreDiameter:200,coreLength:1240,coreWall:6,coilDiameter:400,tubeDiameter:32,tubeWall:2,turns:12,pitch:90});
export const LIMITS = Object.freeze({shellDiameter:[200,1600],height:[400,4000],shellWall:[2,30],coreDiameter:[40,1400],coreLength:[100,3900],coreWall:[1,30],coilDiameter:[100,1500],tubeDiameter:[10,100],tubeWall:[1,15],turns:[1,24],pitch:[15,250],count:[1,8]});
export const ROW_COLORS=Object.freeze([0x72a7f3,0xc398ed,0x69c7ba,0xf0b76c,0xed91ac,0x9ebd71,0x7bc7e7,0xd2b9f2]);
export const DEFAULT_ROWS=Object.freeze([280,400,520].map(coilDiameter=>Object.freeze({coilDiameter,turns:12,pitch:90,count:1})));
const ROW_KEYS=new Set(['coilDiameter','turns','pitch','count']);

export function rowsOf(p){const rows=Array.isArray(p.rows)?p.rows:[{coilDiameter:p.coilDiameter,turns:p.turns,pitch:p.pitch,count:p.count}];return rows.map(row=>({...row,count:row?.count===undefined?1:row.count}));}

export function exampleParameters(count=3,starts=1){
  if(!Number.isInteger(count)||count<1||count>8)throw Error('Выберите от 1 до 8 рядов.');
  if(!Number.isInteger(starts)||starts<1||starts>8)throw Error('Выберите от 1 до 8 змеевиков в ряду.');
  const p={...DEFAULTS};
  if(count>4){p.shellDiameter=1000;p.coreDiameter=180;p.tubeDiameter=20;}
  if(starts>=6)p.tubeDiameter=20;
  const pitch=starts===1?90:Math.ceil(p.tubeDiameter*starts*1.35/5)*5,turns=Math.min(12,Math.floor((p.height-p.tubeDiameter-60)/pitch));
  if(count===1)return {...p,rows:[{coilDiameter:400,turns,pitch,count:starts}]};
  const first=count>4?240:280,last=count>4?880:520;
  return {...p,rows:Array.from({length:count},(_,i)=>({coilDiameter:first+(last-first)*i/(count-1),turns,pitch,count:starts}))};
}

// Minimum centreline distance between two neighbouring equal helices on one
// cylinder. Phase = 2π/n; minimize chord² + axial displacement². This numerical
// ideal-helix check is not a manufacturing tolerance or general mesh collision test.
export function startSeparation(row){
  const count=row.count===undefined?1:row.count;if(count===1)return null;
  const radius=row.coilDiameter/2,b=row.pitch/(2*Math.PI),phase=2*Math.PI/count;
  const distanceSquared=v=>(2*radius*Math.sin((v-phase)/2))**2+(b*v)**2;
  const ratio=(Math.sqrt(5)-1)/2;let low=0,high=phase,c=high-ratio*(high-low),d=low+ratio*(high-low),fc=distanceSquared(c),fd=distanceSquared(d);
  for(let i=0;i<64;i++){if(fc<fd){high=d;d=c;fd=fc;c=high-ratio*(high-low);fc=distanceSquared(c);}else{low=c;c=d;fc=fd;d=low+ratio*(high-low);fd=distanceSquared(d);}}
  return Math.sqrt(Math.min(fc,fd,distanceSquared(0),distanceSquared(phase)));
}

export function validate(p) {
  for (const [key,[min,max]] of Object.entries(LIMITS)) {
    if(ROW_KEYS.has(key))continue;
    if (!Number.isFinite(p[key])) return 'Заполните все размеры числовыми значениями.';
    if (p[key]<min || p[key]>max) return 'Один из размеров выходит за диапазон поля ('+min+'…'+max+').';
  }
  if (p.shellWall*2>=p.shellDiameter || p.coreWall*2>=p.coreDiameter || p.tubeWall*2>=p.tubeDiameter) return 'Толщина стенки должна быть меньше половины наружного диаметра.';
  if (p.coreLength>=p.height) return 'Длина вытеснительной трубы должна быть меньше высоты корпуса.';
  const rows=rowsOf(p);
  if(rows.length<1||rows.length>8)return 'Выберите от 1 до 8 рядов.';
  for(const [i,row] of rows.entries()){
    const prefix='Ряд '+(i+1)+': ';
    if(!row)return prefix+'заполните параметры навивки.';
    for(const key of ROW_KEYS){const [min,max]=LIMITS[key];if(!Number.isFinite(row[key])||row[key]<min||row[key]>max)return prefix+'проверьте диаметр, число змеевиков, витки и шаг — значение выходит за допустимый диапазон.';}
    if (!Number.isInteger(row.turns)) return prefix+'задайте целое число витков от 1 до 24.';
    if (!Number.isInteger(row.count)) return prefix+'задайте целое число змеевиков от 1 до 8.';
    if (row.coilDiameter-p.tubeDiameter<=p.coreDiameter) return prefix+'змеевик пересекает вытеснительную трубу. Увеличьте диаметр навивки.';
    if (row.coilDiameter+p.tubeDiameter>=p.shellDiameter-2*p.shellWall) return prefix+'змеевик не помещается в корпусе. Увеличьте корпус или уменьшите диаметр навивки.';
    if (row.turns*row.pitch+p.tubeDiameter>=p.height) return prefix+'навивка не помещается по высоте. Уменьшите число витков или шаг.';
    // Conservative check: infinite neighbouring turns, slightly closer than axial pitch.
    let low=Math.PI,high=2*Math.PI;const radius=row.coilDiameter/2,b=row.pitch/(2*Math.PI);
    for(let j=0;j<50;j++){const mid=(low+high)/2;if(radius*radius*Math.sin(mid)+b*b*mid>0)high=mid;else low=mid;}
    const delta=(low+high)/2,turnGap=Math.hypot(2*radius*Math.sin(delta/2),b*delta);
    if (turnGap<=p.tubeDiameter) return prefix+'соседние витки пересекаются. Увеличьте шаг или уменьшите диаметр трубы.';
    if(row.count>1&&startSeparation(row)<=p.tubeDiameter)return prefix+'змеевики внутри ряда пересекаются. Увеличьте шаг одного змеевика или уменьшите их количество в ряду.';
  }
  const sorted=rows.map((row,i)=>({...row,index:i})).sort((a,b)=>a.coilDiameter-b.coilDiameter);
  for(let i=1;i<sorted.length;i++)if((sorted[i].coilDiameter-sorted[i-1].coilDiameter)/2<=p.tubeDiameter)return 'Ряды '+(sorted[i-1].index+1)+' и '+(sorted[i].index+1)+': радиальные огибающие труб пересекаются. Разнесите диаметры навивки.';
  return '';
}

export function measurements(p) {
  const rows=rowsOf(p),diameters=rows.map(r=>r.coilDiameter).sort((a,b)=>a-b);
  return {rowCount:rows.length,coilCount:rows.reduce((sum,r)=>sum+r.count,0),coilHeight:Math.max(...rows.map(r=>r.turns*r.pitch)),coilLength:rows.reduce((sum,r)=>sum+r.count*r.turns*Math.hypot(Math.PI*r.coilDiameter,r.pitch),0),shellGap:(p.shellDiameter-2*p.shellWall-diameters.at(-1)-p.tubeDiameter)/2,coreGap:(diameters[0]-p.tubeDiameter-p.coreDiameter)/2,rowGap:rows.length>1?Math.min(...diameters.slice(1).map((d,i)=>(d-diameters[i])/2-p.tubeDiameter)):null};
}

export class HelixCurve extends THREE.Curve {
  constructor(p,phase=0){super();this.p=p;this.phase=phase;}
  getPoint(t,target=new THREE.Vector3()){
    const a=(this.p.startAngle??Math.PI/4)+this.phase+(this.p.handedness??1)*2*Math.PI*this.p.turns*t;
    return target.set(this.p.coilDiameter/2*Math.cos(a),(this.p.verticalDirection??1)*this.p.turns*this.p.pitch*(t-.5),this.p.coilDiameter/2*Math.sin(a));
  }
  getTangent(t,target=new THREE.Vector3()){
    const a=(this.p.startAngle??Math.PI/4)+this.phase+(this.p.handedness??1)*2*Math.PI*this.p.turns*t,k=(this.p.handedness??1)*Math.PI*this.p.turns*this.p.coilDiameter;
    return target.set(-k*Math.sin(a),(this.p.verticalDirection??1)*this.p.turns*this.p.pitch,k*Math.cos(a)).normalize();
  }
}

// TubeGeometry supplies continuous radial/Frenet normals. Keep those normals
// when expanding triangles; do not weld end caps into the curved walls, since
// the flat annular rims must retain their sharp engineering edges.
export function smoothHollowSweep(path,steps,outside,inside,radialSegments){
  const outer=new THREE.TubeGeometry(path,steps,outside,radialSegments,false),inner=new THREE.TubeGeometry(path,steps,inside,radialSegments,false),positions=[],normals=[];
  for(const [surface,inverted] of [[outer,false],[inner,true]]){
    const p=surface.getAttribute('position'),n=surface.getAttribute('normal'),indices=surface.index;
    for(let i=0;i<indices.count;i+=3)for(const offset of inverted?[0,2,1]:[0,1,2]){const j=indices.getX(i+offset);positions.push(p.getX(j),p.getY(j),p.getZ(j));normals.push(n.getX(j)*(inverted?-1:1),n.getY(j)*(inverted?-1:1),n.getZ(j)*(inverted?-1:1));}
  }
  const op=outer.getAttribute('position'),ip=inner.getAttribute('position');
  function rimTriangle(a,b,c,normal){if(new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).dot(normal)<0)[b,c]=[c,b];for(const v of [a,b,c]){positions.push(v.x,v.y,v.z);normals.push(normal.x,normal.y,normal.z);}}
  for(const end of [0,1]){
    const base=end*steps*(radialSegments+1),normal=path.getTangent(end).normalize().multiplyScalar(end?1:-1);
    for(let j=0;j<radialSegments;j++){
      const a=new THREE.Vector3().fromBufferAttribute(op,base+j),b=new THREE.Vector3().fromBufferAttribute(op,base+j+1),c=new THREE.Vector3().fromBufferAttribute(ip,base+j),d=new THREE.Vector3().fromBufferAttribute(ip,base+j+1);
      rimTriangle(a,b,c,normal);rimTriangle(b,d,c,normal);
    }
  }
  outer.dispose();inner.dispose();const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));geometry.userData.smoothWalls=true;geometry.userData.radialSegments=radialSegments;return geometry;
}

export function hollowCylinder(diameter,wall,height){
  return smoothHollowSweep(new THREE.LineCurve3(new THREE.Vector3(0,-height/2,0),new THREE.Vector3(0,height/2,0)),1,diameter/2,diameter/2-wall,128);
}

export function coilGeometry(p){
  return smoothHollowSweep(new HelixCurve(p),p.geometrySteps??Math.max(96,p.turns*96),p.tubeDiameter/2,p.tubeDiameter/2-p.tubeWall,Math.max(24,(p.crossSegments??16)*2));
}

// Clip the actual triangle geometry to z <= 0. Boundary loops are triangulated
// with their nested holes, so a cut through a hollow tube stays hollow.
// This is visual mesh processing, not a CAD Boolean or an exact B-Rep operation.
export function sectionGeometry(source){
  const positions=source.getAttribute('position'),normals=source.getAttribute('normal'),index=source.index;
  const bodyPositions=[],bodyNormals=[],edges=new Map(),epsilon=1e-3;
  const key=v=>Math.round(v.x/epsilon)+','+Math.round(v.y/epsilon);
  const pointAt=i=>{const p=new THREE.Vector3().fromBufferAttribute(positions,i);if(Math.abs(p.z)<=epsilon)p.z=0;return {p,n:new THREE.Vector3().fromBufferAttribute(normals,i)};};
  function intersect(a,b){const t=a.p.z/(a.p.z-b.p.z);return {p:a.p.clone().lerp(b.p,t).setZ(0),n:a.n.clone().lerp(b.n,t).normalize()};}
  function append(a,b,c){for(const v of [a,b,c]){bodyPositions.push(v.p.x,v.p.y,v.p.z);bodyNormals.push(v.n.x,v.n.y,v.n.z);}}
  for(let i=0,count=index?index.count:positions.count;i<count;i+=3){
    const triangle=[0,1,2].map(offset=>pointAt(index?index.getX(i+offset):i+offset)),polygon=[];
    for(let j=0;j<3;j++){
      const a=triangle[j],b=triangle[(j+1)%3],aInside=a.p.z<=epsilon,bInside=b.p.z<=epsilon;
      if(aInside)polygon.push(a);
      if(aInside!==bInside)polygon.push(intersect(a,b));
    }
    for(let j=1;j+1<polygon.length;j++)append(polygon[0],polygon[j],polygon[j+1]);
    if(triangle.some(v=>v.p.z>epsilon)){
      const boundary=polygon.filter(v=>Math.abs(v.p.z)<=epsilon),unique=[...new Map(boundary.map(v=>[key(v.p),v.p])).values()];
      if(unique.length===2){const a=key(unique[0]),b=key(unique[1]);if(a!==b){const id=[a,b].sort().join('|');edges.set(id,{a,b,p:unique[0],q:unique[1]});}}
    }
  }
  const graph=new Map();
  for(const [id,e] of edges){for(const [a,b,p] of [[e.a,e.b,e.p],[e.b,e.a,e.q]]){if(!graph.has(a))graph.set(a,{p,links:[]});graph.get(a).links.push({key:b,id});}}
  const used=new Set(),loops=[];
  for(const [id,e] of edges){
    if(used.has(id))continue;
    const start=e.a,loop=[],visited=new Set();let current=start,closed=false;
    while(!visited.has(current)){
      visited.add(current);const node=graph.get(current);loop.push(new THREE.Vector2(node.p.x,node.p.y));
      const next=node.links.find(link=>!used.has(link.id));if(!next)break;
      used.add(next.id);current=next.key;if(current===start){closed=true;break;}
    }
    if(!closed)throw Error('Не удалось замкнуть контур сечения. Измените размеры примера.');
    if(loop.length>=3 && Math.abs(THREE.ShapeUtils.area(loop))>epsilon)loops.push(loop);
  }
  function contains(loop,p){let inside=false;for(let i=0,j=loop.length-1;i<loop.length;j=i++){const a=loop[i],b=loop[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;}return inside;}
  const records=loops.map(loop=>({loop,area:Math.abs(THREE.ShapeUtils.area(loop)),parent:null,depth:0}));
  for(const record of records){const containers=records.filter(other=>other.area>record.area&&contains(other.loop,record.loop[0])).sort((a,b)=>a.area-b.area);record.parent=containers[0]||null;record.depth=containers.length;}
  const capPositions=[];
  for(const record of records.filter(r=>r.depth%2===0)){
    const outline=record.loop.map(p=>p.clone()),holes=records.filter(r=>r.parent===record&&r.depth%2===1).map(r=>r.loop.map(p=>p.clone()));
    const faces=THREE.ShapeUtils.triangulateShape(outline,holes),points=outline.concat(...holes);
    for(const face of faces){const a=points[face[0]],b=points[face[1]],c=points[face[2]],positive=(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)>0;
      for(const p of positive?[a,b,c]:[a,c,b])capPositions.push(p.x,p.y,0);
    }
  }
  const body=new THREE.BufferGeometry();body.setAttribute('position',new THREE.Float32BufferAttribute(bodyPositions,3));body.setAttribute('normal',new THREE.Float32BufferAttribute(bodyNormals,3));
  const caps=new THREE.BufferGeometry();caps.setAttribute('position',new THREE.Float32BufferAttribute(capPositions,3));caps.computeVertexNormals();
  return {body,caps,loops:records.length,capTriangles:capPositions.length/9};
}

// One cache per demo. Both views share unchanged source geometry; cut geometry
// is built once per part. sweep() removes obsolete geometries after an update.
export class GeometryCache{
  constructor(){this.records=new Map();this.used=new Set();this.builds=0;}
  begin(){this.used.clear();}
  get(key,create){this.used.add(key);if(!this.records.has(key)){const record=create();for(const value of Object.values(record))if(value?.isBufferGeometry)value.userData.cacheOwned=true;this.records.set(key,record);this.builds++;}return this.records.get(key);}
  sweep(){for(const [key,record] of this.records)if(!this.used.has(key)){for(const value of Object.values(record))if(value?.isBufferGeometry)value.dispose();this.records.delete(key);}}
  dispose(){this.used.clear();this.sweep();}
}

export function buildModel(p,mode='whole',cache=null){
  const error=validate(p);if(error)throw Error(error);
  const group=new THREE.Group(),materials={
    shell:new THREE.MeshStandardMaterial({color:0x8f9caa,metalness:.42,roughness:.45}),
    core:new THREE.MeshStandardMaterial({color:0x71a89e,metalness:.3,roughness:.4}),
    cut:new THREE.MeshStandardMaterial({color:0xe8b36d,metalness:.1,roughness:.65,side:THREE.DoubleSide})
  };
  try{
    const parts=[
      {name:'shell',key:['shell',p.shellDiameter,p.shellWall,p.height].join('|'),create:()=>hollowCylinder(p.shellDiameter,p.shellWall,p.height)},
      {name:'core',key:['core',p.coreDiameter,p.coreWall,p.coreLength].join('|'),create:()=>hollowCylinder(p.coreDiameter,p.coreWall,p.coreLength)},
      ...rowsOf(p).flatMap((row,i)=>Array.from({length:row.count},(_,j)=>{const baseName=i?'coil-'+(i+1):'coil',name=j?baseName+'-start-'+(j+1):baseName;materials[name]=new THREE.MeshStandardMaterial({color:ROW_COLORS[i],metalness:.35,roughness:.32});if(row.count>1)materials[name].color.offsetHSL(0,0,(j/(row.count-1)-.5)*.08);return {name,rowIndex:i,startIndex:j,phase:2*Math.PI*j/row.count,key:['coil',p.tubeDiameter,p.tubeWall,row.coilDiameter,row.turns,row.pitch].join('|'),create:()=>coilGeometry({...p,...row})};}))
    ];
    for(const {name,key,create,rowIndex,startIndex,phase=0} of parts){
      const geometry=cache?cache.get(key,()=>({geometry:create()})).geometry:create();
      const clipped=mode==='section'||mode==='cutaway'&&name==='shell';
      if(clipped){
        const createSection=()=>{if(!phase)return sectionGeometry(geometry);const rotated=geometry.clone().rotateY(-phase);try{return sectionGeometry(rotated);}finally{rotated.dispose();}};
        const section=cache?cache.get('section|'+key+(phase?'|phase|'+phase:''),createSection):createSection();if(!cache)geometry.dispose();
        const body=new THREE.Mesh(section.body,materials[name]),cap=new THREE.Mesh(section.caps,materials.cut);body.name=name;body.userData={rowIndex,startIndex,phase};cap.name=name+'-section';cap.userData={rowIndex,startIndex,phase,loops:section.loops,triangles:section.capTriangles};group.add(body,cap);
      }else{const mesh=new THREE.Mesh(geometry,materials[name]);mesh.name=name;mesh.userData={rowIndex,startIndex,phase};mesh.rotation.y=-phase;group.add(mesh);}
    }
    group.userData={mode,parameters:{...p}};
    return group;
  }catch(error){disposeModel(group);Object.values(materials).forEach(material=>material.dispose());throw error;}
}

export function disposeModel(group){
  const geometries=new Set(),materials=new Set();
  group.traverse(child=>{if(child.geometry)geometries.add(child.geometry);if(child.material)for(const m of Array.isArray(child.material)?child.material:[child.material])materials.add(m);});
  geometries.forEach(g=>{if(!g.userData.cacheOwned)g.dispose();});materials.forEach(m=>m.dispose());
}
