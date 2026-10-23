import createCoolProp from './vendor/coolprop/coolprop.js';
import './coil-thermal-method.js';
const library=createCoolProp({print:()=>{},printErr:()=>{}});
self.onmessage=async({data})=>{
 try{const cp=await library;const result=self.CoilThermalMethod.calculate(data.inputs,(...args)=>cp.PropsSI(...args));self.postMessage({id:data.id,result,version:cp.get_global_param_string('version')})}
 catch(error){self.postMessage({id:data.id,error:error.message||'Ошибка теплового расчёта'})}
};
