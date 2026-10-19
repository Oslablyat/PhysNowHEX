'use strict';
const red='#ef4444',blue='#3b82f6';
const coilPath='M-92 0H-58L-34-41L0 41L34-41L60 0H92';
const coil=d=>`<path class="coil" d="${d}" stroke="${red}" stroke-width="3"/>`;
const reference={name:'Предыдущая пружина',description:'Прошлый вариант с тремя широкими витками для сравнения с новой подборкой.',render:()=>coil(springPath())};
function springPath({turns=3,span=140,rx=18,ry=32,vertical=false}={}){
 const end=Math.PI*2*turns,pitch=span/end;
 const rawX=t=>-span/2-rx+pitch*t+rx*Math.cos(t);
 const extrema=[0,end];
 if(rx>pitch){const angle=Math.asin(pitch/rx);for(let turn=0;turn<turns;turn++)extrema.push(turn*2*Math.PI+angle,turn*2*Math.PI+Math.PI-angle)}
 const xs=extrema.map(rawX),offset=-(Math.min(...xs)+Math.max(...xs))/2;
 const point=t=>({x:rawX(t)+offset,y:ry*Math.sin(t)});
 const step=Math.PI/2,k=4/3*Math.tan(step/4),advance=pitch*step/3;
 const number=value=>Number(value.toFixed(4));
 const rotate=p=>vertical?{x:-p.y,y:p.x}:p;
 const xy=p=>`${number(p.x)} ${number(p.y)}`;
 const start=point(0),segments=[];
 let firstControl,lastControl;
 for(let segment=0;segment<turns*4;segment++){
  const a=segment*step,b=(segment+1)*step,p0=point(a),p1=point(b);
  const c1={x:p0.x+advance-rx*Math.sin(a)*k,y:p0.y+ry*Math.cos(a)*k};
  const c2={x:p1.x-advance+rx*Math.sin(b)*k,y:p1.y-ry*Math.cos(b)*k};
  if(segment===0)firstControl=rotate(c1);
  lastControl=rotate(c2);segments.push(`C${xy(rotate(c1))} ${xy(rotate(c2))} ${xy(rotate(p1))}`);
 }
 // Reflect the neighbouring handles to join both leads without a corner.
 const beginning=rotate(start),finish=rotate(point(end));
 const leadIn={x:2*beginning.x-firstControl.x,y:2*beginning.y-firstControl.y};
 const leadOut={x:2*finish.x-lastControl.x,y:2*finish.y-lastControl.y};
 return `M-92 0C-82 0 ${xy(leadIn)} ${xy(beginning)}`+segments.join('')+`C${xy(leadOut)} 82 0 92 0`;
}
function narrowLoops(){
 let d='M-92 0C-78 0-64 14-64 0V-20';
 for(let i=0;i<8;i++){
  const x=-64+i*16,next=x+16,y=i%2?20:-20,outer=y+(i%2?1:-1)*32/3;
  d+=`C${x} ${outer} ${next} ${outer} ${next} ${y}V${i===7?0:-y}`;
 }
 return d+'C64-14 78 0 92 0';
}
const variants=[
 {name:'5 витков · мелкий шаг',description:'Пять аккуратных плавных витков вместо трёх крупных.',short:'5 витков · умеренно плотная намотка',render:()=>coil(springPath({turns:5,span:132,rx:10,ry:26}))},
 {name:'7 витков · плотная',description:'Меньше шаг между витками, больше равномерных петель.',short:'7 витков · маленький шаг',render:()=>coil(springPath({turns:7,span:128,rx:8,ry:25}))},
 {name:'9 витков · частая',description:'Девять небольших витков с самым мелким шагом в подборке.',short:'9 витков · очень мелкий шаг',render:()=>coil(springPath({turns:9,span:126,rx:6.5,ry:23}))},
 {name:'6 витков · высокая',description:'Витки вытянуты по высоте, а шаг вдоль оси остаётся небольшим.',short:'6 витков · высокие петли',render:()=>coil(springPath({turns:6,span:122,rx:9,ry:38}))},
 {name:'7 витков · низкая',description:'Низкая широкая пружина с большим свободным пространством сверху и снизу.',short:'7 витков · компактная высота',render:()=>coil(springPath({turns:7,span:136,rx:7,ry:16}))},
 {name:'5 широких витков',description:'Более широкие округлые петли, сильнее перекрывающие соседние витки.',short:'5 витков · широкие петли',render:()=>coil(springPath({turns:5,span:122,rx:16,ry:30}))},
 {name:'8 узких витков',description:'Плотная равномерная намотка из вытянутых узких петель.',short:'8 витков · узкие петли',render:()=>coil(springPath({turns:8,span:132,rx:5.5,ry:30}))},
 {name:'Вертикальная пружина',description:'Шесть витков расположены вертикально, с плавными подводами от боковых патрубков.',short:'6 витков · вертикальная ось',render:()=>coil(springPath({turns:6,span:120,rx:9,ry:25,vertical:true}))},
 {name:'Мелкая плавная волна',description:'Шесть плавных волн без самопересечений и углов.',short:'6 волн · без пересечения линий',render:()=>coil(springPath({turns:6,span:140,rx:0,ry:22}))},
 {name:'Частые круглые петли',description:'Ровные вертикальные участки и восемь плавных округлых разворотов.',short:'8 разворотов · плавные полукруги',render:()=>coil(narrowLoops())}
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
selectVariant(0);
