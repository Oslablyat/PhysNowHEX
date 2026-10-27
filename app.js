const $ = id => document.getElementById(id);
document.querySelector('.dimension-grid').insertAdjacentHTML('beforeend','<label class="reserve-factor-field" title="Запас относительно расчётной площади без запаса">Коэффициент запаса по площади<div class="input-wrap"><input id="area-reserve-percent" type="number" min="0" step="any" value="10" aria-label="Коэффициент запаса по площади теплообмена в процентах"><span>%</span></div></label>');
document.querySelector('.material-dropdown-field').insertAdjacentHTML('afterend','<label class="wall-conductivity-field" title="Задаётся явно по данным материала; автоматически из марки стали не определяется">Теплопроводность стенки λw<div class="input-wrap"><input id="tube-conductivity" type="number" min="0.000001" step="any" value="16" aria-label="Теплопроводность стенки трубы"><span>Вт/(м·К)</span></div></label>');
const thermalIds = ['thi','tho','tci','tco','mh','mc','cph','cpc','u','ph','pc'];
const geometryIds = ['length','exchanger-diameter','area-reserve-percent','tube-diameter','tube-wall','tube-length','tube-count'];
const selectIds = ['hot-fluid','cold-fluid','exchanger-type','tube-material','hot-flow-unit','cold-flow-unit','detail-parameter-mode','detail-preview-mode'];
const fieldIds = [...thermalIds,...geometryIds,...selectIds,'tube-conductivity'];
const defaults = {'tube-conductivity':16,thi:90,tho:60,tci:20,tco:40,mh:2.5,mc:3.75,unknown:'mc',ph:0.6,pc:0.4,cph:4.18,cpc:4.18,u:800,'hot-fluid':'water','cold-fluid':'water','hot-flow-unit':'kg-s','cold-flow-unit':'kg-s',flow:'counter','exchanger-type':'coil',length:2000,'exchanger-diameter':600,'area-reserve-percent':10,'tube-material':'12x18','tube-diameter':14,'tube-wall':2.5,'tube-length':1800,'tube-count':80,'refine-tubes':false,'detail-parameter-mode':'construction','detail-preview-mode':'layout'};
const typeNames = {shell:'Кожухотрубный',double:'Труба в трубе',coil:'Змеевиковый'};
const materialNames = {"316":"Нерж. сталь AISI 316L","12x18":"Нерж. сталь 12Х18Н10Т","steel20":"Углеродистая сталь 20","copper":"Медь М1","titanium":"Титан ВТ1-0"};
const fmt = (n,d=2) => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(n);
let flow='counter',currentResult=null,currentGeometry=null,lastError='',toastTimer;
let calculationSheets=null,currentVariants=null,selectedVariant='balanced',unknownParameter='mc',verificationSelection=null,verificationState=null,verificationUIReady=false,currentCoilGeometry=null,coilDrawingView='top',coilHighlightedRow=null,coilHighlightedNumber=null,detailCoilRow=0;
let designLayout3d=null,designLayout3dLoading=null,designLayoutGeometry=null,designLayoutSectionMode='section',designLayoutMainObserver=null;
let coilVariantBinding=null;
let coilThermalInputs=null,coilThermalUI=null;
let detailArrangementDropdown=null;
let detailDirectionDropdown=null;
const coilProject={worker:null,id:0,key:null,timer:null,phase:'idle',version:''};
let calculationIssue=null;
const fieldFeedback=new Map(),touchedNumericFields=new Set();
let fieldFeedbackReady=false,submittedNumericFields=false;

function toast(message){$('toast').textContent=message;$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),3000)}
function getState(){return Object.fromEntries([['flow',flow],['unknown',unknownParameter],['selected-variant',selectedVariant],['coil-variant-binding',coilVariantBinding],['verification-design',verificationSelection],['verification-state',verificationState],['coil-thermal-inputs',coilThermalInputs],['refine-tubes',$('refine-tubes').getAttribute('aria-checked')==='true'],...fieldIds.map(id=>[id,$(id).dataset.exactValue??$(id).value])])}
function save(){try{if(calculationSheets){captureCalculationSheet();localStorage.setItem('physnow-sheets-v1',JSON.stringify(calculationSheets))}localStorage.setItem('thermoflow-v2',JSON.stringify(getState()));return true}catch{return false}}
function applyState(state){coilThermalInputs=state['coil-thermal-inputs']&&typeof state['coil-thermal-inputs']==='object'?state['coil-thermal-inputs']:null;verificationState=restoreCoilGeometry(state['verification-state']);coilVariantBinding=restoreCoilVariantBinding(state['coil-variant-binding']);if(!coilVariantBinding&&verificationState)coilVariantBinding={key:null,manual:true,legacy:true};coilHighlightedRow=null;coilHighlightedNumber=null;detailCoilRow=0;verificationSelection=state['verification-design']&&typeof state['verification-design']==='object'?state['verification-design']:null;unknownParameter=selectedUnknown(state);for(const id of findableParameters()){$(id).type='number';$(id).readOnly=id===unknownParameter;delete $(id).dataset.exactValue}selectedVariant=variantProfiles().some(profile=>profile.id===state['selected-variant'])?state['selected-variant']:'balanced';resetFieldFeedback();for(const id of fieldIds)$(id).value=state[id]??(id==='tube-conductivity'?state['coil-thermal-inputs']?.wall_conductivity_w_mk??defaults[id]:defaults[id]);flow=state.flow==='parallel'?'parallel':'counter';$('refine-tubes').setAttribute('aria-checked',String(state['refine-tubes']===true));syncTubeRefinement();syncControls();update(false);renderDesignGeometry();coilThermalUI?.setState(coilThermalInputs)}
function syncControls(animateTabs=false){syncFlowControls();for(const b of document.querySelectorAll('[data-flow]')){const selected=b.dataset.flow===flow;b.classList.toggle('selected',selected);b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1}moveFlowPill(animateTabs);$('heat-exchange-panel').setAttribute('aria-labelledby',flow==='counter'?'flow-counter':'flow-parallel');$('diagram-title').textContent='Поток межтрубного пространства сверху вниз, трубного пространства справа налево · '+(flow==='counter'?'противоток':'прямоток');const type=$('exchanger-type').value;syncMethodRoles();syncDropdowns();$('tube-count').readOnly=type==='double';if(type==='double')$('tube-count').value=1}
// The heat balance and hydraulic model always receive mass flow in kg/s.
function syncMethodRoles(){
 const coil=$('exchanger-type').value==='coil',hot=coil?'трубного':'межтрубного',cold=coil?'межтрубного':'трубного';document.querySelector('.process').dataset.method=coil?'teplo':'legacy';
 for(const [id,title]of [['hot-in','Вход '+hot+' пространства'],['hot-out','Выход '+hot+' пространства'],['cold-in','Вход '+cold+' пространства'],['cold-out','Выход '+cold+' пространства']])$(id).querySelector('h3').textContent=title;
 for(const [id,label]of [['thi','Температура на входе '+hot+' пространства'],['tho','Температура на выходе '+hot+' пространства'],['tci','Температура на входе '+cold+' пространства'],['tco','Температура на выходе '+cold+' пространства'],['mh','Расход в '+(coil?'трубном':'межтрубном')+' пространстве'],['mc','Расход в '+(coil?'межтрубном':'трубном')+' пространстве'],['ph','Давление на входе '+hot+' пространства'],['pc','Давление на входе '+cold+' пространства']]){$(id).setAttribute('aria-label',label);document.querySelector('[data-find-param="'+id+'"]')?.setAttribute('aria-label','Найти: '+label.toLowerCase())}
 $('diagram-title').textContent=coil?'Горячий поток внутри змеевиков, холодный в межтрубном пространстве; '+(flow==='counter'?'противоток':'прямоток · расчёт Teplo недоступен'):'Поток межтрубного пространства сверху вниз, трубного пространства справа налево';
 $('hot-flow-unit').setAttribute('aria-label','Единицы расхода '+(coil?'трубного':'межтрубного')+' потока');$('cold-flow-unit').setAttribute('aria-label','Единицы расхода '+(coil?'межтрубного':'трубного')+' потока');
 $('flow-parallel').disabled=false;$('flow-parallel').title=coil?'Показать схему прямотока. Расчёт Teplo для прямотока не поддерживается.':'';fitDiagram();
 const reserve=document.querySelector('.reserve-factor-field');reserve.firstChild.textContent=coil?'Запас по UA':'Коэффициент запаса по площади';reserve.title=coil?'Запас проводимости UA относительно проектного задания':'Запас относительно расчётной площади без запаса';$('area-reserve-percent').setAttribute('aria-label',coil?'Запас проводимости UA в процентах':'Коэффициент запаса по площади в процентах');
 const power=$('result-q').closest('.metric');power.querySelector('.metric-label').innerHTML=coil?'Задание по мощности <span>Q</span>':'Тепловая нагрузка <span>Q</span>';power.querySelector('.metric-foot').textContent=coil?'Требуется по балансу Teplo':'Передаваемая тепловая мощность';
 if(!coil){$('result-area').closest('.metric').querySelector('.metric-label').innerHTML='Площадь теплообмена <span>F</span>'}
}
function flowUnitName(unit){return {'kg-s':'кг/с','kg-h':'кг/ч','m3-h':'м³/ч','m3-s':'м³/с','l-s':'л/с'}[unit]||'кг/с'}
function isVolumeFlowUnit(unit){return ['m3-h','m3-s','l-s'].includes(unit)}
function flowDensity(temperature,fluid){
 if(fluid!=='water')throw Error('Объёмный расход доступен для воды. Для другой жидкости выберите кг/с или кг/ч.');
 if(temperature===''||!Number.isFinite(Number(temperature))||Number(temperature)<0||Number(temperature)>100)throw Error('Для объёмного расхода воды задайте температуру на входе от 0 до 100 °C.');
 return waterProperties(Number(temperature)).rho;
}
function flowToMass(value,unit,temperature,fluid){
 if(unit==='kg-h')return Number(value)/3600;
 if(!isVolumeFlowUnit(unit))return Number(value);
 const density=flowDensity(temperature,fluid);
 return Number(value)*density/(unit==='m3-h'?3600:unit==='l-s'?1000:1);
}
function massToFlow(value,unit,temperature,fluid){
 if(unit==='kg-h')return Number(value)*3600;
 if(!isVolumeFlowUnit(unit))return Number(value);
 const density=flowDensity(temperature,fluid);
 return Number(value)/density*(unit==='m3-h'?3600:unit==='l-s'?1000:1);
}
function flowUnitErrors(state){
 if(state['exchanger-type']==='coil')return {};
 const errors={},unknown=selectedUnknown(state);
 for(const side of ['hot','cold']){const id=side==='hot'?'thi':'tci';if(!isVolumeFlowUnit(state[side+'-flow-unit'])||id===unknown)continue;try{flowDensity(state[id],state[side+'-fluid'])}catch(error){errors[id]=error.message}}
 return errors;
}
function syncFlowControls(){
 for(const side of ['hot','cold']){
  const select=$(side+'-flow-unit'),water=$(side+'-fluid').value==='water';
  if(!['kg-s','kg-h','m3-h','m3-s','l-s'].includes(select.value))select.value='kg-s';
  if(!water&&isVolumeFlowUnit(select.value))select.value='kg-s';
  for(const option of select.options)option.disabled=!water&&isVolumeFlowUnit(option.value);
  select.dataset.previous=select.value;
 }
}
function changeFlowUnit(side){
 if($('exchanger-type').value==='coil'){
  const select=$(side+'-flow-unit'),previous=select.dataset.previous||'kg-s',next=select.value,id=side==='hot'?'mh':'mc';
  if(id!==unknownParameter){if(!currentResult||currentResult.method!=='Teplo'){select.value=previous;toast('Дождитесь расчёта баланса для точного перевода расхода');return}const mass=currentResult[id],rho=currentResult[side==='hot'?'rhoh':'rhoc'];$(id).value=String(next==='kg-s'?mass:next==='kg-h'?mass*3600:mass/rho*(next==='m3-h'?3600:next==='m3-s'?1:1000))}
  select.dataset.previous=next;update();return;
 }
 const select=$(side+'-flow-unit'),next=select.value,previous=select.dataset.previous||'kg-s',id=side==='hot'?'mh':'mc';
 if(id!==unknownParameter&&$(id).value!==''&&Number.isFinite(Number($(id).value))){
  try{const temperature=$(side==='hot'?'thi':'tci').value,fluid=$(side+'-fluid').value,mass=flowToMass($(id).value,previous,temperature,fluid),converted=massToFlow(mass,next,temperature,fluid);if(!Number.isFinite(converted))throw Error('Расход выходит за допустимый диапазон.');$(id).value=String(Number(converted.toPrecision(12)))}
  catch(error){select.value=previous;toast(error.message);return}
 }
 select.dataset.previous=next;update();
}
function changeFlowFluid(side){
 const select=$(side+'-flow-unit'),id=side==='hot'?'mh':'mc';
 if($(side+'-fluid').value==='custom'&&isVolumeFlowUnit(select.value)){
  if(id!==unknownParameter&&$(id).value!==''){try{$(id).value=String(Number(flowToMass($(id).value,select.value,$(side==='hot'?'thi':'tci').value,'water').toPrecision(12)))}catch{$(id).value=''}}
  select.value='kg-s';toast('Для другой жидкости расход задаётся в кг/с или кг/ч');
 }
 if($(side+'-fluid').value==='water')$(side==='hot'?'cph':'cpc').value=4.18;
 syncFlowControls();update();
}

function numericValues(state,ids){for(const id of ids)if(state[id]===''||!Number.isFinite(Number(state[id])))throw Error('Заполните все числовые поля.');return Object.fromEntries(ids.map(id=>[id,Number(state[id])]))}
function findableParameters(){return ['thi','tho','tci','tco','mh','mc']}
function findParameterName(id){return {thi:'температура горячего потока на входе',tho:'температура горячего потока на выходе',tci:'температура холодного потока на входе',tco:'температура холодного потока на выходе',mh:'расход горячего потока',mc:'расход холодного потока'}[id]}
function selectedUnknown(state){return state.unknown===null?null:findableParameters().includes(state.unknown)?state.unknown:'mc'}
function solveInletTemperature(residual,lo,hi,name){
 if(!(hi>lo))throw Error('Для объёмного расхода '+name+' должна находиться в диапазоне 0…100 °C.');
 let a=lo,b=hi,fa=residual(a),fb=residual(b);
 if(!Number.isFinite(fa)||!Number.isFinite(fb)||fa*fb>0)throw Error('При заданных расходах '+name+' не находится в диапазоне 0…100 °C.');
 if(Math.abs(fa)<1e-10)return a;if(Math.abs(fb)<1e-10)return b;
 for(let i=0;i<90;i++){const mid=(a+b)/2,fm=residual(mid);if(Math.abs(fm)<1e-10||b-a<1e-10)return mid;if((fa<0)===(fm<0)){a=mid;fa=fm}else b=mid}
 return (a+b)/2;
}
function solve(state){
 const unknown=selectedUnknown(state),required=[...new Set([...thermalIds,'mc'])].filter(id=>id!==unknown),n=numericValues(state,required);
 if(['ph','pc','cph','cpc','u'].some(id=>n[id]<=0))throw Error('Давление, теплоёмкости и коэффициент K должны быть больше нуля.');
 for(const id of ['mh','mc'])if(id!==unknown&&n[id]<=0)throw Error('Известные расходы должны быть больше нуля.');
 for(const id of ['thi','tho','tci','tco'])if(id!==unknown&&n[id]<=-273.15)throw Error('Температура должна быть выше −273,15 °C.');
 const hotUnit=state['hot-flow-unit'],coldUnit=state['cold-flow-unit'];
 const hotMass=t=>flowToMass(n.mh,hotUnit,t,state['hot-fluid']);
 const coldMass=t=>flowToMass(n.mc,coldUnit,t,state['cold-fluid']);
 let mh=unknown==='mh'||unknown==='thi'&&isVolumeFlowUnit(hotUnit)?null:hotMass(n.thi);
 let mc=unknown==='mc'||unknown==='tci'&&isVolumeFlowUnit(coldUnit)?null:coldMass(n.tci);
 if(unknown==='thi'){
  const coldQ=mc*n.cpc*(n.tco-n.tci);
  if(isVolumeFlowUnit(hotUnit)){
   n.thi=solveInletTemperature(t=>hotMass(t)*n.cph*(t-n.tho)-coldQ,Math.max(0,n.tho+1e-8),100,'температура на входе межтрубного пространства');mh=hotMass(n.thi);
  }else n.thi=n.tho+coldQ/(mh*n.cph);
 }else if(unknown==='tho')n.tho=n.thi-mc*n.cpc*(n.tco-n.tci)/(mh*n.cph);
 else if(unknown==='tci'){
  const hotQ=mh*n.cph*(n.thi-n.tho);
  if(isVolumeFlowUnit(coldUnit)){
   n.tci=solveInletTemperature(t=>coldMass(t)*n.cpc*(n.tco-t)-hotQ,0,Math.min(100,n.tco-1e-8),'температура на входе трубного пространства');mc=coldMass(n.tci);
  }else n.tci=n.tco-hotQ/(mc*n.cpc);
 }else if(unknown==='tco')n.tco=n.tci+mh*n.cph*(n.thi-n.tho)/(mc*n.cpc);
 else if(unknown==='mh')mh=mc*n.cpc*(n.tco-n.tci)/(n.cph*(n.thi-n.tho));
 else if(unknown==='mc')mc=mh*n.cph*(n.thi-n.tho)/(n.cpc*(n.tco-n.tci));
 n.mh=mh;n.mc=mc;
 if(!['thi','tho','tci','tco','mh','mc'].every(id=>Number.isFinite(n[id])))throw Error('Проверьте расходы и разности температур: параметр не удаётся определить.');
 if([n.thi,n.tho,n.tci,n.tco].some(t=>t<=-273.15))throw Error('Найденная температура ниже абсолютного нуля. Проверьте известные параметры.');
 if(n.mh<=0||n.mc<=0)throw Error('По заданным условиям получен неположительный расход. Проверьте температуры.');
 if(n.tho>=n.thi)throw Error('Температура на входе межтрубного пространства должна быть выше выходной.');
 if(n.tco<=n.tci)throw Error('Температура на выходе трубного пространства должна быть выше входной.');
 // Validate the density domain even when the unknown is the volumetric flow itself.
 if(isVolumeFlowUnit(hotUnit))flowDensity(n.thi,state['hot-fluid']);
 if(isVolumeFlowUnit(coldUnit))flowDensity(n.tci,state['cold-fluid']);
 const q=n.mh*n.cph*(n.thi-n.tho),coldQ=n.mc*n.cpc*(n.tco-n.tci),imbalance=Math.abs(q-coldQ)/Math.max(q,coldQ);
 if(imbalance>.001)throw Error('Тепловой баланс не сходится ('+fmt(imbalance*100,2)+' %). Выберите параметр «Найти» или проверьте значения.');
 const d1=n.thi-(state.flow==='counter'?n.tco:n.tci),d2=n.tho-(state.flow==='counter'?n.tci:n.tco);
 if(d1<=0||d2<=0)throw Error('Температурный напор должен быть положительным на обоих концах. Проверьте данные и схему движения.');
 const dt=Math.abs(d1-d2)<1e-8?(d1+d2)/2:(d1-d2)/Math.log(d1/d2),area=q*1000/(n.u*dt);
 if(![q,dt,area].every(Number.isFinite))throw Error('Результат выходит за допустимый числовой диапазон.');
 return {...n,q,dt,area,imbalance,unknown,flow:state.flow};
}

