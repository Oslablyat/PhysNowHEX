import * as THREE from '../vendor/three-0.186.1/three.module.min.js';

// Neutral CAD-style fill from both hemispheres. Closed lower end faces must
// remain readable when the user freely rotates underneath the apparatus.
// These lights do not cast shadows and do not modify any model geometry.
export function createModelLighting(){
  const group=new THREE.Group();group.name='model-lighting';
  group.add(new THREE.HemisphereLight(0xd7e5ff,0x30303a,2.4));
  for(const [name,color,intensity,position] of [
    ['key',0xffffff,3.1,[1200,2200,2500]],
    ['side-fill',0x7eabff,2,[-1700,300,1500]],
    ['rim',0xffd6a3,2,[600,1400,-2000]],
    ['lower-fill',0xe5edff,1.8,[-600,-1800,1200]]
  ]){const light=new THREE.DirectionalLight(color,intensity);light.name=name;light.position.set(...position);group.add(light);}
  return group;
}
