const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const chart=require('../assets/coil-temperature-chart.js'),method=require('../assets/coil-thermal-method.js');
const close=(a,b,tolerance=1e-7)=>assert(Math.abs(a-b)<=tolerance*Math.max(1,Math.abs(b)),`${a} differs from ${b}`);
function sample(ua,ch,cc){const hotIn=105,coldIn=30,q=ch*(hotIn-coldIn)*method.counterflowFraction(ua,ch,cc);return {inputs:{t_hot_in_c:hotIn,t_cold_in_c:coldIn},result:{area_m2:3,ua_w_k:ua,c_hot_w_k:ch,c_cold_w_k:cc,t_hot_out_c:hotIn-q/ch,t_cold_out_c:coldIn+q/cc}}}
for(const [ua,ch,cc] of [[0,200,200],[100,200,200],[1200,200,400],[1200,400,200],[600,200,200.00000001],[1e6,200,201],[1e6,201,200]]){
 const {inputs,result}=sample(ua,ch,cc),before=JSON.stringify({inputs,result}),p=chart.profile(inputs,result);assert(p);
 close(p.at(0).hot,inputs.t_hot_in_c);close(p.at(0).cold,result.t_cold_out_c);close(p.at(1).hot,result.t_hot_out_c);close(p.at(1).cold,inputs.t_cold_in_c);
 for(const [i,point] of p.points.entries()){
  assert([point.area,point.hot,point.cold].every(Number.isFinite));assert(point.hot>=point.cold-1e-9,'Counterflow curves cannot cross at the same coordinate');
  if(i){assert(point.hot<=p.points[i-1].hot+1e-9);assert(point.cold<=p.points[i-1].cold+1e-9)}
  close(ch*(inputs.t_hot_in_c-point.hot),cc*(result.t_cold_out_c-point.cold));
 }
 if(ua<2000){
  // Independent RK4 integration of dTh/ds=-UA/Ch*(Th-Tc), dTc/ds=-UA/Cc*(Th-Tc).
  let hot=inputs.t_hot_in_c,cold=result.t_cold_out_c;const step=1/2000;
  const derivative=(h,c)=>[-ua/ch*(h-c),-ua/cc*(h-c)];
  for(let i=0;i<2000;i++){
   const a=derivative(hot,cold),b=derivative(hot+step*a[0]/2,cold+step*a[1]/2),c=derivative(hot+step*b[0]/2,cold+step*b[1]/2),d=derivative(hot+step*c[0],cold+step*c[1]);
   hot+=step*(a[0]+2*b[0]+2*c[0]+d[0])/6;cold+=step*(a[1]+2*b[1]+2*c[1]+d[1])/6;
   if((i+1)%200===0){const point=p.at((i+1)/2000);close(point.hot,hot);close(point.cold,cold)}
  }
 }
 assert.equal(JSON.stringify({inputs,result}),before,'Chart does not mutate calculation data');
 const markup=chart.markup(inputs,result);assert(markup.includes('Межтрубное пространство ←'));assert(!markup.includes('<figcaption>'));assert(!markup.includes('temperature-chart-tooltip'));assert(!markup.includes('temperature-probe'));assert(!/NaN|Infinity/.test(markup));
}
assert.equal(chart.profile({},{}),null);const bad=sample(100,200,200);bad.result.c_hot_w_k=0;assert.equal(chart.markup(bad.inputs,bad.result),'');
const ui=fs.readFileSync(path.join(__dirname,'../assets/coil-thermal-ui.js'),'utf8');assert(ui.indexOf('CoilTemperatureChart.markup(lastInputs,r)')<ui.indexOf("['Мощность Q'"));assert(ui.includes('CoilTemperatureChart.bind(output,lastInputs,r)'));
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert(html.indexOf('src="assets/coil-temperature-chart.js')<html.indexOf('src="assets/coil-thermal-ui.js'));
console.log('Temperature chart passed: exact Teplo endpoints, independent ODE integration, equal capacities, zero/large NTU, heat balance, non-crossing counterflow, no mutation and UI integration.');