function geometry(state){let n;try{n=numericValues(state,geometryIds)}catch{throw Error('Заполните размеры аппарата и труб.')}if(n['area-reserve-percent']<0)throw Error('Коэффициент запаса по площади не может быть отрицательным.');if(Object.entries(n).some(([id,v])=>id!=='area-reserve-percent'&&v<=0))throw Error('Размеры и количество труб должны быть больше нуля.');if(!Number.isInteger(n['tube-count']))throw Error('Количество труб должно быть целым числом.');if(2*n['tube-wall']>=n['tube-diameter'])throw Error('Стенка трубы должна быть тоньше половины наружного диаметра.');const surface=Math.PI*n['tube-diameter']/1000*n['tube-length']/1000*n['tube-count'];if(!Number.isFinite(surface))throw Error('Проверьте габаритные размеры.');return {...n,surface}}
function syncUnknownControls(){
 for(const id of findableParameters()){
  const input=$(id),active=id===unknownParameter,group=input.closest('.find-field'),button=group.querySelector('.find-button');
  if(active)input.type='text';
  else{const value=input.dataset.exactValue??input.value;input.type='number';if(input.readOnly)input.value=value;delete input.dataset.exactValue}
  input.readOnly=active;input.placeholder=active?'—':'';input.setAttribute('aria-description',active?'Неизвестный параметр. Определяется по тепловому балансу.':'Известный параметр. Введите значение.');
  group.classList.toggle('is-find',active);group.querySelector('.input-wrap').classList.toggle('readonly',active);
  button.setAttribute('aria-pressed',String(active));button.title=active?'Вернуть ручной ввод':'Найти: '+findParameterName(id);
 }
}
function calculatedDisplayValue(result,id,state){
 if(result.method==='Teplo'&&['mh','mc'].includes(id))return String(result[id==='mh'?'displayFlowHot':'displayFlowCold']);
 const value=id==='mh'?massToFlow(result.mh,state['hot-flow-unit'],result.thi,state['hot-fluid']):id==='mc'?massToFlow(result.mc,state['cold-flow-unit'],result.tci,state['cold-fluid']):result[id];
 return String(Number(value.toPrecision(12)));
}
function areaReservePercent(state){
 const reserve=Number(state['area-reserve-percent']);
 if(state['area-reserve-percent']===''||!Number.isFinite(reserve))throw Error('Задайте коэффициент запаса по площади теплообмена.');
 if(reserve<0)throw Error('Коэффициент запаса по площади не может быть отрицательным.');
 return reserve;
}
function selectUnknownParameter(id){
 unknownParameter=unknownParameter===id?null:id;
 syncUnknownControls();update();
}
function update(persist=true){
 if($('exchanger-type').value==='coil'){updateCoilProject(persist);return}
 setCalculationIssue(null);
 if(coilProject.key!==null){clearTimeout(coilProject.timer);coilProject.key=null;coilProject.id++;coilProject.worker?.postMessage({id:coilProject.id,cancel:true})}
 syncUnknownControls();const state=getState();lastError='';
 try{
  const reservePercent=areaReservePercent(state);currentResult={...solve(state),reservePercent};currentResult.designArea=currentResult.area*(1+reservePercent/100);
  if(unknownParameter){const input=$(unknownParameter),exact=calculatedDisplayValue(currentResult,unknownParameter,state);input.dataset.exactValue=exact;const unit=unknownParameter==='mh'?state['hot-flow-unit']:state['cold-flow-unit'];input.value=fmt(Number(exact),['mh','mc'].includes(unknownParameter)?unit==='m3-s'?6:3:2)}
  $('result-q').textContent=fmt(currentResult.q);$('result-dt').textContent=fmt(currentResult.dt);$('result-area').textContent=fmt(currentResult.designArea);$('result-area-note').textContent='Требуемая поверхность · запас '+fmt(currentResult.reservePercent)+' %';
  $('balance-status').classList.remove('invalid');$('balance-status').innerHTML='<i></i> Тепловой баланс соблюдён';$('balance-status').title=unknownParameter?'Найдено: '+findParameterName(unknownParameter):'Все параметры заданы; расхождение баланса не более 0,1 %';
 }catch(error){
  currentResult=null;lastError=error.message;if(unknownParameter){$(unknownParameter).value='';delete $(unknownParameter).dataset.exactValue}
  for(const id of ['result-q','result-dt','result-area'])$(id).textContent='—';$('result-area-note').textContent='Требуемая поверхность · с учётом запаса';
  const message=lastError.startsWith('Заполните')?'Заполните известные параметры':lastError.startsWith('Тепловой баланс')?'Тепловой баланс не сходится':'Проверьте известные параметры';
  $('balance-status').classList.add('invalid');$('balance-status').innerHTML='<i></i> '+message;$('balance-status').title=lastError;
 }
 for(const id of ['thi','tho','tci','tco']){
  const value=currentResult?currentResult[id]:id===unknownParameter?'':state[id];
  $('svg-'+id).textContent=value!==''&&Number.isFinite(Number(value))?fmt(Number(value))+' °C':'—';
 }
 try{currentGeometry=geometry(state)}catch(error){currentGeometry=null;lastError=lastError||error.message}
 $('error').textContent='';$('error').hidden=true;if(lastError)setCalculationIssue({stage:currentResult?'design':'balance',message:lastError,code:lastError.startsWith('Заполните')?'incomplete':'invalid-input'});renderExchangerVariants(state,currentResult);refreshFieldFeedback();coilThermalUI?.refresh();if(persist)save();
}

function coilProjectState(){const state=getState();return Object.fromEntries([...fieldIds.map(key=>[key,state[key]]),['flow',flow],['unknown',unknownParameter],['refine-tubes',state['refine-tubes']],['coil-thermal-inputs',{arrangement:coilThermalInputs?.arrangement??coilThermalUI?.arrangement??'inline'}]])}
function coilProjectKey(state){return JSON.stringify(['sequential-full-height-v1',calculationSheets?.activeId??'',state.flow,state.unknown,...['thi','tho','tci','tco','mh','mc','ph','pc','hot-fluid','cold-fluid','hot-flow-unit','cold-flow-unit','length','exchanger-diameter','tube-conductivity','area-reserve-percent','refine-tubes','tube-diameter','tube-wall'].map(k=>k===state.unknown?null:state[k]),state['coil-thermal-inputs'].arrangement])}
function setCalculationIssue(issue){
 calculationIssue=issue&&issue.code!=='incomplete'?{...issue}:null;
 document.querySelector('.results').classList.toggle('has-calculation-error',!!calculationIssue);
 if(calculationIssue){
  const state=getState(),invalid=Object.keys(numericFieldErrors(state));
  calculationIssue.fields=[...new Set([...(issue.fields||[]),...invalid,...(!issue.fields?.length&&!invalid.length&&issue.stage==='balance'&&unknownParameter?[unknownParameter]:[])])];
 }
 for(const card of document.querySelectorAll('.port-card'))card.classList.toggle('has-calculation-error',!!calculationIssue?.fields.some(id=>card.contains($(id))));
 $('export').disabled=!!calculationIssue;
 refreshFieldFeedback();
}
function renderCoilProjectBalance(r,state){
 currentResult=r;lastError='';setCalculationIssue(null);
 if(unknownParameter){const input=$(unknownParameter),exact=calculatedDisplayValue(r,unknownParameter,state);input.dataset.exactValue=exact;input.value=fmt(Number(exact),['mh','mc'].includes(unknownParameter)?state[unknownParameter==='mh'?'hot-flow-unit':'cold-flow-unit']==='m3-s'?8:4:4)}
 $('result-q').textContent=fmt(r.q);$('result-dt').textContent=fmt(r.dt);$('balance-status').classList.remove('invalid');$('balance-status').innerHTML='<i></i> Баланс по методике Teplo';$('balance-status').title='CoolProp: cp при средних температурах, масса по плотности на входе. Невязка '+fmt(r.heatBalanceError,6)+' Вт.';
 for(const id of ['thi','tho','tci','tco'])$('svg-'+id).textContent=fmt(r[id])+' °C';
 renderCoilProjectArea();coilThermalUI?.refresh();
}
function renderCoilProjectArea(){
 if($('exchanger-type').value!=='coil')return;
 const metric=$('result-area').closest('.metric');metric.querySelector('.metric-label').innerHTML='Поверхность конструкции <span>F</span>';
 try{const g=calculateCoilGeometry(verificationState),area=Math.PI*(g.tubeDiameter-g.tubeWall)/1000*g.totalLength;$('result-area').textContent=fmt(area);$('result-area-note').textContent='По среднему диаметру · без отводов'}catch{$('result-area').textContent='—';$('result-area-note').textContent='Площадь появится после задания геометрии'}
}
function updateCoilProject(persist=true,force=false){
 syncUnknownControls();const state=coilProjectState(),key=coilProjectKey(state);
 if(!force&&key===coilProject.key){refreshFieldFeedback();if(persist)save();return}
 setCalculationIssue(null);
 coilProject.key=key;coilProject.phase='pending';const id=++coilProject.id;clearTimeout(coilProject.timer);coilProject.worker?.postMessage({id,cancel:true});currentResult=null;lastError='Расчёт Teplo обновляется';
 for(const field of ['result-q','result-dt'])$(field).textContent='—';if(unknownParameter){$(unknownParameter).value='';delete $(unknownParameter).dataset.exactValue}
 $('balance-status').classList.remove('invalid');$('balance-status').innerHTML='<i></i> Расчёт баланса · CoolProp';for(const k of ['thi','tho','tci','tco'])$('svg-'+k).textContent=k===unknownParameter?'—':state[k]!==''?fmt(Number(state[k]))+' °C':'—';
 renderCoilProjectArea();renderExchangerVariants(state,null,{kind:'coil',inputKey:key,rows:[],candidates:[],message:'Расчёт баланса и подбор конструкций по Teplo…'});coilThermalUI?.refresh();refreshFieldFeedback();if(persist)save();
 coilProject.timer=setTimeout(()=>{
  if(!coilProject.worker){
   const worker=new Worker(new URL('assets/coil-project-worker.js?v=balance-errors-20261025',document.baseURI),{type:'module'});coilProject.worker=worker;
   worker.onmessage=({data})=>{
    if(data.id!==coilProject.id||$('exchanger-type').value!=='coil')return;
    if(data.error){coilProject.phase='error';lastError=data.error;setCalculationIssue({stage:currentResult?'design':'balance',...data.issue,message:data.error});if(!currentResult){$('balance-status').classList.add('invalid');$('balance-status').innerHTML='<i></i> Баланс не рассчитан';$('balance-status').title=data.error;$('result-area').textContent='—';$('result-area-note').textContent='Сначала исправьте тепловой баланс'}renderExchangerVariants(coilProjectState(),currentResult,{kind:'coil',inputKey:coilProject.key,rows:[],candidates:[],message:data.error});coilThermalUI?.refresh();save();return}
    if(data.phase==='balance'){coilProject.phase='selecting';renderCoilProjectBalance(data.balance,coilProjectState());save()}
    if(data.phase==='progress'){const status=$('variant-status');if(status){status.hidden=false;status.textContent='Подбор по Teplo: проверено '+data.stats.evaluations+' конструкций, принято '+data.stats.accepted+'.'}}
    if(data.phase==='variants'){
     coilProject.phase='ready';coilProject.version=data.version;lastError='';data.variants.inputKey=coilProject.key;
     const hadRows=data.variants.rows.length;data.variants.rows=data.variants.rows.filter(({design})=>{try{calculateCoilGeometry(design.geometry);return true}catch{return false}});
     if(hadRows&&!data.variants.rows.length)data.variants.message+=' Нет доступного варианта для редактора.';
     renderExchangerVariants(coilProjectState(),currentResult,data.variants);renderCoilProjectArea();coilThermalUI?.refresh();save();
    }
   };
   worker.onerror=()=>{coilProject.phase='error';coilProject.key=null;lastError='Не удалось загрузить расчёт Teplo. Обновите страницу или повторите ввод.';coilProject.worker?.terminate();coilProject.worker=null;setCalculationIssue({stage:'runtime',message:lastError});$('balance-status').classList.add('invalid');$('balance-status').title=lastError;$('balance-status').innerHTML='<i></i> Расчёт Teplo недоступен';renderExchangerVariants(coilProjectState(),null,{kind:'coil',rows:[],candidates:[],message:lastError})};
  }
  coilProject.worker.postMessage({id,state});
 },250);
}

// Preliminary discrete shell-and-tube selection. All dimensions inside this model are SI.
// Pressure-drop equations: BUET ME307, Shell & Tube Heat Exchanger, Kern shell model.
function variantProfiles(){return [
 {id:'balanced',name:'Оптимальная конструкция',detail:'Баланс габаритов, гидравлики и изготовления'},
 {id:'compact',name:'По габаритам',detail:'Минимальный объём корпуса'},
 {id:'hydraulic',name:'По гидравлике',detail:'Минимальная мощность на прокачку'},
 {id:'production',name:'По сложности производства',detail:'Минимум соединений труб и перегородок'}
]}
function waterProperties(t){
 if(!Number.isFinite(t)||t<0||t>100)throw Error('Для подбора задайте жидкую воду с температурами от 0 до 100 °C.');
 return {rho:1000*(1-((t+288.9414)/(508929.2*(t+68.12963)))*(t-3.9863)**2),mu:.001*(1+.015512*(t-20))**-1.572};
}
function hydraulicEstimate(r,tube,shell){
 const {di,do:outside,n,lt,ds,b,nb}=tube,pitch=1.25*outside;
 const vt=r.mc/(tube.water.rho*n*Math.PI*di*di/4),ret=tube.water.rho*vt*di/tube.water.mu;
 // Transition is excluded; the smooth-tube turbulent correlations stop at Re=300,000.
 if((ret>2300&&ret<4000)||ret>300000)return null;
 const ft=ret<=2300?64/ret:ret<=20000?.316*ret**-.25:.184*ret**-.2;
 const dpt=(ft*lt/di+4)*tube.water.rho*vt*vt/2;
 const de=2*Math.sqrt(3)*pitch*pitch/(Math.PI*outside)-outside;
 const as=ds*(pitch-outside)*b/pitch,vs=r.mh/(shell.rho*as),res=shell.rho*vs*de/shell.mu;
 if(res<400||res>1e6)return null;
 const fs=Math.exp(.576-.19*Math.log(res));
 const dps=fs*(nb+1)*(ds/de)*shell.rho*vs*vs/2;
 if(![dpt,dps,vt,vs,ret,res].every(Number.isFinite)||dpt>=r.pc*1e6||dps>=r.ph*1e6)return null;
 return {dpt,dps,vt,vs,ret,res,pumping:dpt*r.mc/tube.water.rho+dps*r.mh/shell.rho};
}
function selectExchangerVariants(state,r){
 if(state['exchanger-type']==='coil')return {kind:'coil',rows:[],candidates:[],message:'Подбор Teplo выполняется в фоновом расчёте.'};
 const unavailable=message=>({rows:[],candidates:[],message});
 if(!r)return unavailable('Заполните параметры потоков — четыре варианта появятся автоматически.');
 if(state['exchanger-type']!=='shell')return unavailable('Подбор вариантов пока доступен для кожухотрубного теплообменника.');
 if(state['hot-fluid']!=='water'||state['cold-fluid']!=='water')return unavailable('Для подбора выберите воду в обоих контурах.');
 if([r.thi,r.tho,r.tci,r.tco].some(t=>t<0||t>100))return unavailable('Модель подбора: жидкая вода от 0 до 100 °C.');
 const maxL=Number(state.length)/1000,maxD=Number(state['exchanger-diameter'])/1000;
 if(!Number.isFinite(maxL)||!Number.isFinite(maxD)||maxL<=0||maxD<=0)return unavailable('Задайте предельные длину и внешний диаметр аппарата.');
 if(maxL>10||maxD>2)return unavailable('Область подбора: длина до 10 000 мм, внешний диаметр до 2 000 мм.');
 const fixed=state['refine-tubes']===true;
 const sizes=fixed?[[Number(state['tube-diameter']),Number(state['tube-wall'])]]:[[16,1.5],[20,2],[25,2],[32,2.5]];
 if(sizes.some(([d,w])=>![d,w].every(Number.isFinite)||w<=0||d<=2*w))return unavailable('Проверьте наружный диаметр и толщину стенки трубы.');
 const hot=waterProperties((r.thi+r.tho)/2),cold=waterProperties((r.tci+r.tco)/2),candidates=[];
 const lengths=[...new Set([.4,.5,.6,.7,.8,.9,1].map(k=>Math.round(maxL*k*1000)/1000))].filter(l=>l>=.3&&l<=maxL);
 for(const [dmm,wmm]of sizes){
  const outside=dmm/1000,di=(dmm-2*wmm)/1000,pitch=1.25*outside;
  if(outside<.006||outside>.1)continue;
  // Actual triangular lattice radii, with a 10 mm radial bundle clearance and 5 mm shell wall.
  // Ring search covers all candidates up to 3,000 tubes, independent of user input magnitude.
  const radii=[];for(let iy=-36;iy<=36;iy++)for(let ix=-36;ix<=36;ix++)radii.push(Math.hypot((ix+(Math.abs(iy)%2)/2)*pitch,iy*Math.sqrt(3)*pitch/2));
  radii.sort((a,b)=>a-b);
  for(const length of lengths){
   const lt=.9*length,minN=Math.ceil((r.designArea??r.area)/(Math.PI*outside*lt));
   if(minN>3000)continue;
   for(const factor of [1,1.3,1.75]){
    const n=Math.ceil(minN*factor);if(n>3000)continue;
    const minimumD=Math.ceil((2*radii[n-1]+outside+.03)*1000/10)*.01;
    const diameters=[...new Set([minimumD,minimumD*1.25,minimumD*1.5,maxD].map(d=>Math.min(maxD,Math.ceil(d*1000)/1000)))];
    for(const diameter of diameters){
     if(diameter+1e-10<minimumD||diameter>maxD)continue;
     const ds=diameter-.01;
     for(const ratio of [.4,.5,.6]){
      const nb=Math.max(1,Math.round(lt/(ratio*ds))-1),b=lt/(nb+1);
      if(b<.4*ds-1e-10||b>.6*ds+1e-10)continue;
      const h=hydraulicEstimate(r,{di,do:outside,n,lt,ds,b,nb,water:cold},hot);if(!h)continue;
      const area=Math.PI*outside*lt*n,volume=Math.PI*diameter*diameter*length/4,complexity=2*n+4*nb;
      candidates.push({length,diameter,lt,n,dmm,wmm,area,b,nb,volume,complexity,...h});
     }
    }
   }
  }
 }
 if(!candidates.length)return unavailable('Нет подходящих вариантов в заданных габаритах и пределах модели. Увеличьте L или D либо измените типоразмер труб.');
 const mins={volume:Infinity,pumping:Infinity,complexity:Infinity};for(const c of candidates)for(const k of Object.keys(mins))mins[k]=Math.min(mins[k],c[k]);
 for(const c of candidates)c.balanced=(Math.log(c.volume/mins.volume)+Math.log(c.pumping/mins.pumping)+Math.log(c.complexity/mins.complexity))/3;
 const keys={balanced:'balanced',compact:'volume',hydraulic:'pumping',production:'complexity'};
 const rows=variantProfiles().map(profile=>({...profile,design:candidates.reduce((best,c)=>c[keys[profile.id]]<best[keys[profile.id]]?c:best)}));
 return {rows,candidates,message:'В пределах заданных L и D · вода / вода'};
}
function renderExchangerVariants(state,r,supplied=null){
 // Automatic geometry binding is independent of the removed variants table.
 currentVariants=supplied??selectExchangerVariants(state,r);
 const coil=state['exchanger-type']==='coil';
 if(coil&&currentVariants.rows.length){
  if(!currentVariants.rows.some(row=>row.id===selectedVariant))selectedVariant=currentVariants.rows.find(row=>row.id==='balanced')?.id??currentVariants.rows[0].id;
  if(coilVariantBinding?.legacy){coilVariantBinding={key:currentVariants.inputKey,profile:selectedVariant,manual:true};}
  else if(!coilVariantBinding||coilVariantBinding.key!==currentVariants.inputKey||!currentVariants.rows.some(row=>row.id===coilVariantBinding.profile)){if(coilVariantBinding?.manual)coilVariantBinding.key=currentVariants.inputKey;else{selectedVariant='balanced';loadCoilVariant(selectedVariant,false)}}
 }
 const status=$('variant-status');if(status){status.hidden=currentVariants.rows.length>0;status.textContent=status.hidden?'':currentVariants.message;}
 if(coil)syncCoilVariantNotice();
 syncVariantSelection();
}
function restoreCoilVariantBinding(value){return value&&typeof value.key==='string'&&typeof value.profile==='string'?{key:value.key,profile:value.profile,manual:value.manual===true}:null}
function syncCoilVariantNotice(){if($('exchanger-type').value!=='coil')return;const status=$('variant-status');if(!status)return;status.hidden=false;status.textContent=currentVariants?.message||'';if(currentVariants?.rows.length)status.textContent+=' '+(coilVariantBinding?.manual?'Геометрия изменена вручную; автоматический подбор не перезаписывает ручные изменения.':'В проработке: '+(currentVariants.rows.find(row=>row.id===selectedVariant)?.name||'—')+'.')}
function markCoilVariantManual(){if(coilVariantBinding&&$('exchanger-type').value==='coil'){coilVariantBinding.manual=true;syncCoilVariantNotice()}}
function loadCoilVariant(profile,refresh=true){
 const candidate=currentVariants?.rows.find(row=>row.id===profile)?.design;if(candidate?.kind!=='coil')return;
 selectedVariant=profile;verificationState=restoreCoilGeometry(candidate.geometry);coilVariantBinding={key:currentVariants.inputKey,profile,manual:false};detailCoilRow=0;coilHighlightedRow=null;coilHighlightedNumber=null;
 if(verificationUIReady)fillVerificationInputs();else renderDesignGeometry();
 renderCoilProjectArea();
 if(refresh){syncVariantSelection();syncCoilVariantNotice();save()}
}
function syncVariantSelection(){
 syncVerificationChoice();
}

