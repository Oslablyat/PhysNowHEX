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
for(const id of ['detail-geometry','apparatus-drawing','design-layout','layout-main-3d','detail-preview-mode','view-exchanger-card','choose-verification'])assert(parents.get(id).includes('construction-page'),`${id} belongs to construction tab`);
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
assert(events.includes('verification'));assert(app.includes("!$('construction-page').hidden&&$('detail-preview-mode').value==='characteristics'"));
// Switching the preview must start the lazy 3D view directly, even after
// reopening a sheet. Other previews and other pages pause the same renderer.
const previewElements={
 'construction-page':{hidden:false},
 'detail-preview-mode':{value:'layout'},
 'apparatus-drawing':{hidden:false},
 'design-layout':{hidden:false},
};
const rendererVisibility=[],loads3d=[];
const previewContext={
 $:id=>previewElements[id],
 designLayout3d:{setVisible:visible=>rendererVisibility.push(visible)},
 ensureDesignLayout3d:()=>loads3d.push('load'),
 syncCoilThermalVisibility:()=>{},
};
vm.createContext(previewContext);
vm.runInContext(app.slice(app.indexOf('function syncDesignLayoutVisibility('),app.indexOf('function designLayout3dStatus(')),previewContext);
for(const mode of ['layout','model-3d','characteristics','model-3d']){
 previewElements['detail-preview-mode'].value=mode;
 previewContext.syncDesignLayoutVisibility();
 assert.equal(previewElements['design-layout'].hidden,mode!=='model-3d');
 assert.equal(previewElements['apparatus-drawing'].hidden,mode!=='layout');
 assert.equal(rendererVisibility.at(-1),mode==='model-3d');
}
assert.equal(loads3d.length,2);
previewElements['construction-page'].hidden=true;
previewContext.syncDesignLayoutVisibility();
assert.equal(rendererVisibility.at(-1),false);
assert.equal(loads3d.length,2);
// Removed table must not turn off automatic coil geometry binding or overwrite manual edits.
const renderSource=app.slice(app.indexOf('function renderExchangerVariants('),app.indexOf('function restoreCoilVariantBinding('));
const status={},loads=[],state={'exchanger-type':'coil'},supplied={inputKey:'new',rows:[{id:'balanced',name:'Оптимальная',design:{kind:'coil'}}],message:'Ready'};
const binding={currentVariants:null,selectedVariant:'balanced',coilVariantBinding:null,$:id=>{assert.equal(id,'variant-status');return status},syncCoilVariantNotice(){},syncVariantSelection(){},loadCoilVariant:(...args)=>loads.push(args)};vm.createContext(binding);vm.runInContext(renderSource,binding);binding.renderExchangerVariants(state,{},supplied);assert.equal(loads.length,1);assert.deepEqual(loads[0],['balanced',false]);assert.equal(binding.currentVariants,supplied);
binding.coilVariantBinding={key:'old',profile:'balanced',manual:true};binding.renderExchangerVariants(state,{},supplied);assert.equal(loads.length,1);assert.equal(binding.coilVariantBinding.key,'new');
binding.$=()=>null;binding.renderExchangerVariants(state,{},supplied);assert.equal(loads.length,1,'Removed notice is optional; manual geometry is still preserved');
console.log('Construction page passed: ordered navigation; separate DOM workspace; removed variants table; actions/3D/thermal routing; automatic binding without UI; manual geometry preserved.');
assert(parents.get('apply-coil-project').includes('construction-page'));
const origin={coilVariantBinding:null,coilProject:{phase:'selecting'},currentVariants:null};vm.createContext(origin);vm.runInContext(app.slice(app.indexOf('function coilGeometrySourceLabel('),app.indexOf('function coilExchangerCardData(')),origin);assert.match(origin.coilGeometrySourceLabel(),/до завершения/);origin.coilVariantBinding={manual:true};assert.match(origin.coilGeometrySourceLabel(),/ручная/);origin.coilVariantBinding={key:'new',manual:false};origin.coilProject.phase='ready';origin.currentVariants={inputKey:'new',rows:[{}]};assert.match(origin.coilGeometrySourceLabel(),/Результат автоматического/);
const applyButton={hidden:true},applyContext={$:id=>id==='apply-coil-project'?applyButton:{value:'coil'},coilProject:{phase:'ready'},currentVariants:{inputKey:'new',rows:[{id:'balanced'}]},coilVariantBinding:{key:'new',manual:true}};vm.createContext(applyContext);vm.runInContext(app.slice(app.indexOf('function syncApplyCoilProject('),app.indexOf('function markCoilVariantManual(')),applyContext);applyContext.syncApplyCoilProject();assert.equal(applyButton.hidden,false);applyContext.coilVariantBinding.manual=false;applyContext.syncApplyCoilProject();assert.equal(applyButton.hidden,true);applyContext.coilProject.phase='selecting';applyContext.syncApplyCoilProject();assert.equal(applyButton.hidden,true);
