const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const dir=path.resolve(__dirname,'../docs/audits'),r=JSON.parse(fs.readFileSync(path.join(dir,'coil-selection-150.json'),'utf8'));
const probes=JSON.parse(fs.readFileSync(path.join(dir,'coil-selection-probes.json'),'utf8')),python=JSON.parse(fs.readFileSync(path.join(dir,'coil-selection-python.json'),'utf8'));
const app=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8'),validate=vm.runInNewContext(app.slice(app.indexOf('function coilGeometryError('),app.indexOf('function coilFieldDefinitions('))+';calculateCoilGeometry'),manufacturing=require('../assets/coil-manufacturing.js');
const category=c=>c.found?'FOUND':!c.countRange.selected?'NO_N':!c.stats.families?'NO_FAMILY':c.budget.stopped==='budget-exhausted'?'LIMIT':'CATALOGUE';
const tally={};for(const c of r.cases)tally[category(c)]=(tally[category(c)]||0)+1;
const f=(n,d=3)=>Number(n).toFixed(d),q=s=>'"'+String(s??'').replaceAll('"','""')+'"';
const fields=['id','regime','mh_kg_s','mc_kg_s','thi_C','tho_C','tci_C','tco_C','status','selected_N','N_min','N_max','full_checks','catalogue_size','target_kW','actual_kW','excess_percent','hot_out_C','cold_out_C','height_mm','diameter_mm','Re_hot','Re_shell','milliseconds'];
const csv=[fields.map(q).join(',')];
for(const c of r.cases){const s=c.state,t=c.target,d=c.selected;csv.push([c.id,c.regime,c.mh,t.mc,s.thi,s.tho,s.tci,s.tco,category(c),c.countRange.selected,c.countRange.min,c.countRange.max,c.stats.evaluations,c.budget.screened,t.q,d?.q,d?(d.ratio-1)*100:null,d?.hot,d?.cold,d?.height,d?.diameter,d?.re,d?.shellRe,c.elapsedMS].map(q).join(','))}
fs.writeFileSync(path.join(dir,'coil-selection-150.csv'),'\ufeff'+csv.join('\r\n')+'\r\n');
const lines=[
 '# Аудит подбора оптимальной змеевиковой конструкции — 150 сценариев',
 '',`Дата: 04.11.2026. Алгоритм: \`${r.algorithm}\`. Исходный рабочий алгоритм при аудите не изменён.`,
 '', '## Условия серии',
 '', `15 расходов горячей воды: ${r.flows.join('; ')} кг/с. Каждый сочетается с 10 температурными режимами. Холодный расход находится по балансу, а не задаётся независимо.`,
 '', 'Габариты не фиксировались равенством: верхние пределы L=10 000 мм, D=3 000 мм — максимальные в текущем интерфейсе. Труба 14×2,5 мм, зазоры 3 мм, λw=16 Вт/(м·К), запас UA=0 %, вода/вода, противоток, расположение рядов коридорное. Абсолютные давления: трубное 2 МПа, межтрубное 1,2 МПа. Они выбраны для жидкой воды во всех режимах; давления в этой серии не варьировались.',
 '', 'Исходные функции balance/select вызываются из рабочего модуля без изменения бюджета или корреляций. Каждый выданный результат повторно пересчитан Teplo и проверен валидатором геометрии приложения, по точным длинам трубок и заготовкам. Затем все выданные конструкции независимо пересчитаны исходным Python Teplo + CoolProp 8.0.0.',
 '', '## Основные результаты',
 '', '| Результат | Число |','|---|---:|',
 `| Найдена и подтверждена конструкция | ${tally.FOUND} |`,
 `| Не выбрано целое N в заданном интервале Re и до 500 трубок | ${tally.NO_N} |`,
 `| Для выбранного N не сформировано геометрических семейств | ${tally.NO_FAMILY} |`,
 `| Достигнут предел 200 полных проверок без результата | ${tally.LIMIT} |`,
 `| Исчерпан сокращённый каталог до 200 проверок без результата | ${tally.CATALOGUE} |`,
 '', `Всего ${r.summary.totalCalls} полных расчётов в основной серии; ${f(r.summary.totalMS/1000,1)} с внутри сценариев, без начальной загрузки WASM. Измерения зависят от машины, кэша и параллельной нагрузки; это не обещание времени браузера. Исключений полного расчёта: ${r.cases.reduce((s,c)=>s+c.stats.errors,0)}. Нарушений проверяемых условий у выбранных конструкций: ${r.summary.auditFailures}.`,
 '', '55/150 — доля успехов именно этой специально широкой стресс-сетки, не оценка вероятности успеха на реальных заданиях. Среди 83 сценариев, дошедших до полной поверки, успехов 55. 36 из 55 решений найдены в первой партии 20; остальным потребовалось больше. Все 21 случая с лимитом завершились без результата.',
 '', '44 отказа на N: 12 — даже одна трубка не достигает предварительного Re=15000; 12 — нет целого N между границами; 20 — нужно больше 500 трубок. Это отказ текущих ограничений и предварительного выбора, а не результат исчерпывающего поиска по всем типоразмерам и фактическим состояниям.',
 '', '## Температурные режимы',
 '', '| Режим | Горячий вход→выход, °C | Холодный вход→выход, °C | Найдено из 15 | Дошло до Teplo |','|---|---|---|---:|---:|'
];
for(const p of r.regimes){const cs=r.cases.filter(c=>c.regime===p.id);lines.push(`| ${p.id} | ${p.thi}→${p.tho} | ${p.tci}→${p.tco} | ${cs.filter(c=>c.found).length} | ${cs.filter(c=>c.stats.evaluations>0).length} |`)}
lines.push('', '## Полная матрица', '', '✓ — найдено; N — предварительный выбор числа трубок не прошёл; G — нет геометрических семейств для выбранного N; L — лимит 200; C — каталог закончился. Отказ не доказывает физическую невозможность.', '', '| Режим / кг·с⁻¹ | '+r.flows.join(' | ')+' |','|---|'+r.flows.map(()=>'---:|').join(''));
for(const p of r.regimes)lines.push('| '+p.id+' | '+r.flows.map(mh=>({FOUND:'✓',NO_N:'N',NO_FAMILY:'G',LIMIT:'L',CATALOGUE:'C'})[category(r.cases.find(c=>c.regime===p.id&&c.mh===mh))]).join(' | ')+' |');
lines.push('', '## Подтверждённые контрпримеры и дополнительные проверки', '', 'Это отдельные диагностические расчёты вне производственного лимита 200. Они не включены в 150 основных сценариев и не меняли рабочий алгоритм. Отсутствие результата в ограниченной диагностике также не доказывает невозможность.', '');
for(const p of probes.probes){
 const c=r.cases.find(c=>c.id===p.id);lines.push('',`### ${p.id}`, '', `Основной результат: ${c.found?'найден':'отказ'}, N=${c.countRange.selected}, ${c.stats.evaluations} полных проверок. Дополнительных вызовов: ${p.diagnosticCalls}.`);
 let evidence=false;
 for(const key of ['afterBudget','heightRefinement','alternativeN','shorterWinner'])if(p[key]){
  const e=p[key],g=e.geometry;validate(g);g.rows.forEach(row=>{const m=manufacturing.measure(row,g.leadBendRadius,g.leadStraightLength);assert(manufacturing.stockFor(m.totalMM));});
  assert(python.cases.some(v=>v.id===p.id&&v.kind===key),'Python evidence missing: '+p.id+' '+key);
  const label={afterBudget:'Найден проходящий вариант дальше рабочего лимита',heightRefinement:'Найден проходящий вариант при уточнении высоты',alternativeN:'Найден проходящий вариант с другим допустимым N',shorterWinner:'Найден более короткий проходящий вариант'}[key];
  lines.push('', `**${label}.** Qзад=${f(c.target.q,6)} кВт, Qфакт=${f(e.q,6)} кВт, избыток ${f((e.ratio-1)*100,6)} %. Выходы ${f(e.hot,6)} / ${f(e.cold,6)} °C. Re=${f(e.re,2)}. Корпус L=${g.height} мм, D=${g.diameter} мм.${key==='heightRefinement'?' Изменение высоты относительно исходной точки каталога: '+e.delta+' мм.':''}${key==='shorterWinner'?' Штатная длина была '+c.selected.height+' мм.':''}`);evidence=true;
 }
 if(!evidence)lines.push('', c.found?'Более короткий проходящий вариант в выполненной диагностике не найден. Глобальный минимум не доказан.':'Контрпример не найден в выполненной диагностике. Это не доказательство отсутствия подходящей конструкции.');
}
const evidenceCount=probes.probes.filter(p=>!p.productionFound&&(p.afterBudget||p.heightRefinement||p.alternativeN)).length;
lines.push('', '## Выводы и рекомендации', '', `1. Приёмка работает на этой серии: все 55 выданных конструкций удовлетворяют исходному Teplo, Re, геометрии, заготовкам, Q=0…+1 % и допускам температур. Независимый Python проверил ${python.checked} конструкций, включая диагностические контрпримеры.`,
 `2. Поиск неполон: подтверждено не менее ${evidenceCount} отказов, при которых подходящая конструкция существует. Важная причина — редкие высоты каталога и отсутствие локального уточнения под узкий допуск Q.`,
 '3. Выбор единственного N≈Re17500 сужает поиск. Если это N не разместилось или не дало нужной мощности, другие целые N внутри допустимого интервала штатно не рассматриваются. Это структурное ограничение; конкретный пропуск нельзя приписывать ему без найденного контрпримера с другим N.',
 '4. Большие вводимые габариты не снимают ограничение радиуса. Для di=9 мм требуется R<108 мм, поэтому рост диаметра корпуса до 3 м не позволяет произвольно разнести ряды и вместить большие расходы. Менять это ограничение без изменения принятой методики нельзя.',
 '5. Режимы E и I дали 0/15. В проверенных вариантах тесное сближение температур часто не обеспечивается при заданных ограничениях; часть вариантов нарушает Re после поверки. Физическая невозможность всех компоновок не доказана.',
 '6. Рекомендуемый следующий шаг: сохранить 200 полных вызовов, выделить часть бюджета на локальное уточнение длины/шага у близких результатов вместо проверки только каталожных высот. Затем добавить небольшой резервный выбор N внутри уже вычисленного допустимого интервала, особенно при отсутствии геометрических семейств. Первую партию 20 нельзя считать гарантией минимума длины.',
 '', '## Артефакты и воспроизведение', '', '- [Все 150 сценариев и результаты, CSV](coil-selection-150.csv)', '- [Числовые данные и выбранная геометрия, JSON](coil-selection-150.json)', '- [Дополнительная диагностика, JSON](coil-selection-probes.json)', '- [Сверка исходным Python, JSON](coil-selection-python.json)', '', 'Из корня репозитория:', '', '```powershell', 'node tests/audit-coil-selection.cjs', 'node tests/audit-coil-selection-probes.cjs B-5 C-5 D-0.08 D-0.15 A-10 A-0.5 C-2.5 E-0.2', 'node tests/audit-coil-selection-probes.cjs --wide C-5 D-0.2 D-0.5 D-2.5 J-0.15 J-2.5 A-2.5 F-2.5 G-2.5', 'python tests/audit-coil-selection-reference.py', 'node tests/report-coil-selection-audit.cjs', '```', '', 'Для Python нужны зависимости исходной методики, включая CoolProp==8.0.0. Основная серия и геометрические проверки работают на встроенном WASM без Python. Опция --details у основной серии сохраняет также наблюдения по каждому вызову. Диагностический скрипт использует изолированную VM-копию модуля только для принудительного выбора альтернативного N, не редактирует production и всегда применяет исходную полную приёмку.');
fs.writeFileSync(path.join(dir,'coil-selection-report.md'),lines.join('\n')+'\n');
console.log({cases:r.cases.length,tally,probes:probes.probes.length,missedSolutions:evidenceCount,python:python.checked});
