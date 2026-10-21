import * as THREE from '../vendor/three-0.186.1/three.module.min.js';
import {GeometryCache,buildDesignModel,disposeModel} from './design-model.js';
import {wheelZoom,zoomAtPoint,panByPixels,orbitByPixels,DEFAULT_AZIMUTH,DEFAULT_POLAR} from './camera-controls.js';

export function createDesignView(host,onStatus){
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.75));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.35;
  const canvas=renderer.domElement;canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Продольный 3D-разрез змеевикового аппарата');host.prepend(canvas);
  canvas.tabIndex=0;canvas.setAttribute('aria-keyshortcuts','+ - 0 Home ArrowLeft ArrowRight ArrowUp ArrowDown');
  const zoomControls=document.createElement('div');zoomControls.className='layout-3d-zoom';
  const zoomHint=document.createElement('span');zoomHint.textContent='ЛКМ — вращение · ПКМ — сдвиг · колесо — масштаб';
  const resetZoom=document.createElement('button');resetZoom.type='button';resetZoom.className='layout-3d-zoom-reset';resetZoom.setAttribute('aria-label','Сбросить ракурс, масштаб и положение: показать аппарат целиком');resetZoom.textContent='100%';zoomControls.append(zoomHint,resetZoom);host.append(zoomControls);
  const scene=new THREE.Scene(),camera=new THREE.OrthographicCamera(-500,500,800,-800,1,100000),fitCamera=new THREE.OrthographicCamera(),cache=new GeometryCache();
  scene.add(new THREE.HemisphereLight(0xd7e5ff,0x30303a,2.4));
  for(const [color,intensity,position] of [[0xffffff,3.1,[1200,2200,2500]],[0x7eabff,2,[-1700,300,1500]],[0xffd6a3,2,[600,1400,-2000]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);}
  const grid=new THREE.GridHelper(1800,18,0x435368,0x2a3442);grid.material.transparent=true;grid.material.opacity=.32;scene.add(grid);
  let latest=null,group=null,visible=false,allowed=true,timer=0,resizeFrame=0,version=0,renderedVersion=-1,lost=false,disposed=false,lastSize='';
  let zoomState={zoom:1,x:0,y:0},zoomFrame=0,drag=null;host.dataset.zoom='1';host.dataset.panX='0';host.dataset.panY='0';
  let orbitState={azimuth:DEFAULT_AZIMUTH,polar:DEFAULT_POLAR};host.dataset.azimuth=String(orbitState.azimuth);host.dataset.polar=String(orbitState.polar);
  function frame(){
    if(disposed||lost||!group||!allowed||document.hidden||!host.isConnected)return;
    const width=host.clientWidth,height=host.clientHeight;if(width<2||height<2)return;
    const size=width+'x'+height;if(size!==lastSize){renderer.setSize(width,height,false);lastSize=size;}
    const {height:h,diameter:d}=group.userData,aspect=width/height,distance=Math.max(h,d)*5;
    camera.position.set(distance*Math.sin(orbitState.polar)*Math.sin(orbitState.azimuth),distance*Math.cos(orbitState.polar),distance*Math.sin(orbitState.polar)*Math.cos(orbitState.azimuth));camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
    // Fit uses the original view, not the current orbit: rotation never silently
    // changes scale or recentres the detail the user has zoomed into.
    fitCamera.position.copy(new THREE.Vector3(.9,.48,2.6).normalize().multiplyScalar(distance));fitCamera.lookAt(0,0,0);fitCamera.updateMatrixWorld(true);
    let halfWidth=0,halfHeight=0;for(const x of [-d/2,d/2])for(const y of [-h/2,h/2])for(const z of [-d/2,d/2]){const point=new THREE.Vector3(x,y,z).applyMatrix4(fitCamera.matrixWorldInverse);halfWidth=Math.max(halfWidth,Math.abs(point.x));halfHeight=Math.max(halfHeight,Math.abs(point.y));}
    const extent=Math.max(halfHeight*1.18,halfWidth*1.2/aspect),panX=zoomState.x*extent*aspect,panY=zoomState.y*extent;camera.left=-extent*aspect+panX;camera.right=extent*aspect+panX;camera.top=extent+panY;camera.bottom=-extent+panY;camera.zoom=zoomState.zoom;camera.updateProjectionMatrix();
    grid.position.y=-h/2-3;grid.scale.setScalar(Math.max(d/600,.7));renderer.render(scene,camera);
  }
  function redrawZoom(){
    host.dataset.zoom=String(zoomState.zoom);host.dataset.panX=String(zoomState.x);host.dataset.panY=String(zoomState.y);host.dataset.azimuth=String(orbitState.azimuth);host.dataset.polar=String(orbitState.polar);resetZoom.textContent=Math.round(zoomState.zoom*100)+'%';
    if(!zoomFrame)zoomFrame=requestAnimationFrame(()=>{zoomFrame=0;if(visible)frame();});
  }
  function resetScale(){endDrag();zoomState={zoom:1,x:0,y:0};orbitState={azimuth:DEFAULT_AZIMUTH,polar:DEFAULT_POLAR};redrawZoom();}
  function startDrag(event){
    if(![0,1,2].includes(event.button)||drag||disposed||lost||!group||!allowed||host.dataset.status==='error')return;
    event.preventDefault();event.stopPropagation();drag={pointerId:event.pointerId,x:event.clientX,y:event.clientY,mask:event.button===0?1:event.button===1?4:2,action:event.button===0&&!event.shiftKey?'orbit':'pan'};
    canvas.focus({preventScroll:true});canvas.setPointerCapture(event.pointerId);host.dataset.dragging='true';host.dataset.dragAction=drag.action;
  }
  function moveDrag(event){
    if(!drag||event.pointerId!==drag.pointerId)return;
    if(event.pointerType==='mouse'&&!(event.buttons&drag.mask)){endDrag(event);return;}
    event.preventDefault();event.stopPropagation();const rect=canvas.getBoundingClientRect();
    if(drag.action==='orbit')orbitState=orbitByPixels(orbitState,event.clientX-drag.x,event.clientY-drag.y,rect.width,rect.height);else zoomState=panByPixels(zoomState,event.clientX-drag.x,event.clientY-drag.y,rect.width,rect.height);drag.x=event.clientX;drag.y=event.clientY;redrawZoom();
  }
  function endDrag(event){
    if(!drag||event&&event.pointerId!==undefined&&event.pointerId!==drag.pointerId)return;
    const pointerId=drag.pointerId;drag=null;host.dataset.dragging='false';if(canvas.hasPointerCapture(pointerId))canvas.releasePointerCapture(pointerId);
  }
  function wheel(event){
    if(event.ctrlKey||event.metaKey||disposed||lost||!group||!allowed||host.dataset.status==='error'||!event.deltaY)return;
    event.preventDefault();event.stopPropagation();const rect=canvas.getBoundingClientRect();
    const x=2*(event.clientX-rect.left)/rect.width-1,y=1-2*(event.clientY-rect.top)/rect.height;
    zoomState=zoomAtPoint(zoomState,wheelZoom(zoomState.zoom,event.deltaY,event.deltaMode,rect.height),x,y);redrawZoom();
  }
  function keyboard(event){
    if(event.ctrlKey||event.metaKey||event.altKey||!['+','=','-','_','0','Home','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key))return;
    event.preventDefault();event.stopPropagation();
    if(event.key==='0'||event.key==='Home')resetScale();else if(event.key.startsWith('Arrow')){orbitState=orbitByPixels(orbitState,event.key==='ArrowLeft'?-1:event.key==='ArrowRight'?1:0,event.key==='ArrowUp'?-1:event.key==='ArrowDown'?1:0,72,72);redrawZoom();}else{zoomState=zoomAtPoint(zoomState,zoomState.zoom*(event.key==='+'||event.key==='='?1.2:1/1.2));redrawZoom();}
  }
  function contextMenu(event){event.preventDefault();}
  canvas.addEventListener('wheel',wheel,{passive:false});canvas.addEventListener('keydown',keyboard);resetZoom.addEventListener('click',resetScale);
  canvas.addEventListener('pointerdown',startDrag);canvas.addEventListener('pointermove',moveDrag);canvas.addEventListener('pointerup',endDrag);canvas.addEventListener('pointercancel',endDrag);canvas.addEventListener('lostpointercapture',endDrag);canvas.addEventListener('contextmenu',contextMenu);window.addEventListener('blur',endDrag);
  function rebuild(){
    timer=0;if(disposed||!latest||!visible||!allowed||document.hidden||lost)return;
    if(version===renderedVersion){frame();onStatus('ready','');return;}
    const started=performance.now();cache.begin();
    try{
      const next=buildDesignModel(latest.g,latest.mode,cache,latest.selectedRow);
      if(group){scene.remove(group);disposeModel(group);}group=next;scene.add(group);cache.sweep();renderedVersion=version;
      canvas.setAttribute('aria-label',latest.mode==='section'?'Продольный разрез всех деталей: корпуса, закрытого вытеснителя и змеевиков':'Вырез передней половины корпуса, целые змеевики и закрытый вытеснитель');
      host.dataset.mode=latest.mode;host.dataset.coilCount=String(group.userData.totalCount);host.dataset.selectedRow=String(latest.selectedRow);frame();
      host.dataset.updateMs=String(performance.now()-started);onStatus('ready','');
    }catch(error){host.dataset.coilCount='0';onStatus('error',error.message);}
  }
  function schedule(delay=120){if(timer)clearTimeout(timer);if(latest&&visible&&allowed&&!document.hidden){onStatus('loading','');timer=setTimeout(rebuild,delay);}}
  const intersection=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);if(visible)schedule(0);else if(timer){clearTimeout(timer);timer=0;}},{rootMargin:'100px'});intersection.observe(host);
  const observer=new ResizeObserver(()=>{if(resizeFrame)cancelAnimationFrame(resizeFrame);resizeFrame=requestAnimationFrame(()=>{resizeFrame=0;if(visible&&allowed){if(version!==renderedVersion)schedule(0);else frame();}});});observer.observe(host);
  const visibility=()=>{if(document.hidden){endDrag();if(timer)clearTimeout(timer);timer=0;}else if(visible)schedule(0);};document.addEventListener('visibilitychange',visibility);
  canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();endDrag();lost=true;onStatus('error','WebGL приостановлен. Показана схема; обновите страницу для восстановления 3D.');});
  canvas.addEventListener('webglcontextrestored',()=>{lost=false;renderedVersion=-1;schedule(0);});
  return {
    update(g,mode,selectedRow){version++;latest=g?{g,mode,selectedRow}:null;if(!g){endDrag();if(timer)clearTimeout(timer);timer=0;if(group){scene.remove(group);disposeModel(group);group=null;}cache.dispose();host.dataset.coilCount='0';}else{onStatus('loading','');schedule();}},
    setVisible(value){allowed=value;if(!allowed){endDrag();if(timer)clearTimeout(timer);timer=0;}else schedule(0);},
    resize(){if(version!==renderedVersion)schedule(0);else frame();},
    dispose(){endDrag();disposed=true;if(timer)clearTimeout(timer);if(resizeFrame)cancelAnimationFrame(resizeFrame);if(zoomFrame)cancelAnimationFrame(zoomFrame);intersection.disconnect();observer.disconnect();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('blur',endDrag);canvas.removeEventListener('wheel',wheel);canvas.removeEventListener('keydown',keyboard);canvas.removeEventListener('pointerdown',startDrag);canvas.removeEventListener('pointermove',moveDrag);canvas.removeEventListener('pointerup',endDrag);canvas.removeEventListener('pointercancel',endDrag);canvas.removeEventListener('lostpointercapture',endDrag);canvas.removeEventListener('contextmenu',contextMenu);resetZoom.removeEventListener('click',resetScale);if(group)disposeModel(group);cache.dispose();grid.geometry.dispose();grid.material.dispose();renderer.dispose();canvas.remove();zoomControls.remove();}
  };
}
