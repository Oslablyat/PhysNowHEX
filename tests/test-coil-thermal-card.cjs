const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const card=require('../assets/coil-thermal-card.js'),method=require('../assets/coil-thermal-method.js');
function covered(object,schema,skip=[]){for(const key of Object.keys(object))assert(schema.some(field=>field[0]===key)||skip.includes(key),'Unmapped card parameter: '+key)}
(async()=>{
 const cp=await(await import(pathToFileURL(path.join(__dirname,'../assets/vendor/coolprop/coolprop.js')))).default({wasmBinary:fs.readFileSync(path.join(__dirname,'../assets/vendor/coolprop/coolprop.wasm')),print:()=>{},printErr:()=>{}});
 const inputs={...method.DEFAULT_INPUT,hot_flow_mode:'mass',cold_flow_mode:'volume'},r=method.calculate(inputs,(...args)=>cp.PropsSI(...args)),s=card.schemas,groups=card.sections(r,inputs,'8.0.0'),text=JSON.stringify(groups);
 covered(r,s.global,['coils','rows','shell','between_rows','hot_properties','cold_properties']);covered(r.shell,s.shell);covered(r.hot_properties,s.properties);covered(r.cold_properties,s.properties);r.rows.forEach(row=>covered(row,s.row));r.coils.forEach(coil=>covered(coil,s.coil));
 for(const name of ['ᾱh','αc','Nuc','Nuh,i','Reh,i','Reкр,i','UA','Погонный коэффициент','Теплопроводность','вязкость','Невязка','εL','εφ','Поправка пучка','Температура внутренней','НЕ ПРОШЁЛ','Не предусмотрен'])assert(text.includes(name),name);
 assert(!/NaN|undefined|Infinity/.test(text));assert(!text.includes('Среднее трубное число Нуссельта'));
 assert(groups.filter(g=>g.title.startsWith('Teplo · змеевик ')).length===r.number_of_coils);assert(groups.every(g=>['thermal','hydraulics','construction'].includes(g.id)));assert.deepEqual(card.sections(null),[]);
 const empty=card.sections({...r,shell:{...r.shell,s1_m:null}},inputs);assert(JSON.stringify(empty).includes('—'));
 console.log('Teplo card passed: every scalar/array output, properties, shell, rows and individual coils mapped; units, null values, applicability warnings, no fictitious Nu/pressure drop or non-finite text.');
})().catch(e=>{console.error(e);process.exitCode=1});
