(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CoilSequentialFormat=api})(globalThis,function(){
 function design(c){return c?{geometry:c.geometry,n:c.n,rowCount:c.rowCount,area:c.area,manufacturing:c.manufacturing,ignoredCriteria:c.ignoredCriteria,thermal:{heat_duty_kw:c.thermal.heat_duty_kw,ua_w_k:c.thermal.ua_w_k,t_hot_out_c:c.thermal.t_hot_out_c,t_cold_out_c:c.thermal.t_cold_out_c,re_hot:c.thermal.coils[0].re_hot,re_cold:c.thermal.shell.re_cold,valid:c.thermal.valid}}:null}
 function pack(result,elapsedMS){
  const c=result.rows?.[0]?.design;
  const s=result.selection;
  return {algorithm:result.algorithm??'production',found:!!c,firstSuccess:result.firstSuccess??null,stats:result.stats,elapsedMS,stopped:result.stopped??result.searchBudget?.stopped,message:result.message,trace:result.trace??[],attempts:result.attempts??[],selected:design(c),acceptedDesigns:result.acceptedDesigns?.map(design),selection:s?{referenceTubeM:s.referenceTubeM,tubeLimitM:s.tubeLimitM,maxTubeIncrease:s.maxTubeIncrease,acceptedCount:s.acceptedCount,recommended:design(s.recommended),simplest:design(s.simplest),compact:design(s.compact),economical:design(s.economical)}:null};
 }
 function summary(cases){
  const both=cases.filter(c=>c.before.found&&c.after.found),sum=(side,field)=>cases.reduce((s,c)=>s+(c[side].stats[field]||0),0);
  return {total:cases.length,beforeFound:cases.filter(c=>c.before.found).length,afterFound:cases.filter(c=>c.after.found).length,both:both.length,lost:cases.filter(c=>c.before.found&&!c.after.found).map(c=>c.id),gained:cases.filter(c=>!c.before.found&&c.after.found).map(c=>c.id),shorter:both.filter(c=>c.after.selected.geometry.height<c.before.selected.geometry.height).length,longer:both.filter(c=>c.after.selected.geometry.height>c.before.selected.geometry.height).length,beforeCalls:sum('before','evaluations'),afterCalls:sum('after','evaluations'),beforeGeometry:sum('before','geometryChecks'),afterGeometry:sum('after','geometryChecks'),acceptedWithin20:cases.filter(c=>c.after.found&&c.after.stats.evaluations<=20).length};
 }
 return {pack,summary};
});
