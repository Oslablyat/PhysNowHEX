/* Centreline lengths in mm. The bend integral is shared with the 3D sweep. */
(function(root,factory){const api=factory();root.CoilManufacturing=api;if(typeof module==='object'&&module.exports)module.exports=api})(globalThis,function(){
 'use strict';
 function bendTable(cylinderRadius,bendRadius,beta,samples=256){
  const angle=Math.PI/2-beta;
  const rate=a=>{const c=Math.cos(a),ds=1/Math.sqrt(1/bendRadius**2-c**4/cylinderRadius**2);return [c/cylinderRadius*ds,Math.sin(a)*ds,ds]};
  const integral=(a,b)=>{const x=rate(a),m=rate((a+b)/2),y=rate(b);return x.map((v,i)=>(b-a)/6*(v+4*m[i]+y[i]))};
  const table=[[0,0,0]];
  for(let i=0;i<samples;i++){const add=integral(beta+angle*i/samples,beta+angle*(i+1)/samples);table.push(table[i].map((v,j)=>v+add[j]))}
  const sample=u=>{const q=Math.max(0,Math.min(1,u))*samples,i=Math.min(samples-1,Math.floor(q)),add=integral(beta+angle*i/samples,beta+angle*q/samples);return table[i].map((v,j)=>v+add[j])};
  return {angle,sample,length:table[samples][2],height:table[samples][1]};
 }
 function measure(row,bendRadius,straight,samples=256){
  const radius=row.diameter/2,beta=Math.atan(row.pitch/(Math.PI*row.diameter));
  if(bendRadius>=radius*(1+(row.pitch/(Math.PI*row.diameter))**2)*(1-1e-6))throw Error('Отвод не помещается на цилиндре навивки');
  const bend=bendTable(radius,bendRadius,beta,samples),winding=row.turns*Math.hypot(Math.PI*row.diameter,row.pitch);
  return {windingMM:winding,bendsMM:2*bend.length,straightMM:2*straight,totalMM:winding+2*bend.length+2*straight,axialEnvelopeMM:row.turns*row.pitch+2*(bend.height+straight)};
 }
 function stockFor(lengthMM){return [1000,3000,6000].find(stock=>lengthMM>=stock*.8-1e-7&&lengthMM<stock-1e-7)??null}
 function lengthFast(row,bendRadius,straight){
  const r=row.diameter/2,beta=Math.atan(row.pitch/(Math.PI*row.diameter)),angle=Math.PI/2-beta,n=16;
  let sum=0;for(let i=0;i<=n;i++){const c=Math.cos(beta+angle*i/n);sum+=(i===0||i===n?1:i%2?4:2)/Math.sqrt(1/bendRadius**2-c**4/r**2)}
  return row.turns*Math.hypot(Math.PI*row.diameter,row.pitch)+2*angle*sum/(3*n)+2*straight;
 }
 return {bendTable,measure,stockFor,lengthFast};
});
