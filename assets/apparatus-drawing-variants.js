/* Standalone design comparison. All views use one illustrative geometry in mm. */
(() => {
  'use strict';
  const colors = ['#69bdd9', '#e8ae65', '#75c8ad'];
  const geometry = {
    diameter:226, shellInside:224, coreDiameter:120, height:932,
    tubeDiameter:14, tubeInside:9, tubeWall:2.5, rowClearance:3, clearance:3,
    rows:[70,87,104].map((radius,index) => ({
      index, diameter:radius * 2, count:18, turns:3, pitch:306,
      separation:17, firstNumber:index * 18 + 1,
    })),
  };
  const variants = [
    ['Продольный разрез справа','Вид сверху и узел зазоров слева. Высота аппарата читается на отдельном большом разрезе.','standard'],
    ['Крупный вид сверху','Основное поле отдано нумерации труб. Высота и зазоры собраны в правой стойке.','top-first'],
    ['Три равных вида','Три чертежа стоят в одной строке. Удобно одновременно сверять радиусы, высоту и шаги.','three-columns'],
    ['Два вида над разрезом','Сверху расположены поперечные изображения. Внизу отдельная широкая полоса с высотой.','top-strip'],
    ['Единый чертёжный лист','Тонкие разделители вместо отдельных карточек. Размеры и сведения собраны на одном листе.','sheet'],
    ['Техническая сетка','Сетка связывает три вида в единое поле. Контуры и цветные ряды остаются основными ориентирами.','crosshair'],
    ['Акцент на зазорах','Увеличенный фрагмент занимает правую половину. Вид сверху и высота остаются рядом.','gap-first'],
    ['Виды А, Б и В','Каждый вид обозначен буквой. Ссылки на продольное сечение и увеличенный узел читаются как на чертеже.','numbered'],
    ['Вид сверху над деталями','Верхнее поле для раскладки труб. Снизу рядом расположены высота и увеличенные зазоры.','stacked'],
    ['Компактная рабочая панель','Меньше рамок и плотнее размещены виды. Все основные размеры продублированы в нижней строке.','compact'],
  ];
  const state = {row:0, opened:null};
  const gallery = document.getElementById('gallery');
  const dialog = document.getElementById('drawing-dialog');
  const dialogContent = document.getElementById('dialog-content');
  const format = value => new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(value);
  const point = value => Number(value.toFixed(3));
  const circle = (x,y,r,className,extra='') => `<circle class="${className}" cx="${point(x)}" cy="${point(y)}" r="${point(r)}" ${extra}/>`;
  const text = (x,y,value,className='drawing-label',extra='') => `<text class="${className}" x="${point(x)}" y="${point(y)}" ${extra}>${value}</text>`;
  const path = (d,className) => `<path class="${className}" d="${d}"/>`;
  function dimensionX(x1,x2,y,label,originY) {
    return `<g class="dimensions">${path(`M${x1} ${originY}V${y+7}M${x2} ${originY}V${y+7}`,'extension')}
      ${path(`M${x1} ${y}H${x2}m${x1-x2+5} -2.5-5 2.5 5 2.5M${x2-5} ${y-2.5}l5 2.5-5 2.5`,'dimension')}
      ${text((x1+x2)/2,y-6,label,'dimension-text')}</g>`;
  }
  function dimensionY(x,y1,y2,label,originX,main=false) {
    return `<g class="dimensions">${path(`M${originX} ${y1}H${x+6}M${originX} ${y2}H${x+6}`,'extension')}
      ${path(`M${x} ${y1}V${y2}m-2.5 ${y1-y2+5}l2.5-5 2.5 5M${x-2.5} ${y2-5}l2.5 5 2.5-5`,'dimension')}
      ${text(0,0,label,`dimension-text${main?' main-dimension':''}`,`transform="translate(${x+14} ${(y1+y2)/2}) rotate(-90)"`)}</g>`;
  }
  function svg(title,viewBox,body) {
    return `<svg class="drawing-svg" viewBox="${viewBox}" role="img" aria-label="${title}"><title>${title}</title>${body}</svg>`;
  }
  function topView() {
    const cx=160,cy=160,scale=1.02,r=geometry.diameter/2*scale;
    let content = circle(cx,cy,r,'shell') + circle(cx,cy,geometry.shellInside/2*scale,'shell-inner');
    content += path('M22 160H298M160 26V294','axis');
    content += circle(cx,cy,geometry.coreDiameter/2*scale,'core');
    content += text(cx,cy-3,'Вытеснитель') + text(cx,cy+13,'Ø '+geometry.coreDiameter);
    for(const row of geometry.rows) {
      const radius=row.diameter/2*scale,color=colors[row.index];
      content += `<g class="top-row" data-pick-row="${row.index}" role="button" tabindex="0" aria-label="Выбрать ряд ${row.index+1}" style="--row-color:${color}">`;
      content += circle(cx,cy,radius,'coil-ring');
      for(let j=0;j<row.count;j++) {
        const angle=j/row.count*2*Math.PI,x=cx+radius*Math.cos(angle),y=cy+radius*Math.sin(angle);
        content += circle(x,y,7.14,'tube-wall') + text(x,y,row.firstNumber+j,'coil-label');
      }
      content += '</g>';
    }
    content += dimensionX(point(cx-r),point(cx+r),302,'Корпус Ø226 / внутри Ø224',cy+r);
    content += dimensionX(160-geometry.rows[state.row].diameter/2*scale,160+geometry.rows[state.row].diameter/2*scale,20,'D навивки = '+geometry.rows[state.row].diameter,160);
    return svg('А. Вид сверху. Нумерация змеевиков от центра наружу','0 0 320 325',content);
  }
  function sideView() {
    const cx=142,scale=.7,left=cx-geometry.diameter/2*scale,right=cx+geometry.diameter/2*scale;
    const top=42,bottom=389,splitA=190,splitB=232;
    let content = `<rect class="shell" x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" rx="2"/>`;
    content += `<rect class="core" x="${cx-42}" y="${top}" width="84" height="${bottom-top}"/>`;
    content += path(`M${cx} 27V410`,'axis');
    for(const row of geometry.rows) {
      const radius=row.diameter/2*scale;
      content += `<g class="tube-column${state.row===row.index?' is-selected':''}" style="--row-color:${colors[row.index]}">`;
      for(const sign of [-1,1]) {
        const x=cx+sign*radius;
        for(let j=0;j<12;j++) {
          const y=j<6?top+7+j*17*scale:bottom-7-(11-j)*17*scale;
          content += circle(x,y,7*scale,'tube-wall') + circle(x,y,4.5*scale,'tube-hole');
        }
      }
      content += '</g>';
    }
    content += `<rect x="${left-2}" y="${splitA}" width="${right-left+4}" height="${splitB-splitA}" fill="#191919"/>`;
    content += path(`M${left} ${splitA}l35-4 35 8 35-8 ${right-left-105} 4M${left} ${splitB}l35-4 35 8 35-8 ${right-left-105} 4`,'break-line');
    content += text(cx,splitA+24,'Разрыв по высоте');
    content += dimensionY(257,top,bottom,'H = 932',right,true);
    content += dimensionX(point(left),point(right),418,'Ø226',bottom);
    return svg('Б. Продольное сечение с разрывом. Высота корпуса 932 мм','0 0 296 438',content);
  }
  function gapView() {
    const measurements=PhysNowCoilLayout.measurements(geometry,state.row);
    const r=22,step=17/14*r*2,xs=[86,86+step,86+step*2],ys=[85,85+step];
    let content=path(`M42 ${ys[0]}H266M42 ${ys[1]}H266M86 44V183M${xs[1]} 44V183M${xs[2]} 44V183`,'axis');
    for(let column=0;column<3;column++) {
      for(const y of ys) {
        content += `<g style="--row-color:${colors[column]}">${circle(xs[column],y,r,'tube-wall')}${circle(xs[column],y,r*9/14,'tube-hole')}</g>`;
      }
    }
    const a=xs[1],b=xs[2];
    content += dimensionX(point(a+r),point(b-r),35,'sᵣ = '+format(measurements.sx),ys[0]);
    content += dimensionX(point(a),point(b),211,'tᵣ = '+format(measurements.ax),ys[1]+r);
    content += dimensionY(258,point(ys[0]+r),point(ys[1]-r),'sₐ = '+format(measurements.sy),b);
    content += dimensionY(35,point(ys[0]),point(ys[1]),'tₐ = '+format(measurements.ay),xs[0]-r);
    content += text(160,240,'t — между осями · s — между стенками');
    return svg('В. Увеличенный узел. Зазоры между стенками и шаги между осями труб','0 0 300 253',content);
  }
  function view(kind,title,letter,body) {
    return `<figure class="drawing-view view-${kind}"><figcaption data-letter="${letter}"><span>${title}</span><small>${kind==='gap'?'Узел В':kind==='top'?'Вид А':'Сечение Б'}</small></figcaption>${body}</figure>`;
  }
  function panel(index) {
    const [, ,layout] = variants[index];
    const m=PhysNowCoilLayout.measurements(geometry,state.row);
    return `<div class="drawing-panel layout-${layout}">
      <div class="drawing-toolbar"><span class="step">05</span>Компоновка аппарата<button class="open-detail" type="button" data-open="${index}">Крупно ↗</button></div>
      <div class="drawing-body">${view('top','Вид сверху','А',topView())}${view('side','Высота аппарата','Б',sideView())}${view('gap','Зазоры между трубами','В',gapView())}</div>
      <div class="drawing-footer"><span>Высота <strong>932</strong></span><span>Труба <strong>14 × 2,5</strong></span><span>Ряд <strong style="color:${colors[state.row]}">${state.row+1} · Ø${geometry.rows[state.row].diameter}</strong></span><span>Зазоры <strong>${format(m.sx)} / ${format(m.sy)}</strong></span></div>
    </div>`;
  }
  function render() {
    gallery.innerHTML = variants.map(([name,note],index) => `<article class="variant" id="variant-${index+1}"><div class="variant-heading"><span class="variant-number">${String(index+1).padStart(2,'0')}</span><h2>${name}</h2></div><p class="variant-note">${note}</p>${panel(index)}</article>`).join('');
    if(state.opened!==null)dialogContent.innerHTML=panel(state.opened);
    document.querySelectorAll('[data-row]').forEach(button => button.setAttribute('aria-pressed',String(Number(button.dataset.row)===state.row)));
  }
  function selectRow(row) { state.row=row;render(); }
  document.querySelector('.quick-nav').innerHTML = variants.map(([name],i) => `<a href="#variant-${i+1}" title="${name}">${String(i+1).padStart(2,'0')}</a>`).join('');
  document.querySelectorAll('[data-row]').forEach(button => {
    button.style.setProperty('--row-color',colors[Number(button.dataset.row)]);
    button.addEventListener('click',()=>selectRow(Number(button.dataset.row)));
  });
  document.addEventListener('click',event => {
    const open=event.target.closest('[data-open]');
    if(open) {
      state.opened=Number(open.dataset.open);
      document.getElementById('dialog-title').textContent=`${String(state.opened+1).padStart(2,'0')} · ${variants[state.opened][0]}`;
      dialogContent.innerHTML=panel(state.opened);
      dialog.showModal();
      return;
    }
    const row=event.target.closest('[data-pick-row]');
    if(row)selectRow(Number(row.dataset.pickRow));
  });
  document.addEventListener('keydown',event => {
    const row=event.target.closest('[data-pick-row]');
    if(!row||!['Enter',' '].includes(event.key))return;
    event.preventDefault();
    const index=Number(row.dataset.pickRow);
    selectRow(index);
    const scope=dialog.open?dialogContent:gallery;
    scope.querySelector(`[data-pick-row="${index}"]`).focus();
  });
  for(const [id,className] of [['show-dimensions','hide-dimensions'],['show-numbers','hide-numbers']]) {
    document.getElementById(id).addEventListener('change',event => document.body.classList.toggle(className,!event.target.checked));
  }
  document.getElementById('close-dialog').addEventListener('click',()=>dialog.close());
  dialog.addEventListener('close',()=>{state.opened=null;});
  render();
})();
