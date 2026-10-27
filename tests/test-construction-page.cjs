const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const order=[...html.matchAll(/data-section="([^"]+)"/g)].map(match=>match[1]);assert.deepEqual(order,['design','construction','verification','results','model']);
// Track actual nesting, not just text order, to prevent accidental mixed pages.
const stack=[],parents=new Map(),voidTags=new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
for(const match of html.matchAll(/<(\/?)([a-z][\w:-]*)\b([^>]*)>/gi)){
 const [,closing,tag,attrs]=match;if(closing){const i=stack.map(item=>item.tag).lastIndexOf(tag);assert(i>=0,`Unexpected closing ${tag}`);stack.splice(i);continue}
 const id=attrs.match(/\bid="([^"]+)"/)?.[1];if(id){assert(!parents.has(id),`Duplicate ID ${id}`);parents.set(id,stack.map(item=>item.id).filter(Boolean))}
 if(!voidTags.has(tag)&&!attrs.endsWith('/'))stack.push({tag,id});
}
for(const id of ['detail-geometry','design-layout','layout-main-3d','detail-preview-mode','view-exchanger-card','choose-verification'])assert(parents.get(id).includes('construction-page'),`${id} belongs to construction tab`);
assert(!parents.has('variant-status'),'Removed the long automatic-selection notice from construction page');
for(const id of ['thi','tci','result-q','exchanger-type'])assert(parents.get(id).includes('design-page'));
assert(!parents.get('construction-page').includes('design-page'));assert(!parents.get('verification-page').includes('construction-page'));
assert(!html.includes('variants-panel'));assert(!html.includes('variant-rows'));assert(!app.includes("$('variant-rows')"));
// Routing must make the editor, 3D and thermal host follow the new tab.
const source=app.slice(app.indexOf('function syncPageView('),app.indexOf('function exportCoilGeometry('));
const elements=Object.fromEntries(['design-page','construction-page','verification-page','calculation-actions','detail-preview-mode'].map(id=>[id,{hidden:true,value:'layout'}]));
const navigation={dataset:{activeSection:'design'}},targets={},events=[];
const context={verificationUIReady:true,headerNavigation:navigation,$:id=>elements[id],document:{title:'',querySelector:key=>targets[key]||(targets[key]={append(node){this.node=node}})},syncDesignLayoutVisibility:()=>events.push('visibility'),verificationState:{rows:[]},fillVerificationInputs:()=>events.push('verification'),requestAnimationFrame:fn=>fn(),fitDiagram:()=>events.push('diagram'),ensureDesignLayout3d:()=>events.push('3d')};vm.createContext(context);vm.runInContext(source,context);
for(const section of order){navigation.dataset.activeSection=section;context.syncPageView();assert.equal(elements['design-page'].hidden,['construction','verification'].includes(section));assert.equal(elements['construction-page'].hidden,section!=='construction');assert.equal(elements['verification-page'].hidden,section!=='verification');const selector=section==='verification'?'.verification-heading-actions':section==='construction'?'.construction-heading-actions':'.calculator-overview>.heading .heading-actions';assert.equal(targets[selector].node,elements['calculation-actions'])}
assert(events.includes('3d'));assert(events.includes('verification'));assert(app.includes("!$('construction-page').hidden&&$('detail-preview-mode').value==='characteristics'"));
// Removed table must not turn off automatic coil geometry binding or overwrite manual edits.
const renderSource=app.slice(app.indexOf('function renderExchangerVariants('),app.indexOf('function restoreCoilVariantBinding('));
const status={},loads=[],state={'exchanger-type':'coil'},supplied={inputKey:'new',rows:[{id:'balanced',name:'Оптимальная',design:{kind:'coil'}}],message:'Ready'};
const binding={currentVariants:null,selectedVariant:'balanced',coilVariantBinding:null,$:id=>{assert.equal(id,'variant-status');return status},syncCoilVariantNotice(){},syncVariantSelection(){},loadCoilVariant:(...args)=>loads.push(args)};vm.createContext(binding);vm.runInContext(renderSource,binding);binding.renderExchangerVariants(state,{},supplied);assert.equal(loads.length,1);assert.deepEqual(loads[0],['balanced',false]);assert.equal(binding.currentVariants,supplied);
binding.coilVariantBinding={key:'old',profile:'balanced',manual:true};binding.renderExchangerVariants(state,{},supplied);assert.equal(loads.length,1);assert.equal(binding.coilVariantBinding.key,'new');
binding.$=()=>null;binding.renderExchangerVariants(state,{},supplied);assert.equal(loads.length,1,'Removed notice is optional; manual geometry is still preserved');
console.log('Construction page passed: ordered navigation; separate DOM workspace; removed variants table; actions/3D/thermal routing; automatic binding without UI; manual geometry preserved.');
