const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {variants,narrowVariants,coilVariants,coilSegments,smoothCoilPath,colors,coilPath,geometry,shellPath,svg,mount}=require('../assets/rectangle-variants.js');
assert.equal(variants.length,10);assert.equal(new Set(variants.map(v=>v.name)).size,10);assert.equal(new Set(variants.map(shellPath)).size,10);
const main=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');assert.equal(coilPath,main.match(/class="exchanger-coil" d="([^"]+)"/)[1],'Reuse the live coil, not an obsolete comparison symbol');
// Main calculator uses the selected old-coil/narrow-shell option, not the experiments.
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8'),layoutSource=app.slice(app.indexOf('function coilProcessLayout('),app.indexOf('new ResizeObserver(fitDiagram)'));
const nozzleMotion=require('../assets/process-nozzle-motion.js');
const node=()=>({attrs:{},setAttribute(k,v){this.attrs[k]=v}});
for(const [w,h,screen]of [[600,500,1400],[160,350,790],[360,235,390]]){
 const shell=node(),fluid=node(),coil=node(),leads=node(),rect=node(),pipes=Array.from({length:4},node),ports=Array.from({length:4},node),temps=Array.from({length:4},node),elements={'.exchanger-shell':shell,'.exchanger-fluid':fluid,'.exchanger-coil':coil,'.exchanger-coil-leads':leads,rect};
 const svgNode={...node(),querySelector:key=>elements[key],querySelectorAll:key=>key==='.pipe'?pipes:key==='.exchanger-ports circle'?ports:temps};
 const fields={'exchanger-type':{value:'coil'},'hot-in':{offsetHeight:120,getBoundingClientRect:()=>({top:10})},'hot-out':{offsetHeight:80,getBoundingClientRect:()=>({top:h-85})}};
 const context={Math,flow:'parallel',ProcessNozzleMotion:{create:()=>nozzleMotion.create({reducedMotion:()=>true,cancelFrame:()=>{}})},matchMedia:()=>({addEventListener(){}}),innerWidth:screen,$:id=>fields[id],document:{addEventListener(){},querySelector:key=>key==='.diagram'?{getBoundingClientRect:()=>({width:w,height:h,top:0})}:svgNode}};vm.createContext(context);vm.runInContext(layoutSource,context);
 const selected=context.coilProcessLayout(w/2,h/2,.6);assert.equal(selected.shell,shellPath(narrowVariants[0]));assert(selected.coilTransform.includes('rotate(90)'));assert(selected.coilTransform.includes(String(.6*1.35)));
 context.fitDiagram();assert.equal(shell.attrs.d,selected.shell);assert.equal(fluid.attrs.d,shell.attrs.d);assert(leads.attrs.d);assert(+ports[0].attrs.cx>w/2&&+ports[0].attrs.cy<h/2);assert(+ports[3].attrs.cx<w/2&&+ports[3].attrs.cy>h/2);
 for(const element of [...pipes,...ports,...temps,coil,leads,shell,fluid])assert(!/NaN|undefined|Infinity/.test(JSON.stringify(element.attrs)));
 fields['exchanger-type'].value='shell';context.fitDiagram();assert(shell.attrs.d.includes('a'));assert.equal(leads.attrs.d,'');assert(!coil.attrs.transform.includes('rotate'));
 fields['exchanger-type'].value='coil';context.fitDiagram();assert.equal(shell.attrs.d,selected.shell,'Switch back restores rectangle');
 context.flow='counter';context.fitDiagram();assert.equal(shell.attrs.d,shellPath({...narrowVariants[0],flowMode:'counter'}));assert(+ports[0].attrs.cy>h/2);assert(+ports[3].attrs.cy<h/2);
}
// Selected motion 6 matches the approved prototype and handles interruption/resize.
assert.equal(nozzleMotion.duration,1100);
let nextFrame=0,queue=new Map(),lastDraw=null;const scheduler={requestFrame:cb=>{queue.set(++nextFrame,cb);return nextFrame},cancelFrame:id=>queue.delete(id),reducedMotion:()=>false,draw:(left,right)=>{lastDraw={left,right}}};
const controller=nozzleMotion.create(scheduler),step=time=>{const jobs=[...queue.values()];queue.clear();jobs.forEach(cb=>cb(time))};
controller.update(0);assert.deepEqual(lastDraw,{left:0,right:0});assert.equal(queue.size,0);controller.update(1);step(0);step(200);assert.equal(lastDraw.left,0);assert(lastDraw.right>0,'Right moves before left');
const interrupted={...lastDraw};controller.update(0);step(250);assert.deepEqual(lastDraw,interrupted,'Reversal starts from current positions');step(1350);assert.deepEqual(lastDraw,{left:0,right:0});assert.equal(queue.size,0);
controller.update(1);step(1500);step(1900);const beforeResize={...lastDraw};controller.setDraw((left,right)=>{lastDraw={left,right}});controller.update(1);assert.deepEqual(lastDraw,beforeResize,'Resize must not restart transition');step(2600);assert.deepEqual(lastDraw,{left:1,right:1});assert.equal(queue.size,0);controller.reset();controller.update(0);assert.deepEqual(lastDraw,{left:0,right:0});
const quiet=nozzleMotion.create({...scheduler,reducedMotion:()=>true});quiet.update(0);quiet.update(1);assert.deepEqual(lastDraw,{left:1,right:1});assert.equal(queue.size,0);
assert(main.includes('<path class="exchanger-shell"'));assert(!main.includes('rectangle-variants.js'),'No experimental comparison dependency in calculator');
assert.equal(colors.shell,'#171717');assert.equal(colors.fluid,'#3b82f6');assert.equal(colors.opacity,.12);assert.equal(colors.outline,'#626970');
const ids=new Set();for(const [i,v]of variants.entries()){
 const g=geometry(v);assert(g.leftX<0&&g.leftY>0&&g.rightX>0&&g.rightY<0,'Lower-left outlet and upper-right inlet');assert(v.margin>v.radius+g.n,'Nozzle stays on the straight side, not the corner');assert(v.radius>=0&&v.radius<Math.min(g.x,g.y));assert(v.neck>0);
 for(const small of [true,false]){const markup=svg(v,i,small);assert(!/NaN|undefined|Infinity/.test(markup));assert.equal((markup.match(/class="diagram-port"/g)||[]).length,4);assert(markup.includes(`cx="${g.leftX}" cy="${g.leftY}"`));assert(markup.includes(`cx="${g.rightX}" cy="${g.rightY}"`));assert(markup.includes('fill-opacity="0.12"'));assert(markup.includes('rotate(90)'));assert.equal((markup.match(/class="diagram-outline"/g)||[]).length,v.flanges?3:1);for(const [,id]of markup.matchAll(/\bid="([^"]+)"/g)){assert(!ids.has(id),'Unique marker ID');ids.add(id)}}
}
const html=fs.readFileSync(path.join(__dirname,'../assets/rectangle-variants.html'),'utf8'),js=fs.readFileSync(path.join(__dirname,'../assets/rectangle-variants.js'),'utf8');assert(!html.includes('app.js'));assert(!/localStorage|Worker\(/.test(js));assert(html.includes('href="../"'));
assert.equal(narrowVariants.length,10);assert.equal(new Set(narrowVariants.map(v=>`${v.nozzleRadius}/${v.coilScale}`)).size,10);
for(const [i,v]of narrowVariants.entries()){
 const base=variants[2],g=geometry(v);for(const key of ['width','height','radius','neck','margin'])assert.equal(v[key],base[key],`Preserve variant 3: ${key}`);
 assert(v.nozzleRadius>geometry(base).n);assert(v.coilScale>.9);assert(26*v.coilScale+3<g.x,'Wider coil stays clear of shell');assert(v.margin>v.radius+g.n);
 for(const small of [true,false]){const markup=svg(v,i,small);assert(markup.includes(` ${v.coilScale})`));assert(!/NaN|undefined|Infinity/.test(markup));assert.equal((markup.match(/class="diagram-port"/g)||[]).length,4)}
}
const narrowHtml=fs.readFileSync(path.join(__dirname,'../assets/rectangle-narrow-variants.html'),'utf8');assert(narrowHtml.includes('data-series="narrow"'));assert(!narrowHtml.includes('app.js'));
assert.equal(coilVariants.length,10);assert.equal(new Set(coilVariants.map(smoothCoilPath)).size,10);
const withoutCoil=markup=>markup.replace(/<path class="diagram-coil"[^>]*\/>/g,'').replace(/aria-label="[^"]*"/g,'');
for(const [i,v]of coilVariants.entries()){
 const segments=coilSegments(v),g=geometry(v);assert.deepEqual(g,geometry(narrowVariants[0]));assert.deepEqual(segments[0].p0,{x:0,y:-129});assert.deepEqual(segments.at(-1).p3,{x:0,y:129});
 assert(v.coilShape.depth>=14,'Every option has substantial projected depth, not a flat wave');
 const body=segments.slice(70,-70);assert(body.filter(s=>s.p3.y<s.p0.y).length>12,'Projected turns loop back vertically to show front/rear arcs');
 assert.equal(segments[0].p1.x,0);assert.equal(segments.at(-1).p2.x,0,'Both endpoint tangents vertical');
 for(const [j,s]of segments.entries()){
  for(const p of [s.p0,s.p1,s.p2,s.p3]){assert(Number.isFinite(p.x)&&Number.isFinite(p.y));assert(Math.abs(p.x)<g.x-10);assert(Math.abs(p.y)<=g.y)}
  if(j){const before=segments[j-1];assert.deepEqual(before.p3,s.p0);for(const axis of ['x','y'])assert(Math.abs((before.p3[axis]-before.p2[axis])-(s.p1[axis]-s.p0[axis]))<1e-10,'C1 joins: no sharp elbow')}
 }
 for(const small of [true,false]){const markup=svg(v,i,small);assert.equal((markup.match(/class="diagram-coil"/g)||[]).length,1,'One continuous coil, including both leads');assert.equal(withoutCoil(markup),withoutCoil(svg(narrowVariants[0],i,small)),'Only coil geometry changes; all colors, ports, shell and flows identical')}
}
const coilHtml=fs.readFileSync(path.join(__dirname,'../assets/rectangle-coil-variants.html'),'utf8');assert(coilHtml.includes('data-series="coil"'));assert(!coilHtml.includes('app.js'));
// Exercise all page datasets and cyclic navigation without touching browser storage.
for(const series of ['', 'narrow','coil']){
 const nodes={},buttons=Array.from({length:10},()=>({setAttribute(){},focus(){}}));
 const node=id=>nodes[id]||(nodes[id]={textContent:'',innerHTML:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn},querySelectorAll(){return buttons}});
 mount({body:{dataset:{series}},getElementById:node});const expected=series==='coil'?coilVariants:series?narrowVariants:variants;
 assert.equal(node('selected-title').textContent,expected[0].name);assert.equal((node('variants').innerHTML.match(/data-index=/g)||[]).length,10);
 for(let i=1;i<=10;i++){node('next').handlers.click();assert.equal(node('selected-title').textContent,expected[i%10].name)}
 node('previous').handlers.click();assert.equal(node('count').textContent,'10 / 10');
}
const flowComparison=require('../assets/rectangle-flow-variants.js');assert.equal(flowComparison.layouts.length,10);
const flowIds=new Set(),flowPaths=new Set();
for(let i=0;i<10;i++){
 const parallel=flowComparison.variant(i,'parallel'),counter=flowComparison.variant(i,'counter'),p=geometry(parallel),c=geometry(counter);flowPaths.add(shellPath(parallel));
 assert(p.leftY>0&&p.rightY<0);assert(c.leftY<0&&c.rightY>0);assert.equal(c.leftY,-p.leftY);assert.equal(c.rightY,-p.rightY);assert.equal(c.leftX,p.leftX);assert.equal(c.rightX,p.rightX);
 for(const v of [parallel,counter]){assert.equal(v.width,narrowVariants[0].width);assert.equal(v.height,narrowVariants[0].height);assert.equal(v.coilScale,narrowVariants[0].coilScale);assert.equal(v.nozzleRadius,8);assert(!v.coilShape);const g=geometry(v);assert(Math.abs(g.leftY)+g.n<v.height/2-v.radius);assert(Math.abs(g.rightY)+g.n<v.height/2-v.radius)}
 for(const mode of ['parallel','counter'])for(const small of [true,false]){const markup=flowComparison.svg(i,mode,small);assert(markup.includes(coilPath));assert(markup.includes('stroke="#ef4444"'));assert(!/NaN|undefined|Infinity/.test(markup));assert(markup.includes(mode==='counter'?'слева вверху':'слева внизу'));for(const [,id]of markup.matchAll(/\bid="([^"]+)"/g)){assert(!flowIds.has(id));flowIds.add(id)}}
}
assert.equal(flowPaths.size,10);const rows=flowComparison.rows();assert.equal((rows.match(/class="flow-row"/g)||[]).length,10);assert.equal((rows.match(/class="flow-cell"/g)||[]).length,20);
const flowHtml=fs.readFileSync(path.join(__dirname,'../assets/rectangle-flow-variants.html'),'utf8');assert(!flowHtml.includes('app.js'));assert(flowHtml.includes('<dialog'));assert(flowHtml.includes('только противоток'));
const animations=require('../assets/rectangle-flow-animations.js');assert.equal(animations.motions.length,10);assert.deepEqual(animations.base,narrowVariants[0]);
const signatures=new Set();
for(let i=0;i<10;i++){
 assert.deepEqual(animations.frame(i,0),{left:0,right:0,neck:1,opacity:1});assert.deepEqual(animations.frame(i,1),{left:1,right:1,neck:1,opacity:1});
 signatures.add(JSON.stringify([.1,.25,.5,.75,.9].map(t=>animations.frame(i,t))));
 for(let k=0;k<=100;k++){const f=animations.frame(i,k/100),v=animations.geometryAt(f.left,f.right,f.neck),g=geometry(v);assert(Object.values(f).every(Number.isFinite));assert(f.opacity>=0&&f.opacity<=1);assert(f.neck>=0&&f.neck<=1);assert(Math.abs(g.leftY)+g.n<g.y-g.r);assert(Math.abs(g.rightY)+g.n<g.y-g.r);for(const key of ['width','height','radius','nozzleRadius','coilScale'])assert.equal(v[key],narrowVariants[0][key])}
}
assert.equal(signatures.size,10);assert.deepEqual(geometry(animations.geometryAt(0,0)),geometry(narrowVariants[0]));assert.deepEqual(geometry(animations.geometryAt(1,1)),geometry({...narrowVariants[0],flowMode:'counter'}));assert.equal((animations.cards().match(/class="motion-card"/g)||[]).length,10);assert.equal((animations.cards().match(/data-replay/g)||[]).length,10);
const animationHtml=fs.readFileSync(path.join(__dirname,'../assets/rectangle-flow-animations.html'),'utf8'),animationJs=fs.readFileSync(path.join(__dirname,'../assets/rectangle-flow-animations.js'),'utf8');assert(!animationHtml.includes('app.js'));assert(!/localStorage|Worker\(/.test(animationJs));assert(animationJs.includes('prefers-reduced-motion'));assert(animationJs.includes('cancelAnimationFrame'));assert(animationJs.includes('visibilitychange'));
console.log('Rectangle comparisons passed: main selection; isolated shape/flow comparisons; 10 distinct animations with identical selected endpoints, safe frames, original coil/palette, cancellation and reduced-motion handling.');
