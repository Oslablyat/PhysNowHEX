const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
(async()=>{
 const {createModelLighting}=await import(pathToFileURL(path.resolve(__dirname,'../assets/coil-3d/lighting.js'))),group=createModelLighting(),fill=group.getObjectByName('lower-fill');
 assert(fill?.isDirectionalLight);assert(fill.position.y<0);assert(fill.intensity>=1.5);assert.equal(fill.castShadow,false);
 assert.equal(group.children.filter(light=>light.isDirectionalLight).length,4);assert.equal(group.children.filter(light=>light.isHemisphereLight).length,1);
 const bottomIrradiance=group.children.filter(light=>light.isDirectionalLight).reduce((sum,light)=>sum+Math.max(0,-light.position.y/light.position.length())*light.intensity,0);
 assert(bottomIrradiance>1.3,'Downward-facing end caps need nonzero directional fill');
 assert(group.children.every(light=>light.isLight&&!light.castShadow));assert(!group.children.some(part=>part.isMesh),'Lighting must not add a floor/shadow disc or change model geometry');
 console.log('3D lighting passed: lower-facing end caps lit by neutral fill; upper lights retained; no shadow casting or additional geometry.');
})().catch(error=>{console.error(error);process.exitCode=1});
