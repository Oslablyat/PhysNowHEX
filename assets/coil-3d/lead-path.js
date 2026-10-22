import * as THREE from '../vendor/three-0.186.1/three.module.min.js';
import {HelixCurve} from './model.js?v=rows-sidebar-20261022';

// One open centreline. Bends stay on the helix cylinder and have constant
// centreline curvature 1 / bendRadius. They are spatial bends, not planar elbows.
export class LeadedCoilCurve extends THREE.Curve {
  constructor(p){
    super();
    this.helix=new HelixCurve({...p,startAngle:0,verticalDirection:-1});
    this.radius=p.bendRadius;
    const bend=(t,sign)=>{
      const point=this.helix.getPoint(t),out=this.helix.getTangent(t).multiplyScalar(sign===1?-1:1);
      const cylinderRadius=p.coilDiameter/2,phi0=Math.atan2(point.z,point.x),direction=Math.sign(-Math.sin(phi0)*out.x+Math.cos(phi0)*out.z);
      const beta=Math.asin(THREE.MathUtils.clamp(out.y*sign,-1,1)),angle=Math.PI/2-beta;
      // On a cylinder: curvature² = (dθ/ds)² + cos(θ)^4 / R².
      // Integrating this equation keeps both the requested bend radius and R.
      const rate=a=>{const c=Math.cos(a),ds=1/Math.sqrt(1/this.radius**2-c**4/cylinderRadius**2);return [c/cylinderRadius*ds,Math.sin(a)*ds,ds];};
      const integral=(a,b)=>{const x=rate(a),m=rate((a+b)/2),y=rate(b);return x.map((v,i)=>(b-a)/6*(v+4*m[i]+y[i]));};
      const samples=256,table=[[0,0,0]];
      for(let i=0;i<samples;i++){const add=integral(beta+angle*i/samples,beta+angle*(i+1)/samples);table.push(table[i].map((v,j)=>v+add[j]));}
      const sample=u=>{const q=THREE.MathUtils.clamp(u,0,1)*samples,i=Math.min(samples-1,Math.floor(q)),add=integral(beta+angle*i/samples,beta+angle*q/samples);return table[i].map((v,j)=>v+add[j]);};
      const at=(u,target=new THREE.Vector3())=>{const [azimuth,height]=sample(u),phi=phi0+direction*azimuth;return target.set(cylinderRadius*Math.cos(phi),point.y+sign*height,cylinderRadius*Math.sin(phi));};
      const tangent=(u,target=new THREE.Vector3())=>{const phi=phi0+direction*sample(u)[0],a=beta+angle*u,c=direction*Math.cos(a);return target.set(-Math.sin(phi)*c,sign*Math.sin(a),Math.cos(phi)*c);};
      return {at,tangent,angle,point,end:at(1),length:table[samples][2]};
    };
    this.upper=bend(0,1);this.lower=bend(1,-1);
    const straight=p.leadStraightLength;
    this.top=this.upper.end.clone();this.top.y+=straight;
    this.bottom=this.lower.end.clone();this.bottom.y-=straight;
    const down=new THREE.Vector3(0,-1,0),line=(a,b)=>({point:(u,target)=>target.lerpVectors(a,b,u),tangent:(_u,target)=>target.copy(down),steps:1,length:a.distanceTo(b)});
    const arcSteps=b=>Math.max(16,Math.ceil(b.angle/(2*Math.PI)*p.stepsPerTurn));
    this.segments=[...(straight>0?[line(this.top,this.upper.end)]:[]),
      {point:(u,target)=>this.upper.at(1-u,target),tangent:(u,target)=>this.upper.tangent(1-u,target).negate(),steps:arcSteps(this.upper),length:this.upper.length},
      {point:(u,target)=>this.helix.getPoint(u,target),tangent:(u,target)=>this.helix.getTangent(u,target),steps:Math.max(16,Math.ceil(p.turns*p.stepsPerTurn)),length:p.turns*Math.hypot(Math.PI*p.coilDiameter,p.pitch)},
      {point:(u,target)=>this.lower.at(u,target),tangent:(u,target)=>this.lower.tangent(u,target),steps:arcSteps(this.lower),length:this.lower.length},...(straight>0?[line(this.lower.end,this.bottom)]:[])];
    this.steps=this.segments.reduce((n,s)=>n+s.steps,0);
  }
  segment(t){let step=THREE.MathUtils.clamp(t,0,1)*this.steps;for(const s of this.segments){if(step<=s.steps)return [s,step/s.steps];step-=s.steps;}return [this.segments.at(-1),1];}
  getPoint(t,target=new THREE.Vector3()){const [s,u]=this.segment(t);return s.point(u,target);}
  getTangent(t,target=new THREE.Vector3()){const [s,u]=this.segment(t);return s.tangent(u,target);}
  // TubeGeometry samples by these step weights. Every tangent join gets an
  // exact ring; long straight leads do not steal detail from bends or turns.
  getPointAt(t,target){return this.getPoint(t,target);}
  getTangentAt(t,target){return this.getTangent(t,target);}
  getLength(){return this.segments.reduce((n,s)=>n+s.length,0);}
}

export function leadPath(p,row){
  const bendRadius=p.leadBendRadius,maximum=row.coilDiameter/2*(1+(row.pitch/(Math.PI*row.coilDiameter))**2);
  if(!Number.isFinite(bendRadius)||bendRadius<=p.tubeDiameter/2)throw Error('Радиус отвода по оси должен быть больше половины наружного диаметра трубы.');
  if(bendRadius>=maximum*(1-1e-6))throw Error('Ряд '+(row.index+1)+': радиус отвода слишком велик для перехода на цилиндре навивки.');
  if(!Number.isFinite(p.leadStraightLength)||p.leadStraightLength<0)throw Error('Длина прямого участка должна быть неотрицательной.');
  return new LeadedCoilCurve({...p,...row,bendRadius});
}
