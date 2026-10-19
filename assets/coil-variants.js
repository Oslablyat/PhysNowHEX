'use strict';
const red='#ef4444',blue='#3b82f6';
const coilPath='M-92 0H-58L-34-41L0 41L34-41L60 0H92';
const coil=d=>`<path class="coil" d="${d}" stroke="${red}" stroke-width="3"/>`;
const reference={name:'Текущий зигзаг',description:'Красный зигзаг, который сейчас установлен на основной странице.',render:()=>coil(coilPath)};
function springPath(){
 const turns=3,end=Math.PI*2*turns,pitch=140/end,rx=18,ry=32;
 const rawX=t=>-88+pitch*t+rx*Math.cos(t);
 const extrema=[0,end],angle=Math.asin(pitch/rx);
 for(let turn=0;turn<turns;turn++)extrema.push(turn*2*Math.PI+angle,turn*2*Math.PI+Math.PI-angle);
 const xs=extrema.map(rawX),offset=-(Math.min(...xs)+Math.max(...xs))/2;
 const point=t=>({x:rawX(t)+offset,y:ry*Math.sin(t)});
 const step=Math.PI/2,k=4/3*Math.tan(step/4),advance=pitch*step/3;
 const number=value=>Number(value.toFixed(4));
 const xy=p=>`${number(p.x)} ${number(p.y)}`;
 const start=point(0),segments=[];
 let firstControl,lastControl;
 for(let segment=0;segment<turns*4;segment++){
  const a=segment*step,b=(segment+1)*step,p0=point(a),p1=point(b);
  const c1={x:p0.x+advance-rx*Math.sin(a)*k,y:p0.y+ry*Math.cos(a)*k};
  const c2={x:p1.x-advance+rx*Math.sin(b)*k,y:p1.y-ry*Math.cos(b)*k};
  if(segment===0)firstControl=c1;
  lastControl=c2;segments.push(`C${xy(c1)} ${xy(c2)} ${xy(p1)}`);
 }
 // Reflect the neighbouring handles to join both leads without a corner.
 const leadIn={x:2*start.x-firstControl.x,y:2*start.y-firstControl.y};
 const finish=point(end),leadOut={x:2*finish.x-lastControl.x,y:2*finish.y-lastControl.y};
 return `M-92 0C-82 0 ${xy(leadIn)} ${xy(start)}`+segments.join('')+`C${xy(leadOut)} 82 0 92 0`;
}
const variants=[
 {name:'Скруглённый зигзаг',description:'Привычная форма с плавными вершинами вместо острых углов.',short:'Два изгиба · мягкие вершины',render:()=>coil('M-92 0H-61Q-57 0-55-4L-37-34Q-34-41-31-34L-4 33Q0 43 4 33L31-34Q34-41 37-34L57-4Q59 0 63 0H92')},
 {name:'Плавная волна',description:'Два плавных волнообразных витка с одинаковой амплитудой.',short:'Плавные кривые · два периода',render:()=>coil('M-92 0H-78C-65-44-52-44-39 0S-13 44 0 0S26-44 39 0S65 44 78 0H92')},
 {name:'Крупная волна',description:'Один широкий плавный период: меньше деталей в центре.',short:'Один период · крупный изгиб',render:()=>coil('M-92 0H-78C-52-62-26-62 0 0S52 62 78 0H92')},
 {name:'Частый зигзаг',description:'Больше небольших угловых витков, чем у текущего символа.',short:'Частые витки · чёткий ритм',render:()=>coil('M-92 0H-72L-60-27L-36 27L-12-27L12 27L36-27L60 27L72 0H92')},
 {name:'Прямоугольные витки',description:'Прямые участки с поворотами под прямым углом.',short:'Прямые участки · П-образные витки',render:()=>coil('M-92 0H-72V-30H-36V30H0V-30H36V30H72V0H92')},
 {name:'Вертикальные петли',description:'Вертикальные участки соединены плавными полукруглыми поворотами.',short:'Вертикальные витки · круглые повороты',render:()=>coil('M-92 0H-72V-26Q-72-44-54-44Q-36-44-36-26V26Q-36 44-18 44Q0 44 0 26V-26Q0-44 18-44Q36-44 36-26V26Q36 44 54 44Q72 44 72 26V0H92')},
 {name:'Горизонтальная змейка',description:'Три горизонтальных прохода с плавными разворотами на концах.',short:'Три ряда · плавные развороты',render:()=>coil('M-92 0H-78V-28Q-78-36-70-36H48Q64-36 64-18Q64 0 48 0H-48Q-64 0-64 18Q-64 36-48 36H64Q72 36 72 28V8Q72 0 80 0H92')},
 {name:'Плоская спираль',description:'Плоская спираль вместо условного углового символа змеевика.',short:'Спираль · вид в плоскости',render:()=>coil('M-92 0H-62C-62-36-34-62 0-62C36-62 62-34 62 0C62 30 34 48 8 48C-20 48-42 28-42 4C-42-18-22-32 0-32C20-32 32-16 32 2C32 18 16 28 2 28C-12 28-20 16-20 4C-20-6-10-12 0-12C10-12 14-4 14 4L70 4Q76 4 80 0H92')},
 {name:'Плавная пружина',description:'Три витка выровнены по центру. Кривые и подводы соединены плавно, без углов.',short:'По центру · плавные витки и подводы',render:()=>coil(springPath())},
 {name:'Низкий зигзаг',description:'Небольшая высота витков и больше свободного пространства внутри круга.',short:'Компактная высота · три изгиба',render:()=>coil('M-92 0H-68L-46-20L-22 20L2-20L26 20L50 0H92')}
];
function sceneSvg(variant,index,small=false){
 const id=(small?'thumb':'main')+'-'+index;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${small?'500 185 340 330':'0 0 1340 676'}" role="img" aria-label="${variant.name}: ${variant.description}">
 <defs><marker id="${id}-shell" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L12 6L0 12Z" fill="${blue}"/></marker><marker id="${id}-tube" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="12" markerHeight="12" markerUnits="userSpaceOnUse" orient="auto"><path d="M0 0L12 6L0 12Z" fill="${red}"/></marker></defs>
 <g class="connections"><path class="stream-path" d="M420 148C560 148 670 154.59615385 670 246" stroke="${blue}" marker-end="url(#${id}-shell)"/>
 <path class="stream-path" d="M920 148C804.73684211 148 862.36842105 350 774 350" stroke="${red}" marker-end="url(#${id}-tube)"/>
 <path class="stream-path" d="M572 350C481.24324324 350 540.43243243 576 426 576" stroke="${red}" marker-end="url(#${id}-tube)"/>
 <path class="stream-path" d="M670 448C670 555 769.18699187 576 914 576" stroke="${blue}" marker-end="url(#${id}-shell)"/></g>
 <g class="central-element" transform="translate(670 350)"><g class="housing"><circle r="92" fill="#171717"/><circle r="92" fill="${blue}" fill-opacity=".12" stroke="#626970" stroke-width="1.25"/></g>
 <g class="coil-design">${variant.render()}</g><g class="ports"><circle class="port" cy="-92" r="4.5" stroke="${blue}"/><circle class="port" cy="92" r="4.5" stroke="${blue}"/><circle class="port" cx="92" r="4.5" stroke="${red}"/><circle class="port" cx="-92" r="4.5" stroke="${red}"/></g></g>
 ${small?'':`<g class="temperatures"><text class="temperature" x="565" y="132" fill="#7d96ff">90 °C</text><text class="temperature" x="775" y="132" fill="#ff6b6b">20 °C</text><text class="temperature" x="565" y="602" fill="#ff6b6b">40 °C</text><text class="temperature" x="775" y="602" fill="#7d96ff">60 °C</text></g>`}</svg>`;
}
let selected=0;
const scene=document.getElementById('scene'),gallery=document.getElementById('variants');
gallery.innerHTML=variants.map((variant,index)=>`<button class="variant" type="button" data-index="${index}" aria-pressed="false" aria-label="Змеевик ${index+1}: ${variant.name}">${sceneSvg(variant,index,true)}<div class="variant-copy"><div class="variant-name"><span>${String(index+1).padStart(2,'0')}</span>${variant.name}</div><p>${variant.short}</p></div></button>`).join('');
function selectVariant(index){
 selected=index===-1?-1:(index+variants.length)%variants.length;
 const variant=selected===-1?reference:variants[selected];
 document.getElementById('selected-title').textContent=variant.name;
 document.getElementById('selected-number').textContent=selected===-1?'Сейчас':String(selected+1).padStart(2,'0');
 document.getElementById('selected-description').textContent=variant.description;
 document.getElementById('count').textContent=selected===-1?'Сейчас':(selected+1)+' / '+variants.length;
 document.getElementById('reference').setAttribute('aria-pressed',String(selected===-1));
 scene.querySelector('svg')?.remove();scene.insertAdjacentHTML('afterbegin',sceneSvg(variant,selected));
 gallery.querySelectorAll('button').forEach((button,index)=>button.setAttribute('aria-pressed',String(index===selected)));
}
gallery.addEventListener('click',event=>{const button=event.target.closest('button[data-index]');if(button){selectVariant(Number(button.dataset.index));document.querySelector('.viewer').scrollIntoView({block:'start'})}});
document.getElementById('reference').addEventListener('click',()=>selectVariant(-1));
document.getElementById('previous').addEventListener('click',()=>selectVariant(selected<=0?9:selected-1));
document.getElementById('next').addEventListener('click',()=>selectVariant(selected+1));
document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey)return;if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();selectVariant(event.key==='ArrowRight'?(selected+1)%10:selected<=0?9:selected-1)}});
selectVariant(8);
