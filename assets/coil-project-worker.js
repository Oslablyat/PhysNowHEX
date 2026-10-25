import createCoolProp from './vendor/coolprop/coolprop.js';
import './coil-thermal-method.js';
import './coil-project-method.js?v=balance-errors-20261025';
const library=createCoolProp({print:()=>{},printErr:()=>{}});let latest=0;
self.onmessage=async({data})=>{
 latest=data.id;const cancelled=()=>latest!==data.id;
 if(data.cancel)return;
 let stage='runtime';
 try{
  const cp=await library;if(cancelled())return;stage='balance';
  const cache=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(cache.has(key))return cache.get(key);const value=cp.PropsSI(...args);if(cache.size<100000)cache.set(key,value);return value};
  const balance=self.CoilProjectMethod.balance(data.state,props);stage='inputs';self.CoilProjectMethod.source(data.state,balance);
  self.postMessage({id:data.id,phase:'balance',balance});
  stage='design';const variants=await self.CoilProjectMethod.select(data.state,balance,props,{cancelled,yield:()=>new Promise(resolve=>setTimeout(resolve,0)),progress:stats=>{if(!cancelled())self.postMessage({id:data.id,phase:'progress',stats})}});
  if(cancelled()||!variants)return;
  // Keep full verification for enabled winners, not thousands of duplicate
  // coil arrays in a postMessage or per-sheet snapshot.
  variants.candidates=variants.candidates.map(({thermal,thermalSource,...c})=>({...c,verified:thermal.valid,duty:thermal.heat_duty_kw,ua:thermal.ua_w_k}));
  self.postMessage({id:data.id,phase:'variants',variants,version:cp.get_global_param_string('version')});
 }catch(error){if(!cancelled())self.postMessage({id:data.id,error:error.message||'Ошибка проектировочного расчёта Teplo',issue:{stage,code:error.code||'calculation-failed',fields:error.fields||[],hint:error.hint||''}})}
};
