export function changeKind(c){
 if(c.before.found&&c.after.found)return c.after.selected.height<c.before.selected.height-1e-7?'shorter':c.after.selected.height>c.before.selected.height+1e-7?'longer':'same';
 return c.before.found?'lost':c.after.found?'gained':'none';
}
export const changeLabels={shorter:'Короче',longer:'Длиннее',same:'Та же длина',lost:'Решение потеряно',gained:'Новое решение',none:'Без конструкции'};
export function resultReason(side){
 if(side.found)return 'Конструкция найдена и прошла проверку.';
 if(!side.countRange||side.countRange.min>side.countRange.max)return 'Нет целого числа трубок для Re 15 000–20 000 в пределах 500 трубок.';
 if(!side.families)return 'Не найдена компоновка по числу трубок, радиусу навивки и зазорам.';
 if(side.stop==='budget-exhausted')return 'Достигнут лимит 200 проверок. Подходящий вариант не найден; отсутствие решения не доказано.';
 if(!side.screened)return 'В каталоге нет полной компоновки под заготовки 1/3/6 м с остатком до 20 %.';
 return 'Проверенный каталог исчерпан: варианты не прошли тепловое задание или ограничения методики. Отсутствие другой конструкции не доказано.';
}
export function axialGap(g,row=g.rows[0]){return row.pitch/row.count-g.tubeDiameter}
export function windingArea(g){const mean=(g.tubeDiameter-g.tubeWall)/1000;return g.rows.reduce((s,r)=>s+Math.PI*mean*r.count*r.turns*Math.hypot(Math.PI*r.diameter,r.pitch)/1000,0)}
export function matches(c,filter,query){
 const kind=changeKind(c),hit=filter==='all'||filter==='both'&&c.before.found&&c.after.found||filter===kind;
 const s=c.inputs,haystack=[c.id,s.mh,s.thi,s.tho,s.tci,s.tco].join(' ').toLowerCase();return hit&&haystack.includes(query.trim().replace(',','.').toLowerCase());
}