// Keep an explicit snapshot; later design edits do not silently replace it.
function verificationCandidate(){
 const row=currentVariants?.rows.find(item=>item.id===selectedVariant);
 if(!row?.design)return null;
 const inputs=getState();delete inputs['verification-design'];delete inputs['verification-state'];delete inputs['coil-variant-binding'];delete inputs['coil-thermal-inputs'];delete inputs['detail-parameter-mode'];delete inputs['detail-preview-mode'];
 return {profile:row.id,name:row.name,design:JSON.parse(JSON.stringify(row.design)),inputs};
}
function syncVerificationChoice(){
 const button=$('choose-verification');if(!button)return;
 button.hidden=$('exchanger-type').value==='coil';
 const candidate=verificationCandidate(),chosen=!!candidate&&JSON.stringify(candidate)===JSON.stringify(verificationSelection);
 button.disabled=!candidate||chosen;button.classList.toggle('is-chosen',chosen);
 const viewButton=$('view-exchanger-card');if(viewButton){const coil=$('exchanger-type').value==='coil'&&!!verificationState;viewButton.disabled=!candidate&&!coil;viewButton.title=coil?'Текущая геометрия и поверочный расчёт Teplo':candidate?'Посмотреть параметры: '+candidate.name:'Заполните исходные данные, чтобы открыть карточку'}
 button.querySelector('.verification-choice-label').textContent=chosen?'Выбрано для поверочного':'Выбрать для поверочного расчёта';
 button.querySelector('path').setAttribute('d',chosen?'M4 10l4 4 8-8':'M4 10h12m-5-5 5 5-5 5');
 button.title=!candidate?'Заполните исходные данные, чтобы выбрать конструкцию':chosen?'Сохранено: '+candidate.name:'Сохранить для поверочного расчёта: '+candidate.name;
}
function chooseVerificationDesign(){
 const candidate=verificationCandidate();if(!candidate)return;
 verificationSelection=candidate;save();syncVerificationChoice();
 toast('Для поверочного расчёта выбрано: '+candidate.name);
}

function coilShellCalculationItems(){
 const s=currentVariants?.shellCalculation;if(!s)return [];
 return [['Формула стенки · предварительно',s.formula,''],['Межтрубное рабочее абсолютное давление',s.absoluteMPa,'МПа'],['Вычитаемая атмосфера',s.atmosphereMPa,'МПа'],['Избыточное давление для стенки',s.gaugeMPa,'МПа'],['Допускаемое напряжение [σ]',s.allowableMPa,'МПа'],['Коэффициент шва φ',s.weldFactor,''],['Прибавка c',s.corrosionMM,'мм'],['Стенка до округления',s.rawMM,'мм'],['Стенка после округления вверх',s.wallMM,'мм'],['Внутренний диаметр подбора',s.innerMM,'мм'],['Ограничение','Упрощённая оценка по заданной формуле; не полный расчёт прочности, устойчивости, днищ и штуцеров. Вакуум не проверяется.','']];
}
function variantExportRows(state=getState()){
 if(state['exchanger-type']==='coil'&&currentResult?.method==='Teplo'){
  const rows=[[],['Подбор змеевиков по Teplo'],['Вариант','Высота, мм','Диаметр, мм','F по среднему диаметру, м²','Змеевиков','Труба, мм','Q факт., кВт','K факт., Вт/(м²·К)','UA факт., Вт/К','Горячий выход, °C','Холодный выход, °C','Критерии Teplo','Задание и запас UA']];
  for(const {name,design:c}of currentVariants?.rows||[])rows.push([name,c.length*1000,c.diameter*1000,c.area,c.n,c.dmm+' × '+c.wmm,c.thermal.heat_duty_kw,c.thermal.overall_u_w_m2k,c.thermal.ua_w_k,c.thermal.t_hot_out_c,c.thermal.t_cold_out_c,c.thermal.valid?'Выполнены':'НЕ выполнены',CoilProjectMethod.meets(c.thermal,currentResult)?'Выполнены':'НЕ выполнены']);
  rows.push(...coilShellCalculationItems(),['Границы','Фиксированные D/H; труба 14×2,5 по умолчанию; 1–8 рядов снаружи внутрь по одному змеевику; целые витки на всю высоту, до 1000. Зазоры 3 мм. Первая достаточная конструкция, не глобальный оптимум. Критерий 3 < R/dᵢ < 12 временно исключён; полная применимость Teplo не подтверждена. Стенка по упрощённой формуле, не полный расчёт прочности. Δp отсутствует.']);return rows;
 }
 if(state['exchanger-type']==='coil')return [[],['Подбор Teplo'],['Подбор недоступен',currentVariants?.message||'Дождитесь завершения расчёта Teplo.']];
 if(state['exchanger-type']!=='shell')return [[],['Варианты конструкции'],['Подбор недоступен',currentVariants?.message||'Дискретный подбор пока реализован только для кожухотрубного аппарата.']];
 const rows=[[],['Предварительный дискретный подбор: вода / вода'],['Вариант','Длина, мм','Внешний диаметр, мм','Поверхность, м²','Труб, шт.','Труба d × δ, мм','Перепад трубное, кПа','Перепад межтрубное, кПа','Скорость в трубах, м/с','Перегородок, шт.','Активная длина труб, мм','Шаг перегородок, мм','Прокачка, Вт']];
 for(const {name,design:c}of currentVariants?.rows||[])rows.push([name,c.length*1000,c.diameter*1000,c.area,c.n,`${c.dmm} × ${c.wmm}`,c.dpt/1000,c.dps/1000,c.vt,c.nb,c.lt*1000,c.b*1000,c.pumping]);
 if(!currentVariants?.rows.length)rows.push(['Подбор недоступен',currentVariants?.message||'']);
 rows.push(['Методика','Одноходовой гладкотрубный аппарат; K постоянный; треугольный шаг 1,25d; гидравлика Керна; стенка корпуса 5 мм; радиальный зазор 10 мм; активная длина 90% L; без патрубков, утечек и фазовых переходов. Минимумы только среди перебранных кандидатов.']);return rows;
}
function exportCoilProject(){
 if(currentResult?.method!=='Teplo'||coilProject.phase!=='ready'){toast('Дождитесь завершения расчёта Teplo');return}
 const r=currentResult,rows=[['PhysNow — проектировочный расчёт Teplo / CoolProp'],['Параметр','Значение','Единица'],['Схема','Противоток; горячая среда внутри змеевиков',''],['Горячий вход',r.thi,'°C'],['Горячий выход · задание',r.tho,'°C'],['Холодный вход',r.tci,'°C'],['Холодный выход · задание',r.tco,'°C'],['Расход внутри змеевиков',r.mh,'кг/с'],['Расход межтрубного потока',r.mc,'кг/с'],['Трубная cp при средней температуре',r.cph,'кДж/(кг·К)'],['Межтрубная cp при средней температуре',r.cpc,'кДж/(кг·К)'],['Невязка баланса',r.heatBalanceError,'Вт'],['Q задания',r.q,'кВт'],['UA задания',r.requiredUA,'Вт/К'],['Запас UA',r.reservePercent,'%'],['Теплопроводность стенки',Number($('tube-conductivity').value),'Вт/(м·К)'],['Материал',materialNames[$('tube-material').value],''],['Геометрия в проработке',coilVariantBinding?.manual?'Изменена вручную; результаты вариантов не подтверждают ручную геометрию':selectedVariant,''],...variantExportRows()];
 if(!currentVariants?.rows.length)rows.push(['Подбор',currentVariants?.message||'Нет подходящих конструкций','']);
 const csv='\ufeff'+rows.map(row=>row.map(value=>'"'+String(typeof value==='number'?fmt(value,9):value).replaceAll('"','""')+'"').join(';')).join('\r\n'),url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='physnow-teplo-project.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}


for(const id of [...thermalIds,...geometryIds])$(id).addEventListener('input',()=>{if(id==='cph')$('hot-fluid').value='custom';if(id==='cpc')$('cold-fluid').value='custom';update()});
for(const side of ['hot','cold']){$(side+'-fluid').addEventListener('change',()=>changeFlowFluid(side));$(side+'-flow-unit').addEventListener('change',()=>changeFlowUnit(side))}
$('exchanger-type').addEventListener('change',()=>{if($('exchanger-type').value!=='double'&&$('tube-count').readOnly)$('tube-count').value=80;if($('exchanger-type').value==='coil'){coilVariantBinding=null;selectedVariant='balanced'}syncControls();update()});
$('tube-material').addEventListener('change',()=>{syncDropdowns();update()});
$('tube-conductivity').addEventListener('input',()=>update());
for(const id of ['detail-parameter-mode','detail-preview-mode'])$(id).addEventListener('change',()=>{syncDropdowns();syncDesignGeometryVisibility();syncDesignLayoutVisibility();save()});
for(const b of document.querySelectorAll('[data-flow]'))b.addEventListener('click',()=>{flow=b.dataset.flow;syncControls(true);update()});
$('reset').addEventListener('click',()=>{applyState({...defaults,thi:'',tho:'',tci:'',tco:'',mh:'',ph:'',pc:''});save();$('thi').focus();toast('Параметры потоков очищены')});
$('close-help').addEventListener('click',()=>$('help-dialog').close());$('help-dialog').addEventListener('click',e=>{if(e.target===$('help-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
$('export').addEventListener('click',()=>{if($('exchanger-type').value==='coil'){exportCoilProject();return}update();if(lastError||!currentResult||!currentGeometry){validateAllNumericFields();toast('Для экспорта исправьте исходные данные');return}const r=currentResult,g=currentGeometry,s=getState();const rows=[['PhysNow — предварительный расчёт'],['Параметр','Значение','Единица'],['Тип аппарата',typeNames[s['exchanger-type']],''],['Неизвестный параметр',unknownParameter?findParameterName(unknownParameter):'Все параметры заданы',''],['Схема',flow==='counter'?'Противоток':'Прямоток',''],['Предельная длина теплообменника',g.length,'мм'],['Предельный внешний диаметр теплообменника',g['exchanger-diameter'],'мм'],['Коэффициент запаса по площади',r.reservePercent,'%'],['Материал труб',materialNames[$('tube-material').value],''],['Наружный диаметр трубы',g['tube-diameter'],'мм'],['Толщина стенки',g['tube-wall'],'мм'],['Межтрубное пространство',$('hot-fluid').selectedOptions[0].textContent,''],['Трубное пространство',$('cold-fluid').selectedOptions[0].textContent,''],['Температура на входе межтрубного пространства',r.thi,'°C'],['Температура на выходе межтрубного пространства',r.tho,'°C'],['Температура на входе трубного пространства',r.tci,'°C'],['Температура на выходе трубного пространства',r.tco,'°C'],['Абсолютное давление на входе межтрубного пространства',r.ph,'МПа'],['Абсолютное давление на входе трубного пространства',r.pc,'МПа'],['Массовый расход в межтрубном пространстве',r.mh,'кг/с'],['Массовый расход в трубном пространстве',r.mc,'кг/с'],['Расход на входе межтрубного пространства',Number(s.mh),flowUnitName(s['hot-flow-unit'])],['Расход на входе трубного пространства',massToFlow(r.mc,s['cold-flow-unit'],s.tci,s['cold-fluid']),flowUnitName(s['cold-flow-unit'])],['Теплоёмкость теплоносителя межтрубного пространства',r.cph,'кДж/(кг·К)'],['Теплоёмкость теплоносителя трубного пространства',r.cpc,'кДж/(кг·К)'],['Коэффициент теплопередачи',r.u,'Вт/(м²·К)'],['Тепловая нагрузка',r.q,'кВт'],['Температурный напор',r.dt,'К'],['Расчётная площадь без запаса',r.area,'м²'],['Требуемая площадь с запасом',r.designArea,'м²'],['Допущения','Постоянные cₚ и K, без фазового перехода и теплопотерь. Габариты и материал не определяют K автоматически. Гидравлика и геометрия вариантов — в таблице ниже.','']];rows.push(...variantExportRows());const csv='\uFEFF'+rows.map(row=>row.map(x=>'"'+String(typeof x==='number'?fmt(x,6):x).replaceAll('"','""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='physnow-calculation.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Параметры аппарата и результаты экспортированы в CSV')});
// Selected narrow comparison, option 1: original coil, 150 x 258 shell,
// 16-wide side nozzles, and 50% wider winding. Visual only, not thermal geometry.
function coilProcessLayout(cx,cy,scale,left=0,right=left){
 const l=98-196*left,r=-98+196*right;
 const shell=`M-67 -129H67Q75 -129 75 -121V${r-8}H87V${r+8}H75V121Q75 129 67 129H-67Q-75 129 -75 121V${l+8}H-87V${l-8}H-75V-121Q-75 -129 -67 -129Z`;
 return {shell,transform:`translate(${cx} ${cy}) scale(${scale})`,coilTransform:`translate(${cx} ${cy}) rotate(90) scale(${scale*222/184} ${scale*1.35})`,leads:`M${cx} ${cy-129*scale}V${cy-111*scale}M${cx} ${cy+111*scale}V${cy+129*scale}`,ports:[[cx+87*scale,cy+r*scale],[cx,cy+129*scale],[cx,cy-129*scale],[cx-87*scale,cy+l*scale]]};
}
const processNozzleMotion=ProcessNozzleMotion.create();
document.addEventListener('visibilitychange',()=>{if(document.hidden)processNozzleMotion.finish()});
matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',event=>{if(event.matches)processNozzleMotion.finish()});
function fitDiagram(){
 const box=document.querySelector('.diagram').getBoundingClientRect(),svg=document.querySelector('.process-svg');
 const w=box.width,h=box.height;if(w<=0||h<=0)return;
 const standalone=innerWidth<=560,cx=w/2,cy=standalone?h*.48:h*.5,r=Math.min(68,w*.28,h*.22);
 const inletAnchor=$('hot-in').getBoundingClientRect().top+$('hot-in').offsetHeight/2-box.top;
 const top=standalone?48:Math.min(inletAnchor,Math.max(24,cy-r-12-76));
 const bottom=standalone?h-53:$('hot-out').getBoundingClientRect().top+$('hot-out').offsetHeight/2-box.top;
 svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
 const set=(e,attrs)=>{for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v))};
 set(svg.querySelector('rect'),{width:w,height:h});
 const pipes=svg.querySelectorAll('.pipe');
 const shellRadius=r+6,hotIn=cy-shellRadius-12,hotOut=cy+shellRadius+6,coldIn=cx+shellRadius+12,coldOut=cx-shellRadius-6;
 // Control-point ratios come from reference variant 3 (1340 x 676 canvas).
 const coldInSpan=w-coldIn,coldOutSpan=coldOut-6,hotOutSpan=w-6-cx;
 set(pipes[0],{d:`M0 ${top}C${cx*140/250} ${top} ${cx} ${top+(hotIn-top)*7/104} ${cx} ${hotIn}`});
 set(pipes[1],{d:`M${w} ${top}C${w-coldInSpan*120/152} ${top} ${w-coldInSpan*60/152} ${cy} ${coldIn} ${cy}`});
 set(pipes[2],{d:`M${coldOut} ${cy}C${coldOut-coldOutSpan*92/148} ${cy} ${coldOut-coldOutSpan*32/148} ${bottom} 6 ${bottom}`});
 set(pipes[3],{d:`M${cx} ${hotOut}C${cx} ${hotOut+(bottom-hotOut)*107/128} ${cx+hotOutSpan*100/246} ${bottom} ${w-6} ${bottom}`});
 const verticalCoil=$('exchanger-type').value==='coil';
 let ports;
 if(verticalCoil){
  const drawCoil=(left,right)=>{
  const layout=coilProcessLayout(cx,cy,Math.min(1,2*shellRadius/222),left,right),[sideIn,tubeOut,tubeIn,sideOut]=layout.ports;
  for(const cls of ['.exchanger-shell','.exchanger-fluid'])set(svg.querySelector(cls),{d:layout.shell,transform:layout.transform});
  set(svg.querySelector('.exchanger-coil'),{transform:layout.coilTransform});set(svg.querySelector('.exchanger-coil-leads'),{d:layout.leads});
  const inletY=tubeIn[1]-6,outletY=tubeOut[1]+6,inletX=sideIn[0]+6,outletX=sideOut[0]-6;
  set(pipes[0],{d:`M0 ${top}C${cx*.56} ${top} ${cx} ${top+(inletY-top)*.07} ${cx} ${inletY}`});
  set(pipes[1],{d:`M${w} ${top}C${inletX+(w-inletX)*.4} ${top} ${inletX+(w-inletX)*.4} ${sideIn[1]} ${inletX} ${sideIn[1]}`});
  set(pipes[2],{d:`M${outletX} ${sideOut[1]}C${outletX*.62} ${sideOut[1]} ${outletX*.62} ${bottom} 6 ${bottom}`});
  set(pipes[3],{d:`M${cx} ${outletY}C${cx} ${outletY+(bottom-outletY)*.84} ${cx+(w-6-cx)*.41} ${bottom} ${w-6} ${bottom}`});
  const joints=svg.querySelectorAll('.exchanger-ports circle');layout.ports.forEach(([x,y],i)=>set(joints[i],{cx:x,cy:y}));
  };
  processNozzleMotion.setDraw(drawCoil);processNozzleMotion.update(flow==='counter');
 }else{
  processNozzleMotion.reset();
  const circle=`M${-shellRadius} 0a${shellRadius} ${shellRadius} 0 1 0 ${2*shellRadius} 0a${shellRadius} ${shellRadius} 0 1 0 ${-2*shellRadius} 0`;
  for(const cls of ['.exchanger-shell','.exchanger-fluid'])set(svg.querySelector(cls),{d:circle,transform:`translate(${cx} ${cy})`});
  set(svg.querySelector('.exchanger-coil'),{transform:`translate(${cx} ${cy}) scale(${shellRadius/92})`});set(svg.querySelector('.exchanger-coil-leads'),{d:''});
  ports=[[cx,cy-shellRadius],[cx+shellRadius,cy],[cx-shellRadius,cy],[cx,cy+shellRadius]];
 }
 if(ports){const joints=svg.querySelectorAll('.exchanger-ports circle');ports.forEach(([x,y],i)=>set(joints[i],{cx:x,cy:y}))}
 const temps=svg.querySelectorAll('.svg-temp text');
 [[w*.29,top-12],[w*.71,top-12],[w*.29,bottom+18],[w*.71,bottom+18]].forEach(([x,y],i)=>set(temps[i],{x,y,'text-anchor':'middle'}));

}
new ResizeObserver(fitDiagram).observe(document.querySelector('.process'));

function moveFlowPill(animate=false){
 const root=document.querySelector('.t-tabs'),pill=root?.querySelector('.t-tabs-pill'),active=root?.querySelector('[aria-selected="true"]');
 if(!pill||!active||!active.offsetWidth)return;
 const move=()=>{pill.style.transform='translateX('+active.offsetLeft+'px)';pill.style.width=active.offsetWidth+'px'};
 if(animate){move();return}
 const transition=pill.style.transition;pill.style.transition='none';move();void pill.offsetWidth;pill.style.transition=transition;
}
const flowTabButtons=[...document.querySelectorAll('.t-tab')];
for(const button of flowTabButtons)button.addEventListener('keydown',event=>{
 if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
 event.preventDefault();const index=flowTabButtons.indexOf(button),count=flowTabButtons.length;
 const next=event.key==='Home'?0:event.key==='End'?count-1:(index+(event.key==='ArrowRight'?1:-1)+count)%count;
 flowTabButtons[next].click();flowTabButtons[next].focus();
});
new ResizeObserver(()=>moveFlowPill(false)).observe(document.querySelector('.t-tabs'));
window.addEventListener('resize',()=>moveFlowPill(false));
document.fonts.ready.then(()=>moveFlowPill(false));



const animatedDropdowns=[];
function syncDropdowns(){for(const dropdown of animatedDropdowns)dropdown.sync()}
function createAnimatedDropdown(root){
 const trigger=root.querySelector('.dd-trigger'),label=root.querySelector('.dd-label'),menu=root.querySelector('.dd-menu'),items=[...menu.querySelectorAll('.dd-item')],field=$(root.dataset.dd),wrapper=root.closest('.dropdown-field');
 let labelTimer,closeTimer;
 function ms(name,fallback){if(matchMedia('(prefers-reduced-motion: reduce)').matches)return 0;const raw=getComputedStyle(root).getPropertyValue(name).trim(),n=parseFloat(raw);return Number.isFinite(n)?n*(raw.endsWith('ms')?1:1000):fallback}
 function swap(next,animate){
  clearTimeout(labelTimer);label.classList.remove('is-exit','is-enter-start');if(label.textContent===next)return;
  if(!animate||!ms('--text-swap-dur',150)){label.textContent=next;trigger.style.width='auto';return}
  const from=trigger.getBoundingClientRect().width;trigger.style.width=from+'px';label.classList.add('is-exit');
  labelTimer=setTimeout(()=>{label.textContent=next;const transition=trigger.style.transition;trigger.style.transition='none';trigger.style.width='auto';const to=trigger.getBoundingClientRect().width;trigger.style.width=from+'px';void trigger.offsetWidth;trigger.style.transition=transition;trigger.style.width=to+'px';label.classList.remove('is-exit');label.classList.add('is-enter-start');void label.offsetHeight;label.classList.remove('is-enter-start')},ms('--text-swap-dur',150));
 }
 function sync(){
  const active=items.find(item=>item.dataset.value===field.value)||items[0],value=active.dataset.value;
  for(const item of items)item.setAttribute('aria-selected',String(item===active));
  if(root.dataset.value!==value)swap(active.querySelector('span').textContent,Boolean(root.dataset.value));root.dataset.value=value;
 }
 function position(){
  const bounds=root.closest('.construction,.design-detail-panel').getBoundingClientRect(),anchor=root.getBoundingClientRect();menu.style.maxHeight='';
  const height=menu.offsetHeight,below=Math.min(innerHeight-8,bounds.bottom-8)-anchor.bottom-8,above=anchor.top-Math.max(8,bounds.top+8)-8;
  const upward=below<height&&above>below;menu.dataset.origin=upward?'bottom-left':'top-left';
  if(height>(upward?above:below))menu.style.maxHeight=Math.max(60,upward?above:below)+'px';
 }
 function open(keyboard=false){
  for(const other of animatedDropdowns)if(other.root!==root)other.close();
  clearTimeout(closeTimer);menu.hidden=false;menu.inert=false;menu.classList.remove('is-closing');position();void menu.offsetWidth;menu.classList.add('is-open');trigger.setAttribute('aria-expanded','true');wrapper.classList.add('is-active');
  const selected=items.find(item=>item.getAttribute('aria-selected')==='true')||items[0];for(const item of items)item.tabIndex=item===selected?0:-1;if(keyboard)selected.focus();
 }
 function close(returnFocus=false){
  if(returnFocus)trigger.focus();if(!menu.classList.contains('is-open'))return;
  menu.classList.remove('is-open');menu.classList.add('is-closing');trigger.setAttribute('aria-expanded','false');menu.inert=true;for(const item of items)item.tabIndex=-1;
  clearTimeout(closeTimer);closeTimer=setTimeout(()=>{menu.hidden=true;menu.classList.remove('is-closing');wrapper.classList.remove('is-active')},ms('--dropdown-close-dur',150));
 }
 trigger.addEventListener('click',()=>menu.classList.contains('is-open')?close():open());
 trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)){event.preventDefault();open(true);if(event.key==='Home')items[0].focus();if(event.key==='End')items.at(-1).focus()}});
 for(const item of items){
  item.addEventListener('click',()=>{if(field.value!==item.dataset.value){field.value=item.dataset.value;field.dispatchEvent(new Event('change',{bubbles:true}))}close(true)});
  item.addEventListener('keydown',event=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;event.preventDefault();const index=items.indexOf(item),count=items.length,next=event.key==='Home'?0:event.key==='End'?count-1:(index+(event.key==='ArrowDown'?1:-1)+count)%count;items.forEach((option,i)=>option.tabIndex=i===next?0:-1);items[next].focus()});
 }
 document.addEventListener('pointerdown',event=>{if(!root.contains(event.target))close()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.classList.contains('is-open')){event.preventDefault();close(true)}});
 root.addEventListener('focusout',event=>{if(!root.contains(event.relatedTarget))close()});
 window.addEventListener('resize',()=>{trigger.style.width='auto';if(menu.classList.contains('is-open'))position()});document.fonts.ready.then(()=>{trigger.style.width='auto'});
 root.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse')return;const button=event.target.closest('button');if(!button||button.disabled)return;const start=performance.now();clearTimeout(button._ddPress);button.classList.add('is-pressed');const up=()=>{document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);button._ddPress=setTimeout(()=>button.classList.remove('is-pressed'),Math.max(0,ms('--press-dur',150)-(performance.now()-start)))};document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true)},{passive:true});
 return {root,sync,close};
}
for(const root of document.querySelectorAll('[data-dd]'))animatedDropdowns.push(createAnimatedDropdown(root));

try{const saved=JSON.parse(localStorage.getItem('thermoflow-v2')||localStorage.getItem('thermoflow-v1'));applyState(saved&&typeof saved==='object'?{...defaults,...saved,'tube-conductivity':saved['tube-conductivity']??saved['coil-thermal-inputs']?.wall_conductivity_w_mk??defaults['tube-conductivity']}:defaults)}catch{applyState(defaults)}
fitDiagram();document.fonts.ready.then(fitDiagram);

// Calculation tools reuse the existing storage and CSV export on either page.
$('header-save').addEventListener('click',()=>toast(save()?'Листы расчёта сохранены в этом браузере':'Браузер не разрешил сохранить расчёт'));
$('header-download').addEventListener('click',()=>['verification','construction'].includes(headerNavigation.dataset.activeSection)?exportCoilGeometry():$('export').click());

// Header navigation: switch the selected item and slide its underline.
const headerNavigation=document.querySelector('.cad-navigation');
const headerSections=[...headerNavigation.querySelectorAll('[data-section]')];
function positionHeaderUnderline(animate=true){
 const selected=headerNavigation.querySelector('.is-active');
 if(!selected)return;
 if(!animate)headerNavigation.classList.add('is-measuring');
 headerNavigation.style.setProperty('--nav-line-x',`${selected.offsetLeft}px`);
 headerNavigation.style.setProperty('--nav-line-width',`${selected.offsetWidth}px`);
 headerNavigation.style.setProperty('--nav-line-y',`${headerNavigation.clientHeight-2}px`);
 if(!animate){void headerNavigation.offsetWidth;headerNavigation.classList.remove('is-measuring')}
}
function selectHeaderSection(button){
 for(const item of headerSections){const active=item===button;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active));item.tabIndex=active?0:-1}
 headerNavigation.dataset.activeSection=button.dataset.section;
 positionHeaderUnderline();syncPageView();window.scrollTo({top:0,behavior:'instant'});
 if(calculationSheets)save();
}
for(const button of headerSections){
 button.addEventListener('click',()=>selectHeaderSection(button));
 button.addEventListener('keydown',event=>{
  const current=headerSections.indexOf(button);let next;
  if(event.key==='ArrowRight')next=(current+1)%headerSections.length;
  else if(event.key==='ArrowLeft')next=(current-1+headerSections.length)%headerSections.length;
  else if(event.key==='Home')next=0;
  else if(event.key==='End')next=headerSections.length-1;
  else return;
  event.preventDefault();selectHeaderSection(headerSections[next]);headerSections[next].focus();
 });
}
positionHeaderUnderline(false);
window.addEventListener('resize',()=>positionHeaderUnderline(false));
document.fonts.ready.then(()=>positionHeaderUnderline(false));

