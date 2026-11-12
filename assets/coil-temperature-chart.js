/* Counterflow profiles for Teplo's equivalent UA and constant capacity rates. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CoilTemperatureChart=api})(globalThis,function(){
 'use strict';
 const format=(value,digits=2)=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:digits}).format(value);
 function profile(inputs,result){
  const hotIn=inputs?.t_hot_in_c,coldIn=inputs?.t_cold_in_c;
  const area=result?.area_m2,ua=result?.ua_w_k,ch=result?.c_hot_w_k,cc=result?.c_cold_w_k,hotOut=result?.t_hot_out_c,coldOut=result?.t_cold_out_c;
  if(![hotIn,coldIn,area,ua,ch,cc,hotOut,coldOut].every(Number.isFinite)||area<=0||ua<0||ch<=0||cc<=0||hotIn<=coldIn)return null;
  if(hotIn<coldOut-1e-7||hotOut<coldIn-1e-7||hotOut>hotIn+1e-7||coldOut<coldIn-1e-7)return null;
  // d(Th-Tc)/d(F/Ftotal) = UA(1/Cc-1/Ch)(Th-Tc).
  const exponent=ua/cc-ua/ch;if(!Number.isFinite(exponent))return null;
  function at(fraction){
   const s=Math.max(0,Math.min(1,fraction));
   // Stable at equal capacity rates, zero UA and arbitrarily large NTU.
   const q=s===0?0:s===1?1:Math.abs(exponent)<1e-7?s*(1+exponent*(s-1)/2):exponent>0?Math.exp(exponent*(s-1))*(-Math.expm1(-exponent*s))/(-Math.expm1(-exponent)):Math.expm1(exponent*s)/Math.expm1(exponent);
   return {fraction:s,area:s*area,hot:hotIn-(hotIn-hotOut)*q,cold:coldOut-(coldOut-coldIn)*q};
  }
  return {area,ua,ch,cc,hotIn,hotOut,coldIn,coldOut,at,points:Array.from({length:121},(_,i)=>at(i/120))};
 }
 function markup(inputs,result){
  const data=profile(inputs,result);if(!data)return '';
  const width=720,height=360,left=58,right=width-24,top=36,bottom=height-65;
  const minimum=Math.min(data.hotOut,data.coldIn),maximum=Math.max(data.hotIn,data.coldOut),padding=Math.max(3,(maximum-minimum)*.12),low=minimum-padding,high=maximum+padding;
  const x=s=>left+s*(right-left),y=t=>bottom-(t-low)/(high-low)*(bottom-top),n=value=>value.toFixed(3);
  let grid='',ticks='';
  for(let i=0;i<=5;i++){
   const s=i/5,px=x(s),temperature=low+(high-low)*s,py=y(temperature);
   grid+='<path d="M'+n(px)+' '+top+'V'+bottom+'M'+left+' '+n(py)+'H'+right+'"/>';
   ticks+='<text x="'+n(px)+'" y="'+(bottom+22)+'" text-anchor="middle">'+format(s*data.area,3)+'</text><text x="'+(left-10)+'" y="'+n(py+4)+'" text-anchor="end">'+format(temperature,1)+'</text>';
  }
  const line=key=>data.points.map((point,i)=>(i?'L':'M')+n(x(point.fraction))+' '+n(y(point[key]))).join(' ');
  const endpoint=(s,value,kind,above)=>'<circle class="temperature-'+kind+'" cx="'+x(s)+'" cy="'+n(y(value))+'" r="3.5"/><text class="temperature-end temperature-'+kind+'" x="'+(x(s)+(s?-8:8))+'" y="'+n(y(value)+(above?-11:20))+'" text-anchor="'+(s?'end':'start')+'">'+format(value)+' °C</text>';
  return '<figure class="coil-temperature-chart" aria-label="Температуры в трубном и межтрубном пространстве">'+
   '<header><h3>Изменение температур</h3><span class="temperature-chart-mode">Противоток</span></header>'+
   '<div class="temperature-legend"><span class="temperature-hot">Трубное пространство →</span><span class="temperature-cold">Межтрубное пространство ←</span></div>'+
   '<div class="temperature-chart-plot"><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="График температур по площади теплообмена. Трубный поток слева направо, межтрубный справа налево.">'+
   '<g class="temperature-grid">'+grid+'</g><path class="temperature-axes" d="M'+left+' '+top+'V'+bottom+'H'+right+'"/><g class="temperature-ticks">'+ticks+'<text x="'+left+'" y="16">Температура, °C</text><text x="'+((left+right)/2)+'" y="'+(height-17)+'" text-anchor="middle">Площадь теплообмена F, м²</text></g>'+
   '<path class="temperature-curve temperature-hot" d="'+line('hot')+'"/><path class="temperature-curve temperature-cold" d="'+line('cold')+'"/>'+
   endpoint(0,data.hotIn,'hot',true)+endpoint(1,data.hotOut,'hot',true)+endpoint(0,data.coldOut,'cold',false)+endpoint(1,data.coldIn,'cold',false)+
   '</svg></div>'+
   '</figure>';
 }
 function bind(){}
 return {profile,markup,bind};
});
