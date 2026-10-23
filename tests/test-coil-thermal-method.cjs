const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
const method=require('../assets/coil-thermal-method.js'),fixtures=require('./fixtures/teplo-reference.json');
function compare(actual,expected,label){
 if(typeof expected==='number'){assert(Number.isFinite(actual),label+' is not finite');assert(Math.abs(actual-expected)<=Math.max(1e-7,Math.abs(expected)*1e-9),label+': '+actual+' != '+expected);return}
 if(expected===null||typeof expected!=='object'){assert.equal(actual,expected,label);return}
 for(const key of Object.keys(expected))compare(actual[key],expected[key],label+'.'+key);
}
(async()=>{
 const create=(await import(pathToFileURL(path.join(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default;
 const cp=await create({wasmBinary:fs.readFileSync(path.join(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print:()=>{},printErr:()=>{}}),props=(...args)=>cp.PropsSI(...args);
 assert.equal(cp.get_global_param_string('version'),'8.0.0');
 for(const {name,inputs,expected} of fixtures.cases){const before=JSON.stringify(inputs),r=method.calculate(inputs,props),coils=r.rows.map(row=>r.coils.find(c=>c.row===row.row));compare({...r,coils},expected,name);assert.equal(JSON.stringify(inputs),before);assert(!('nu_hot' in r));assert(!('nu_cold' in r));assert(r.rows.every(row=>!('alpha_cold_w_m2k' in row)));assert(Math.abs(r.heat_balance_error_w)<1e-7);assert(r.outlet_error_hot_c<=.01&&r.outlet_error_cold_c<=.01&&r.wall_error_c<=.01)}
 const spec={count:3,radius_m:.05,pitch_m:.042,turns:1,tube_outer_diameter_m:.014};
 assert.equal(method.buildLayout({coil_rows:[spec]}).errors.length,0);
 assert(method.buildLayout({coil_rows:[{...spec,pitch_m:.04199}]}).errors.length);
 for(const patch of [{count:0},{count:1.5},{turns:1.5},{radius_m:NaN},{pitch_m:''}])assert.throws(()=>method.calculate({coil_rows:[{...spec,...patch}]},props));
 for(const patch of [{tube_wall_thickness_m:.007},{p_hot_mpa:0},{t_hot_in_c:20},{row_count:2},{arrangement:'bad'},{mass_flow_hot_kg_s:0},{mass_flow_hot_kg_s:1,volume_flow_hot_m3_h:1},{hot_fluid:'not-a-fluid'}])assert.throws(()=>method.calculate(patch,props));
 assert.throws(()=>method.calculate({},()=>Infinity));assert.throws(()=>method.calculate({},()=>NaN));
 compare(method.counterflowFraction(100,200,200),1/3,'Equal capacity rates');assert.equal(method.counterflowFraction(0,200,100),0);assert(Number.isFinite(method.counterflowFraction(1e12,200,201)));
 compare(method.interp(15,[10,20],[.42,.52]),.47,'Linear interpolation');assert.equal(method.interp(0,[10,20],[.42,.52]),.42);
 const base=method.calculate({},props),volume=method.calculate({hot_flow_mode:'volume',volume_flow_hot_m3_h:base.volume_flow_hot_inlet_m3_h},props);compare(volume.heat_duty_w,base.heat_duty_w,'Equivalent inlet volume');
 const hidden=method.calculate({...method.DEFAULT_INPUT,coil_rows:method.DEFAULT_INPUT.coil_rows.map(r=>({...r,hidden:true}))},props);compare(hidden.heat_duty_w,base.heat_duty_w,'Visibility must not change thermal result');
 // Deterministic constant-property injection is only for exact branch boundaries,
 // not the physical reference suite above (which uses real CoolProp).
 const constantProps=name=>({Dmass:1000,VISCOSITY:.001,Cpmass:4200,CONDUCTIVITY:.6,PRANDTL:7})[name];
 const free=method.buildLayout().rows[0].free_area_m2,atRe=(re)=>method.calculate({cold_flow_mode:'mass',mass_flow_cold_kg_s:re*.001*free/.014},constantProps);
 assert.equal(atRe(999).shell.regime,'laminar');assert.equal(atRe(1000).shell.regime,'crossflow');assert.equal(atRe(99999).shell.valid,true);assert.equal(atRe(100001).shell.valid,false);
 console.log('Teplo: '+fixtures.cases.length+' independent Python/CoolProp 8.0.0 references match browser WASM to 1e-9 relative / 1e-7 absolute; geometry, both shell branches, arrangements, row diameters, short-length correction, applicability warnings, valid regimes, flow conversion, balanced limits and input errors passed.');
})().catch(error=>{console.error(error);process.exitCode=1});