// Each document tab owns an independent calculation, including its selected menu item.
const calculationPanel=document.querySelector('main');
calculationPanel.id='calculation-sheet-panel';
calculationPanel.setAttribute('role','tabpanel');
function captureCalculationSheet(){
 const sheet=calculationSheets.sheets.find(item=>item.id===calculationSheets.activeId);
 if(sheet){sheet.state=getState();sheet.section=headerNavigation.querySelector('.is-active').dataset.section}
}
function createCalculationSheet(state){
 const number=calculationSheets.nextNumber++;
 return {id:crypto.randomUUID(),name:`Неопределённый ${number}`,state:{...defaults,...state},section:'design'};
}
function renameCalculationSheet(sheet,tab){
 const input=document.createElement('input');input.type='text';input.className='cad-sheet-name-input';input.id=tab.id;input.value=sheet.name;input.setAttribute('aria-label','Название листа');
 let finished=false;
 const finish=commit=>{
  if(finished)return;finished=true;
  const name=input.value.trim();
  if(commit&&name){sheet.name=name;tab.textContent=name;const close=input.parentElement?.querySelector('.cad-document-close');if(close){close.title='Закрыть '+name;close.setAttribute('aria-label',close.title)}save()}
  if(input.isConnected)input.replaceWith(tab);
 };
 input.addEventListener('blur',()=>finish(true));
 input.addEventListener('keydown',event=>{
  event.stopPropagation();if(event.isComposing)return;
  if(event.key==='Enter'){event.preventDefault();finish(true)}
  else if(event.key==='Escape'){event.preventDefault();finish(false)}
 });
 tab.replaceWith(input);input.focus();input.select();
}
function renderCalculationSheets(){
 const list=$('calculation-sheets');list.parentElement.style.setProperty('--sheet-count',calculationSheets.sheets.length);list.replaceChildren();
 for(const sheet of calculationSheets.sheets){
  const active=sheet.id===calculationSheets.activeId;
  const wrapper=document.createElement('div');wrapper.className='cad-document'+(active?' is-selected':'');
  const tab=document.createElement('button');tab.type='button';tab.className='cad-sheet-tab';tab.id='sheet-'+sheet.id;
  tab.textContent=sheet.name;tab.setAttribute('role','tab');tab.setAttribute('aria-selected',String(active));tab.setAttribute('aria-controls','calculation-sheet-panel');tab.tabIndex=active?0:-1;
  tab.addEventListener('click',()=>activateCalculationSheet(sheet.id));
  tab.addEventListener('dblclick',event=>{event.preventDefault();renameCalculationSheet(sheet,tab)});
  tab.addEventListener('keydown',event=>{
   const index=calculationSheets.sheets.findIndex(item=>item.id===sheet.id),count=calculationSheets.sheets.length;let next;
   if(event.key==='ArrowRight')next=(index+1)%count;else if(event.key==='ArrowLeft')next=(index-1+count)%count;
   else if(event.key==='Home')next=0;else if(event.key==='End')next=count-1;
   else if(event.key==='Delete'){event.preventDefault();closeCalculationSheet(sheet.id);return}else return;
   event.preventDefault();activateCalculationSheet(calculationSheets.sheets[next].id,true);
  });
  const close=document.createElement('button');close.type='button';close.className='cad-document-close';close.title=`Закрыть ${sheet.name}`;close.setAttribute('aria-label',`Закрыть ${sheet.name}`);
  close.innerHTML='<svg aria-hidden="true" class="cad-icon"><use href="#icon-times"></use></svg>';
  close.addEventListener('click',()=>closeCalculationSheet(sheet.id));wrapper.append(tab,close);list.append(wrapper);
  if(active)calculationPanel.setAttribute('aria-labelledby',tab.id);
 }
 positionHeaderUnderline(false);
}
function loadCalculationSheet(focus=false,renderTabs=true){
 const sheet=calculationSheets.sheets.find(item=>item.id===calculationSheets.activeId);
 for(const dropdown of animatedDropdowns)dropdown.close();
 applyState(sheet.state);
 for(const item of headerSections){const active=item.dataset.section===sheet.section;item.classList.toggle('is-active',active);item.setAttribute('aria-pressed',String(active));item.tabIndex=active?0:-1}
 headerNavigation.dataset.activeSection=sheet.section;syncPageView();
 if(renderTabs)renderCalculationSheets();
 else{
  for(const tab of $('calculation-sheets').querySelectorAll('.cad-sheet-tab')){const active=tab.id==='sheet-'+sheet.id;tab.parentElement.classList.toggle('is-selected',active);tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1}
  calculationPanel.setAttribute('aria-labelledby','sheet-'+sheet.id);
 }
 fitDiagram();save();
 const activeTab=$('sheet-'+sheet.id);activeTab.scrollIntoView({block:'nearest',inline:'nearest'});if(focus)activeTab.focus();
}
function activateCalculationSheet(id,focus=false){
 if(!calculationSheets.sheets.some(item=>item.id===id))return;
 if(calculationSheets.activeId===id){if(focus)$('sheet-'+id).focus();return}
 captureCalculationSheet();calculationSheets.activeId=id;loadCalculationSheet(focus,false);
}
function addCalculationSheet(){
 captureCalculationSheet();
 const sheet=createCalculationSheet({thi:'',tho:'',tci:'',tco:'',mh:'',ph:'',pc:''});
 calculationSheets.sheets.push(sheet);calculationSheets.activeId=sheet.id;loadCalculationSheet(true);
}
function loadCalculationExample(){
 applyState({...getState(),...defaults,'selected-variant':'balanced','verification-state':null,'coil-variant-binding':null});
 selectHeaderSection(headerSections.find(button=>button.dataset.section==='design'));
 toast('Данные примера загружены в текущий расчёт');
}
function closeCalculationSheet(id){
 captureCalculationSheet();const index=calculationSheets.sheets.findIndex(item=>item.id===id);if(index<0)return;
 const [closed]=calculationSheets.sheets.splice(index,1);calculationSheets.closed.push({sheet:closed,index});
 if(!calculationSheets.sheets.length)calculationSheets.sheets.push(createCalculationSheet({thi:'',tho:'',tci:'',tco:'',mh:'',ph:'',pc:''}));
 if(calculationSheets.activeId===id)calculationSheets.activeId=calculationSheets.sheets[Math.min(index,calculationSheets.sheets.length-1)].id;
 loadCalculationSheet(true);toast('Лист закрыт · Ctrl+Shift+T — восстановить');
}
function restoreCalculationSheet(){
 const closed=calculationSheets.closed.pop();if(!closed)return;
 captureCalculationSheet();calculationSheets.sheets.splice(Math.min(closed.index,calculationSheets.sheets.length),0,closed.sheet);
 calculationSheets.activeId=closed.sheet.id;loadCalculationSheet(true);toast('Закрытый лист восстановлен');
}
function initializeCalculationSheets(){
 try{
  const stored=JSON.parse(localStorage.getItem('physnow-sheets-v1'));
  if(stored?.version===1&&Array.isArray(stored.sheets)&&stored.sheets.length&&stored.sheets.every(sheet=>typeof sheet.id==='string'&&typeof sheet.name==='string'&&sheet.state&&typeof sheet.state==='object')){
   calculationSheets={...stored,nextNumber:Number.isInteger(stored.nextNumber)?stored.nextNumber:stored.sheets.length+1,closed:Array.isArray(stored.closed)?stored.closed:[]};
   for(const sheet of calculationSheets.sheets)if(!headerSections.some(item=>item.dataset.section===sheet.section))sheet.section='design';
   if(!stored.sheets.some(sheet=>sheet.id===stored.activeId))calculationSheets.activeId=stored.sheets[0].id;
  }
 }catch{}
 if(!calculationSheets){calculationSheets={version:1,sheets:[],activeId:null,nextNumber:1,closed:[]};const first=createCalculationSheet(getState());calculationSheets.sheets.push(first);calculationSheets.activeId=first.id}
 loadCalculationSheet();
}
$('new-calculation-sheet').addEventListener('click',addCalculationSheet);
$('header-example').addEventListener('click',loadCalculationExample);
document.addEventListener('keydown',event=>{if((event.ctrlKey||event.metaKey)&&event.shiftKey&&event.code==='KeyT'&&calculationSheets.closed.length){event.preventDefault();restoreCalculationSheet()}});
initializeCalculationSheets();
// Adapted from the supplied Transitions.dev error-state shake, without message labels.
function numericFieldErrors(state){
 const unknown=state.unknown===null?null:['thi','tho','tci','tco','mh','mc'].includes(state.unknown)?state.unknown:'mc';
 const errors={},numbers={};
 for(const id of [...thermalIds,...geometryIds]){
  if(id===unknown)continue;
  if(state[id]===''||state[id]==null||!Number.isFinite(Number(state[id]))){errors[id]='Введите число';continue}
  const value=Number(state[id]);numbers[id]=value;
  if(['thi','tho','tci','tco'].includes(id)){
   if(value<=-273.15)errors[id]='Температура должна быть выше −273,15 °C';
  }else if(id==='area-reserve-percent'){
   if(value<0)errors[id]='Коэффициент запаса не может быть отрицательным';
  }else if(value<=0)errors[id]='Значение должно быть больше нуля';
 }
 if(Number.isFinite(numbers['tube-count'])&&!Number.isInteger(numbers['tube-count']))errors['tube-count']='Введите целое количество труб';
 const pair=(left,right,invalid,message)=>{if(!errors[left]&&!errors[right]&&Number.isFinite(numbers[left])&&Number.isFinite(numbers[right])&&invalid(numbers[left],numbers[right])){errors[left]=message;errors[right]=message}};
 pair('tube-wall','tube-diameter',(wall,diameter)=>2*wall>=diameter,'Толщина стенки должна быть меньше половины наружного диаметра');
 pair('thi','tho',(inlet,outlet)=>inlet<=outlet,'Температура горячего потока на входе должна быть выше выходной');
 pair('tco','tci',(outlet,inlet)=>outlet<=inlet,'Температура холодного потока на выходе должна быть выше входной');
 const ends=state.flow==='parallel'?[['thi','tci'],['tho','tco']]:[['thi','tco'],['tho','tci']];
 for(const [hot,cold]of ends)pair(hot,cold,(a,b)=>a<=b,'Температурный напор на этом конце должен быть положительным');
 return errors;
}
function clearFieldFeedback(info){
 info.border.classList.remove('is-error','is-shaking');
 info.input.removeAttribute('aria-invalid');
 if(info.describedBy==null)info.input.removeAttribute('aria-describedby');else info.input.setAttribute('aria-describedby',info.describedBy);
 if(info.note){info.note.hidden=true;info.note.textContent=''}
 if(info.title==null)info.input.removeAttribute('title');else info.input.title=info.title;
 if(info.description==null)info.input.removeAttribute('aria-description');else info.input.setAttribute('aria-description',info.description);
}
function resetFieldFeedback(){
 if(!fieldFeedbackReady)return;
 touchedNumericFields.clear();submittedNumericFields=false;
 for(const info of fieldFeedback.values())clearFieldFeedback(info);
}
function refreshFieldFeedback(shakeIds=[]){
 if(!fieldFeedbackReady)return;
 const state=getState(),errors={...numericFieldErrors(state),...flowUnitErrors(state)};
 for(const [id,info]of fieldFeedback){
  const calculationError=calculationIssue?.fields.includes(id)?calculationIssue.message:'';
  const error=calculationError||errors[id]||(info.input.validity.badInput?'Введите число':'');
  const reveal=!!calculationError||(submittedNumericFields||touchedNumericFields.has(id))&&!info.input.readOnly;
  if(!error||!reveal){clearFieldFeedback(info);continue}
  info.border.classList.add('is-error');info.input.setAttribute('aria-invalid','true');
  // A failed solved/read-only field needs an immediate visible explanation too.
  info.input.title=error;info.input.setAttribute('aria-description',error);
  if(calculationError){
   info.input.setAttribute('aria-describedby',[info.describedBy,info.note?.id].filter(Boolean).join(' '));
   if(info.note){info.note.hidden=false;info.note.textContent='Проверьте значение'}
  }else{if(info.describedBy==null)info.input.removeAttribute('aria-describedby');else info.input.setAttribute('aria-describedby',info.describedBy);if(info.note){info.note.hidden=true;info.note.textContent=''}}
  if(shakeIds.includes(id)){
   info.border.classList.remove('is-shaking');void info.border.offsetWidth;info.border.classList.add('is-shaking');
  }
 }
}
function validateAllNumericFields(){submittedNumericFields=true;refreshFieldFeedback([...fieldFeedback.keys()])}
function initializeFieldFeedback(){
 for(const id of [...thermalIds,...geometryIds]){
  const input=$(id);if(input.type==='hidden')continue;
  const border=input.closest('.input-wrap')||input;
  border.classList.add('t-input');
  let note=null;if(input.closest('.find-field')){note=document.createElement('p');note.id='calculation-field-'+id;note.className='calculation-field-error';note.hidden=true;input.closest('.find-field').append(note)}
  fieldFeedback.set(id,{input,border,note,title:input.getAttribute('title'),description:input.getAttribute('aria-description'),describedBy:input.getAttribute('aria-describedby')});
  input.addEventListener('blur',()=>{touchedNumericFields.add(id);refreshFieldFeedback([id])});
  border.addEventListener('animationend',event=>{if(event.animationName==='t-input-shake')border.classList.remove('is-shaking')});
 }
 fieldFeedbackReady=true;
 refreshFieldFeedback();
}
initializeFieldFeedback();


