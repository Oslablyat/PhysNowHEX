import createCoolProp from './vendor/coolprop/coolprop.js';
import './coil-thermal-method.js';
import './coil-manufacturing.js?v=re-stock-20261029';
import './coil-project-method.js?v=sequential-lab-20261106';
import './coil-sequential-method.js?v=gaps-v6';
import './coil-sequential-format.js?v=gaps-v6';
const library=createCoolProp({print(){},printErr(){}});
self.onmessage=async({data})=>{
 try{
  const cp=await library,memo=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(!memo.has(key))memo.set(key,cp.PropsSI(...args));return memo.get(key)},p=self.CoilProjectMethod,q=self.CoilSequentialMethod,target=p.balance(data.state,props);
  self.postMessage({id:data.id,phase:'balance',target});
  const output={};
  for(const [side,engine]of [['before',p],['after',q]]){
   memo.clear();const start=performance.now();self.postMessage({id:data.id,phase:'start',side});
   const result=await engine.select(data.state,target,props,{yield:()=>new Promise(resolve=>setTimeout(resolve,0)),progress:stats=>self.postMessage({id:data.id,phase:'progress',side,stats})});
   output[side]=self.CoilSequentialFormat.pack(result,performance.now()-start);
   self.postMessage({id:data.id,phase:'result',side,result:output[side]});
  }
  self.postMessage({id:data.id,phase:'done',target,...output});
 }catch(error){self.postMessage({id:data.id,phase:'error',error:error.message})}
};
