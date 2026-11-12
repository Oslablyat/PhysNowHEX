/* Измеряет макет тестовых страниц через Chrome DevTools Protocol.
   Запуск: node assets/results-table-lab/probe.cjs [port] [baseUrl] */
'use strict';
const {spawn}=require('node:child_process');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');

const CHROME_CANDIDATES=[
 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
];
const chrome=CHROME_CANDIDATES.find(p=>fs.existsSync(p));
if(!chrome){console.error('Chrome/Edge не найден');process.exit(1)}

const base=process.argv[2]||'http://127.0.0.1:4187/assets/results-table-lab/';
const port=9300+Math.floor(Math.random()*300);
const profile=path.join(require('node:os').tmpdir(),'rtl-probe-'+port);

const child=spawn(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',
 `--remote-debugging-port=${port}`,`--user-data-dir=${profile}`,'--window-size=1440,900','about:blank'],{stdio:'ignore'});

const wait=ms=>new Promise(r=>setTimeout(r,ms));

function getJson(url){
 return new Promise((resolve,reject)=>{
  http.get(url,res=>{let body='';res.on('data',c=>body+=c);res.on('end',()=>{try{resolve(JSON.parse(body))}catch(e){reject(e)}})}).on('error',reject);
 });
}

async function targetWs(){
 for(let i=0;i<60;i++){
  try{
   const list=await getJson(`http://127.0.0.1:${port}/json/list`);
   const page=list.find(t=>t.type==='page');
   if(page&&page.webSocketDebuggerUrl)return page.webSocketDebuggerUrl;
  }catch{}
  await wait(150);
 }
 throw new Error('CDP недоступен');
}

function client(url){
 const ws=new WebSocket(url);
 let id=0;
 const pending=new Map();
 ws.addEventListener('message',event=>{
  const msg=JSON.parse(event.data);
  if(msg.id&&pending.has(msg.id)){const {resolve,reject}=pending.get(msg.id);pending.delete(msg.id);msg.error?reject(new Error(msg.error.message)):resolve(msg.result)}
 });
 const ready=new Promise((resolve,reject)=>{ws.addEventListener('open',resolve);ws.addEventListener('error',reject)});
 const send=(method,params)=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params:params||{}}))});
 return {ready,send,close:()=>ws.close()};
}

const MEASURE=`(()=>{
 const q=s=>document.querySelector(s);
 const box=s=>{const e=q(s);if(!e)return null;const r=e.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height),top:Math.round(r.top)}};
 const wrap=q('.tbl-wrap');
 const tableElement=wrap?wrap.querySelector('table'):null;
 const overlay=q('.floating')||q('.catalog-screen')||q('.pip');
 const ov=overlay?(()=>{const r=overlay.getBoundingClientRect();return {w:Math.round(r.width),h:Math.round(r.height)}})():null;
 const overY=document.documentElement.scrollHeight-window.innerHeight;
 let bottom=null;
 if(overY>0){
  for(const el of document.querySelectorAll('.workbench > *, .workbench, main')){
   const r=el.getBoundingClientRect();
   if(Math.round(r.bottom)-window.innerHeight>2)bottom=(el.id||el.className||el.tagName)+':'+Math.round(r.bottom)+'/'+window.innerHeight;
  }
 }
 return {
  overflowX:document.documentElement.scrollWidth-window.innerWidth,
  overflowY:overY,
  bottom,
  drawing:box('.drawing-panel'),
  parameters:box('.parameters'),
  table:wrap?{clientW:wrap.clientWidth,scrollW:wrap.scrollWidth,h:Math.round(wrap.getBoundingClientRect().height)}:null,
  tableEl:tableElement?{w:Math.round(tableElement.getBoundingClientRect().width),scrollW:tableElement.scrollWidth,rows:tableElement.querySelectorAll('tbody tr').length}:null,
  overlay:ov,
  error:document.documentElement.dataset.jsError||''
 };
})()`;

(async()=>{
 const ws=await targetWs();
 const c=client(ws);
 await c.ready;
 await c.send('Page.enable');
 await c.send('Runtime.enable');
 const lines=[];
 for(let n=1;n<=20;n++){
  const name='variant-'+String(n).padStart(2,'0')+'.html';
  await c.send('Page.navigate',{url:base+name});
  await wait(260);
  const res=await c.send('Runtime.evaluate',{expression:MEASURE,returnByValue:true});
  const m=res.result.value;
  const canvas=m.drawing?m.drawing.w+'×'+m.drawing.h:'—';
  const table=m.table?`${m.table.clientW}/${m.table.scrollW}×${m.table.h}`:'—';
  const overlay=m.overlay?`${m.overlay.w}×${m.overlay.h}`:'—';
  const tableWide=m.tableEl?String(m.tableEl.w):'—';
  lines.push(`${String(n).padStart(2,'0')}  чертёж ${canvas.padEnd(11)} окно ${table.padEnd(13)} табл.шир ${tableWide.padEnd(5)} строк ${String(m.tableEl?m.tableEl.rows:0).padStart(2)}  наложение ${overlay.padEnd(10)} ovfX ${String(m.overflowX).padStart(3)} ovfY ${String(m.overflowY).padStart(3)} ${m.bottom||''}${m.error?'  ОШИБКА '+m.error:''}`);
 }
 console.log(lines.join('\n'));
 c.close();
 child.kill();
 try{fs.rmSync(profile,{recursive:true,force:true})}catch{}
 process.exit(0);
})().catch(error=>{console.error(error.message);child.kill();process.exit(1)});