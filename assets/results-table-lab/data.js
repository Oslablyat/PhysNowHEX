/* Демонстрационные данные для лаборатории таблицы «Рассчитанные конструкции».
   Набор колонок, статусы и предупреждения повторяют assets/calculated-designs.js.
   Числа синтетические: нужны только чтобы оценить плотность и поведение интерфейса.
   Фронт компромиссов задан явно, чтобы «лучшая» строка зависела от приоритета,
   как на настоящем фронте Парето. */
window.RESULTS_LAB_DATA=(function(){
 'use strict';
 const round=(value,digits=3)=>Number(value.toFixed(digits));

 /* 12 компромиссов: у каждого своя сильная сторона. */
 const FRONT=[
  {id:451,height:398,diameter:140,count:4,rowCount:1},   // баланс, рекомендован
  {id:399,height:566,diameter:138,count:4,rowCount:1},   // мало трубы
  {id:321,height:374,diameter:178,count:4,rowCount:1},
  {id:465,height:686,diameter:136,count:4,rowCount:1},   // самый узкий
  {id:259,height:334,diameter:180,count:4,rowCount:1},   // самый короткий
  {id:527,height:430,diameter:164,count:8,rowCount:2},
  {id:608,height:350,diameter:204,count:8,rowCount:2},
  {id:714,height:310,diameter:232,count:12,rowCount:3},
  {id:822,height:782,diameter:130,count:4,rowCount:1},
  {id:907,height:470,diameter:170,count:8,rowCount:2},
  {id:953,height:950,diameter:125,count:4,rowCount:1},
  {id:978,height:294,diameter:250,count:12,rowCount:3}
 ];
 /* Остальные подходящие строки — вне фронта, для полного каталога. */
 const EXTRA=[
  {id:1012,height:520,diameter:196,count:16,rowCount:2},
  {id:1043,height:610,diameter:214,count:24,rowCount:3},
  {id:1071,height:455,diameter:252,count:32,rowCount:4},
  {id:1098,height:735,diameter:188,count:12,rowCount:3},
  {id:1124,height:388,diameter:226,count:16,rowCount:4},
  {id:1150,height:864,diameter:158,count:6,rowCount:2},
  {id:1176,height:286,diameter:240,count:24,rowCount:4},
  {id:1203,height:642,diameter:176,count:8,rowCount:1},
  {id:1229,height:508,diameter:210,count:20,rowCount:3}
 ];

 let seed=20261110;
 const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
 const between=(a,b)=>a+(b-a)*random();

 function enrich(row,index){
  const tubeMetres=round(row.diameter/1000*Math.PI*(row.height/1000)*1.95+(row.rowCount+1)*1.25+between(0,0.9));
  const stockMetres=round(tubeMetres*(1+between(0.02,0.16)),2);
  const area=round(tubeMetres*Math.PI*0.014,3);
  const duty=round(between(25.05,25.62));
  const ua=round(duty*1000/between(44.4,45.6),1);
  return {
   ...row,
   rank:null,
   tubeMetres,
   stockMetres,
   lengthSpread:round(between(0.2,2.4)),
   volumeLitres:round((row.diameter/2)**2*Math.PI*row.height/1e6*0.55+between(0.5,3),2),
   area,
   duty,
   reHot:round(between(15200,19900),0),
   reCold:round(between(900,7200),0),
   ua,
   k:round(ua/area,1),
   status:'accepted',
   warning:index%9===4?'Re трубного потока у нижней границы 15 000':index%13===7?'Запас по диаметру корпуса менее 2 %':null
  };
 }

 const front=FRONT.map(enrich);
 front.forEach((row,index)=>{row.rank=index+1});
 const extra=EXTRA.map((row,index)=>enrich(row,index+FRONT.length));

 return {
  rows:[...front,...extra],
  recommendedId:FRONT[0].id,
  evaluations:1000,
  errors:2,
  frontSize:FRONT.length,
  drawings:[topView(),sectionView(),gapView()],
  columns:[
   {key:'rank',label:'Место',group:'core',digits:0,width:58},
   {key:'id',label:'№',group:'core',digits:0,width:56},
   {key:'height',label:'Длина, мм',group:'geometry',digits:0},
   {key:'diameter',label:'Диаметр, мм',group:'geometry',digits:0},
   {key:'count',label:'Трубок, шт.',group:'geometry',digits:0},
   {key:'rowCount',label:'Рядов',group:'geometry',digits:0},
   {key:'tubeMetres',label:'Всего трубы, м',group:'tube',digits:3},
   {key:'stockMetres',label:'Закупка, м',group:'tube',digits:2},
   {key:'lengthSpread',label:'Разброс длин, м',group:'tube',digits:3},
   {key:'volumeLitres',label:'Объём, л',group:'tube',digits:2},
   {key:'area',label:'Площадь, м²',group:'thermal',digits:3},
   {key:'duty',label:'Мощность, кВт',group:'thermal',digits:3},
   {key:'reHot',label:'Re трубный',group:'thermal',digits:0},
   {key:'reCold',label:'Re межтрубный',group:'thermal',digits:0},
   {key:'ua',label:'UA, Вт/К',group:'thermal',digits:1},
   {key:'k',label:'K, Вт/(м²·К)',group:'thermal',digits:1}
  ]
 };

 function topView(){
  const ringRadius=[96,84,72,60];
  const tubes=[];
  ringRadius.forEach((radius,ring)=>{
   const total=4+ring*2;
   for(let i=0;i<total;i++){
    const angle=i/total*Math.PI*2;
    tubes.push(`<circle class="dwg-tube" cx="${round(160+radius*Math.cos(angle),1)}" cy="${round(160+radius*Math.sin(angle),1)}" r="6.5"/>`);
   }
  });
  return `<svg viewBox="0 0 320 322" role="img" aria-label="Вид сверху. Расположение змеевиков"><title>Вид сверху</title>
   <circle class="dwg-shell" cx="160" cy="160" r="114"/><circle class="dwg-shell-inner" cx="160" cy="160" r="111"/>
   <path class="dwg-axis" d="M24 160H296M160 26V294"/>
   <circle class="dwg-core" cx="160" cy="160" r="78"/>
   <text class="dwg-label" x="160" y="156">Вытеснитель</text><text class="dwg-label" x="160" y="172">Ø 98</text>
   <circle class="dwg-ring" cx="160" cy="160" r="96"/><circle class="dwg-ring" cx="160" cy="160" r="84"/>
   <circle class="dwg-ring" cx="160" cy="160" r="72"/><circle class="dwg-ring" cx="160" cy="160" r="60"/>
   ${tubes.join('')}
   <path class="dwg-dim" d="M52 288H268"/><path class="dwg-ext" d="M52 276V294M268 276V294"/>
   <text class="dwg-dim-text" x="160" y="310">Корпус Ø 140 / внутри Ø 138</text></svg>`;
 }
 function sectionView(){
  const tubes=[];
  for(let row=0;row<4;row++){
   for(let i=0;i<9;i++){
    tubes.push(`<circle class="dwg-tube" cx="72" cy="${52+i*30}" r="7"/>`);
    tubes.push(`<circle class="dwg-tube" cx="248" cy="${52+i*30}" r="7"/>`);
   }
  }
  return `<svg viewBox="0 0 320 360" role="img" aria-label="Продольное сечение корпуса"><title>Сечение Б</title>
   <rect class="dwg-shell" x="46" y="24" width="228" height="300" rx="4"/>
   <rect class="dwg-core" x="88" y="24" width="144" height="132"/>
   <rect class="dwg-core" x="88" y="192" width="144" height="132"/>
   <path class="dwg-axis" d="M160 12V340"/>
   <rect x="46" y="156" width="228" height="36" class="dwg-break-bg"/>
   <path class="dwg-break" d="M46 156l57-5 57 9 57-9 57 5M46 192l57-5 57 9 57-9 57 5"/>
   <text class="dwg-label" x="160" y="178">Разрыв по высоте</text>
   ${tubes.join('')}
   <path class="dwg-dim" d="M292 24V324"/><path class="dwg-ext" d="M282 24H296M282 324H296"/>
   <text class="dwg-dim-text" x="0" y="0" transform="translate(310 190) rotate(-90)">H = 398</text></svg>`;
 }
 function gapView(){
  return `<svg viewBox="0 0 150 210" role="img" aria-label="Зазоры между трубками ряда"><title>Зазоры между трубками</title>
   <g class="dwg-gap">
    <path class="dwg-axis" d="M58 34V180"/>
    <circle class="dwg-tube-wall" cx="58" cy="66" r="25"/><circle class="dwg-tube" cx="58" cy="66" r="16"/>
    <circle class="dwg-tube-wall" cx="58" cy="142" r="25"/><circle class="dwg-tube" cx="58" cy="142" r="16"/>
   </g>
   <path class="dwg-ext" d="M58 91H118M58 117H118"/>
   <path class="dwg-dim" d="M112 95V113"/>
   <text class="dwg-dim-text" x="0" y="0" transform="translate(130 108) rotate(-90)">2 мм</text>
   <text class="dwg-label" x="58" y="196">Ряд 1</text></svg>`;
 }
})();