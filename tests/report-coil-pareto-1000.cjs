const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../docs/audits');
const read=name=>JSON.parse(fs.readFileSync(path.join(dir,name+'.json'),'utf8'));
const before=[...read('coil-pareto-50'),...read('coil-pareto-40-extra')];
const after=[...read('coil-pareto-1000'),...read('coil-pareto-1000-extra')];
const oldById=new Map(before.map(r=>[r.id,r]));
assert.equal(new Set(after.map(r=>r.id)).size,90);
for(const r of after){
 assert.deepEqual(r.state,oldById.get(r.id).state);
 assert.equal(r.algorithm,'inline-pareto-v2');assert.deepEqual(r.issues,[]);
 assert(r.calls<=1000);
}
const primary=after.filter(r=>r.id>50||(r.id-1)%5===(Math.floor((r.id-1)/5)+4)%5);
assert.equal(primary.length,50);
const sum=(rows,key)=>rows.reduce((n,r)=>n+r[key],0);
const fmt=(n,digits=0)=>n.toLocaleString('ru-RU',{maximumFractionDigits:digits});
function comparison(row){
 const a=row.geometry,b=oldById.get(row.id).geometry;
 if(!a||!b)return a?'Найден впервые':b?'Потерян':'Оба поиска пусты';
 if(a.valid!==b.valid)return a.valid?'Подтверждена применимость':'Только с исключением';
 const diff=a.metrics.map((v,i)=>v-b.metrics[i]),eps=1e-8;
 if(diff.every(v=>Math.abs(v)<=eps))return 'Равные показатели';
 if(diff.every(v=>v<=eps))return 'Улучшение';
 if(diff.every(v=>v>=-eps))return 'Ухудшение';
 return 'Другой компромисс';
}
const text=['# Подбор с лимитом 1 000 поверок','',
 'Сравнивались сохранённые результаты версии v1 с потолком 10 000 и фактические запуски v2 с потолком 1 000. Использованы идентичные входы. Основная серия содержит 50 различных тепловых режимов. Ещё 40 запусков проверяют другие ограничения у опорных режимов.','',
 '| Серия | Версия | Успешных | Из них с исключением Re | Поверок | Ошибок Teplo | Подходящих | На фронтах |',
 '|---|---|---:|---:|---:|---:|---:|---:|'];
for(const [label,rows] of [['50 режимов',primary],['Все 90 запусков',after]]){
 for(const [version,list] of [['v1',rows.map(r=>oldById.get(r.id))],['v2',rows]]){
  text.push('| '+[label,version,list.filter(r=>r.geometry).length,list.filter(r=>r.geometry&&!r.geometry.valid).length,...['calls','errors','accepted','front'].map(k=>fmt(sum(list,k)))].join(' | ')+' |');
 }
}
text.push('','В каждом запуске проверены фактическое число и уникальность тепловых входов, все принятые геометрии в валидаторе редактора, независимый расчёт фронта и первого места. Для каждой рекомендации повторены исходная поверка Teplo и измерение трубок. Дополнительная контрольная поверка рекомендации относится к аудиту. Таблица затрат учитывает вызовы самого решателя, включая ошибки и диагностику габаритов.','',
 '## Сравнение рекомендаций','',
 'Улучшение означает, что по пяти показателям рабочей длины, диаметра, закупки или полного метража, числа трубок и рядов ни один не стал хуже и хотя бы один стал лучше. Если улучшение одних сопровождается ростом других, указан другой компромисс. Число точек нового фронта само по себе не измеряет близость к глобальному оптимуму. Исходное множество v1 хранит показатели победителей и размеры фронтов, поэтому здесь сравниваются рекомендации и размеры, а не совпадение всех строк.','',
 '| Результат | 50 различных режимов | Все 90 запусков |','|---|---:|---:|');