// Enter finishes editing and runs the same validation as leaving a field normally.
document.querySelector('main').addEventListener('keydown',event=>{
 if(event.key!=='Enter'||event.isComposing||!(event.target instanceof HTMLInputElement)||event.target.type==='hidden')return;
 event.preventDefault();event.target.blur();
});

function syncTubeRefinement(){
 const checkbox=$('refine-tubes');
 const checked=checkbox.getAttribute('aria-checked')==='true';
 $('tube-fields').hidden=!checked;
 checkbox.setAttribute('aria-expanded',String(checked));
 $('tube-refinement-box').setAttribute('aria-checked',String(checked));
}
$('refine-tubes').addEventListener('click',()=>{
 const checkbox=$('refine-tubes');
 checkbox.setAttribute('aria-checked',String(checkbox.getAttribute('aria-checked')!=='true'));
 syncTubeRefinement();update();
});
const tubeCheckPath=$('tube-refinement-box').querySelector('path');
$('tube-refinement-box').style.setProperty('--check-len',Math.ceil(tubeCheckPath.getTotalLength())+1);
$('refine-tubes').addEventListener('pointerdown',event=>{
 if(event.pointerType==='mouse')return;
 const row=event.currentTarget,start=performance.now();clearTimeout(row._tubePress);row.classList.add('is-pressed');
 const up=()=>{document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);row._tubePress=setTimeout(()=>row.classList.remove('is-pressed'),Math.max(0,150-(performance.now()-start)))};
 document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
},{passive:true});



for(const button of document.querySelectorAll('[data-find-param]'))button.addEventListener('click',()=>selectUnknownParameter(button.dataset.findParam));

$('choose-verification').addEventListener('click',chooseVerificationDesign);

// Coil card follows the current editor + matching Teplo result, not an old candidate.
let exchangerCardSections=[],exchangerCardCategory='all',exchangerCardKind=null;
function exchangerCardData(candidate,r){
 const c=candidate.design,s=candidate.inputs;
 if(c.kind==='coil')return coilExchangerCardData(candidate,r);
 const value=(label,n,unit='',digits=2)=>[label,typeof n==='number'?fmt(n,digits):n,unit];
 return [
  {id:'construction',title:'Конструкция',items:[
   value('Тип теплообменника',typeNames[s['exchanger-type']]),
   value('Материал труб',materialNames[s['tube-material']]),
   value('Схема движения',s.flow==='counter'?'Противоток':'Прямоток'),
   value('Длина аппарата L',c.length*1000,'мм',0),
   value('Внешний диаметр D',c.diameter*1000,'мм',0),
   value('Площадь теплообмена F',c.area,'м²'),
   value('Количество труб',c.n,'шт.',0),
   value('Типоразмер труб d × δ',fmt(c.dmm)+' × '+fmt(c.wmm),'мм'),
   value('Активная длина труб',c.lt*1000,'мм',0),
   ...(s['exchanger-type']==='shell'?[value('Количество перегородок',c.nb,'шт.',0),value('Шаг перегородок',c.b*1000,'мм',1)]:[])
  ]},
  {id:'thermal',title:'Тепловые параметры',items:[
   value('Теплоноситель межтрубного пространства','Вода'),
   value('Теплоноситель трубного пространства','Вода'),
   value('Тепловая нагрузка Q',r.q,'кВт'),
   value('Температурный напор ΔTₗₘ',r.dt,'К'),
   value('Расчётная площадь без запаса',r.area,'м²'),
   value('Коэффициент запаса по площади',r.reservePercent,'%'),
   value('Требуемая площадь с запасом',r.designArea,'м²'),
   value('Превышение подобранной площади',(c.area/r.designArea-1)*100,'%'),
   value('Коэффициент теплопередачи K',r.u,'Вт/(м²·К)',0),
   value('Температура на входе · межтрубное',r.thi,'°C'),
   value('Температура на выходе · межтрубное',r.tho,'°C'),
   value('Температура на входе · трубное',r.tci,'°C'),
   value('Температура на выходе · трубное',r.tco,'°C'),
   value('Расход · межтрубное',massToFlow(r.mh,s['hot-flow-unit'],r.thi,s['hot-fluid']),flowUnitName(s['hot-flow-unit']),3),
   value('Расход · трубное',massToFlow(r.mc,s['cold-flow-unit'],r.tci,s['cold-fluid']),flowUnitName(s['cold-flow-unit']),3)
  ]},
  {id:'hydraulics',title:'Гидравлика',items:[
   value('Перепад давления · трубное',c.dpt/1000,'кПа',3),
   value('Перепад давления · межтрубное',c.dps/1000,'кПа',3),
   value('Скорость в трубах',c.vt,'м/с',3),
   value('Скорость в межтрубном пространстве',c.vs,'м/с',3),
   value('Давление на входе · трубное, абс.',r.pc,'МПа',3),
   value('Давление на входе · межтрубное, абс.',r.ph,'МПа',3),
   value('Число Рейнольдса · трубное',c.ret,'',0),
   value('Число Рейнольдса · межтрубное',c.res,'',0),
   value('Мощность на прокачку',c.pumping,'Вт',3)
  ]}
 ];
}
function coilExchangerCardData(candidate,r){
 const g=calculateCoilGeometry(verificationState||candidate.design.geometry),s=candidate.inputs,value=(label,n,unit='',digits=6)=>[label,typeof n==='number'?fmt(n,digits):n,unit],snapshot=coilThermalUI?.snapshot;
 const groups=[{id:'construction',title:'Текущая змеевиковая конструкция',items:[value('Тип теплообменника','Змеевиковый с вытеснительной трубой'),value('Источник геометрии',coilVariantBinding?.manual?'Ручная геометрия текущего листа · требует собственной поверки':'Выбранная конструкция текущего листа'),value('Материал труб в проектном задании',materialNames[s['tube-material']]),value('Рабочая высота корпуса',g.height,'мм'),value('Внешний диаметр корпуса',g.diameter,'мм'),value('Стенка корпуса',g.shellWall,'мм'),value('Диаметр вытеснительной трубы',g.coreDiameter,'мм'),value('Длина вытеснительной трубы',g.coreLength,'мм'),value('Стенка вытеснительной трубы',g.coreWall,'мм'),value('Радиус отвода по оси',g.leadBendRadius,'мм'),value('Прямой участок после отвода',g.leadStraightLength,'мм'),value('Минимальный зазор между навивками',g.clearance,'мм'),value('Минимальный зазор до вытеснителя',g.coreClearance,'мм'),value('Минимальный зазор до корпуса',g.shellClearance,'мм'),value('Минимальный зазор между рядами',g.rowClearance,'мм'),value('Рядов',g.rows.length,'',0),value('Змеевиков всего',g.totalCount,'шт.',0),value('Наружный диаметр трубки',g.tubeDiameter,'мм'),value('Стенка трубки',g.tubeWall,'мм'),value('Внутренний диаметр трубки',g.tubeInside,'мм'),value('Длина навивки всего',g.totalLength,'м'),value('Наружная поверхность навивки без отводов',g.totalArea,'м²'),value('Внутренний объём труб',g.tubeVolume,'м³',9),value('Свободный объём корпуса',g.shellVolume,'м³',9),value('Объём металла труб',g.metalVolume,'м³',9),...g.rows.flatMap((row,i)=>[value('Ряд '+(i+1)+' · диаметр навивки',row.diameter,'мм'),value('Ряд '+(i+1)+' · змеевиков',row.count,'шт.',0),value('Ряд '+(i+1)+' · витков на змеевик',row.turns),value('Ряд '+(i+1)+' · шаг',row.pitch,'мм'),value('Ряд '+(i+1)+' · смещение по высоте',row.offset,'мм'),value('Ряд '+(i+1)+' · начальный угол 3D',row.phase,'°'),value('Ряд '+(i+1)+' · направление 3D',row.direction==='left'?'Левое':'Правое'),value('Ряд '+(i+1)+' · длина одного змеевика',row.coilLength,'м')])]},
 {id:'thermal',title:'Teplo · состояние расчёта',items:[value('Состояние поверочного расчёта',snapshot?.message||'Расчёт запускается…'),value('Проектное задание и поверка','Баланс и входные потоки — CoolProp; K, UA и выходы конструкции — Teplo. Заданные выходы сверху остаются проектным заданием.')]}];
 if(r?.method==='Teplo')groups.push({id:'thermal',title:'Проектное задание · баланс Teplo / CoolProp',items:[value('Заданная тепловая нагрузка Q',r.q,'кВт'),value('Температурный напор задания',r.dt,'К'),value('Требуемая проводимость UA без запаса',r.requiredUA,'Вт/К'),value('Запас по UA',r.reservePercent,'%'),value('Требуемая проводимость UA с запасом',r.requiredUA*(1+r.reservePercent/100),'Вт/К'),value('Трубная cp при средней температуре',r.cph,'кДж/(кг·К)'),value('Межтрубная cp при средней температуре',r.cpc,'кДж/(кг·К)'),value('Невязка проектного баланса',r.heatBalanceError,'Вт'),value('Тип подбора','Полновысотные ряды снаружи внутрь до первого выполнения задания; постоянный K не задаётся'),value('Согласованное исключение','3 < R/dᵢ < 12 временно не ограничивает подбор; полная применимость Teplo не подтверждена')]});
 if(currentVariants?.shellCalculation)groups.push({id:'construction',title:'Предварительная стенка корпуса · проектный подбор, не ручная геометрия',items:coilShellCalculationItems().map(([label,n,unit])=>value(label,n,unit,9))});
 if(snapshot?.result)groups.push(...CoilThermalCard.sections(snapshot.result,snapshot.inputs,snapshot.version));
 else groups.push({id:'hydraulics',title:'Гидравлика',items:[value('Перепад давления','Не предусмотрен приложенной методикой')]});
 return groups;
}
function renderExchangerCard(){
 const target=$('exchanger-card-content'),query=$('exchanger-card-search').value.trim().toLocaleLowerCase('ru-RU').replace(/альфа|alpha/g,'α').replace(/nusselt/g,'нуссельт').replace(/reynolds/g,'рейнольдс');
 target.replaceChildren();let count=0;
 for(const group of exchangerCardSections){
  if(exchangerCardCategory!=='all'&&exchangerCardCategory!==group.id)continue;
  const items=group.items.filter(item=>[group.title,...item].join(' ').toLocaleLowerCase('ru-RU').includes(query));
  if(!items.length)continue;
  const section=document.createElement('section');section.className='exchanger-card-group';
  const heading=document.createElement('h3');heading.textContent=group.title;section.append(heading);
  const list=document.createElement('dl');
  for(const [label,value,unit]of items){
   const row=document.createElement('div');row.className='exchanger-card-param';
   const term=document.createElement('dt');term.textContent=label;
   const detail=document.createElement('dd');detail.append(document.createTextNode(String(value)));
   if(unit){const suffix=document.createElement('span');suffix.className='exchanger-card-unit';suffix.textContent=unit;detail.append(suffix)}
   row.append(term,detail);list.append(row);count++;
  }
  section.append(list);target.append(section);
 }
 $('exchanger-card-empty').hidden=count>0;
 target.setAttribute('aria-labelledby','card-tab-'+exchangerCardCategory);
}
function setExchangerCardCategory(category){
 exchangerCardCategory=category;
 for(const button of document.querySelectorAll('[data-card-category]')){const selected=button.dataset.cardCategory===category;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1}
 renderExchangerCard();$('exchanger-card-content').closest('.exchanger-card-body').scrollTop=0;
}
function refreshOpenExchangerCard(){
 if(!$('exchanger-card-dialog').open||exchangerCardKind!=='coil')return;
 try{exchangerCardSections=coilExchangerCardData({design:{geometry:verificationState},inputs:getState()},currentResult)}
 catch(error){exchangerCardSections=[{id:'construction',title:'Геометрия · ошибка',items:[['Состояние',error.message,'']]},{id:'thermal',title:'Teplo · результат недоступен',items:[['Состояние','Исправьте геометрию. Предыдущие результаты не показываются.','']]}]}
 renderExchangerCard();
}
function openExchangerCard(options={}){
 const coil=options.thermal===true||$('exchanger-type').value==='coil',candidate=verificationCandidate();if(!coil&&(!candidate||!currentResult))return;
 exchangerCardKind=coil?'coil':'shell';
 exchangerCardSections=coil?[]:exchangerCardData(candidate,currentResult);
 $('exchanger-card-title').textContent=coil?'Текущая змеевиковая конструкция':candidate.name;
 $('exchanger-card-subtitle').textContent=coil?'Карточка теплообменника · текущая геометрия и поверка Teplo':'Карточка теплообменника · '+typeNames[candidate.inputs['exchanger-type']];
 $('exchanger-card-search').value='';setExchangerCardCategory('all');
 $('exchanger-card-dialog').showModal();document.documentElement.classList.add('exchanger-card-open');
 if(coil){refreshOpenExchangerCard();coilThermalUI?.request()}
 $('exchanger-card-search').focus();
}
$('view-exchanger-card').addEventListener('click',openExchangerCard);
$('close-exchanger-card').addEventListener('click',()=>$('exchanger-card-dialog').close());
$('exchanger-card-search').addEventListener('input',renderExchangerCard);
$('exchanger-card-dialog').addEventListener('close',()=>{document.documentElement.classList.remove('exchanger-card-open');coilThermalUI?.request(false);exchangerCardKind=null});
$('exchanger-card-dialog').addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();event.currentTarget.close()}});
$('exchanger-card-dialog').addEventListener('click',event=>{
 if(event.target!==event.currentTarget)return;
 const rect=event.currentTarget.getBoundingClientRect();
 if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)event.currentTarget.close();
});
const exchangerCardTabs=[...document.querySelectorAll('[data-card-category]')];
for(const button of exchangerCardTabs){
 button.addEventListener('click',()=>setExchangerCardCategory(button.dataset.cardCategory));
 button.addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();const index=exchangerCardTabs.indexOf(button),count=exchangerCardTabs.length;
  const next=event.key==='Home'?0:event.key==='End'?count-1:(index+(event.key==='ArrowRight'?1:-1)+count)%count;
  setExchangerCardCategory(exchangerCardTabs[next].dataset.cardCategory);exchangerCardTabs[next].focus();
 });
}

