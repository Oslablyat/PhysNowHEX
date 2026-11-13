/* Teplo verification reads the current sheet's upper source controls. */
(function(root){
 'use strict';
 const base={arrangement:'inline'};
 const f=(n,d=3)=>n==null?'—':new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(n);
 const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 function create(hooks){
  let state={...base},worker=null,id=0,timer=null,result=null,lastInputs=null,version='',active=false,requested=false;
  const element=document.createElement('section');element.className='coil-thermal';element.id='coil-thermal-panel';element.setAttribute('aria-label','Теплогидравлические характеристики');
  element.innerHTML='<p class="coil-thermal-status" id="coil-thermal-status" role="status" aria-live="polite"></p><div id="coil-thermal-results"></div>'+
   '<details class="coil-thermal-method"><summary>Формулы и границы расчёта</summary><p>Fᵢ = πdₘLᵢ; Lᵢ = nᵢ√((2πRᵢ)² + hᵢ²). Общий трубный расход делится поровну между змеевиками. Aс = min[π(Ds² − Dd²)/4 − 2πRᵣdₒ,ᵣ]. Одна кольцевая полоса на радиальный ряд, без умножения на число змеевиков.</p><p>Nuₕ,ᵢ = 0,021 Reₕ,ᵢ⁰·⁸ Prₕ⁰·⁴³ (1 + 1,77dᵢ/Rᵢ) εL,ᵢ εT,h. При Reс &lt; 1000: Nuс = 0,56 Reс⁰·⁵ Prс⁰·³⁶ εT,c εb. Иначе: Nuс = C Reсᵐ Prс⁰·³³ εT,c εb εs; C/m = 0,26/0,65 либо 0,41/0,6.</p><p>Осредняется только трубная α по Fᵢ. Межтрубные Nu и α — общие для аппарата. Kₗ,ᵢ = π/[1/(αсdₒ) + ln(dₒ/dᵢ)/(2λw) + 1/(ᾱₕdᵢ)]; UA = ΣKᵢFᵢ. Выходы вычисляются методом ε–NTU для противотока, с пределом Cmin/Cmax → 1.</p><p>Свойства потоков и Pr у стенки — CoolProp 8.0.0 при текущих температурах и абсолютном давлении. Масса фиксируется по плотности на входе. Два вложенных цикла: до 200 итераций каждый, допуск 0,01 °C по стенке и обоим выходам. Проверки: Reₕ &gt; 2300 + 10500(dᵢ/R)⁰·³; 3 &lt; R/dᵢ &lt; 12; Reс &lt; 100000; область таблицы εL. Нарушение применимости сохраняет численный результат с предупреждением. Геометрическая ошибка или отсутствие сходимости блокирует результат.</p><p>Принят эквивалентный общий UA, без пошагового температурного профиля по рядам. Потери давления, загрязнения, прочность и фазовые переходы не рассчитываются. Источник переноса — METHODOLOGY.md и heat_exchanger_method.py из Teplo.zip; старый teplo_report.txt не используется как эталон.</p><a href="assets/teplo-methodology.md" target="_blank" rel="noopener">Полное описание приложенной методики</a></details>';
  const status=element.querySelector('#coil-thermal-status'),output=element.querySelector('#coil-thermal-results');
  function notify(){hooks.change?.()}
  function invalidate(){id++;result=null;lastInputs=null;output.replaceChildren();status.hidden=false;status.dataset.kind='pending';status.textContent='Расчёт обновляется…';element.dataset.status='pending';notify()}
  function geometryInput(){
   const g=hooks.geometry();if(!g)throw Error('Сначала задайте корректную геометрию змеевиков');
   if(Number(g.coreDiameter)>0&&Number(g.coreLength)<Math.max(...g.rows.map(r=>Number(r.offset??0)+Number(r.turns)*Number(r.pitch))))throw Error('Методика предполагает вытеснительную трубу по всей высоте навивки. Увеличьте её длину.');
   return {...state,...hooks.source(),row_count:g.rows.length,shell_inner_diameter_m:(Number(g.diameter)-2*Number(g.shellWall))/1000,displacer_outer_diameter_m:Number(g.coreDiameter)/1000,tube_outer_diameter_m:Number(g.tubeDiameter)/1000,tube_wall_thickness_m:Number(g.tubeWall)/1000,coil_rows:g.rows.map(r=>({count:Number(r.count),radius_m:Number(r.diameter)/2000,pitch_m:Number(r.pitch)/1000,turns:Number(r.turns),tube_outer_diameter_m:Number(g.tubeDiameter)/1000}))};
  }
  function fail(message){result=null;lastInputs=null;output.replaceChildren();status.hidden=false;status.dataset.kind='error';status.textContent=message;element.dataset.status='error';notify()}
  function table(title,headers,rows){return '<section class="coil-thermal-table"><h3>'+title+'</h3><div><table><thead><tr>'+headers.map(s=>'<th>'+s+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(v=>'<td>'+esc(v)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div></section>'}
 function cardGroups(groups){return '<section class="coil-thermal-inline-card"><h3>Общие параметры</h3>'+groups.map(group=>table(group.title,['Параметр','Значение','Единица'],group.items.map(item=>[item[0]??'',item[1]??'—',item[2]??'']))).join('')+'</section>'}
  function metrics(entries){return '<div class="coil-thermal-metrics">'+entries.map(([name,value,unit])=>'<div><span>'+name+'</span><b>'+esc(value)+' <small>'+unit+'</small></b></div>').join('')+'</div>'}
  function render(r){
   const assessment=hooks.assess?.(r);element.dataset.status='ready';status.dataset.kind=r.valid&&assessment?.meets!==false?'valid':'warning';status.textContent=r.valid?(assessment?.meets===false?'Критерии применимости выполнены, но проектное задание или запас UA не выполнены. Конструкция не подтверждена.':assessment?.meets?'Проектное задание, запас UA и критерии применимости Teplo выполнены.':'Критерии применимости выполнены.'):'Есть невыполненные критерии применимости. Числа рассчитаны вне области корреляции — не считать конструкцию подтверждённой.';
   if(assessment?.target?.projectAlgorithm){const percent=(assessment.agreement?.limit??.01)*100;status.dataset.kind=assessment.meets?'valid':'warning';status.textContent=assessment.meets?'Мощность от задания до +'+percent+' %, выходные температуры в допуске, Re 15000…20000 и критерии Teplo выполнены. Запас UA 0 %.':'Мощность должна быть от задания до +'+percent+' %, выходы — в допуске. Есть невыполненные условия задания, Re или методики Teplo. Запас UA 0 %.';}
   if(assessment?.applicability?.tubeReUnrestricted){
    status.dataset.kind=assessment.meets&&r.valid?'valid':'warning';
    status.textContent=assessment.meets?(r.valid?'Тепловое задание выполнено. Один змеевик: Re трубного потока не ограничен. Остальные критерии Teplo выполнены.':'Тепловое задание выполнено с исключением по Re трубного потока. Применимость корреляции Teplo по Re не подтверждена.'):'Один змеевик: Re трубного потока не ограничен. Не выполнены тепловое задание или другие условия методики.';
   }
   const sh=r.shell,checks=r.coils.flatMap(c=>c.tube_checks.map(message=>['Змеевик '+c.index+' · ряд '+c.row,message]));checks.push(...sh.checks.map(message=>['Межтрубная сторона',message]));
   if(assessment?.target?.projectAlgorithm&&!assessment?.applicability?.tubeReUnrestricted)for(const c of r.coils)if(c.re_hot<15000||c.re_hot>20000)checks.push(['Змеевик '+c.index+' · ряд '+c.row,'Проектное ограничение: 15000 ≤ Re ≤ 20000; Re='+f(c.re_hot)]);
   if(assessment?.agreement)checks.push(...assessment.agreement.checks.map(message=>['Соответствие проектному заданию',message]));
   output.innerHTML=root.CoilTemperatureChart.markup(lastInputs,r)+metrics([['Мощность Q',f(r.heat_duty_kw,6),'кВт'],['Горячая · выход',f(r.t_hot_out_c,6),'°C'],['Холодная · выход',f(r.t_cold_out_c,6),'°C'],['Средний K',f(r.overall_u_w_m2k),'Вт/(м²·К)'],['Проводимость UA',f(r.ua_w_k),'Вт/К'],['F по среднему диаметру',f(r.area_m2,6),'м²']])+
    (checks.length?table('Невыполненные условия',['Объект','Условие и фактическое значение'],checks):'')+
    cardGroups(hooks.cardSections?.(r,lastInputs,version)||[]);
   status.hidden=status.dataset.kind==='valid';root.CoilTemperatureChart.bind(output,lastInputs,r);notify();
  }
  function run(){
   clearTimeout(timer);if(!active&&!requested)return;
   try{const inputs=geometryInput();root.CoilThermalMethod.buildLayout(inputs);lastInputs=inputs;
    const cached=hooks.verified?.(inputs);
    if(cached){result=cached.result;version=cached.version;render(result);return}
    if(!worker){worker=new Worker(new URL('coil-thermal-worker.js',new URL('assets/',document.baseURI)),{type:'module'});worker.onmessage=({data})=>{if(data.id!==id)return;if(data.error){fail(data.error);return}result=data.result;version=data.version;render(result)};worker.onerror=()=>{worker?.terminate();worker=null;fail('Не удалось загрузить CoolProp или выполнить расчёт. Проверьте доступность файлов сайта и повторите ввод.')};}
    status.textContent='Расчёт по методике · загрузка CoolProp при первом запуске…';worker.postMessage({id,inputs});
   }catch(error){fail(error.message)}
  }
  function refresh(){invalidate();clearTimeout(timer);if(active||requested)timer=setTimeout(run,250)}
  function commit(){hooks.save({...state});refresh()}
  function setArrangement(value){if(!['inline','staggered'].includes(value))return;if(state.arrangement===value)return;state.arrangement=value;commit()}
  return {setArrangement,get arrangement(){return state.arrangement},mount(host,visible){const changed=element.parentElement!==host||active!==visible;host.append(element);active=visible;element.hidden=!visible;if(changed&&visible)refresh()},setState(saved){state={...base,arrangement:saved?.arrangement==='staggered'?'staggered':'inline'};refresh()},refresh,element,get result(){return result},get inputs(){return lastInputs},get snapshot(){return {result,inputs:lastInputs,version,status:element.dataset.status,message:status.textContent}},request(value=true){requested=value;if(value&&!result){clearTimeout(timer);run()}},dispose(){clearTimeout(timer);worker?.terminate()}};
 }
 root.PhysNowCoilThermalUI={create};
})(globalThis);