for(const outcome of ['Улучшение','Равные показатели','Другой компромисс','Ухудшение','Найден впервые','Потерян','Оба поиска пусты','Подтверждена применимость','Только с исключением']){
 const n=count=>count.filter(r=>comparison(r)===outcome).length;
 if(n(after)||outcome==='Потерян'||outcome==='Ухудшение')text.push('| '+[outcome,n(primary),n(after)].join(' | ')+' |');
}
const exhausted=primary.filter(row=>row.calls===1000);
text.push('', 'Предел 1 000 достигнут в '+exhausted.length+' из 50 различных режимов. Из них в '+exhausted.filter(row=>!row.geometry).length+' случаях таблица осталась пустой. Для этих заданий возможность найти подходящую конструкцию при дальнейшем поиске остаётся открытой.');
text.push('','## Что дают последние поверки','',
 'Для каждого порога взяты уже проверенные к этому моменту конструкции в том же порядке поиска. Первое место пересчитано на доступных строках. Совпадение проверяется по полной геометрии рекомендации.','',
 '| Порог полных поверок | Режимов с вариантом из 50 | Совпадений с окончательной рекомендацией из 25 |','|---:|---:|---:|');
for(const limit of [100,250,500,800,1000]){
 const snapshots=primary.map(row=>row.budgets.find(b=>b.limit===limit));
 text.push('| '+[fmt(limit),snapshots.filter(b=>b.found).length,snapshots.filter(b=>b.same).length].join(' | ')+' |');
}
text.push('','## Сверка с независимо построенными конструкциями','',
 '| № | Q задания, кВт | Рекомендация v1, H × ØD | Рекомендация v2, H × ØD | Независимый пример, H × ØD | Полное совпадение геометрии v2 с примером |',
 '|---:|---:|---|---|---|---|');
const size=metrics=>metrics?metrics[0]+' × Ø'+metrics[1]:'—';
for(const c of read('coil-pareto-challenges').filter(c=>c.chosen)){
 const r=after.find(x=>x.id===c.id);
 text.push('| '+[c.id,fmt(r.target,3),size(oldById.get(c.id).geometry?.metrics),size(r.geometry?.metrics),size(c.chosen.metrics),r.geometry?.key===c.chosen.geometryKey?'Да':'Нет'].join(' | ')+' |');
}
const example19=read('coil-pareto-challenges').find(r=>r.id===19).chosen;
const result19=after.find(r=>r.id===19);
if(result19.frontMetrics.some(row=>row.metrics.every((value,i)=>Math.abs(value-example19.metrics[i])<1e-8))){
 text.push('','В задании № 19 показатели независимого примера присутствуют в таблице Парето. При одинаковой закупке 3 м, одной трубке и одном ряде пример 206 × Ø92 мм выигрывает по высоте, а рекомендация 222 × Ø82 мм — по диаметру.');
}
text.push('','## Результаты 50 сопоставленных режимов','',
 '| № | Q задания, кВт | Поверки v1 → v2 | Принято v1 → v2 | Фронт v1 → v2 | H × ØD v1 → v2, мм | Сравнение |',
 '|---:|---:|---:|---:|---:|---|---|');
for(const r of primary){
 const b=oldById.get(r.id),pair=k=>fmt(b[k])+' → '+fmt(r[k]);
 text.push('| '+[r.id,fmt(r.target,3),pair('calls'),pair('accepted'),pair('front'),size(b.geometry?.metrics)+' → '+size(r.geometry?.metrics),comparison(r)].join(' | ')+' |');
}
text.push('','Полные входы, выходы и рекомендации сохранены в [первой серии v2](coil-pareto-1000.json) и [дополнительной серии v2](coil-pareto-1000-extra.json). Предыдущий [отчёт](coil-pareto-50.md) содержит методику испытаний и независимые конструкции.','',
 'Для повторения из корня репозитория выполнить','',
 '```sh','node tests/audit-coil-pareto-50.cjs','node tests/audit-coil-pareto-50.cjs extended','node tests/report-coil-pareto-1000.cjs','```','');
fs.writeFileSync(path.join(dir,'coil-pareto-1000.md'),text.join('\n'));
