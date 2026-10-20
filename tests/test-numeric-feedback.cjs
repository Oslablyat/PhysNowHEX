const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync(require('node:path').join(__dirname,'..','app.js'),'utf8');
const validate=vm.runInNewContext(app.slice(app.indexOf('function numericFieldErrors('),app.indexOf('function clearFieldFeedback('))+'\nnumericFieldErrors',{
 thermalIds:['thi','tho','tci','tco','mh','cph','cpc','u','ph','pc'],
 geometryIds:['length','exchanger-diameter','area-reserve-percent','tube-diameter','tube-wall','tube-length','tube-count']
});
const state={thi:90,tho:60,tci:20,tco:40,mh:2.5,cph:4.18,cpc:4.18,u:800,ph:.6,pc:.4,flow:'counter',length:2000,'exchanger-diameter':600,'area-reserve-percent':10,'tube-diameter':20,'tube-wall':2,'tube-length':1800,'tube-count':80};
assert.equal(Object.keys(validate(state)).length,0);
assert(validate({...state,ph:0}).ph);
assert(validate({...state,mh:-1}).mh);
assert(validate({...state,length:''}).length);
assert(validate({...state,'area-reserve-percent':-1})['area-reserve-percent']);
assert(validate({...state,'tube-count':1.5})['tube-count']);
const thick=validate({...state,'tube-wall':10});assert(thick['tube-wall']&&thick['tube-diameter']);
const crossing=validate({...state,thi:35,tho:30});assert(crossing.thi&&crossing.tco);
assert.equal(Object.keys(validate({...state,thi:-10,tho:-20,tci:-40,tco:-30})).length,0);
assert(validate({...state,tci:-273.15}).tci);
console.log('10 numeric validation checks passed.');
