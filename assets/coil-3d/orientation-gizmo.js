import {orbitFrame} from './camera-controls.js?v=plane-panel-20261022';

// Engineering coordinates: Z is the apparatus height. The renderer is Y-up;
// X=(1,0,0), Y=(0,0,-1), Z=(0,1,0) remain a right-handed coordinate system.
const AXES=[{name:'X',vector:[1,0,0],color:'#ef5c57'},{name:'Y',vector:[0,0,-1],color:'#70bd64'},{name:'Z',vector:[0,1,0],color:'#529cf0'}];
const PLANES=[{name:'XY',a:0,b:1,normal:2,color:'#529cf0',label:'сверху / снизу'},{name:'XZ',a:0,b:2,normal:1,color:'#70bd64',label:'спереди / сзади'},{name:'YZ',a:1,b:2,normal:0,color:'#ef5c57',label:'справа / слева'}];
const dot=(a,b)=>a.reduce((sum,value,i)=>sum+value*b[i],0);
export const ISOMETRIC_VIEW={azimuth:3*Math.PI/4,polar:Math.acos(1/Math.sqrt(3))};

export function planeOrbit(name,current){
  const plane=PLANES.find(p=>p.name===name);if(!plane)return null;
  const normal=AXES[plane.normal].vector,reverse=dot(orbitFrame(current).direction,normal)>1-1e-10;
  if(name==='XY')return {azimuth:0,polar:reverse?Math.PI:0};
  if(name==='XZ')return {azimuth:reverse?0:Math.PI,polar:Math.PI/2};
  return {azimuth:reverse?3*Math.PI/2:Math.PI/2,polar:Math.PI/2};
}

export function projectOrientation(state){
  const {direction,up}=orbitFrame(state),right=[up[1]*direction[2]-up[2]*direction[1],up[2]*direction[0]-up[0]*direction[2],up[0]*direction[1]-up[1]*direction[0]];
  const project=v=>({x:dot(v,right),y:-dot(v,up),depth:dot(v,direction)});
  return {axes:AXES.map(axis=>({...axis,...project(axis.vector)})),planes:PLANES.map(plane=>{
    const a=AXES[plane.a].vector,b=AXES[plane.b].vector,depth=dot(AXES[plane.normal].vector,direction);
    const points=Array.from({length:13},(_,i)=>{const angle=i*Math.PI/24;return project(a.map((v,j)=>v*Math.cos(angle)+b[j]*Math.sin(angle)))});
    return {...plane,points,depth,aligned:Math.abs(depth)>1-1e-10};
  })};
}

export function createOrientationGizmo(host,onSelect){
  const root=document.createElement('div');root.className='layout-orientation';root.setAttribute('role','group');root.setAttribute('aria-label','Ориентация по координатным плоскостям');
  root.innerHTML='<svg viewBox="0 0 120 116" class="orientation-triad" aria-label="Координатные оси и плоскости"></svg><button type="button" class="orientation-home" data-orientation-iso title="Изометрия" aria-label="Изометрический вид"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m10 2 7 4v8l-7 4-7-4V6l7-4Zm-7 4 7 4 7-4m-7 4v8"/></svg></button><div class="orientation-planes">'+PLANES.map(p=>'<button type="button" data-orientation-plane="'+p.name+'" title="Плоскость '+p.name+' · '+p.label+'. Повторное нажатие — обратная сторона" aria-label="Вид перпендикулярно плоскости '+p.name+'" style="--plane-color:'+p.color+'">'+p.name+'</button>').join('')+'</div>';
  host.append(root);const svg=root.querySelector('.orientation-triad'),ns='http://www.w3.org/2000/svg';
  function element(tag,attrs,parent=svg){const node=document.createElementNS(ns,tag);for(const [name,value] of Object.entries(attrs))node.setAttribute(name,value);parent.append(node);return node;}
  const planes=PLANES.map(p=>{const group=element('g',{'data-orientation-plane':p.name,role:'button',tabindex:'0','aria-label':'Вид перпендикулярно плоскости '+p.name,class:'orientation-plane',style:'--plane-color:'+p.color});const title=element('title',{},group);title.textContent='Плоскость '+p.name+' · '+p.label+'. Повторное нажатие — обратная сторона';return {group,area:element('path',{class:'orientation-plane-area'},group),arc:element('path',{class:'orientation-plane-arc'},group)};});
  element('circle',{cx:54,cy:61,r:3,class:'orientation-origin'});
  const axes=AXES.map(axis=>{const group=element('g',{'aria-hidden':'true',class:'orientation-axis',style:'color:'+axis.color});return {line:element('path',{},group),tip:element('path',{class:'orientation-arrow'},group),label:element('text',{'text-anchor':'middle','dominant-baseline':'central'},group)};});axes.forEach((axis,i)=>axis.label.textContent=AXES[i].name);
  const click=event=>{const control=event.target.closest('[data-orientation-plane],[data-orientation-iso]');if(!control)return;event.preventDefault();event.stopPropagation();onSelect(control.hasAttribute('data-orientation-iso')?'iso':control.dataset.orientationPlane);};
  const key=event=>{if(event.target.matches('g[data-orientation-plane]')&&['Enter',' '].includes(event.key))click(event);};root.addEventListener('click',click);root.addEventListener('keydown',key);
  const point=(x,y)=>[54+x,61+y];
  return {update(state){
    const projected=projectOrientation(state);root.dataset.plane=projected.planes.find(p=>p.aligned)?.name??'free';
    projected.planes.forEach((plane,i)=>{const arc=plane.points.map(p=>point(p.x*28,p.y*28).join(' ')),path='M'+arc.join(' L');planes[i].area.setAttribute('d','M54 61 L'+arc.join(' L')+' Z');planes[i].arc.setAttribute('d',path);for(const control of root.querySelectorAll('[data-orientation-plane="'+plane.name+'"]'))control.setAttribute('aria-pressed',String(plane.aligned));});
    projected.axes.forEach((axis,i)=>{const part=axes[i],x=axis.x*38,y=axis.y*38,length=Math.hypot(x,y),ux=length?x/length:0,uy=length?y/length:0;part.line.setAttribute('d','M54 61 L'+point(x,y).join(' '));part.tip.setAttribute('d',length<2?'':'M'+point(x,y).join(' ')+' L'+point(x-ux*8-uy*3,y-uy*8+ux*3).join(' ')+' L'+point(x-ux*8+uy*3,y-uy*8-ux*3).join(' ')+' Z');part.label.setAttribute('x',String(54+axis.x*49));part.label.setAttribute('y',String(61+axis.y*49));part.label.style.opacity=length<8?'0':String(axis.depth<0?.65:1);});
  },dispose(){root.removeEventListener('click',click);root.removeEventListener('keydown',key);root.remove();}};
}
