(function(root){
 'use strict';
 const profiles=[{id:'balanced',name:'Оптимальная конструкция',detail:'Равный вес объёма корпуса и показателя изготовления'},{id:'compact',name:'По габаритам',detail:'Минимальный объём корпуса'},{id:'production',name:'По сложности производства',detail:'Минимум 2N + суммы витков всех змеевиков; сравнительный показатель, не трудоёмкость'}];
 let last=null;
 function inputKey(state,result){return JSON.stringify([Number(state.length),Number(state['exchanger-diameter']),Number(Number(result?.designArea).toPrecision(10)),state['refine-tubes']===true,...(state['refine-tubes']===true?[Number(state['tube-diameter']),Number(state['tube-wall'])]:[])]);}
 function select(state,result,validate){
  const key=JSON.stringify([inputKey(state,result),result?.designArea]);if(last?.key===key&&last.validate===validate)return last.value;
  const done=value=>{last={key,validate,value};return value;};
  const empty=message=>done({kind:'coil',rows:[],candidates:[],message,inputKey:inputKey(state,result)});
  const target=result?.designArea,maxH=Number(state.length),maxD=Number(state['exchanger-diameter']);
  if(!Number.isFinite(target)||target<=0)return empty('Заполните параметры потоков: геометрические варианты появятся автоматически.');
  if(!Number.isFinite(maxH)||!Number.isFinite(maxD)||maxH<200||maxH>10000||maxD<200||maxD>3000)return empty('Границы геометрического подбора: L от 200 до 10 000 мм, D от 200 до 3 000 мм.');
  const sizes=state['refine-tubes']===true?[[Number(state['tube-diameter']),Number(state['tube-wall'])]]:[[16,1.5],[20,2],[25,2],[32,2.5]];
  if(sizes.some(([d,w])=>!Number.isFinite(d)||!Number.isFinite(w)||w<=0||d<=2*w||d>100))return empty('Проверьте наружный диаметр и толщину стенки трубы.');
  const diameters=[...new Set([.4,.5,.6,.7,.8,.9,1].map(k=>Math.round(maxD*k)).filter(d=>d>=200&&d<=maxD))],candidates=[],seen=new Set();
  for(const diameter of diameters)for(const [dmm,wmm] of sizes){
   const coreDiameter=Math.round(diameter*.2),gap=2,outer=diameter-10-dmm-2*gap,inner=Math.max(coreDiameter+dmm+2*gap,4*dmm+1);
   for(let nr=1;nr<=8;nr++)for(const spacing of [1,1.5]){
    const ds=Array.from({length:nr},(_,i)=>outer-2*(dmm+gap)*spacing*(nr-1-i));if(ds[0]<inner)continue;
    for(const count of [1,2,4])for(const axialFactor of [1,1.25]){
     const q=count*(dmm+gap)/(Math.PI*ds[0]);if(q>=1)continue;
     const pitch=Math.ceil(count*(dmm+gap)/Math.sqrt(1-q*q)*axialFactor),areaPerTurn=Math.PI*dmm/1e6*ds.reduce((sum,d)=>sum+count*Math.hypot(Math.PI*d,pitch),0);
     const turns=Math.max(1,Math.ceil(target/areaPerTurn));if(turns>100)continue;
     const height=Math.max(200,Math.ceil(turns*pitch+dmm));if(height>maxH)continue;
     const geometry={diameter,height,shellWall:5,coreDiameter,coreLength:height,coreWall:2,tubeDiameter:dmm,tubeWall:wmm,clearance:gap,coreClearance:gap,shellClearance:gap,rowClearance:gap,leadBendRadius:2*dmm,leadStraightLength:Math.max(40,2*dmm),rows:ds.map(d=>({diameter:d,count,turns,pitch,offset:0,phase:0,direction:'right',hidden:false}))};
     const key=JSON.stringify(geometry);if(seen.has(key))continue;seen.add(key);
     let g;try{g=validate(geometry)}catch{continue}
     if(g.totalArea+1e-10<target)continue;
     const totalTurns=g.rows.reduce((sum,row)=>sum+row.turns*row.count,0),volume=Math.PI/4*(diameter/1000)**2*height/1000;
     candidates.push({kind:'coil',geometry,length:height/1000,diameter:diameter/1000,dmm,wmm,n:g.totalCount,area:g.totalArea,totalLength:g.totalLength,rowCount:nr,totalTurns,volume,complexity:2*g.totalCount+totalTurns});
    }
   }
  }
  if(!candidates.length)return empty('В перебранных геометрических вариантах нет нужной площади в заданных L и D. Увеличьте габариты или измените типоразмер труб.');
  const minVolume=Math.min(...candidates.map(c=>c.volume)),minComplexity=Math.min(...candidates.map(c=>c.complexity));
  for(const c of candidates)c.balanced=(Math.log(c.volume/minVolume)+Math.log(c.complexity/minComplexity))/2;
  const keys={balanced:'balanced',compact:'volume',production:'complexity'};
  const rows=profiles.map(profile=>({...profile,design:candidates.reduce((best,c)=>c[keys[profile.id]]<best[keys[profile.id]]?c:best)}));
  return done({kind:'coil',inputKey:inputKey(state,result),rows,candidates,message:'Геометрический подбор по требуемой площади с запасом. K задан проектировочным расчётом. Гидравлика пока не рассчитывается.'});
 }
 const api={select,inputKey,profiles};if(typeof module==='object'&&module.exports)module.exports=api;else root.CoilDesignVariants=api;
})(globalThis);
