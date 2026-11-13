import createCoolProp from './vendor/coolprop/coolprop.js';
import './coil-thermal-method.js';
import './coil-manufacturing.js?v=re-stock-20261029';
import './coil-project-method.js?v=multi-tube-sizes-20261113';
import './coil-project-multicriteria.js?v=multi-tube-sizes-20261113';
const library=createCoolProp({print:()=>{},printErr:()=>{}});let latest=0,cachedId=null,acceptedDesigns=new Map();
self.onmessage=async({data})=>{
 if(data.selectCalculation){
  if(data.id!==latest||data.id!==cachedId)return;
  const design=self.CoilMulticriteria.materialize(acceptedDesigns.get(data.calculationId));
  self.postMessage(design?{id:data.id,phase:'selected',selectionRequest:data.selectionRequest,design}:{id:data.id,phase:'selection-error',selectionRequest:data.selectionRequest,message:'Эта конструкция недоступна в текущем расчёте.'});return;
 }
 latest=data.id;const cancelled=()=>latest!==data.id;
 acceptedDesigns.clear();cachedId=null;
 if(data.cancel)return;
 let stage='runtime';
 try{
  const cp=await library;if(cancelled())return;stage='balance';
  const cache=new Map(),props=(...args)=>{const key=JSON.stringify(args);if(cache.has(key))return cache.get(key);const value=cp.PropsSI(...args);if(cache.size>=150000)cache.clear();cache.set(key,value);return value};
  const state={...data.state,'design-objective':'pareto'};
  const balance=self.CoilProjectMethod.balance(state,props);stage='inputs';self.CoilProjectMethod.source(state,balance);
  self.postMessage({id:data.id,phase:'balance',balance});
  stage='design';let lastProgress=0;
  const variants=await self.CoilMulticriteria.select(state,balance,props,{cancelled,yield:()=>new Promise(resolve=>setTimeout(resolve,0)),progress:stats=>{if(!cancelled()&&Date.now()-lastProgress>=500){lastProgress=Date.now();self.postMessage({id:data.id,phase:'progress',stats})}}});
  if(cancelled()||!variants)return;
  acceptedDesigns=new Map((variants.acceptedDesigns??[]).map(c=>[c.calculationId,c]));cachedId=data.id;delete variants.acceptedDesigns;
  // Keep full verification for enabled winners, not thousands of duplicate
  // coil arrays in a postMessage or per-sheet snapshot.
  variants.candidates=variants.candidates.map(({thermal,thermalSource,...c})=>({...c,verified:thermal.valid,duty:thermal.heat_duty_kw,ua:thermal.ua_w_k}));
  self.postMessage({id:data.id,phase:'variants',variants,version:cp.get_global_param_string('version')});
 }catch(error){if(!cancelled())self.postMessage({id:data.id,error:error.message||'Ошибка проектировочного расчёта Teplo',issue:{stage,code:error.code||'calculation-failed',fields:error.fields||[],hint:error.hint||''}})}
};
