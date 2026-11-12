/* Дымовые проверки интерактива тестовых страниц через Chrome DevTools Protocol.
   Запуск: node assets/results-table-lab/check.cjs [baseUrl] */
'use strict';
const {spawn}=require('node:child_process');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');

const CHROME=[
 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].find(p=>fs.existsSync(p));
if(!CHROME){console.error('Chrome/Edge не найден');process.exit(1)}

const base=process.argv[2]||'http://127.0.0.1:4187/assets/results-table-lab/';
const port=9600+Math.floor(Math.random()*300);
const profile=path.join(os.tmpdir(),'rtl-check-'+port);
const child=spawn(CHROME,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
 `--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--window-size=1440,900','about:blank'],{stdio:'ignore'});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const getJson=url=>new Promise((res,rej)=>{http.get(url,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{res(JSON.parse(b))}catch(e){rej(e)}})}).on('error',rej)});
async function wsUrl(){
 for(let i=0;i<80;i++){
  try{const list=await getJson(`http://127.0.0.1:${port}/json/list`);const page=list.find(t=>t.type==='page');if(page?.webSocketDebuggerUrl)return page.webSocketDebuggerUrl}catch{}
  await wait(150);
 }
 throw new Error('CDP недоступен');
}
function connect(url){
 const ws=new WebSocket(url);let id=0;const pending=new Map();
 ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(new Error(m.error.message)):resolve(m.result)}});
 const ready=new Promise((res,rej)=>{ws.addEventListener('open',res);ws.addEventListener('error',rej)});
 const send=(method,params)=>new Promise((res,rej)=>{const n=++id;pending.set(n,{resolve:res,reject:rej});ws.send(JSON.stringify({id:n,method,params:params||{}}))});
 return {ready,send,close:()=>ws.close()};
}

const tests=[];
let currentStep='старт';
const check=(name,ok,detail)=>{tests.push({name,ok,detail:detail||''})};