// Geometry only. No thermal/hydraulic predictions until the flow model is agreed.
function coilGeometryError(message,keys=[]){const error=new Error(message);error.keys=keys;throw error}
function coilConstructionDefaults(state){return {coreLength:state.height,coreWall:Math.min(2,Math.max(0,Number(state.coreDiameter)||0)/4),coreClearance:state.clearance,shellClearance:state.clearance,rowClearance:state.clearance,leadBendRadius:2*Number(state.tubeDiameter),leadStraightLength:Math.max(40,2*Number(state.tubeDiameter))}}
function restoreCoilGeometry(value){
 if(!value||typeof value!=='object'||!Array.isArray(value.rows)||value.rows.length<1||value.rows.length>8||value.rows.some(r=>!r||typeof r!=='object'))return null;
 const clean={};for(const key of ['diameter','height','shellWall','coreDiameter','tubeDiameter','tubeWall','clearance'])clean[key]=['number','string'].includes(typeof value[key])?value[key]:'';
 for(const [key,fallback] of Object.entries(coilConstructionDefaults(clean)))clean[key]=['number','string'].includes(typeof value[key])?value[key]:fallback;
 for(const key of ['shellHidden','coreHidden'])clean[key]=value[key]===true;
 clean.rows=value.rows.map(row=>({...Object.fromEntries(['diameter','count','turns','pitch'].map(key=>[key,['number','string'].includes(typeof row[key])?row[key]:''])),offset:['number','string'].includes(typeof row.offset)?row.offset:0,phase:['number','string'].includes(typeof row.phase)?row.phase:0,direction:row.direction==='left'?'left':'right',hidden:row.hidden===true}));
 return clean;
}
function seedCoilGeometry(source={}){
 const positive=(value,fallback)=>Number.isFinite(Number(value))&&Number(value)>0?Number(value):fallback;
 const diameter=Math.max(200,Math.min(3000,positive(source['exchanger-diameter'],500)));
 const height=Math.max(200,Math.min(10000,positive(source.length,1200)));
 const tubeDiameter=Math.min(diameter/20,positive(source['tube-diameter'],16));
 const tubeWall=Math.min(tubeDiameter/4,positive(source['tube-wall'],1.5));
 const shellWall=5,coreDiameter=Math.round(diameter*.2),clearance=2;
 const inner=coreDiameter+tubeDiameter+2*clearance,outer=diameter-2*shellWall-tubeDiameter-2*clearance;
 const rows=[2,5,7].map((count,i)=>{
  const pitch=Math.ceil((tubeDiameter+clearance)*count*1.2);
  return {count,diameter:Math.round(inner+(outer-inner)*(i+1)/4),turns:Math.max(.5,Math.floor((height-tubeDiameter)/pitch*2)/2),pitch};
 });
 const state={diameter,height,shellWall,coreDiameter,tubeDiameter,tubeWall,clearance,rows};return {...state,...coilConstructionDefaults(state)};
}
function calculateCoilGeometry(state){
 const fields=['diameter','height','shellWall','coreDiameter','tubeDiameter','tubeWall','clearance'],n={};
 for(const key of ['shellHidden','coreHidden'])n[key]=state[key]===true;
 for(const key of fields){
  if(state[key]===''||state[key]==null||!Number.isFinite(Number(state[key])))coilGeometryError('Заполните геометрию аппарата.',[key]);
  n[key]=Number(state[key]);
  if(n[key]<(key==='coreDiameter'||key==='clearance'?0:.001))coilGeometryError('Размер должен быть '+(['coreDiameter','clearance'].includes(key)?'неотрицательным.':'больше нуля.'),[key]);
 }
 for(const [key,fallback] of Object.entries(coilConstructionDefaults(n))){const value=state[key]??fallback;if(value===''||!Number.isFinite(Number(value))||Number(value)<0)coilGeometryError(key.startsWith('lead')?'Заполните радиус отвода и неотрицательную длину прямого участка.':'Заполните длину и стенку вытеснительной трубы и неотрицательные зазоры.',[key]);n[key]=Number(value)}
 if(n.leadBendRadius<=n.tubeDiameter/2)coilGeometryError('Радиус отвода по оси трубы должен быть больше половины её наружного диаметра.',['leadBendRadius','tubeDiameter']);
 if(n.coreDiameter>0&&(n.coreWall<=0||2*n.coreWall>=n.coreDiameter))coilGeometryError('Стенка вытеснительной трубы должна быть больше нуля и меньше половины её диаметра.',['coreWall','coreDiameter']);
 if(n.coreDiameter>0&&(n.coreLength<=0||n.coreLength>n.height))coilGeometryError('Длина вытеснительной трубы должна быть больше нуля и не превышать рабочую высоту корпуса.',['coreLength','height']);
 if(n.diameter>3000||n.height>10000)coilGeometryError('Пределы редактора: диаметр до 3 000 мм, высота до 10 000 мм.',['diameter','height']);
 if(n.tubeDiameter>100)coilGeometryError('Наружный диаметр трубы должен быть не более 100 мм.',['tubeDiameter']);
 if(n.tubeWall*2>=n.tubeDiameter)coilGeometryError('Толщина стенки должна быть меньше половины диаметра трубы.',['tubeWall','tubeDiameter']);
 const shellInside=n.diameter-2*n.shellWall;
 if(shellInside<n.coreDiameter+2*n.tubeDiameter+2*n.coreClearance+2*n.shellClearance)coilGeometryError('Между вставкой и корпусом нет места для змеевиков с заданными зазорами.',['coreDiameter','diameter','shellWall','coreClearance','shellClearance']);
 if(!Array.isArray(state.rows)||!state.rows.length||state.rows.length>8)coilGeometryError('Задайте от 1 до 8 рядов змеевиков.');
 let totalCount=0,totalLength=0,totalArea=0,maxHeight=0;
 const rows=state.rows.map((row,index)=>{
  const r={index};
  for(const key of ['diameter','count','turns','pitch']){
   if(row[key]===''||row[key]==null||!Number.isFinite(Number(row[key]))||Number(row[key])<=0)coilGeometryError('Заполните параметры ряда '+(index+1)+'.',['row-'+index+'-'+key]);
   r[key]=Number(row[key]);
  }
  for(const key of ['offset','phase']){const value=row[key]??0;if(value===''||!Number.isFinite(Number(value)))coilGeometryError('Заполните смещение и начальный угол ряда '+(index+1)+'.',['row-'+index+'-'+key]);r[key]=Number(value)}
  if(r.offset<0)coilGeometryError('Смещение ряда по высоте не может быть отрицательным.',['row-'+index+'-offset']);
  if(Math.abs(r.phase)>360)coilGeometryError('Начальный угол задаётся от −360 до 360°.',['row-'+index+'-phase']);
  if(row.direction!=null&&!['right','left'].includes(row.direction))coilGeometryError('Выберите направление навивки.',['row-'+index+'-direction']);r.direction=row.direction||'right';r.hidden=row.hidden===true;
  if(!Number.isInteger(r.count)||r.count>64)coilGeometryError('В ряду может быть от 1 до 64 змеевиков.',['row-'+index+'-count']);
  if(r.turns>1000||r.turns<.5)coilGeometryError('Количество витков — от 0,5 до 1000.',['row-'+index+'-turns']);
  if(r.diameter<n.coreDiameter+n.tubeDiameter+2*n.coreClearance)coilGeometryError('Ряд '+(index+1)+' пересекает центральную вставку или не выдерживает зазор.',['row-'+index+'-diameter','coreDiameter','coreClearance']);
  if(r.diameter+n.tubeDiameter+2*n.shellClearance>shellInside)coilGeometryError('Ряд '+(index+1)+' выходит за внутренний диаметр корпуса или не выдерживает зазор.',['row-'+index+'-diameter','diameter','shellClearance']);
  // Neighbouring starts on one helical cylinder: approximate normal separation.
  r.separation=r.pitch/r.count/Math.sqrt(1+(r.pitch/(Math.PI*r.diameter))**2);
  if(r.separation+1e-8<n.tubeDiameter+n.clearance)coilGeometryError('В ряду '+(index+1)+' змеевики расположены слишком близко. Увеличьте шаг витка или уменьшите их количество.',['row-'+index+'-pitch','row-'+index+'-count']);
  const chord=2*(r.diameter/2)*Math.sin(Math.PI/r.count);
  if(r.count>1&&chord+1e-8<n.tubeDiameter+n.clearance)coilGeometryError('Входы змеевиков ряда '+(index+1)+' пересекаются. Увеличьте диаметр навивки или уменьшите количество.',['row-'+index+'-diameter','row-'+index+'-count']);
  r.height=r.turns*r.pitch+n.tubeDiameter;
  if(r.height+r.offset>n.height+1e-8)coilGeometryError('Ряд '+(index+1)+' не помещается по высоте с учётом смещения. Уменьшите число витков, шаг или смещение.',['row-'+index+'-turns','row-'+index+'-pitch','row-'+index+'-offset','height']);
  r.coilLength=r.turns*Math.hypot(Math.PI*r.diameter,r.pitch)/1000;
  r.length=r.coilLength*r.count;r.area=Math.PI*n.tubeDiameter/1000*r.length;
  r.firstNumber=totalCount+1;totalCount+=r.count;totalLength+=r.length;totalArea+=r.area;maxHeight=Math.max(maxHeight,r.height+r.offset);
  const maxBendRadius=r.diameter/2*(1+(r.pitch/(Math.PI*r.diameter))**2);
  if(n.leadBendRadius>=maxBendRadius*(1-1e-6))coilGeometryError('Ряд '+(index+1)+': для сохранения радиуса навивки радиус отвода должен быть меньше '+maxBendRadius.toFixed(2)+' мм.',['leadBendRadius','row-'+index+'-diameter','row-'+index+'-pitch']);
  return r;
 });
 const sorted=[...rows].sort((a,b)=>a.diameter-b.diameter);
 for(let i=1;i<sorted.length;i++)if((sorted[i].diameter-sorted[i-1].diameter)/2+1e-8<n.tubeDiameter+n.rowClearance)coilGeometryError('Ряды '+(sorted[i-1].index+1)+' и '+(sorted[i].index+1)+' пересекаются или не выдерживают зазор.',['row-'+sorted[i-1].index+'-diameter','row-'+sorted[i].index+'-diameter','rowClearance']);
 const tubeInside=n.tubeDiameter-2*n.tubeWall;
 const tubeVolume=Math.PI/4*(tubeInside/1000)**2*totalLength;
 const displacement=Math.PI/4*(n.tubeDiameter/1000)**2*totalLength;
 const vesselVolume=Math.PI/4*((shellInside/1000)**2*n.height/1000-(n.coreDiameter/1000)**2*n.coreLength/1000);
 if(displacement>=vesselVolume)coilGeometryError('Объём труб превышает свободный объём аппарата. Проверьте геометрию.');
 return {...n,shellInside,tubeInside,rows,totalCount,totalLength,totalArea,maxHeight,tubeVolume,shellVolume:vesselVolume-displacement,metalVolume:displacement-tubeVolume};
}

