const status=document.getElementById('render-status');
const form=document.getElementById('geometry-form');
const errorBox=document.getElementById('validation-error');
const viewports=[document.getElementById('whole-view'),document.getElementById('section-view')];
const fail=error=>{
  console.error(error);status.textContent='3D недоступно';
  for(const host of viewports){host.querySelector('.loading')?.remove();const note=document.createElement('div');note.className='render-failure';note.textContent='Не удалось показать 3D. Нужен браузер с WebGL 2 и включённым аппаратным ускорением. Если страница была открыта давно, попробуйте обновить её.';const button=document.createElement('button');button.type='button';button.textContent='Повторить загрузку';button.onclick=()=>location.reload();note.append(button);host.append(note);}
};

async function main(){
  // Local pinned dependencies: this page needs no network/CDN and never loads app.js.
  const [THREE,model,{createModelLighting}]=await Promise.all([import('../vendor/three-0.186.1/three.module.min.js'),import('./model.js'),import('./lighting.js?v=bottom-fill-20261024')]);
  document.getElementById('three-version').textContent='r'+THREE.REVISION;
  const views=[],cache=new model.GeometryCache(),rowKeys=['coilDiameter','turns','pitch','count'],globalKeys=Object.keys(model.DEFAULTS).filter(key=>!rowKeys.includes(key));
  let mode='cutaway',current=model.exampleParameters(3),rows=current.rows.map(row=>({...row})),selectedRow=0,pending=0,lost=false;
  const number=new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1});
  const field=key=>form.elements.namedItem(key),rowCount=document.getElementById('row-count');
  const numeric=key=>field(key).value===''?NaN:Number(field(key).value);
  const rowColor=i=>'#'+model.ROW_COLORS[i].toString(16).padStart(6,'0');
  const plural=(n,one,few,many)=>n%100>=11&&n%100<=14?many:n%10===1?one:n%10>=2&&n%10<=4?few:many;
  function stashSelectedRow(){if(rows[selectedRow])for(const key of rowKeys)rows[selectedRow][key]=numeric(key);}
  function syncRowControls(){for(const key of rowKeys)field(key).value=Number.isFinite(rows[selectedRow][key])?rows[selectedRow][key]:'';document.getElementById('selected-row-title').textContent='Параметры ряда '+(selectedRow+1);}
  function syncRowsUI(){
    for(const [id,legend] of [['row-tabs',false],['row-legend',true]]){
      const host=document.getElementById(id);
      if(host.children.length!==rows.length){host.replaceChildren();for(let i=0;i<rows.length;i++){const button=document.createElement('button');button.type='button';button.dataset.selectRow=String(i);button.style.setProperty('--row-color',rowColor(i));button.append(document.createElement('i'));const title=document.createElement('span');title.textContent='Ряд '+(i+1);button.append(title);if(legend)button.append(document.createElement('small'));host.append(button);}}
      for(const [i,button] of [...host.children].entries()){button.setAttribute('aria-pressed',String(i===selectedRow));button.setAttribute('aria-label','Редактировать ряд '+(i+1));if(legend)button.querySelector('small').textContent=(Number.isFinite(rows[i].count)?rows[i].count:'—')+' шт. · Ø '+(Number.isFinite(rows[i].coilDiameter)?number.format(rows[i].coilDiameter):'—')+' мм';}
    }
    const row=rows[selectedRow],count=row.count;document.getElementById('row-start-info').textContent=Number.isInteger(count)&&count>1&&count<=8?'Входы через '+number.format(360/count)+'° · осевой шаг между трубами '+(Number.isFinite(row.pitch)?number.format(row.pitch/count):'—')+' мм':count===1?'Один змеевик в выбранном ряду':'Задайте от 1 до 8 змеевиков';
  }
  function loadExample(count,starts=1){
    if(pending)clearTimeout(pending);const p=model.exampleParameters(count,starts);rows=p.rows.map(row=>({...row}));selectedRow=0;
    for(const key of globalKeys)field(key).value=p[key];rowCount.value=String(count);syncRowControls();syncRowsUI();
    document.getElementById('preset-note').textContent=starts>1?'Пример: '+count+' ряда по '+starts+' змеевика. Шаг подобран под многозаходную навивку.':count>4?'Пример '+count+' рядов: корпус Ø '+p.shellDiameter+' мм, трубы Ø '+p.tubeDiameter+' мм.':'В каждом ряду может быть несколько змеевиков. Размеры трубы общие.';
    update();
  }
  function spreadRows(count){
    stashSelectedRow();const core=numeric('coreDiameter'),tube=numeric('tubeDiameter'),shell=numeric('shellDiameter'),wall=numeric('shellWall'),margin=Math.max(4,tube*.35),first=core+tube+2*margin,last=shell-2*wall-tube-2*margin;
    const previous=rows;rows=Array.from({length:count},(_,i)=>({...previous[i]||previous.at(-1),coilDiameter:Math.round((count===1?(first+last)/2:first+(last-first)*i/(count-1))*10)/10}));
    selectedRow=Math.min(selectedRow,count-1);syncRowControls();syncRowsUI();update();
  }
  function createView(host){
    const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
    renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
    renderer.domElement.setAttribute('role','img');renderer.domElement.setAttribute('aria-label',host.id==='whole-view'?'Цилиндрический аппарат без разреза':'Аппарат с раскрытыми внутренними деталями');
    host.append(renderer.domElement);host.querySelector('.loading')?.remove();
    const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-500,500,800,-800,1,30000);
    scene.add(createModelLighting());
    const grid=new THREE.GridHelper(1800,18,0x435368,0x2a3442);grid.material.transparent=true;grid.material.opacity=.32;scene.add(grid);
    const view={host,renderer,scene,camera,grid,group:null};
    renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();lost=true;status.textContent='3D приостановлено. Обновите страницу для восстановления.';host.dataset.invalid='true';});
    renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());return view;
  }
  function frame(view){
    if(lost)return;
    const width=view.host.clientWidth,height=view.host.clientHeight;if(!width||!height)return;
    view.renderer.setSize(width,height,false);
    const p=current,aspect=width/height,direction=new THREE.Vector3(.9,.48,2.6).normalize(),target=new THREE.Vector3(0,-p.height*.015,0);
    view.camera.position.copy(direction.multiplyScalar(6500)).add(target);view.camera.lookAt(target);view.camera.updateMatrixWorld(true);
    // Project the same complete bounding box in both views; camera scale matches.
    let halfWidth=0,halfHeight=0;
    for(const x of [-p.shellDiameter/2,p.shellDiameter/2])for(const y of [-p.height/2,p.height/2])for(const z of [-p.shellDiameter/2,p.shellDiameter/2]){const point=new THREE.Vector3(x,y,z).applyMatrix4(view.camera.matrixWorldInverse);halfWidth=Math.max(halfWidth,Math.abs(point.x));halfHeight=Math.max(halfHeight,Math.abs(point.y));}
    const extent=Math.max(halfHeight*1.19,halfWidth*1.22/aspect);view.camera.left=-extent*aspect;view.camera.right=extent*aspect;view.camera.top=extent;view.camera.bottom=-extent;view.camera.updateProjectionMatrix();
    view.grid.position.y=-p.height/2-3;view.grid.scale.setScalar(Math.max(p.shellDiameter/600,.7));view.renderer.render(view.scene,view.camera);
  }
  function readParameters(){stashSelectedRow();return {...Object.fromEntries(globalKeys.map(key=>[key,numeric(key)])),rows:rows.map(row=>({...row}))};}
  function setError(message){errorBox.textContent=message;errorBox.hidden=!message;for(const host of viewports)host.dataset.invalid=String(Boolean(message));if(message){status.textContent='Геометрия не обновлена: некорректные размеры';for(const id of ['height','length','shell-gap','core-gap'])document.getElementById('metric-'+id).textContent='—';document.getElementById('row-gap-summary').textContent='Между рядами: —';document.getElementById('row-start-gap-summary').textContent='';document.getElementById('update-timing').textContent='Перестроение: —';}}
  function update(){
    pending=0;const start=performance.now(),p=readParameters(),error=model.validate(p);syncRowsUI();setError(error);if(error)return;
    cache.begin();const beforeBuilds=cache.builds;
    let whole,section;
    try{whole=model.buildModel(p,'whole',cache);section=model.buildModel(p,mode,cache);}catch(error){if(whole)model.disposeModel(whole);if(section)model.disposeModel(section);setError(error.message);return;}
    current=p;
    for(const [index,group] of [whole,section].entries()){const view=views[index];if(view.group){view.scene.remove(view.group);model.disposeModel(view.group);}view.group=group;view.scene.add(group);frame(view);}
    cache.sweep();
    const m=model.measurements(p);document.getElementById('metric-height').textContent=number.format(m.coilHeight)+' мм';document.getElementById('metric-length').textContent=number.format(m.coilLength/1000)+' м';document.getElementById('metric-shell-gap').textContent=number.format(m.shellGap)+' мм';document.getElementById('metric-core-gap').textContent=number.format(m.coreGap)+' мм';
    const strict=mode==='section';document.getElementById('section-title').textContent=strict?'Продольный разрез':'Вырез корпуса';document.getElementById('cut-label').textContent=strict?'Единая плоскость сечения всех деталей':'Передняя половина корпуса удалена';document.getElementById('section-description').innerHTML='<span class="swatch cut"></span>'+(strict?'Срезаны все детали · полости труб не закрашены':'Корпус вскрыт · змеевик и вытеснительная труба целые');
    views[1].renderer.domElement.setAttribute('aria-label',strict?'Полный продольный разрез корпуса, змеевика и вытеснительной трубы':'Передняя половина корпуса удалена, змеевик и вытеснительная труба целые');
    const elapsed=performance.now()-start;
    document.getElementById('row-summary').textContent=rows.length+' '+plural(rows.length,'ряд','ряда','рядов')+' · '+m.coilCount+' '+plural(m.coilCount,'змеевик','змеевика','змеевиков');
    document.getElementById('row-gap-summary').textContent=m.rowGap===null?'Один ряд: межрядного зазора нет':'Мин. радиальный зазор между рядами: '+number.format(m.rowGap)+' мм';
    const separation=model.startSeparation(rows[selectedRow]);document.getElementById('row-start-gap-summary').textContent=separation===null?'':'Зазор внутри ряда '+(selectedRow+1)+': '+number.format(separation-p.tubeDiameter)+' мм';
    document.getElementById('update-timing').textContent='Перестроение: '+Math.round(elapsed)+' мс';document.getElementById('update-timing').title='Время обработки параметров, построения геометрии и отправки двух видов на отрисовку. Без задержки ввода 140 мс и без ожидания завершения GPU.';
    status.textContent='Модель обновлена · камера закреплена';document.body.dataset.ready='true';document.body.dataset.mode=mode;document.body.dataset.rowCount=String(rows.length);document.body.dataset.coilCount=String(m.coilCount);document.body.dataset.updateMs=String(elapsed);document.body.dataset.createdGeometries=String(cache.builds-beforeBuilds);
  }
  try{for(const host of viewports)views.push(createView(host));}catch(error){for(const view of views)view.renderer.dispose();throw error;}
  form.addEventListener('submit',event=>{event.preventDefault();if(pending)clearTimeout(pending);update();});
  form.addEventListener('input',event=>{if(event.target===rowCount)return;if(pending)clearTimeout(pending);pending=setTimeout(update,140);});
  form.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();if(pending)clearTimeout(pending);update();event.target.blur();}});
  document.getElementById('reset').addEventListener('click',()=>loadExample(3));
  for(const button of document.querySelectorAll('[data-example]'))button.addEventListener('click',()=>loadExample(Number(button.dataset.example),Number(button.dataset.starts)||1));
  rowCount.addEventListener('change',()=>{if(pending)clearTimeout(pending);spreadRows(Number(rowCount.value));});
  document.getElementById('spread-rows').addEventListener('click',()=>{if(pending)clearTimeout(pending);spreadRows(rows.length);});
  for(const id of ['row-tabs','row-legend'])document.getElementById(id).addEventListener('click',event=>{const button=event.target.closest('[data-select-row]');if(!button)return;if(pending)clearTimeout(pending);stashSelectedRow();selectedRow=Number(button.dataset.selectRow);syncRowControls();update();});
  for(const button of document.querySelectorAll('[data-section-mode]'))button.addEventListener('click',()=>{mode=button.dataset.sectionMode;for(const other of document.querySelectorAll('[data-section-mode]'))other.setAttribute('aria-pressed',String(other===button));if(pending)clearTimeout(pending);update();});
  const observer=new ResizeObserver(()=>{for(const view of views)frame(view);});for(const host of viewports)observer.observe(host);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)for(const view of views)frame(view);});
  window.addEventListener('pagehide',event=>{if(event.persisted)return;observer.disconnect();if(pending)clearTimeout(pending);for(const view of views){if(view.group)model.disposeModel(view.group);view.grid.geometry.dispose();view.grid.material.dispose();view.renderer.dispose();}cache.dispose();},{once:true});
  loadExample(3);
}
main().catch(fail);