(async()=>{
 const c=connect(await wsUrl());
 await c.ready;
 await c.send('Page.enable');
 await c.send('Runtime.enable');
 const evaluate=async (expression,label)=>{
  const res=await c.send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
  if(res.exceptionDetails){
   const d=res.exceptionDetails;
   throw new Error('['+currentStep+'] '+(label?label+': ':'evaluate: ')+(d.exception?.description||d.text||'ошибка')+(d.url?' @ '+d.url:''));
  }
  return res.result.value;
 };
 const open=async name=>{
  currentStep=name;
  await c.send('Page.navigate',{url:base+name});
  await wait(300);
  const err=await evaluate('document.documentElement.dataset.jsError||""');
  if(err)throw new Error(name+': '+err);
 };

 const names=[...Array(20)].map((_,i)=>'variant-'+String(i+1).padStart(2,'0')+'.html');

 for(const name of names){
  await open(name);
  const info=await evaluate(`(()=>{
    const q=s=>document.querySelector(s);
    return {
      header:!!q('.site-header'),
      drawing:!!q('.drawing-panel svg'),
      summary:!!q('#drawing-summary')&&q('#drawing-summary').textContent.includes('№'),
      tools:!!q('#canvas-tools')&&q('#canvas-tools').children.length>0,
      picker:!!q('#variant-picker'),
      overflowX:document.documentElement.scrollWidth-window.innerWidth,
      overflowY:document.documentElement.scrollHeight-window.innerHeight
    };
  })()`);
  check(name+' каркас', info.header&&info.drawing&&info.summary&&info.picker, JSON.stringify(info));
  check(name+' без переполнения', info.overflowX<=0&&info.overflowY<=0, 'x='+info.overflowX+' y='+info.overflowY);
 }

 /* выбор строки таблицы обновляет предпросмотр и сводку чертежа */
 await open('variant-08.html');
 const beforeSummary=await evaluate(`document.querySelector('#drawing-summary').textContent`);
 const target=await evaluate(`(()=>{const rows=[...document.querySelectorAll('tr[data-preview-row]')];const pick=rows[3];return pick.dataset.previewRow})()`);
 await evaluate(`(()=>{const rows=[...document.querySelectorAll('tr[data-preview-row]')];rows[3].dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`);
 await wait(150);
 const afterSummary=await evaluate(`document.querySelector('#drawing-summary').textContent`);
 check('08 клик по строке меняет предпросмотр', beforeSummary!==afterSummary&&afterSummary.includes('№'+target), afterSummary.slice(0,80));

 /* «Применить» фиксирует выбор */
 await evaluate(`document.querySelector('[data-action="apply"]').click()`);
 await wait(200);
 const applied=await evaluate(`({label:document.querySelector('#state-label').textContent,toast:document.querySelector('#notification').hidden===false})`);
 check('08 применить', applied.label.includes('№'+target)&&applied.toast, JSON.stringify(applied));

 /* раскрытие строки */
 await open('variant-08.html');
 await evaluate(`(()=>{const r=[...document.querySelectorAll('tr[data-preview-row]')][1];r.click();})()`);
 await wait(120);
 const detail=await evaluate(`document.querySelectorAll('tr.detail-row').length`);
 check('08 раскрытие строки показывает детали', detail===1, 'detail rows='+detail);

 /* пресеты колонок */
 await open('variant-09.html');
 const wide=await evaluate(`document.querySelector('table.tbl').getBoundingClientRect().width`);
 await evaluate(`document.querySelector('[data-preset="core"]').click()`);
 await wait(150);
 const narrow=await evaluate(`document.querySelector('table.tbl').getBoundingClientRect().width`);
 check('09 пресет «Основные» сужает таблицу', narrow<wide-200, Math.round(wide)+' → '+Math.round(narrow));

 /* мастер отбора фильтрует */
 await open('variant-10.html');
 const readCount=()=>evaluate(`(()=>{const m=document.body.textContent.match(/Подходит:\\s*(\\d+)/);return m?Number(m[1]):-1})()`);
 const total=await readCount();
 await evaluate(`document.querySelector('[data-wizard="rows"][data-value="1"]').click()`);
 await wait(150);
 const filtered=await readCount();
 check('10 мастер сужает список', total>0&&filtered>0&&filtered<total, 'всего '+total+', после отбора '+filtered);

 /* сравнение ограничено тремя */
 await open('variant-12.html');
 await evaluate(`(()=>{const boxes=[...document.querySelectorAll('[data-cmp]')];boxes[7].click();})()`);
 await wait(150);
 const compare=await evaluate(`({checked:document.querySelectorAll('[data-cmp]:checked').length,disabled:document.querySelectorAll('[data-cmp]:disabled').length})`);
 check('12 сравнение не больше трёх', compare.checked===3&&compare.disabled>0, JSON.stringify(compare));

 /* приоритет переключает рекомендацию */
 await open('variant-14.html');
 const startCard=await evaluate(`document.querySelector('.card').textContent`);
 await evaluate(`document.querySelector('[data-goal="height"]').click()`);
 await wait(150);
 const goalCard=await evaluate(`document.querySelector('.card').textContent`);
 check('14 приоритет меняет рекомендацию', startCard!==goalCard, goalCard.slice(0,50));

 /* дерево группирует */
 await open('variant-15.html');
 await evaluate(`document.querySelector('[data-group="2"]').click()`);
 await wait(150);
 const group=await evaluate(`document.querySelectorAll('tr[data-preview-row]').length`);
 check('15 дерево показывает ветку', group>0, 'строк в ветке '+group);

 /* док перетаскивается кнопками */
 await open('variant-13.html');
 const h1=await evaluate(`document.querySelector('#dock').getBoundingClientRect().height`);
 await evaluate(`document.querySelector('[data-dock="420"]').click()`);
 await wait(150);
 const h2=await evaluate(`document.querySelector('#dock').getBoundingClientRect().height`);
 check('13 док меняет высоту', h2>h1+50, Math.round(h1)+' → '+Math.round(h2));

 /* шаговый просмотр */
 await open('variant-16.html');
 const card1=await evaluate(`document.querySelector('.card').textContent`);
 await evaluate(`document.querySelector('[data-action="step"][data-value="1"]').click()`);
 await wait(150);
 const card2=await evaluate(`document.querySelector('.card').textContent`);
 check('16 шаг меняет карточку', card1!==card2);

 /* группы по рядам сворачиваются */
 await open('variant-17.html');
 const rowsBefore=await evaluate(`document.querySelectorAll('tr[data-preview-row]').length`);
 await evaluate(`document.querySelector('[data-group-head]').click()`);
 await wait(150);
 const rowsAfter=await evaluate(`document.querySelectorAll('tr[data-preview-row]').length`);
 check('17 группа сворачивается', rowsAfter<rowsBefore, rowsBefore+' → '+rowsAfter);

 /* мини-панель закрывается */
 await open('variant-19.html');
 const pipBefore=await evaluate(`!!document.querySelector('.pip')`);
 await evaluate(`document.querySelector('[data-action="pip-close"]').click()`);
 await wait(150);
 const pipAfter=await evaluate(`!!document.querySelector('.pip')`);
 check('19 мини-панель закрывается', pipBefore&&!pipAfter);

 /* быстрый поиск фильтрует */
 await open('variant-20.html');
 const all=await evaluate(`document.querySelectorAll('.card').length`);
 await evaluate(`(()=>{const i=document.querySelector('[data-search]');i.value='374';i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
 await wait(200);
 const found=await evaluate(`document.querySelectorAll('.card').length`);
 check('20 поиск фильтрует', found>0&&found<all, all+' → '+found);

 /* закрытие окна возвращает чертёж */
 await open('variant-04.html');
 await evaluate(`document.querySelector('[data-action="close"]').click()`);
 await wait(150);
 const closed=await evaluate(`!document.querySelector('.floating')&&!document.querySelector('#canvas-body').hidden`);
 check('04 закрытие окна возвращает чертёж', closed);

 /* галерея */
 await c.send('Page.navigate',{url:base+'../results-table-variants.html'});
 await wait(300);
 const gallery=await evaluate(`({cards:document.querySelectorAll('.concept').length,links:[...document.querySelectorAll('.concept')].every(a=>a.getAttribute('href')),minis:document.querySelectorAll('.mini').length,overflowX:document.documentElement.scrollWidth-window.innerWidth})`);
 check('галерея: 20 карточек с миниатюрами', gallery.cards===20&&gallery.minis===20&&gallery.links, JSON.stringify(gallery));

 /* мобильная ширина */
 await c.send('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:2,mobile:true});
 for(const name of ['variant-01.html','variant-08.html','variant-13.html','variant-18.html']){
  await c.send('Page.navigate',{url:base+name});
  await wait(300);
  const m=await evaluate(`({x:document.documentElement.scrollWidth-window.innerWidth,err:document.documentElement.dataset.jsError||''})`);
  check('мобильный '+name, m.x<=1&&!m.err, 'overflowX='+m.x);
 }
 await c.send('Emulation.clearDeviceMetricsOverride');

 const failed=tests.filter(t=>!t.ok);
 for(const t of tests)if(!t.ok)console.log('FAIL  '+t.name+'   '+t.detail);
 console.log(`\n${tests.length-failed.length}/${tests.length} проверок пройдено`);
 c.close();
 child.kill();
 try{fs.rmSync(profile,{recursive:true,force:true})}catch{}
 process.exit(failed.length?1:0);
})().catch(error=>{console.error(error.message);child.kill();process.exit(1)});