function coilFieldDefinitions(){return [
 ['diameter','Внешний диаметр D','мм'],['height','Высота аппарата H','мм'],['shellWall','Стенка корпуса','мм'],['coreDiameter','Диаметр вставки','мм'],['tubeDiameter','Наружный диаметр трубы','мм'],['tubeWall','Стенка трубы','мм'],['clearance','Зазор между навивками','мм']
]}
function coilNumericField(key,label,unit,value){return '<label class="coil-field"><span>'+label.split(' · ряд ')[0]+'</span><div class="input-wrap t-input"><input type="number" step="any" data-coil-field="'+key+'" aria-label="'+label+'" value="'+(Number.isFinite(Number(value))?value:'')+'"><span>'+unit+'</span></div></label>'}
// The compact design editor and the verification page share the same per-sheet geometry.
function detailGeometryTable(fields){
 const extras=coilConstructionDefaults(verificationState);
 return '<table class="detail-geometry-table"><tbody>'+fields.map(([key,label,unit])=>{
  const match=key.match(/^row-(\d+)-(\w+)$/),value=match?verificationState.rows[Number(match[1])][match[2]]??0:verificationState[key]??extras[key],id='detail-coil-'+key;
  const direction=match?.[2]==='direction',editor=direction?detailDirectionMarkup():'<div class="input-wrap t-input"><input id="'+id+'" type="number" step="'+(match?.[2]==='count'?'1':'any')+'" data-detail-coil-field="'+key+'" value="'+(Number.isFinite(Number(value))?value:'')+'"><span>'+unit+'</span></div>';
  return '<tr><td><label '+(direction?'id="detail-direction-label" for="detail-direction-trigger"':'for="'+id+'"')+'>'+label+'</label></td><td>'+editor+'</td></tr>';
 }).join('')+'</tbody></table>';
}
function syncDesignGeometryVisibility(){const panel=$('detail-geometry');if(panel)panel.hidden=$('detail-parameter-mode').value!=='construction'}
function detailDirectionMarkup(){return `<div class="dropdown-field direction-dropdown-field arrangement-dropdown-field rectangular-dropdown-field"><div class="dd" data-dd="detail-coil-direction"><button type="button" id="detail-direction-trigger" class="dd-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="detail-direction-menu" aria-labelledby="detail-direction-label detail-direction-value"><span class="t-text-swap dd-label" id="detail-direction-value">Правое</span><svg class="hi" viewBox="0 0 20 20" aria-hidden="true"><path d="m4 7 6 6 6-6"/></svg></button><div class="t-dropdown dd-menu" id="detail-direction-menu" role="listbox" aria-labelledby="detail-direction-label" data-origin="top-left" hidden inert>${[['right','Правое'],['left','Левое']].map(([value,title])=>`<button type="button" class="dd-item" role="option" data-value="${value}" aria-selected="${value==='right'}" tabindex="-1"><span>${title}</span><svg class="hi" viewBox="0 0 24 24" aria-hidden="true"><path d="m5.25 12.7 4.15 4.15L18.75 6.87"/></svg></button>`).join('')}</div></div><input type="hidden" id="detail-coil-direction" value="right"></div>`}
function detailArrangementMarkup(){return `<div class="dropdown-field arrangement-dropdown-field rectangular-dropdown-field"><div class="dd" data-dd="detail-thermal-arrangement"><button type="button" id="detail-arrangement-trigger" class="dd-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="detail-arrangement-menu" aria-labelledby="detail-arrangement-label detail-arrangement-value"><span class="t-text-swap dd-label" id="detail-arrangement-value">Коридорное</span><svg class="hi" viewBox="0 0 20 20" aria-hidden="true"><path d="m4 7 6 6 6-6"/></svg></button><div class="t-dropdown dd-menu" id="detail-arrangement-menu" role="listbox" aria-labelledby="detail-arrangement-label" data-origin="top-left" hidden inert>${[['inline','Коридорное'],['staggered','Шахматное']].map(([value,title])=>`<button type="button" class="dd-item" role="option" data-value="${value}" aria-selected="${value==='inline'}" tabindex="-1"><span>${title}</span><svg class="hi" viewBox="0 0 24 24" aria-hidden="true"><path d="m5.25 12.7 4.15 4.15L18.75 6.87"/></svg></button>`).join('')}</div></div><input type="hidden" id="detail-thermal-arrangement" data-detail-thermal-field="arrangement" value="inline"></div>`}
function renderDesignGeometry(){
 const panel=$('detail-geometry');if(!panel)return;
 if(!verificationState){verificationState=seedCoilGeometry(getState());if($('exchanger-type').value==='coil'&&!coilVariantBinding)coilVariantBinding={key:'',profile:'balanced',manual:false};syncVerificationChoice()}
 detailCoilRow=Math.max(0,Math.min(detailCoilRow,verificationState.rows.length-1));
 const section=(name,fields)=>'<section class="detail-geometry-group"><h3>'+name+'</h3>'+detailGeometryTable(fields)+'</section>';
 panel.innerHTML='<p class="detail-geometry-caption">Змеевиковый аппарат с вытеснительной трубой</p>'+
  section('Корпус',[['diameter','Наружный диаметр','мм'],['height','Рабочая высота','мм'],['shellWall','Толщина стенки','мм']])+
  section('Вытеснительная труба',[['coreDiameter','Наружный диаметр','мм'],['coreLength','Длина трубы','мм'],['coreWall','Толщина стенки','мм']])+
  '<section class="detail-geometry-group"><h3>Трубы змеевиков</h3>'+detailGeometryTable([['tubeDiameter','Наружный диаметр','мм'],['tubeWall','Толщина стенки','мм']])+'<table class="detail-geometry-table"><tbody><tr><td><label id="detail-arrangement-label" for="detail-arrangement-trigger">Расположение труб</label></td><td>'+detailArrangementMarkup()+'</td></tr></tbody></table></section>'+
  '<section class="detail-geometry-group"><h3>Отводы · для всех рядов</h3>'+detailGeometryTable([['leadBendRadius','Радиус отвода по оси','мм'],['leadStraightLength','Прямой участок после отвода','мм']])+'<p class="detail-geometry-note">Единые размеры для верхних и нижних отводов всех змеевиков. Ось перехода остаётся на цилиндре навивки. Длина прямого участка отсчитывается от конца отвода, не от торца корпуса; короткий вывод может закончиться внутри аппарата.</p></section>'+
  '<section class="detail-geometry-group"><h3>Ряды змеевиков</h3><div class="detail-row-toolbar"><span>Радиальных рядов: <b>'+verificationState.rows.length+'</b></span><button type="button" data-detail-row-action="remove" aria-label="Удалить выбранный ряд"'+(verificationState.rows.length===1?' disabled':'')+'>−</button><button type="button" data-detail-row-action="add" aria-label="Добавить ряд"'+(verificationState.rows.length===8?' disabled':'')+'>+</button></div><div class="detail-row-tabs" aria-label="Выбор ряда">'+verificationState.rows.map((_,i)=>'<button type="button" data-detail-row="'+i+'" aria-label="Ряд '+(i+1)+'" aria-pressed="'+(i===detailCoilRow)+'">'+(i+1)+'</button>').join('')+'</div><p class="detail-row-caption">Ряд '+(detailCoilRow+1)+' · диаметр навивки по оси трубы</p>'+detailGeometryTable([['diameter','Диаметр навивки','мм'],['count','Змеевиков в ряду','шт.'],['turns','Витков на змеевик',''],['pitch','Шаг навивки','мм'],['offset','Смещение по высоте','мм'],['phase','Начальный угол','°'],['direction','Направление навивки','']].map(([key,label,unit])=>['row-'+detailCoilRow+'-'+key,label,unit]))+'</section>'+
  '<p id="detail-geometry-error" class="detail-geometry-error" role="status" hidden></p>';
 // Keep one dropdown instance across editor rebuilds (row/sheet changes).
 const wrapper=panel.querySelector('.arrangement-dropdown-field:not(.direction-dropdown-field)');
 if(detailArrangementDropdown){detailArrangementDropdown.close();wrapper.replaceWith(detailArrangementDropdown.root.closest('.dropdown-field'))}
 else{detailArrangementDropdown=createAnimatedDropdown(wrapper.querySelector('.dd'));animatedDropdowns.push(detailArrangementDropdown)}
 const directionWrapper=panel.querySelector('.direction-dropdown-field');
 if(detailDirectionDropdown){detailDirectionDropdown.close();directionWrapper.replaceWith(detailDirectionDropdown.root.closest('.dropdown-field'))}
 else{detailDirectionDropdown=createAnimatedDropdown(directionWrapper.querySelector('.dd'));animatedDropdowns.push(detailDirectionDropdown)}
 const directionField=$('detail-coil-direction');directionField.dataset.detailCoilField='row-'+detailCoilRow+'-direction';directionField.value=verificationState.rows[detailCoilRow].direction??'right';detailDirectionDropdown.sync();
 syncDetailThermalArrangement();syncDesignGeometryVisibility();renderDesignGeometryFeedback();
}
function syncDetailThermalArrangement(){const field=$('detail-thermal-arrangement');if(field){field.value=coilThermalUI?.arrangement??coilThermalInputs?.arrangement??'inline';detailArrangementDropdown?.sync()}}
function renderDesignGeometryFeedback(){
 renderCoilProjectArea();
 coilThermalUI?.refresh();
 const panel=$('detail-geometry'),message=$('detail-geometry-error');if(!message||!verificationState)return;
 for(const field of panel.querySelectorAll('[data-detail-coil-field]')){field.removeAttribute('aria-invalid');field.removeAttribute('aria-describedby');field.closest('.input-wrap')?.classList.remove('is-error')}
 let g=null,errorMessage='';
 try{g=calculateCoilGeometry(verificationState);message.hidden=true;message.textContent=''}
 catch(error){errorMessage=error.message;message.hidden=false;message.textContent=error.message;for(const key of error.keys||[]){const field=panel.querySelector('[data-detail-coil-field="'+key+'"]');if(field){field.setAttribute('aria-invalid','true');field.setAttribute('aria-describedby','detail-geometry-error');field.closest('.input-wrap')?.classList.add('is-error')}}}
 renderDesignLayout(g,errorMessage);
}
function initializeDesignGeometry(){
 const panel=$('detail-geometry');
 panel.addEventListener('change',event=>{if(event.target.dataset.detailThermalField==='arrangement')coilThermalUI?.setArrangement(event.target.value)});
 panel.addEventListener('change',event=>{if(event.target.id==='detail-coil-direction'){detailDirectionDropdown.sync();event.target.dispatchEvent(new Event('input',{bubbles:true}))}});
 panel.addEventListener('input',event=>{const key=event.target.dataset.detailCoilField;if(!key)return;const match=key.match(/^row-(\d+)-(\w+)$/);if(match)verificationState.rows[Number(match[1])][match[2]]=event.target.value;else verificationState[key]=event.target.value;markCoilVariantManual();renderDesignGeometryFeedback();updateCoilGeometry();save()});
 panel.addEventListener('keydown',event=>{if(event.key==='Enter'&&event.target.matches('input')){event.preventDefault();event.target.blur()}});
 panel.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;const scroll=panel.scrollTop;
  if(button.hasAttribute('data-detail-row'))detailCoilRow=Number(button.dataset.detailRow);
  else if(button.dataset.detailRowAction==='add'){const count=verificationState.rows.length;addCoilRow();if(verificationState.rows.length===count)return;markCoilVariantManual();detailCoilRow=verificationState.rows.length-1}
  else if(button.dataset.detailRowAction==='remove'&&verificationState.rows.length>1){verificationState.rows.splice(detailCoilRow,1);markCoilVariantManual();detailCoilRow=Math.min(detailCoilRow,verificationState.rows.length-1);coilHighlightedRow=null;coilHighlightedNumber=null;fillVerificationInputs();save()}
  else return;
  renderDesignGeometry();panel.scrollTop=scroll;panel.querySelector('[data-detail-row="'+detailCoilRow+'"]').focus({preventScroll:true});
 });
 renderDesignGeometry();
}
function initializeVerificationPage(){
 const page=$('verification-page');
 page.innerHTML=`<div class="heading verification-heading"><div><h1>Поверочный расчёт</h1><p>Змеевиковый аппарат · геометрия и тепловой расчёт Teplo</p></div><div class="verification-heading-actions"><span class="coil-stage">Teplo</span><button type="button" class="verification-choice" id="coil-from-design">Из проектировочного</button><button type="button" class="verification-choice" id="coil-export">Экспорт геометрии<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9m-4-4 4 4 4-4M4 14v3h12v-3"/></svg></button></div></div>
 <div class="coil-workspace"><aside class="coil-editor" aria-label="Геометрия змеевикового аппарата">
 <section class="coil-panel"><div class="coil-panel-heading"><h2><span class="coil-step">01</span>Аппарат и трубы</h2></div><div class="coil-global-fields"></div><p class="coil-field-note">Диаметр навивки задаётся по оси трубы. Вставка — центральный цилиндр; 0 мм — без вставки.</p></section>
 <section class="coil-panel"><div class="coil-panel-heading"><h2><span class="coil-step">02</span>Ряды змеевиков</h2><span id="coil-rows-count"></span></div><div id="coil-row-editors"></div><button type="button" class="coil-add-row" id="coil-add-row"><span aria-hidden="true">+</span> Добавить ряд</button><p class="coil-field-note">Количество — независимые змеевики в ряду. Шаг — подъём одного змеевика за полный оборот.</p></section></aside>
 <div class="coil-preview-column"><section class="coil-panel coil-preview"><div class="coil-preview-heading"><div><h2>Компоновка змеевиков</h2><p id="coil-view-caption">Вид сверху · входы змеевиков</p></div><div class="coil-view-tabs" role="tablist" aria-label="Проекция аппарата"><button type="button" id="coil-top-tab" role="tab" data-coil-view="top" aria-selected="true" aria-controls="coil-drawing-panel">Сверху</button><button type="button" id="coil-side-tab" role="tab" data-coil-view="side" aria-selected="false" aria-controls="coil-drawing-panel" tabindex="-1">Сбоку</button></div></div>
 <div class="coil-summary" aria-live="polite"><div><span>Рядов</span><b id="coil-total-rows">—</b></div><div><span>Змеевиков</span><b id="coil-total-count">—</b></div><div><span>Длина труб</span><b><span id="coil-total-length">—</span><small>м</small></b></div><div><span>Поверхность</span><b><span id="coil-total-area">—</span><small>м²</small></b></div></div>
 <p id="coil-geometry-error" class="coil-geometry-error" role="status" hidden></p>
 <div class="coil-visual"><div id="coil-drawing-panel" role="tabpanel" aria-labelledby="coil-top-tab"><svg id="coil-drawing" viewBox="0 0 640 600" role="img" aria-label="Вид сверху: расположение входов змеевиков"></svg></div><div class="coil-legend"><h3>Ряды</h3><div id="coil-row-legend"></div><div class="coil-legend-key"><span><i class="coil-key-shell"></i>Корпус</span><span><i class="coil-key-core"></i>Вставка</span><span><i class="coil-key-track"></i>Ось навивки</span></div><button type="button" id="coil-clear-highlight" hidden>Показать все ряды</button></div></div>
 <div class="coil-preview-footer"><span id="coil-selection-note">Номера — отдельные змеевики. Нажмите на номер или ряд.</span><span id="coil-drawing-note">Маркеры входов увеличены для читаемости</span></div></section>
 <section class="coil-panel coil-geometry-results"><div class="coil-panel-heading"><h2><span class="coil-step">03</span>Геометрические параметры</h2></div><div class="coil-results-scroll"><table><thead><tr><th>Ряд</th><th>Змеевиков</th><th>Длина одного, м</th><th>Поверхность, м²</th><th>Высота, мм</th></tr></thead><tbody id="coil-geometry-rows"></tbody></table></div><div class="coil-volume-results"><span>Внутренний объём труб <b id="coil-tube-volume">—</b></span><span>Свободный объём корпуса <b id="coil-shell-volume">—</b></span></div></section>
 <details class="coil-panel coil-method"><summary>Что учитывает геометрическая модель</summary><p>Ряды — концентрические цилиндрические навивки. Змеевики в ряду одинаковы и равномерно распределены по углу; их количество и число витков задаются отдельно. Длина спирали: z · √((πD)² + h²), поверхность: πd · l. Длина подводящих участков не включена.</p><p>Проверяются габариты, радиальные зазоры, размещение входов и приближённое расстояние между соседними спиралями ряда. Это геометрическая компоновка, без проверки технологичности, прочности и вибраций. Вид сбоку — схема навивок; скрытые участки показаны пунктиром.</p><p>Ниже подключён поверочный тепловой расчёт Teplo по геометрии этого листа: выходные температуры, теплоотдача и критерии применимости. Геометрическая поверхность выше — наружная; тепловая поверхность Teplo вычисляется по среднему диаметру. Потери давления в методике не заданы.</p></details></div></div>`;
 $('coil-from-design').addEventListener('click',()=>{if($('exchanger-type').value==='coil'&&currentVariants?.rows.length){loadCoilVariant(selectedVariant);return}verificationState=seedCoilGeometry(getState());markCoilVariantManual();coilHighlightedRow=null;coilHighlightedNumber=null;fillVerificationInputs();save();toast('Габариты и типоразмер труб взяты из проектировочного расчёта')});
 $('coil-export').addEventListener('click',exportCoilGeometry);
 $('coil-add-row').addEventListener('click',addCoilRow);
 page.addEventListener('input',event=>{
  const key=event.target.dataset.coilField;if(!key)return;
  const value=event.target.value;
  const match=key.match(/^row-(\d+)-(\w+)$/);
  if(match)verificationState.rows[Number(match[1])][match[2]]=value;else verificationState[key]=value;
  markCoilVariantManual();updateCoilGeometry();renderDesignGeometry();save();
 });
 page.addEventListener('focusout',event=>{
  if(!event.target.dataset.coilField)return;
  if(event.target.getAttribute('aria-invalid')==='true'){const border=event.target.closest('.input-wrap');border.classList.remove('is-shaking');void border.offsetWidth;border.classList.add('is-shaking')}
 });
 page.addEventListener('animationend',event=>{if(event.animationName==='t-input-shake')event.target.classList.remove('is-shaking')});
 $('coil-clear-highlight').addEventListener('click',()=>{coilHighlightedRow=null;coilHighlightedNumber=null;renderCoilDrawing()});
 const tabs=[...page.querySelectorAll('[data-coil-view]')];
 for(const button of tabs){
  button.addEventListener('click',()=>setCoilView(button.dataset.coilView));
  button.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const next=['Home','ArrowLeft'].includes(event.key)?tabs[0]:tabs[1];setCoilView(next.dataset.coilView);next.focus()});
 }
 $('coil-row-editors').addEventListener('click',event=>{const remove=event.target.closest('[data-remove-coil-row]');if(!remove)return;verificationState.rows.splice(Number(remove.dataset.removeCoilRow),1);markCoilVariantManual();coilHighlightedRow=null;coilHighlightedNumber=null;fillVerificationInputs();save()});
 $('coil-row-legend').addEventListener('click',event=>{const row=event.target.closest('[data-highlight-coil-row]');if(row)highlightCoil(Number(row.dataset.highlightCoilRow))});
 $('coil-drawing').addEventListener('click',event=>{const coil=event.target.closest('[data-coil-number]');if(coil)highlightCoil(Number(coil.dataset.coilRow),Number(coil.dataset.coilNumber))});
 $('coil-drawing').addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;const coil=event.target.closest('[data-coil-number]');if(coil){event.preventDefault();highlightCoil(Number(coil.dataset.coilRow),Number(coil.dataset.coilNumber));$('coil-row-legend').querySelector('[data-highlight-coil-row="'+coil.dataset.coilRow+'"]').focus()}});
 verificationUIReady=true;syncPageView();
}
function fillVerificationInputs(){
 if(!verificationUIReady)return;
 if(!verificationState)verificationState=seedCoilGeometry(getState());
 $('verification-page').querySelector('.coil-global-fields').innerHTML=coilFieldDefinitions().map(([key,label,unit])=>coilNumericField(key,label,unit,verificationState[key])).join('');
 const target=$('coil-row-editors');target.replaceChildren();
 verificationState.rows.forEach((row,i)=>{
  const card=document.createElement('div');card.className='coil-row-editor';card.style.setProperty('--row-color',coilRowColor(i));
  card.innerHTML='<div class="coil-row-editor-heading"><h3><i></i>Ряд '+(i+1)+'</h3><button type="button" data-remove-coil-row="'+i+'" aria-label="Удалить ряд '+(i+1)+'" '+(verificationState.rows.length===1?'disabled':'')+'>×</button></div><div class="coil-row-fields">'+[['diameter','Диаметр навивки','мм'],['count','Змеевиков','шт.'],['turns','Число витков','вит.'],['pitch','Шаг витка','мм']].map(([key,label,unit])=>coilNumericField('row-'+i+'-'+key,label+' · ряд '+(i+1),unit,row[key])).join('')+'</div>';
  target.append(card);
 });
 $('coil-rows-count').textContent=verificationState.rows.length+' / 8';$('coil-add-row').disabled=verificationState.rows.length>=8;
 updateCoilGeometry();renderDesignGeometry();
}
function addCoilRow(){
 if(!verificationState||verificationState.rows.length>=8)return;
 const s=verificationState,outer=Number(s.diameter)-2*Number(s.shellWall)-Number(s.tubeDiameter)-2*Number(s.shellClearance??s.clearance),inner=Number(s.coreDiameter)+Number(s.tubeDiameter)+2*Number(s.coreClearance??s.clearance),rowGap=Number(s.rowClearance??s.clearance);
 const centers=s.rows.map(r=>Number(r.diameter)).filter(Number.isFinite).sort((a,b)=>a-b),bounds=[inner,...centers,outer];
 let diameter=(inner+outer)/2,best=-Infinity;
 for(let i=1;i<bounds.length;i++){const low=i===1?bounds[i-1]:bounds[i-1]+2*(Number(s.tubeDiameter)+rowGap),high=i===bounds.length-1?bounds[i]:bounds[i]-2*(Number(s.tubeDiameter)+rowGap);if(high-low>best){best=high-low;diameter=(low+high)/2}}
 if(best<0){toast('Для нового ряда увеличьте диаметр корпуса или уменьшите диаметр трубы');return}
 const pitch=Math.ceil((Number(s.tubeDiameter)+Number(s.clearance))*2*1.2),height=Number(s.height);
 s.rows.push({diameter:Math.round(diameter*10)/10,count:2,turns:Math.max(.5,Math.floor((height-Number(s.tubeDiameter))/pitch*2)/2),pitch});
 markCoilVariantManual();
 coilHighlightedRow=null;coilHighlightedNumber=null;fillVerificationInputs();save();
}
function updateCoilGeometry(){
 if(!verificationUIReady)return;
 const page=$('verification-page');
 for(const input of page.querySelectorAll('[data-coil-field]')){input.removeAttribute('aria-invalid');input.removeAttribute('title');input.closest('.input-wrap').classList.remove('is-error')}
 try{currentCoilGeometry=calculateCoilGeometry(verificationState);$('coil-geometry-error').hidden=true;$('coil-geometry-error').textContent=''}
 catch(error){currentCoilGeometry=null;$('coil-geometry-error').hidden=false;$('coil-geometry-error').textContent=error.message;for(const key of error.keys||[]){const input=page.querySelector('[data-coil-field="'+key+'"]');if(input){input.setAttribute('aria-invalid','true');input.title=error.message;input.closest('.input-wrap').classList.add('is-error')}}}
 const g=currentCoilGeometry;
 $('coil-total-rows').textContent=g?g.rows.length:'—';$('coil-total-count').textContent=g?fmt(g.totalCount,0):'—';$('coil-total-length').textContent=g?fmt(g.totalLength,2):'—';$('coil-total-area').textContent=g?fmt(g.totalArea,2):'—';
 $('coil-tube-volume').textContent=g?fmt(g.tubeVolume*1000,2)+' л':'—';$('coil-shell-volume').textContent=g?fmt(g.shellVolume*1000,2)+' л':'—';
 const table=$('coil-geometry-rows');table.replaceChildren();
 if(g)for(const row of g.rows){const tr=document.createElement('tr');for(const value of [row.index+1,row.count,fmt(row.coilLength,2),fmt(row.area,2),fmt(row.height,1)]){const td=document.createElement('td');td.textContent=value;tr.append(td)}table.append(tr)}
 $('coil-export').disabled=!g;renderCoilDrawing();
}
function coilRowColor(i){return ['#72bddc','#e5ad71','#76c6a6','#aa9ae5','#da95b7','#b9ca71','#79b4ed','#c99a76'][i%8]}
function setCoilView(view){coilDrawingView=view;for(const button of document.querySelectorAll('[data-coil-view]')){const selected=button.dataset.coilView===view;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1}$('coil-drawing-panel').setAttribute('aria-labelledby',view==='top'?'coil-top-tab':'coil-side-tab');$('coil-view-caption').textContent=view==='top'?'Вид сверху · входы змеевиков':'Вид сбоку · навивки змеевиков';$('coil-drawing-note').textContent=view==='top'?'Маркеры входов увеличены для читаемости':'Задние участки спиралей показаны пунктиром';renderCoilDrawing()}
function highlightCoil(index,number=null){coilHighlightedRow=coilHighlightedRow===index&&coilHighlightedNumber===number?null:index;coilHighlightedNumber=coilHighlightedRow===null?null:number;renderCoilDrawing()}
function renderCoilDrawing(){
 const svg=$('coil-drawing'),legend=$('coil-row-legend'),g=currentCoilGeometry;if(!svg||!legend)return;
 legend.replaceChildren();
 if(!g){svg.innerHTML='<text x="320" y="300" text-anchor="middle" class="coil-svg-empty">Проверьте размеры аппарата и рядов</text>';$('coil-clear-highlight').hidden=true;$('coil-selection-note').textContent='Рисунок появится после исправления геометрии';return}
 if(coilHighlightedRow!=null&&coilHighlightedRow>=g.rows.length){coilHighlightedRow=null;coilHighlightedNumber=null}
 for(const row of g.rows){const button=document.createElement('button');button.type='button';button.dataset.highlightCoilRow=row.index;button.setAttribute('aria-pressed',String(coilHighlightedRow===row.index));button.style.setProperty('--row-color',coilRowColor(row.index));button.innerHTML='<i></i><span>Ряд '+(row.index+1)+'<small>'+row.count+' шт. · Ø '+fmt(row.diameter,1)+' мм</small></span>';legend.append(button)}
 $('coil-clear-highlight').hidden=coilHighlightedRow===null;
 $('coil-selection-note').textContent=coilHighlightedRow===null?'Номера — отдельные змеевики. Нажмите на номер или ряд.':(coilHighlightedNumber?'Змеевик № '+coilHighlightedNumber+' · ':'')+'Ряд '+(coilHighlightedRow+1)+' · '+g.rows[coilHighlightedRow].count+' шт. · '+fmt(g.rows[coilHighlightedRow].coilLength,2)+' м на змеевик';
 svg.setAttribute('aria-label',coilDrawingView==='top'?'Вид сверху: '+g.rows.length+' ряда, '+g.totalCount+' змеевиков':'Вид сбоку: навивки '+g.totalCount+' змеевиков');
 svg.innerHTML=coilDrawingView==='top'?coilTopSvg(g):coilSideSvg(g);
}
function coilTopSvg(g,highlightRow=coilHighlightedRow,highlightNumber=coilHighlightedNumber,dimOpacity=.2,entryAngles=null){
 const scale=480/g.diameter,cx=320,cy=288,R=g.diameter/2*scale,inside=g.shellInside/2*scale,core=g.coreDiameter/2*scale;
 let out='<title>Вид сверху — входы змеевиков</title><circle class="coil-shell-wall" cx="'+cx+'" cy="'+cy+'" r="'+R+'"/><circle class="coil-shell-inside" cx="'+cx+'" cy="'+cy+'" r="'+inside+'"/>';
 if(core>0)out+='<circle class="coil-core" cx="'+cx+'" cy="'+cy+'" r="'+core+'"/><circle cx="'+cx+'" cy="'+cy+'" r="'+Math.max(0,core-g.coreWall*scale)+'" fill="none" stroke="#555" stroke-width=".8"/><text class="coil-core-label" x="'+cx+'" y="'+(cy-3)+'" text-anchor="middle">Вставка</text><text class="coil-core-value" x="'+cx+'" y="'+(cy+17)+'" text-anchor="middle">Ø '+fmt(g.coreDiameter,1)+'</text>';
 for(const row of g.rows){
  const r=row.diameter/2*scale,color=coilRowColor(row.index),opacity=highlightRow===null||highlightRow===row.index?1:dimOpacity;
  out+='<g opacity="'+opacity+'"><circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="none" stroke="'+color+'" stroke-width="1.2" stroke-dasharray="9 7" opacity=".6"/>';
  for(let j=0;j<row.count;j++){
   const angle=2*Math.PI*j/row.count+row.phase*Math.PI/180+(entryAngles?.[row.index]??0),x=cx+r*Math.cos(angle),y=cy+r*Math.sin(angle),number=row.firstNumber+j,selected=number===highlightNumber;
   const marker=Math.min(17,Math.max(13,g.tubeDiameter/2*scale),row.count>1?r*Math.sin(Math.PI/row.count)*.8:17),font=marker<10?9:12;
   out+='<g class="coil-node" role="button" tabindex="0" data-coil-row="'+row.index+'" data-coil-number="'+number+'" aria-label="Змеевик '+number+', ряд '+(row.index+1)+'"><title>Змеевик '+number+' · ряд '+(row.index+1)+'</title><circle cx="'+x+'" cy="'+y+'" r="'+marker+'" fill="'+(selected?color:'#1a2226')+'" stroke="'+color+'" stroke-width="'+(selected?3:2)+'"/><text x="'+x+'" y="'+y+'" dy=".34em" text-anchor="middle" fill="'+(selected?'#111':color)+'" font-size="'+font+'">'+number+'</text></g>';
  }
  out+='</g>';
 }
 out+='<path class="coil-dimension-line" d="M80 538v22m480-22v22M80 550h480"/><text class="coil-dimension-text" x="320" y="578" text-anchor="middle">Корпус Ø '+fmt(g.diameter,1)+' мм · внутри Ø '+fmt(g.shellInside,1)+' мм</text>';
 return out;
}
function coilSideSvg(g,highlightRow=coilHighlightedRow,dimOpacity=.12,compact=false){
 const scale=Math.min(450/g.height,440/g.diameter),cx=320,y0=60,width=g.diameter*scale,height=g.height*scale,x0=cx-width/2,core=g.coreDiameter*scale;
 let out='<title>Вертикальный разрез — навивки змеевиков</title><rect class="coil-shell-wall" x="'+x0+'" y="'+y0+'" width="'+width+'" height="'+height+'" rx="8"/><path class="coil-shell-inside" fill="none" d="M'+(cx-g.shellInside*scale/2)+' '+y0+'v'+height+'M'+(cx+g.shellInside*scale/2)+' '+y0+'v'+height+'"/>';
 if(core>0)out+='<rect class="coil-core" x="'+(cx-core/2)+'" y="'+y0+'" width="'+core+'" height="'+(g.coreLength*scale)+'"/><rect x="'+(cx-core/2+g.coreWall*scale)+'" y="'+(y0+g.coreWall*scale)+'" width="'+Math.max(0,core-2*g.coreWall*scale)+'" height="'+Math.max(0,(g.coreLength-2*g.coreWall)*scale)+'" fill="none" stroke="#555" stroke-width=".7"/>';
 for(const row of [...g.rows].reverse()){
  const color=coilRowColor(row.index),radius=row.diameter*scale/2,opacity=highlightRow===null||highlightRow===row.index?1:dimOpacity,stroke=Math.max(1.1,Math.min(3,g.tubeDiameter*scale*.35));
  out+='<g opacity="'+opacity+'">';
  for(let j=0;j<row.count;j++){
   let front='',back='';const steps=Math.ceil(row.turns*4),phase=j/row.count*2*Math.PI+row.phase*Math.PI/180,handed=row.direction==='left'?-1:1;
   const pitchScale=row.pitch*scale/(2*Math.PI)*handed;
   for(let k=0;k<steps;k++){
    const a=phase+handed*k/steps*row.turns*2*Math.PI,b=phase+handed*(k+1)/steps*row.turns*2*Math.PI,delta=b-a;
    const x1=cx+radius*Math.cos(a),x2=cx+radius*Math.cos(b),y1=y0+(row.offset+g.tubeDiameter/2)*scale+(a-phase)*pitchScale,y2=y0+(row.offset+g.tubeDiameter/2)*scale+(b-phase)*pitchScale;
    const segment='M'+x1.toFixed(2)+' '+y1.toFixed(2)+'C'+(x1-radius*Math.sin(a)*delta/3).toFixed(2)+' '+(y1+pitchScale*delta/3).toFixed(2)+' '+(x2+radius*Math.sin(b)*delta/3).toFixed(2)+' '+(y2-pitchScale*delta/3).toFixed(2)+' '+x2.toFixed(2)+' '+y2.toFixed(2);
    if(Math.sin((a+b)/2)>=0)front+=segment;else back+=segment;
   }
   out+='<path d="'+back+'" fill="none" stroke="'+color+'" stroke-width="'+stroke+'" stroke-dasharray="3 4" opacity=".28"/><path d="'+front+'" fill="none" stroke="'+color+'" stroke-width="'+stroke+'" opacity=".8"/>';
  }
  out+='</g>';
 }
 const x=x0+width+24;
 out+='<path class="coil-dimension-line" d="M'+(x-6)+' '+y0+'h14m-14 '+height+'h14M'+x+' '+y0+'v'+height+'"/><text class="coil-dimension-text" transform="translate('+(x+20)+','+(y0+height/2)+') rotate(90)" text-anchor="middle">H = '+fmt(g.height,1)+' мм</text><text class="coil-dimension-text" x="320" y="'+(compact?y0+height+36:562)+'" text-anchor="middle">Труба Ø '+fmt(g.tubeDiameter)+' × '+fmt(g.tubeWall)+' мм · '+g.totalCount+' змеевиков</text>';
 return out;
}
function syncDesignLayoutVisibility(){const panel=$('design-layout');if(panel)panel.hidden=$('detail-preview-mode').value!=='layout';designLayout3d?.setVisible(!!panel&&!panel.hidden&&!$('construction-page').hidden);syncCoilThermalVisibility()}
function designLayout3dStatus(state,message=''){
 const host=$('layout-main-3d');host.dataset.status=state;
 $('layout-main-3d-state').textContent=state==='error'?'Не удалось показать 3D. '+message:state==='loading'?'Обновление 3D…':'';
}
function ensureDesignLayout3d(){
 if(designLayout3dLoading||!designLayoutGeometry)return;
 designLayout3dLoading=import('./assets/coil-3d/design-view.js?v=sequential-20261024').then(module=>{
  designLayout3d=module.createDesignView($('layout-main-3d'),designLayout3dStatus);
  syncDesignLayoutVisibility();designLayout3d.update(designLayoutGeometry,designLayoutSectionMode,detailCoilRow);
 }).catch(error=>designLayout3dStatus('error',error.message));
}
function syncDesignLayoutSectionMode(){
 $('layout-section-toggle').setAttribute('aria-pressed',String(designLayoutSectionMode==='section'));
}
function renderDesignRowVisibility(g){
 for(const button of document.querySelectorAll('[data-layout-part]')){const part=button.dataset.layoutPart,available=!!g&&(part==='shell'||g.coreDiameter>0),shown=available&&!g[part+'Hidden'],label=part==='shell'?'корпус':'вытеснительную трубу';button.disabled=!available;button.setAttribute('aria-pressed',String(shown));button.setAttribute('aria-label',(shown?'Скрыть ':'Показать ')+label);button.title=available?'':part==='core'?'Вытеснительная труба не задана в геометрии':'Проверьте геометрию аппарата'}
 const list=$('layout-row-visibility'),count=$('layout-visible-count'),showAll=$('layout-show-all');if(!g){list.replaceChildren();count.textContent='—';showAll.disabled=true;return}
 const shown=g.rows.filter(row=>!row.hidden).length;count.textContent=shown+' / '+g.rows.length;showAll.disabled=shown===g.rows.length;
 if(list.children.length!==g.rows.length)list.innerHTML=g.rows.map((_,i)=>'<button type="button" data-layout-row="'+i+'" aria-controls="layout-main-3d"><span class="layout-row-check" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="m2 6 3 3 5-6"/></svg></span><span class="layout-row-dot" aria-hidden="true"></span><span>Ряд '+(i+1)+'</span></button>').join('');
 for(const button of list.children){const index=Number(button.dataset.layoutRow),shown=!g.rows[index].hidden;button.setAttribute('aria-pressed',String(shown));button.setAttribute('aria-label',(shown?'Скрыть':'Показать')+' ряд '+(index+1));button.style.setProperty('--row-color',coilRowColor(index))}
}
function renderDesignLayout(g,errorMessage=''){
 const panel=$('design-layout');if(!panel)return;syncDesignLayoutVisibility();
 designLayoutGeometry=g;renderDesignRowVisibility(g);designLayout3d?.update(g,designLayoutSectionMode,detailCoilRow);
 const message=$('design-layout-error');message.hidden=!!g;message.textContent=g?'':'Проверьте геометрию слева. '+errorMessage;$('design-layout-grid').hidden=!g;
}
function initializeLayoutSidebar(){
 const slot=$('layout-main-slot'),toggle=$('layout-sidebar-toggle'),content=$('layout-sidebar-content'),storageKey='physnow-layout-sidebar-v1';
 let collapsed=false;try{collapsed=JSON.parse(localStorage.getItem(storageKey))?.collapsed===true}catch{}
 function apply(){slot.dataset.sidebarCollapsed=String(collapsed);content.hidden=collapsed;content.inert=collapsed;toggle.setAttribute('aria-expanded',String(!collapsed));toggle.setAttribute('aria-label',collapsed?'Развернуть панель конструкции':'Свернуть панель конструкции');toggle.title=collapsed?'Развернуть панель':'Свернуть панель'}
 function persist(){try{localStorage.setItem(storageKey,JSON.stringify({collapsed}))}catch{}}
 toggle.addEventListener('click',()=>{collapsed=!collapsed;apply();persist()});apply();persist();
}
function initializeDesignLayout(){
 initializeLayoutSidebar();syncDesignLayoutSectionMode();
 $('design-layout').addEventListener('click',event=>{
  if(event.target.closest('#layout-section-toggle')){designLayoutSectionMode=designLayoutSectionMode==='section'?'full':'section';syncDesignLayoutSectionMode();renderDesignGeometryFeedback();return}
  if(event.target.closest('#layout-show-all')){if(!designLayoutGeometry)return;verificationState.rows.forEach((row,index)=>{row.hidden=false;designLayoutGeometry.rows[index].hidden=false;designLayout3d?.setRowVisible(index,true)});renderDesignRowVisibility(designLayoutGeometry);save();return}
  const partButton=event.target.closest('[data-layout-part]');if(partButton){if(!designLayoutGeometry||partButton.disabled)return;const part=partButton.dataset.layoutPart,key=part+'Hidden';verificationState[key]=!verificationState[key];designLayoutGeometry[key]=verificationState[key];designLayout3d?.setPartVisible(part,!verificationState[key]);renderDesignRowVisibility(designLayoutGeometry);save();return}
  const button=event.target.closest('[data-layout-row]');if(!button||!designLayoutGeometry)return;
  const index=Number(button.dataset.layoutRow),row=verificationState.rows[index];row.hidden=!row.hidden;designLayoutGeometry.rows[index].hidden=row.hidden;designLayout3d?.setRowVisible(index,!row.hidden);renderDesignRowVisibility(designLayoutGeometry);save();
 });
 designLayoutMainObserver=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting))ensureDesignLayout3d()},{rootMargin:'150px'});designLayoutMainObserver.observe($('layout-main-slot'));
 window.addEventListener('pagehide',event=>{if(!event.persisted){designLayoutMainObserver.disconnect();designLayout3d?.dispose()}},{once:true});
}
function syncPageView(){
 if(!verificationUIReady)return;
 const verification=headerNavigation.dataset.activeSection==='verification',construction=headerNavigation.dataset.activeSection==='construction';
 $('design-page').hidden=verification||construction;$('construction-page').hidden=!construction;$('verification-page').hidden=!verification;
 syncDesignLayoutVisibility();
 const actionsTarget=document.querySelector(verification?'.verification-heading-actions':construction?'.construction-heading-actions':'.calculator-overview>.heading .heading-actions');
 actionsTarget.append($('calculation-actions'));
 if(verification){if(!verificationState)verificationState=seedCoilGeometry(getState());fillVerificationInputs();document.title='PhysNow'}
 else{document.title='PhysNow';if(construction){if($('detail-preview-mode').value==='layout')ensureDesignLayout3d()}else requestAnimationFrame(fitDiagram)}
}
function exportCoilGeometry(){
 const g=currentCoilGeometry;if(!g){toast('Проверьте геометрию перед экспортом');return}
 const detailFields=[['coreLength','Длина вытеснительной трубы','мм'],['coreWall','Стенка вытеснительной трубы','мм'],['coreClearance','Зазор до вытеснителя','мм'],['shellClearance','Зазор до корпуса','мм'],['rowClearance','Зазор между рядами','мм'],['leadBendRadius','Радиус отвода по оси','мм'],['leadStraightLength','Прямой участок после отвода','мм']];
 const rows=[['PhysNow — геометрия змеевикового аппарата'],['Параметр','Значение','Единица'],...[...coilFieldDefinitions(),...detailFields].map(([key,label,unit])=>[label,g[key],unit]),[],['Ряд','Диаметр навивки, мм','Змеевиков','Витков','Шаг, мм','Смещение по высоте, мм','Начальный угол, °','Направление навивки','Длина одного, м','Поверхность ряда, м²','Высота, мм'],...g.rows.map(r=>[r.index+1,r.diameter,r.count,r.turns,r.pitch,r.offset,r.phase,r.direction==='left'?'Левое':'Правое',r.coilLength,r.area,r.height]),[],['Змеевиков всего',g.totalCount,'шт.'],['Общая длина труб',g.totalLength,'м'],['Поверхность',g.totalArea,'м²'],['Внутренний объём труб',g.tubeVolume*1000,'л'],['Свободный объём корпуса',g.shellVolume*1000,'л'],['Примечание','Без подводящих участков. Вытеснительная труба закрыта, её полость не входит в свободный объём корпуса. Поверхность здесь наружная. Тепловой расчёт Teplo и его отдельный отчёт используют средний диаметр трубки. Гидравлические потери не рассчитываются.']];
 const csv='\uFEFF'+rows.map(row=>row.map(value=>'"'+String(typeof value==='number'?fmt(value,6):value).replaceAll('"','""')+'"').join(';')).join('\r\n');
 const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'})),link=document.createElement('a');link.href=url;link.download='physnow-coil-geometry.csv';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Геометрия змеевиков экспортирована в CSV');
}
initializeVerificationPage();
initializeDesignGeometry();
initializeDesignLayout();
initializeCoilThermalMethod();

