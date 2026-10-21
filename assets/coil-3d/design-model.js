import * as THREE from '../vendor/three-0.186.1/three.module.min.js';
import {GeometryCache,hollowCylinder,coilGeometry,sectionGeometry,disposeModel} from './model.js';
export {GeometryCache,disposeModel};

// Same row palette as coilRowColor() in the main editor and its top view.
const COLORS=[0x72bddc,0xe5ad71,0x76c6a6,0xaa9ae5,0xda95b7,0xb9ca71,0x79b4ed,0xc99a76];

// Receives calculateCoilGeometry's validated result, not the standalone demo's
// narrower input limits. The renderer never rewrites sheet data or geometry.
export function designParameters(g){
  if(!g||!Array.isArray(g.rows)||!g.rows.length||g.rows.length>8)throw Error('Не задана геометрия аппарата.');
  for(const key of ['diameter','height','shellWall','tubeDiameter','tubeWall'])if(!Number.isFinite(g[key])||g[key]<=0)throw Error('Проверьте размеры аппарата.');
  const rows=g.rows.map((r,i)=>{
    if(![r.diameter,r.turns,r.pitch,r.count,r.offset??0,r.phase??0].every(Number.isFinite)||r.count<1||r.count>64||!Number.isInteger(r.count)||r.turns<.5||r.turns>100)throw Error('Проверьте параметры ряда '+(i+1)+'.');
    return {coilDiameter:r.diameter,turns:r.turns,pitch:r.pitch,count:r.count,phase:(r.phase??0)*Math.PI/180,handedness:r.direction==='left'?-1:1,centerY:g.height/2-(r.offset??0)-g.tubeDiameter/2-r.turns*r.pitch/2,index:i};
  });
  const totalTurns=rows.reduce((sum,r)=>sum+r.count*r.turns,0),stepsPerTurn=Math.max(16,Math.min(96,Math.floor(650000/Math.max(1,totalTurns*64))));
  // Keep a safe visual budget; an explicit 2D fallback retains all valid data.
  if(totalTurns*stepsPerTurn*64>1800000)throw Error('Слишком много навивок для подробного 3D на этом устройстве. Показана схема без изменения геометрии.');
  return {shellDiameter:g.diameter,height:g.height,shellWall:g.shellWall,coreDiameter:g.coreDiameter,coreWall:g.coreWall,coreLength:g.coreLength,tubeDiameter:g.tubeDiameter,tubeWall:g.tubeWall,rows,stepsPerTurn,totalCount:rows.reduce((sum,r)=>sum+r.count,0)};
}

export function closedCoreGeometry(diameter,wall,height){
  const outer=new THREE.CylinderGeometry(diameter/2,diameter/2,height,128,1,false).toNonIndexed();
  const cavityHeight=height-2*wall,inside=diameter/2-wall;
  if(cavityHeight<=0||inside<=0)return outer;
  const inner=new THREE.CylinderGeometry(inside,inside,cavityHeight,128,1,false).toNonIndexed();
  const positions=[],normals=[];
  for(const [geometry,inverted] of [[outer,false],[inner,true]]){
    const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal');
    for(let i=0;i<p.count;i+=3)for(const offset of inverted?[0,2,1]:[0,1,2]){const j=i+offset;positions.push(p.getX(j),p.getY(j),p.getZ(j));normals.push(n.getX(j)*(inverted?-1:1),n.getY(j)*(inverted?-1:1),n.getZ(j)*(inverted?-1:1));}
  }
  outer.dispose();inner.dispose();const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));result.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));return result;
}

export function buildDesignModel(g,mode='section',cache=new GeometryCache(),selectedRow=0){
  const p=designParameters(g),group=new THREE.Group(),materials=new Map();
  const material=(key,color,selected=true)=>{
    if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,metalness:key==='cut'?.1:.35,roughness:key==='cut'?.65:.42,side:key==='cut'?THREE.DoubleSide:THREE.FrontSide}));
    const result=materials.get(key);if(key.startsWith('row')){result.emissive.setHex(selected?color:0x000000);result.emissiveIntensity=selected?.1:0;}return result;
  };
  const parts=[{name:'shell',key:['shell',p.shellDiameter,p.shellWall,p.height].join('|'),color:0x8f9caa,create:()=>hollowCylinder(p.shellDiameter,p.shellWall,p.height),y:0}];
  if(p.coreDiameter>0)parts.push({name:'core',key:['closed-core',p.coreDiameter,p.coreWall,p.coreLength].join('|'),color:0x71a89e,create:()=>closedCoreGeometry(p.coreDiameter,p.coreWall,p.coreLength),y:p.height/2-p.coreLength/2});
  for(const row of p.rows){
    const settings={...p,...row,startAngle:0,verticalDirection:-1,geometrySteps:Math.max(16,Math.ceil(row.turns*p.stepsPerTurn)),crossSegments:16};
    const key=['design-coil',p.tubeDiameter,p.tubeWall,row.coilDiameter,row.turns,row.pitch,row.handedness,settings.geometrySteps].join('|');
    for(let j=0;j<row.count;j++)parts.push({name:'row-'+row.index+'-coil-'+j,key,color:COLORS[row.index],rowIndex:row.index,startIndex:j,phase:row.phase+2*Math.PI*j/row.count,y:row.centerY,create:()=>coilGeometry(settings)});
  }
  try{
    for(const part of parts){
      const geometry=cache.get(part.key,()=>({geometry:part.create()})).geometry,phase=part.phase??0;
      const bodyMaterial=material(part.rowIndex==null?part.name:'row'+part.rowIndex,part.color,part.rowIndex===selectedRow);
      if(mode==='section'||part.name==='shell'){
        const section=cache.get('cut|'+part.key+'|'+phase,()=>{if(!phase)return sectionGeometry(geometry);const rotated=geometry.clone().rotateY(-phase);try{return sectionGeometry(rotated);}finally{rotated.dispose();}});
        const body=new THREE.Mesh(section.body,bodyMaterial),cap=new THREE.Mesh(section.caps,material('cut',0xe8b36d));body.name=part.name;cap.name=part.name+'-section';body.position.y=cap.position.y=part.y;body.userData={rowIndex:part.rowIndex,startIndex:part.startIndex,phase};group.add(body,cap);
      }else{const mesh=new THREE.Mesh(geometry,bodyMaterial);mesh.name=part.name;mesh.rotation.y=-phase;mesh.position.y=part.y;mesh.userData={rowIndex:part.rowIndex,startIndex:part.startIndex,phase};group.add(mesh);}
    }
    group.userData={height:p.height,diameter:p.shellDiameter,totalCount:p.totalCount,mode,selectedRow};return group;
  }catch(error){disposeModel(group);for(const m of materials.values())m.dispose();throw error;}
}
