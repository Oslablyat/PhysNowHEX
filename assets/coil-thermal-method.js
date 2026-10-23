/* Teplo / METHODOLOGY.md: counterflow verification, SI units, CoolProp PropsSI.
 * Geometry uses the MEAN tube diameter for heat-transfer area (not outer area).
 * No pressure-drop model is specified by this method. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CoilThermalMethod=api})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const DEFAULT_INPUT={hot_fluid:'Water',cold_fluid:'Water',t_hot_in_c:105,t_cold_in_c:30,p_hot_mpa:1.101,p_cold_mpa:.501,mass_flow_hot_kg_s:.02175,volume_flow_cold_m3_h:.7,tube_outer_diameter_m:.014,tube_wall_thickness_m:.002,wall_conductivity_w_mk:16,shell_inner_diameter_m:.138,displacer_outer_diameter_m:.076,arrangement:'inline',outlet_tolerance_c:.01,wall_tolerance_c:.01,row_count:1,coil_rows:[{count:1,radius_m:.05,pitch_m:.021,turns:31,tube_outer_diameter_m:.014}]};
 const ANGLE_X=[10,20,30,40,50,60,70,80,90],ANGLE_Y=[.42,.52,.67,.78,.88,.94,.98,1,1];
 const LENGTH_X=[1,2,5,10,20,30,40,50],RE_X=[1e4,2.5e4,1e5,1e6];
 const LENGTH_Y=[[1.68,1.50,1.34,1.25,1.15,1.08,1.035,1],[1.50,1.39,1.27,1.18,1.11,1.06,1.025,1],[1.35,1.29,1.22,1.15,1.09,1.05,1.020,1],[1.14,1.12,1.09,1.06,1.04,1.025,1.010,1]];
 const pi=Math.PI;
 function finite(value,label){if(value===null||value===''||typeof value==='boolean'||!Number.isFinite(Number(value)))throw Error(label+': требуется конечное число');return Number(value)}
 function positive(data,key){const n=finite(data[key],key);if(n<=0)throw Error(key+': требуется положительное число');return n}
 function integer(value,label){const n=finite(value,label);if(!Number.isInteger(n)||n<1)throw Error(label+': требуется целое число не меньше 1');return n}
 function interp(x,xs,ys){if(x<=xs[0])return ys[0];for(let i=1;i<xs.length;i++)if(x<=xs[i])return ys[i-1]+(ys[i]-ys[i-1])*(x-xs[i-1])/(xs[i]-xs[i-1]);return ys.at(-1)}
 function counterflowFraction(ua,ch,cc){
  if(![ua,ch,cc].every(Number.isFinite)||ua<0||ch<=0||cc<=0)throw Error('Недопустимые UA или водные эквиваленты');
  const cmin=Math.min(ch,cc),ratio=cmin/Math.max(ch,cc),ntu=ua/cmin;
  return (1-ratio<1e-8?ntu/(1+ntu):-Math.expm1(-ntu*(1-ratio))/(1-ratio*Math.exp(-ntu*(1-ratio))))*cmin/ch;
 }
 function buildLayout(data={}){
  const d={...DEFAULT_INPUT,...data},ds=positive(d,'shell_inner_diameter_m'),dd=finite(d.displacer_outer_diameter_m,'Диаметр вытеснителя');
  if(dd<0||dd>=ds)throw Error('Неверный диаметр вытеснителя');
  let specs=d.coil_rows;
  if(data.coils){
   const groups=new Map();for(const raw of data.coils){const number=integer(raw.row,'Номер ряда');if(!groups.has(number))groups.set(number,[]);groups.get(number).push(raw)}
   const numbers=[...groups.keys()].sort((a,b)=>a-b);if(!numbers.length||numbers.some((n,i)=>n!==i+1))throw Error('Номера рядов должны идти подряд от 1');
   specs=numbers.map(number=>{const members=groups.get(number),first=members[0];for(const key of ['radius_m','pitch_m','turns','tube_outer_diameter_m'])if(new Set(members.map(c=>Number(c[key]??(key==='tube_outer_diameter_m'?d[key]:NaN)))).size!==1)throw Error('Ряд '+number+': все змеевики должны иметь одинаковые R, h, витки и диаметр');return {...first,count:members.length}});
  }else if(!Array.isArray(specs)||specs.length!==integer(d.row_count,'Количество рядов'))throw Error('Количество строк рядов не совпадает с заданным числом рядов');
  if(!specs.length)throw Error('Нужен хотя бы один ряд');
  if(specs.reduce((n,s)=>n+integer(s.count,'Количество змеевиков'),0)>500)throw Error('Допускается не более 500 змеевиков');
  const coils=[],rows=[],errors=[],annulus=pi*(ds*ds-dd*dd)/4;
  specs.forEach((spec,index)=>{
   const number=index+1,count=integer(spec.count,'Ряд '+number+': количество змеевиков'),radius=positive(spec,'radius_m'),pitch=positive(spec,'pitch_m'),turns=integer(spec.turns,'Ряд '+number+': количество витков'),do_=positive({tube_outer_diameter_m:spec.tube_outer_diameter_m??d.tube_outer_diameter_m},'tube_outer_diameter_m');
   const required=count*do_,phase=number%2?0:pi/count,coreGap=radius-do_/2-dd/2,shellGap=ds/2-radius-do_/2,step=count>1?2*radius*Math.sin(pi/count):null,gap=step===null?null:step-do_;
   if(pitch-required < -1e-12)errors.push('Ряд '+number+': шаг h='+pitch.toFixed(5)+' м < Nзм·dзм='+required.toFixed(5)+' м');
   if(coreGap<=0)errors.push('Ряд '+number+': трубки пересекают вытеснитель (зазор '+coreGap.toFixed(6)+' м)');
   if(shellGap<=0)errors.push('Ряд '+number+': трубки пересекают кожух (зазор '+shellGap.toFixed(6)+' м)');
   if(gap!==null&&gap < -1e-12)errors.push('Ряд '+number+': входы соседних змеевиков пересекаются на '+(-gap).toFixed(6)+' м');
   const first=coils.length+1;
   for(let j=0;j<count;j++){const theta=phase+2*pi*j/count;coils.push({index:coils.length+1,row:number,position:j+1,theta_deg:(theta*180/pi)%360,x_m:radius*Math.cos(theta),y_m:radius*Math.sin(theta),radius_m:radius,pitch_m:pitch,turns,tube_outer_diameter_m:do_})}
   const projection=pi*((radius+do_/2)**2-(radius-do_/2)**2),free=annulus-projection;
   if(free<=0)errors.push('Ряд '+number+': свободное сечение неположительно');
   rows.push({row:number,coil_count:count,radius_m:radius,pitch_m:pitch,turns,phase_deg:phase*180/pi,height_m:turns*pitch,tube_outer_diameter_m:do_,required_pitch_m:required,pitch_margin_m:pitch-required,first_coil_index:first,center_step_m:step,edge_gap_m:gap,displacer_gap_m:coreGap,shell_gap_m:shellGap,projection_m2:projection,free_area_m2:free});
  });
  const between_rows=[];
  for(let a=0;a<rows.length;a++)for(let b=a+1;b<rows.length;b++){const gap=Math.abs(rows[a].radius_m-rows[b].radius_m)-(rows[a].tube_outer_diameter_m+rows[b].tube_outer_diameter_m)/2;between_rows.push({row_a:a+1,row_b:b+1,radial_gap_m:gap});if(gap < -1e-12)errors.push('Ряды '+(a+1)+' и '+(b+1)+': радиальные зоны трубок пересекаются на '+(-gap).toFixed(6)+' м')}
  return {coils,rows,between_rows,annulus_area_m2:annulus,errors,shell_diameter_m:ds,displacer_diameter_m:dd};
 }
 function inletFlow(data,d,side,density){
  const mk='mass_flow_'+side+'_kg_s',vk='volume_flow_'+side+'_m3_h',mass=data[mk]!=null,volume=data[vk]!=null;
  let mode=data[side+'_flow_mode'];if(mode==null){if(mass&&volume)throw Error(side+': задайте один вид расхода или явно укажите режим');mode=mass?'mass':volume?'volume':side==='hot'?'mass':'volume'}
  if(mode==='mass'){const g=positive(d,mk);return [g,g/density*3600,mode]}
  if(mode==='volume'){const v=positive(d,vk);return [v/3600*density,v,mode]}
  throw Error(side+'_flow_mode: допустимы mass или volume');
 }
 function calculate(data={},propsSI){
  if(typeof propsSI!=='function')throw Error('Не загружена библиотека CoolProp');
  const d={...DEFAULT_INPUT,...data},thi=finite(d.t_hot_in_c,'Горячий вход'),tci=finite(d.t_cold_in_c,'Холодный вход');
  if(thi<=tci)throw Error('Горячая входная температура должна быть выше холодной');
  const ph=positive(d,'p_hot_mpa')*1e6,pc=positive(d,'p_cold_mpa')*1e6,delta=positive(d,'tube_wall_thickness_m'),lw=positive(d,'wall_conductivity_w_mk'),tolOut=positive(d,'outlet_tolerance_c'),tolWall=positive(d,'wall_tolerance_c');
  if(!['inline','staggered'].includes(d.arrangement))throw Error('Расположение должно быть inline или staggered');
  const layout=buildLayout(data);if(layout.errors.length)throw Error(layout.errors.join('\n'));
  const propertyCache=new Map();
  function prop(name,fluid,t,p){const key=JSON.stringify([name,fluid,t,p]);if(propertyCache.has(key))return propertyCache.get(key);let value;try{value=propsSI(name,'T',t+273.15,'P',p,fluid)}catch{throw Error('CoolProp: не удалось определить '+name+' для '+fluid+' при '+t.toFixed(3)+' °C и '+(p/1e6)+' МПа')};if(!Number.isFinite(value)||value<=0||value>1e100)throw Error('CoolProp: недопустимое свойство '+name+' для '+fluid+' при '+t.toFixed(3)+' °C');propertyCache.set(key,value);return value}
  const properties=(fluid,t,p)=>Object.fromEntries([['rho','Dmass'],['mu','VISCOSITY'],['cp','Cpmass'],['lambda','CONDUCTIVITY'],['pr','PRANDTL']].map(([k,n])=>[k,prop(n,fluid,t,p)]));
  const inletHot=properties(d.hot_fluid,thi,ph),inletCold=properties(d.cold_fluid,tci,pc),[gh,vhIn,hotMode]=inletFlow(data,d,'hot',inletHot.rho),[gc,vcIn,coldMode]=inletFlow(data,d,'cold',inletCold.rho),{coils,rows}=layout;
  for(const c of coils){const do_=c.tube_outer_diameter_m,di=do_-2*delta,dm=(do_+di)/2;if(di<=0)throw Error('Ряд '+c.row+': диаметр трубки должен быть больше удвоенной толщины стенки');const length=c.turns*Math.hypot(2*pi*c.radius_m,c.pitch_m),angle=Math.atan(2*pi*c.radius_m/c.pitch_m)*180/pi;Object.assign(c,{tube_inner_diameter_m:di,tube_mean_diameter_m:dm,tube_flow_area_m2:pi*di*di/4,height_m:c.turns*c.pitch_m,length_m:length,area_m2:pi*dm*length,angle_deg:angle,angle_correction:interp(angle,ANGLE_X,ANGLE_Y)})}
  const members=r=>coils.filter(c=>c.row===r.row),area=coils.reduce((s,c)=>s+c.area_m2,0),tubeArea=coils.reduce((s,c)=>s+c.tube_flow_area_m2,0);
  for(const row of rows){const cs=members(row),n=row.coil_count*row.turns,b=d.arrangement==='inline'?.9:.7;Object.assign(row,{tube_inner_diameter_m:cs[0].tube_inner_diameter_m,tube_mean_diameter_m:cs[0].tube_mean_diameter_m,area_m2:cs.reduce((s,c)=>s+c.area_m2,0),crossflow_tube_count:n,first_tube_count:1,second_tube_count:Number(n>=2),remaining_tube_count:Math.max(n-2,0),second_tube_correction:b,row_correction:(.6+b*Number(n>=2)+Math.max(n-2,0))/n})}
  const ordered=[...rows].sort((a,b)=>a.radius_m-b.radius_m),radial=ordered.slice(1).map((r,i)=>r.radius_m-ordered[i].radius_m),pitches=rows.map(r=>r.pitch_m),s1=radial.length?radial.reduce((a,b)=>a+b,0)/radial.length:null,s2=pitches.reduce((a,b)=>a+b,0)/pitches.length,relative=s1===null?null:s1/s2,limiting=rows.reduce((a,b)=>a.free_area_m2<=b.free_area_m2?a:b);
  const shell={free_area_m2:limiting.free_area_m2,limiting_row:limiting.row,diameter_effective_m:rows.reduce((s,r)=>s+r.tube_outer_diameter_m,0)/rows.length,s1_m:s1,s2_m:s2,row_winding_steps_m:pitches,adjacent_radius_steps_m:radial,relative_pitch:relative,spacing_correction:relative===null?1:d.arrangement==='inline'?relative**.15:relative<2?1:relative**.167,bundle_correction:coils.reduce((s,c)=>s+c.area_m2*rows[c.row-1].row_correction*c.angle_correction,0)/area};
  let tho=thi,tco=tci,hot,cold,thm,tcm,vc,ch,cc,wh,wall,prhw,prcw,eh,ec,ah,ua,phi,newHo,newCo,duty,wallError,hotError,coldError,outerIteration,wallIteration;
  for(outerIteration=1;outerIteration<=200;outerIteration++){
   thm=(thi+tho)/2;tcm=(tci+tco)/2;hot=properties(d.hot_fluid,thm,ph);cold=properties(d.cold_fluid,tcm,pc);vc=gc/cold.rho;ch=gh*hot.cp;cc=gc*cold.cp;wh=gh/(hot.rho*tubeArea);
   Object.assign(shell,{volume_flow_mean_m3_h:vc*3600,velocity_m_s:vc/shell.free_area_m2});shell.re_cold=cold.rho*shell.velocity_m_s*shell.diameter_effective_m/cold.mu;shell.regime=shell.re_cold<1000?'laminar':'crossflow';
   for(const c of coils){const di=c.tube_inner_diameter_m;Object.assign(c,{hot_mass_flow_kg_s:gh/coils.length,hot_velocity_m_s:gh/coils.length/(hot.rho*c.tube_flow_area_m2)});c.re_hot=hot.rho*c.hot_velocity_m_s*di/hot.mu;c.re_critical=2300+10500*(di/c.radius_m)**.3;c.radius_ratio=c.radius_m/di;c.length_ratio=c.length_m/di;c.length_correction=interp(c.re_hot,RE_X,LENGTH_Y.map(curve=>interp(c.length_ratio,LENGTH_X,curve)))}
   wall=(thm+tcm)/2;
   for(wallIteration=1;wallIteration<=200;wallIteration++){
    prhw=prop('PRANDTL',d.hot_fluid,wall,ph);prcw=prop('PRANDTL',d.cold_fluid,wall,pc);eh=(hot.pr/prhw)**.25;ec=(cold.pr/prcw)**.25;
    const low=shell.re_cold<1000,coefficient=low?.56:d.arrangement==='inline'?.26:.41,power=low?.5:d.arrangement==='inline'?.65:.6,prPower=low?.36:.33;
    Object.assign(shell,{correlation_c:coefficient,re_exponent:power,pr_exponent:prPower,nu_base:coefficient*shell.re_cold**power*cold.pr**prPower*ec});
    for(const c of coils){c.nu_hot=.021*c.re_hot**.8*hot.pr**.43*(1+1.77*c.tube_inner_diameter_m/c.radius_m)*c.length_correction*eh;c.alpha_hot_w_m2k=c.nu_hot*hot.lambda/c.tube_inner_diameter_m}
    ah=coils.reduce((s,c)=>s+c.alpha_hot_w_m2k*c.area_m2,0)/area;shell.nu_cold=shell.nu_base*shell.bundle_correction*(low?1:shell.spacing_correction);shell.alpha_cold_w_m2k=shell.nu_cold*cold.lambda/shell.diameter_effective_m;
    for(const c of coils){const do_=c.tube_outer_diameter_m,di=c.tube_inner_diameter_m,dm=c.tube_mean_diameter_m;c.k_linear_w_mk=pi/(1/(shell.alpha_cold_w_m2k*do_)+Math.log(do_/di)/(2*lw)+1/(ah*di));c.k_w_m2k=c.k_linear_w_mk/(pi*dm);c.ua_w_k=c.k_w_m2k*c.area_m2}
    ua=coils.reduce((s,c)=>s+c.ua_w_k,0);phi=counterflowFraction(ua,ch,cc);newHo=thi-(thi-tci)*phi;newCo=tci+(thi-tci)*ch/cc*phi;duty=ch*(thi-newHo);
    for(const c of coils){const do_=c.tube_outer_diameter_m,di=c.tube_inner_diameter_m,dm=c.tube_mean_diameter_m;c.heat_duty_w=duty*c.ua_w_k/ua;const flux=c.heat_duty_w/c.area_m2;c.wall_outer_c=tcm+flux*dm/(do_*shell.alpha_cold_w_m2k);c.wall_inner_c=thm-flux*dm/(di*ah);c.wall_mean_c=(c.wall_outer_c+c.wall_inner_c)/2}
    const next=coils.reduce((s,c)=>s+c.wall_mean_c*c.area_m2,0)/area;wallError=Math.abs(next-wall);wall=next;if(wallError<=tolWall)break;
   }
   if(wallIteration>200)throw Error('Не достигнута сходимость температуры стенки');
   hotError=Math.abs(newHo-tho);coldError=Math.abs(newCo-tco);tho=newHo;tco=newCo;if(hotError<=tolOut&&coldError<=tolOut)break;
  }
  if(outerIteration>200)throw Error('Не достигнута сходимость выходных температур');
  shell.checks=shell.re_cold>=1e5?['Re межтрубного потока < 100000: Re='+shell.re_cold.toFixed(2)+' (весь аппарат)']:[];shell.valid=!shell.checks.length;
  for(const row of rows)row.alpha_hot_w_m2k=members(row).reduce((s,c)=>s+c.alpha_hot_w_m2k*c.area_m2,0)/row.area_m2;
  for(const c of coils){const checks=[];if(c.re_hot<=c.re_critical)checks.push('Re трубного потока > Reкр: Re='+c.re_hot.toFixed(2)+', Reкр='+c.re_critical.toFixed(2));if(!(c.radius_ratio>3&&c.radius_ratio<12))checks.push('3 < R/d внутреннего диаметра < 12: R/d='+c.radius_ratio.toFixed(4));if(c.length_ratio<50&&!(c.re_hot>=1e4&&c.re_hot<=1e6))checks.push('При L/d < 50 нужно 10000 ≤ Re ≤ 1000000: L/d='+c.length_ratio.toFixed(2)+', Re='+c.re_hot.toFixed(2));Object.assign(c,{tube_checks:checks,tube_valid:!checks.length,checks:[...checks,...shell.checks],valid:!checks.length&&shell.valid})}
  const result={coils,rows,shell,between_rows:layout.between_rows,number_of_coils:coils.length,number_of_rows:rows.length,area_m2:area,tube_flow_area_m2:tubeArea,annulus_area_m2:layout.annulus_area_m2,t_hot_out_c:tho,t_cold_out_c:tco,heat_duty_w:duty,heat_duty_kw:duty/1000,ua_w_k:ua,overall_u_w_m2k:ua/area,alpha_hot_w_m2k:ah,pr_hot:hot.pr,pr_cold:cold.pr,hot_properties:hot,cold_properties:cold,temperature_correction_hot:eh,temperature_correction_cold:ec,mass_flow_hot_kg_s:gh,mass_flow_cold_kg_s:gc,volume_flow_hot_inlet_m3_h:vhIn,volume_flow_cold_inlet_m3_h:vcIn,volume_flow_cold_mean_m3_h:vc*3600,hot_flow_mode:hotMode,cold_flow_mode:coldMode,hot_inlet_density_kg_m3:inletHot.rho,cold_inlet_density_kg_m3:inletCold.rho,hot_velocity_m_s:wh,t_hot_mean_c:thm,t_cold_mean_c:tcm,t_wall_c:wall,pr_hot_wall:prhw,pr_cold_wall:prcw,temperature_function:phi,c_hot_w_k:ch,c_cold_w_k:cc,outlet_iterations:outerIteration,wall_iterations:wallIteration,outlet_error_hot_c:hotError,outlet_error_cold_c:coldError,wall_error_c:wallError,heat_balance_error_w:duty-cc*(tco-tci),valid:coils.every(c=>c.valid)};
  if(![duty,ua,tho,tco,result.overall_u_w_m2k,wall].every(Number.isFinite))throw Error('Расчёт дал неконечный результат');
  return result;
 }
 return {DEFAULT_INPUT,calculate,buildLayout,counterflowFraction,interp};
});