function syncCoilThermalVisibility(){
 if(!coilThermalUI)return;
 const verification=!$('verification-page').hidden,design=!$('construction-page').hidden&&$('detail-preview-mode').value==='characteristics';
 $('coil-thermal-design').hidden=!design;$('coil-thermal-verification').hidden=!verification;
 coilThermalUI.mount($(verification?'coil-thermal-verification':'coil-thermal-design'),verification||design);
}
function coilThermalSourceInputs(){
 if(currentResult?.method==='Teplo'){if(lastError)throw Error('Исправьте исходные данные в верхнем блоке.');return CoilProjectMethod.source(getState(),currentResult)}
 if(flow!=='counter')throw Error('Методика Teplo описывает только противоток. Переключите схему движения в верхнем блоке.');
 const state=getState();if(!currentResult||lastError)throw Error('Исправьте исходные данные потоков в верхнем блоке проектировочного расчёта.');
 if(state['hot-fluid']!=='water'||state['cold-fluid']!=='water')throw Error('Для Teplo пока поддерживается вода в обоих контурах. Выберите среду в верхнем блоке.');
 const conductivity=Number(state['tube-conductivity']);if(state['tube-conductivity']===''||!Number.isFinite(conductivity)||conductivity<=0)throw Error('Задайте положительную теплопроводность стенки λw в верхнем блоке конструкции.');
 const result={hot_fluid:'Water',cold_fluid:'Water',t_hot_in_c:currentResult.thi,t_cold_in_c:currentResult.tci,p_hot_mpa:currentResult.ph,p_cold_mpa:currentResult.pc,wall_conductivity_w_mk:conductivity};
 for(const [side,key,unit] of [['hot','mh','hot-flow-unit'],['cold','mc','cold-flow-unit']]){const mode=state[unit],v=Number(state[key]);if(['kg-s','kg-h'].includes(mode)){result[side+'_flow_mode']='mass';result['mass_flow_'+side+'_kg_s']=currentResult[key]}else{result[side+'_flow_mode']='volume';result['volume_flow_'+side+'_m3_h']=v*(mode==='m3-s'?3600:mode==='l-s'?3.6:1)}}
 return result;
}
function initializeCoilThermalMethod(){
 for(const [id,parent] of [['coil-thermal-design',document.querySelector('.design-detail-preview')],['coil-thermal-verification',$('verification-page')]]){const host=document.createElement('div');host.id=id;host.hidden=true;parent.append(host)}
 coilThermalUI=PhysNowCoilThermalUI.create({
  change(){syncDetailThermalArrangement();refreshOpenExchangerCard()},
  card(){openExchangerCard({thermal:true})},
  geometry(){if(!verificationState)return null;return calculateCoilGeometry(verificationState)},
  save(state){coilThermalInputs=state;save();if($('exchanger-type').value==='coil')updateCoilProject()},
  assess(result){return currentResult?.method==='Teplo'?{meets:CoilProjectMethod.meets(result,currentResult),applicability:CoilProjectMethod.applicability(result,currentResult),target:currentResult}:null},
  source:coilThermalSourceInputs
 });
 coilThermalUI.setState(coilThermalInputs);syncCoilThermalVisibility();
 window.addEventListener('pagehide',event=>{if(!event.persisted)coilThermalUI.dispose()});
}

// Account for wrapped navigation on narrow screens when scrolling to controls.
const stickyHeaderObserver=new ResizeObserver(()=>document.documentElement.style.setProperty('--cad-header-height',Math.ceil(document.querySelector('.cad-header').getBoundingClientRect().height)+'px'));
stickyHeaderObserver.observe(document.querySelector('.cad-header'));
