import {createDesignView} from './coil-3d/design-view.js?v=audit-comparison-20261106';
import {changeKind,changeLabels,resultReason,axialGap,windingArea,matches} from './coil-audit-utils.js';

const $=id=>document.getElementById(id),sides=['before','after'],views={},bounds={};
let data=null,current=null,filtered=[],mode='section';
const number=(v,d=2)=>Number.isFinite(v)?new Intl.NumberFormat('ru-RU',{maximumFractionDigits:d}).format(v):'—';
function element(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(className)node.className=className;return node}
function badge(node,text,kind){node.textContent=text;node.dataset.kind=kind}
function updateEnvelope(){
 const valid=Object.values(bounds).filter(Boolean),envelope=$('same-scale').checked&&valid.length?{height:Math.max(...valid.map(v=>v.height)),diameter:Math.max(...valid.map(v=>v.diameter))}:null;
 for(const side of sides)views[side]?.setFitEnvelope(envelope);
}
function cameraChanged(side,state){if($('sync').checked)views[side==='before'?'after':'before']?.setCameraState(state)}
function createViews(){
 for(const side of sides){
  try{views[side]=createDesignView($(side+'-view'),(state,message,meta)=>{
   const host=$(side+'-view');host.dataset.status=state;
   if(!current?.[side].found)return;
   $(side+'-message').textContent=state==='ready'?'':state==='loading'?'Строю 3D-модель…':message;
   if(state==='ready'&&meta){bounds[side]={height:meta.height,diameter:meta.diameter};updateEnvelope()}
  },{onCameraChange:state=>cameraChanged(side,state),modelQuality:{stepsPerTurn:48,radialSegments:16}})}
  catch{$(side+'-view').dataset.status='unsupported'}
 }
}
function renderSummary(){
 const all=data.cases,common=all.filter(c=>c.before.found&&c.after.found);
 $('summary').replaceChildren(...[[all.length,'заданий'],[data.sources.before.summary.found+' → '+data.sources.after.summary.found,'найдено конструкций'],[common.filter(c=>changeKind(c)==='shorter').length+' / '+common.length,'общих решений короче']].map(([value,label])=>{const div=element('div');div.append(element('strong',value),element('span',label));return div}));
}
function renderList(){
 filtered=data.cases.filter(c=>matches(c,$('filter').value,$('search').value));
 $('list-count').textContent=filtered.length+' из '+data.cases.length+' заданий';
 const fragment=document.createDocumentFragment();
 for(const c of filtered){const button=element('button',undefined,'case-item');button.type='button';button.dataset.id=c.id;button.dataset.change=changeKind(c);button.setAttribute('aria-current',String(c.id===current?.id));button.setAttribute('aria-label','Задание '+c.id+' · '+changeLabels[changeKind(c)]);button.append(element('strong',c.id),element('small',number(c.inputs.mh)+' кг/с'),element('span',changeLabels[changeKind(c)],'mini-status'));button.addEventListener('click',()=>{selectCase(c);if(matchMedia('(max-width:720px)').matches)document.querySelector('.case-heading').scrollIntoView({block:'start',behavior:'smooth'})});fragment.append(button)}
 if(!filtered.length)fragment.append(element('p','По этому фильтру заданий нет.','empty-list'));
 $('case-list').replaceChildren(fragment);
 document.querySelector('.detail').hidden=!filtered.length;
 if(filtered.length&&!filtered.some(c=>c.id===current?.id))selectCase(filtered[0]);else updatePager();
}
function updatePager(){const index=filtered.findIndex(c=>c.id===current?.id);$('previous').disabled=index<=0;$('next').disabled=index<0||index>=filtered.length-1}
function inputStat(label,value,note){const div=element('div',undefined,'input-stat');div.append(element('span',label),element('strong',value),element('small',note));return div}
function renderInputs(c){
 const s=c.inputs,t=c.target;
 $('inputs').replaceChildren(inputStat('Горячий поток · внутри труб',s.thi+' → '+s.tho+' °C',number(s.mh)+' кг/с · '+number(s.ph)+' МПа абс.'),inputStat('Холодный поток · межтрубное',s.tci+' → '+s.tco+' °C',number(t.mc,4)+' кг/с · '+number(s.pc)+' МПа абс.'),inputStat('Задание по мощности',number(t.q)+' кВт','Температурный напор '+number(t.dt)+' К'),inputStat('Общие условия','Труба 14 × 2,5 мм','L ≤ 10 м · D ≤ 3 м · запас UA 0 %'));
}
function parameterRow(label,a,b,unit='',digits=2,delta=true){
 const tr=element('tr'),format=v=>v===null||v===undefined?'—':typeof v==='number'?number(v,digits)+(unit?' '+unit:''):v;
 tr.append(element('th',label),element('td',format(a)),element('td',format(b)));
 const numeric=Number.isFinite(a)&&Number.isFinite(b),diff=numeric?b-a:0;
 tr.dataset.changed=String(numeric&&Math.abs(diff)>1e-7);
 tr.append(element('td',delta&&numeric?(Math.abs(diff)<1e-7?'Без изменения':(diff>0?'+':'−')+number(Math.abs(diff),digits)+(unit?' '+unit:'')):'—'));
 return tr;
}
function renderParameters(c){
 const old=c.before.selected,now=c.after.selected,g=old?.geometry,h=now?.geometry;
 const rows=[['Рабочая высота корпуса',g?.height,h?.height,'мм',0],['Наружный диаметр корпуса',g?.diameter,h?.diameter,'мм',0],['Стенка корпуса',g?.shellWall,h?.shellWall,'мм',0],['Диаметр вытеснительной трубы',g?.coreDiameter,h?.coreDiameter,'мм',0],['Длина вытеснительной трубы',g?.coreLength,h?.coreLength,'мм',0],['Стенка вытеснительной трубы',g?.coreWall,h?.coreWall,'мм',0],['Трубка',g?g.tubeDiameter+' × '+g.tubeWall+' мм':null,h?h.tubeDiameter+' × '+h.tubeWall+' мм':null],['Радиальных рядов',old?.rowCount,now?.rowCount,'',0],['Змеевиков всего',old?.n,now?.n,'шт.',0],['Вертикальный зазор между стенками',g?axialGap(g):null,h?axialGap(h):null,'мм',3],['Межосевое расстояние / d',g?g.rows[0].pitch/g.rows[0].count/g.tubeDiameter:null,h?h.rows[0].pitch/h.rows[0].count/h.tubeDiameter:null,'',3],['Радиальный зазор между рядами',g?.rows.length>1?g.rowClearance:null,h?.rows.length>1?h.rowClearance:null,'мм',0],['Зазор до корпуса',g?.shellClearance,h?.shellClearance,'мм',0],['Зазор до вставки',g?.coreClearance,h?.coreClearance,'мм',0],['Радиус отвода по оси',g?.leadBendRadius,h?.leadBendRadius,'мм',0],['Прямой конец после отвода',g?.leadStraightLength,h?.leadStraightLength,'мм',0],['Тепловая поверхность навивки',g?windingArea(g):null,h?windingArea(h):null,'м²',3],['Фактическая мощность',old?.q,now?.q,'кВт',3],['Отклонение от задания',old?(old.ratio-1)*100:null,now?(now.ratio-1)*100:null,'%',4],['Горячий выход',old?.hot,now?.hot,'°C',3],['Холодный выход',old?.cold,now?.cold,'°C',3],['Re в трубках',old?.re,now?.re,'',0],['Re межтрубного потока',old?.shellRe,now?.shellRe,'',0],['Полных проверок в поиске',c.before.checks,c.after.checks,'',0],['Пробных поверок без сходимости',c.before.errors,c.after.errors,'',0]];
 $('parameters').replaceChildren(...rows.map(row=>parameterRow(...row)));
 const fragment=document.createDocumentFragment(),count=Math.max(g?.rows.length||0,h?.rows.length||0);
 if(!count){const tr=element('tr'),td=element('td','В обеих версиях принятая конструкция отсутствует.');td.colSpan=3;tr.append(td);fragment.append(tr)}
 for(let i=0;i<count;i++){
  const a=g?.rows[i],b=h?.rows[i],ma=old?.manufacturing[i],mb=now?.manufacturing[i],title=element('tr'),th=element('th','Ряд '+(i+1));th.colSpan=3;title.dataset.subhead='true';title.append(th);fragment.append(title);
  const specs=[['Диаметр навивки, мм',a?.diameter,b?.diameter],['Змеевиков в ряду',a?.count,b?.count],['Витков на змеевик',a?.turns,b?.turns],['Смещение по высоте, мм',a?.offset,b?.offset],['Начальный угол, °',a?.phase,b?.phase],['Шаг одного змеевика, мм',a?.pitch,b?.pitch],['Межосевой вертикальный шаг, мм',a?a.pitch/a.count:null,b?b.pitch/b.count:null],['Вертикальный зазор, мм',a?axialGap(g,a):null,b?axialGap(h,b):null],['Полная длина одной трубки, м',ma?ma.totalMM/1000:null,mb?mb.totalMM/1000:null],['Заготовка, м',ma?ma.stockMM/1000:null,mb?mb.stockMM/1000:null],['Остаток заготовки, %',ma?ma.wasteFraction*100:null,mb?mb.wasteFraction*100:null]];
  for(const [label,x,y]of specs){const tr=element('tr');tr.append(element('th',label),element('td',number(x,3)),element('td',number(y,3)));fragment.append(tr)}
 }
 $('rows').replaceChildren(fragment);
}
function renderOutcome(c){
 const host=$('outcome');host.replaceChildren();
 for(const [side,label]of [['before','До'],['after','После']]){
  const p=element('p');p.append(element('strong',label+': '),document.createTextNode(resultReason(c[side])));
  if(!c[side].found&&c[side].closest)p.append(document.createTextNode(' Ближайшая проверенная по остальным критериям мощность: '+number(c[side].closest.ratio*100,3)+' % задания.'));
  host.append(p);
 }
 if(c.before.found){const g=c.before.selected.geometry,spacing=g.rows[0].pitch/g.rows[0].count/g.tubeDiameter,gap=axialGap(g);if(spacing>2+1e-7||spacing<1.1-1e-7||Math.abs(gap-Math.round(gap))>1e-7)host.append(element('p','Прежняя конструкция показана как результат v8. Её вертикальный шаг или дробный зазор не удовлетворяют новым условиям v9.'))}
}
function renderModels(reset=true){
 for(const side of sides){
  const value=current[side],host=$(side+'-view'),message=$(side+'-message');host.dataset.found=String(value.found);host.dataset.caseId=current.id;badge($(side+'-badge'),value.found?'Найдена':'Не найдена',value.found?'found':'none');bounds[side]=null;
  if(!value.found){views[side]?.update(null,mode,-1);message.replaceChildren(element('strong','Конструкция не найдена'),element('span',resultReason(value)));$(side+'-caption').textContent=value.checks+' полных проверок · принятой геометрии нет';continue}
  const g=structuredClone(value.selected.geometry);g.shellHidden=!$('shell').checked;g.coreHidden=!$('core').checked;
  if(views[side]){message.textContent='Строю 3D-модель…';views[side].update(g,mode,-1);if(reset)views[side].resetView()}
  else{message.textContent='3D недоступно в этом браузере. Все параметры конструкции приведены ниже.'}
  $(side+'-caption').textContent='H '+number(g.height,0)+' × Ø'+number(g.diameter,0)+' мм · '+value.selected.n+' змеевиков · зазор '+number(axialGap(g),3)+' мм';
  host.dataset.caseId=current.id;
 }
 updateEnvelope();
}
function selectCase(c){
 current=c;document.querySelector('.detail').hidden=false;$('case-title').textContent='Задание '+c.id;
 badge($('change-badge'),changeLabels[changeKind(c)],changeKind(c));
 const old=c.before.selected,now=c.after.selected;
 $('case-note').textContent=old&&now?'Высота '+number(old.height,0)+' → '+number(now.height,0)+' мм · '+(now.height<old.height?'короче на '+number(old.height-now.height,0)+' мм':now.height>old.height?'длиннее на '+number(now.height-old.height,0)+' мм':'длина не изменилась'):'Сопоставление результатов одного задания при одинаковых исходных данных';
 renderInputs(c);renderParameters(c);renderOutcome(c);renderModels();
 for(const button of $('case-list').querySelectorAll('button'))button.setAttribute('aria-current',String(button.dataset.id===c.id));
 const active=$('case-list').querySelector('[aria-current=true]');if(active){const list=$('case-list');list.scrollTop+=active.getBoundingClientRect().top-list.getBoundingClientRect().top-list.clientHeight/2+active.clientHeight/2}
 updatePager();history.replaceState(null,'','#'+c.id);
}
function requestedCase(){let id='';try{id=decodeURIComponent(location.hash.slice(1))}catch{}return data.cases.find(c=>c.id===id)||data.cases.find(c=>c.id==='C-2.5')||data.cases[0]}
$('search').addEventListener('input',renderList);$('filter').addEventListener('change',renderList);
$('previous').addEventListener('click',()=>selectCase(filtered[filtered.findIndex(c=>c.id===current.id)-1]));
$('next').addEventListener('click',()=>selectCase(filtered[filtered.findIndex(c=>c.id===current.id)+1]));
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{mode=button.dataset.mode;document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));renderModels(false)}));
for(const name of ['shell','core'])$(name).addEventListener('change',()=>{for(const side of sides)views[side]?.setPartVisible(name,$(name).checked)});
$('same-scale').addEventListener('change',updateEnvelope);
$('sync').addEventListener('change',()=>{if($('sync').checked&&views.before)views.after?.setCameraState(views.before.getCameraState())});
$('reset-view').addEventListener('click',()=>{for(const side of sides)views[side]?.resetView()});
for(const [id,factor]of [['zoom-in',1.3],['zoom-out',1/1.3]])$(id).addEventListener('click',()=>{for(const side of sides){const view=views[side];if(!view)continue;const state=view.getCameraState();state.zoom.zoom*=factor;view.setCameraState(state)}});
window.addEventListener('hashchange',()=>{if(!data)return;$('search').value='';$('filter').value='all';current=requestedCase();renderList();selectCase(current)});
window.addEventListener('pagehide',()=>{for(const side of sides)views[side]?.dispose()},{once:true});
try{
 const response=await fetch('./coil-audit-data.json?v=20261106');if(!response.ok)throw Error('HTTP '+response.status);
 data=await response.json();if(data.schema!==1||data.cases.length!==150)throw Error('Некорректный набор испытаний');
 $('load-status').hidden=true;$('workspace').hidden=false;renderSummary();createViews();current=requestedCase();renderList();selectCase(current);
}catch(error){$('load-status').textContent='Не удалось загрузить результаты испытаний. Обновите страницу. '+error.message}
