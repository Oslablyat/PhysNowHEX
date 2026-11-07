const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),q=require('../assets/coil-sequential-method.js');
const root=path.resolve(__dirname,'..'),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const report=read('docs/audits/coil-sequential-150.json'),previous=read('docs/audits/coil-sequential-v5-snapshot.json'),focused=read('docs/audits/coil-sequential-focused-v6.json'),s=report.summary;
assert.equal(report.cases.length,150);assert.equal(focused.cases.length,16);
fs.writeFileSync(path.join(root,'assets/coil-sequential-focused-data.json'),JSON.stringify({created:focused.created,cases:focused.cases.map(c=>({id:c.id,state:c.state,target:c.target,before:c.current,after:c.after}))})+'\n');
const g=d=>d?`${d.geometry.height} × Ø${d.geometry.diameter}`:'нет результата',metres=d=>d?q.tubeMetres(d).toFixed(3):'—';
const pairs=report.cases.filter(c=>c.after.found&&previous.cases.find(p=>p.id===c.id).after.found),sum=(list,fn)=>list.reduce((s,c)=>s+fn(c),0),old=c=>previous.cases.find(p=>p.id===c.id).after.selected;
const less=pairs.filter(c=>q.tubeMetres(c.after.selected)<q.tubeMetres(old(c))-1e-7),fewer=pairs.filter(c=>c.after.selected.rowCount<old(c).rowCount),maxCalls=Math.max(...report.cases.map(c=>c.after.stats.evaluations));
const changed=pairs.filter(c=>JSON.stringify(c.after.selected.geometry)!==JSON.stringify(old(c).geometry)),gained=report.cases.filter(c=>c.after.found&&!previous.cases.find(p=>p.id===c.id).after.found),lost=report.cases.filter(c=>!c.after.found&&previous.cases.find(p=>p.id===c.id).after.found);
const used={radial:new Set(),shell:new Set(),core:new Set()};for(const c of report.cases)for(const d of c.after.acceptedDesigns??[]){const gaps=q.geometryGaps(d.geometry);for(const field of ['shell','core'])used[field].add(gaps[field]);for(const v of gaps.radial)used.radial.add(v)}
const gapText=d=>{if(!d)return '—';const a=q.geometryGaps(d.geometry);return `${a.radial[0]??'—'} / ${a.shell} / ${a.core}`};
const lines=[
 '# Разумная конструкция: тестовый подбор v6','', 'Дата: 07.11.2026, МСК.','',
 `Основной алгоритм ${report.baseline} не заменён. Тестовый ${report.experiment}. Расчётная база, Teplo/CoolProp и критерии приёмки не изменены.`, '',
 '## Правило выбора, согласованное с владельцем','',
 '1. Все варианты сначала должны пройти исходный Teplo и действующее задание: мощность 0…+1 %, близость выходных температур, Re/радиус/геометрия/заготовки.',
 '2. Среди найденных выбирается минимальное число рядов. Среди вариантов с этим числом рядов опорным становится минимальная длина корпуса, затем диаметр.',
 '3. Для большего числа рядов разрешён расход трубы не выше 120 % опорного. Учитывается полная физическая длина каждой трубки с обоими отводами и концами, умноженная на число параллельных трубок в ряду.',
 '4. Из опорных и удовлетворяющих бюджету многорядных вариантов выбирается меньшая длина, затем диаметр. При равенстве — меньше рядов и меньше трубы.',
 '5. Внутри минимального найденного числа рядов ограничение +20 % не применяется: это согласованное правило для дополнительных рядов. Поэтому single-coil сохраняет выбор короткого корпуса.',
 '6. На странице доступны четыре профиля одного поиска: «Разумная», «Самая короткая», «Меньше трубы», «Меньше рядов». Переключение показывает уже поверенные альтернативы без нового Teplo.', '',
 'Опорный вариант существует среди проверенных конструкций, а не среди всех физически возможных аппаратов. Цена материала и изготовления не рассчитывается. Лимит относится к фактической длине трубок, а не к сумме закупочных заготовок. Правило L≥2D отсутствует.', '',
 '## Как изменился поиск','',
 '- Первый допустимый вариант сохраняется. Общая схема определения N, рядов, радиуса и витков сохранена.',
 '- Архивируются все полностью принятые конструкции. Более длинные варианты с меньшим расходом трубы или меньшим числом рядов больше не отсекаются только из-за высоты.',
 '- До восьми первых поверок этапа улучшения уточняют простую опорную компоновку. Затем чередуются задачи разумного выбора, простой основы, короткого корпуса и экономии трубы.',
 '- Предварительно отсекаются формы, доминируемые уже проверенной конструкцией по всем четырём признакам: H, D, полная длина трубы, ряды. Прогноз длины точный аналитический, но тепловой прогноз не является приёмкой.',
 '- Попадание по UA уточняется по ближайшим полным расчётам. Учитывается зависимость поправки методики от числа витков; высоты по мм не перебираются.', '',
 '## Сетка и жёсткие ограничения','',
 '- Всего не более 200 полных вызовов Teplo, включая ошибки. Общие геометрии не пересчитываются. Отсутствие результата при лимите не доказывает невозможность.',
 '- Начальная фаза: 512 геометрических предложений, 48 изготовимых форм на N, 24 на число рядов, 32 Teplo на N, до трёх поверок длины на форму.',
 '- Доработка: не более 2400 предварительных форм, 48 дополнительных поверок в рамках общего бюджета; остановка после 20 отказов подряд при наличии допустимого результата.',
 '- Основное N по Re≈17500 и не более четырёх реально поверенных резервных N. Single-coil строго N=1 без ограничения трубного Re; исходные предупреждения применимости и raw valid сохраняются.',
 '- Равные коридорные ряды на полную высоту, общий шаг/целые витки/фаза/направление, 3<R/di<12, радиальные зазоры между рядами, до корпуса и до вытеснителя независимо целыми мм от ceil(0,1do) до floor(do) (для Ø14: 2…14 мм), целые вертикальные зазоры при межосевом 1,1do…2do.',
 '- Тестовые заготовки 0,5/1/1,5/2/3/6 м, основной набор 1/3/6 м. Полная трубка строго короче заготовки, остаток ≤20 %. При stock-lengths=false эти два ограничения отключены.',
 '- Тепловая площадь включает навивку; расход трубы дополнительно включает отводы и концы. Постоянные K и Δp не вводятся.', '',
 '## Повторная серия 150 заданий','',
 'Прежние 15 расходов × 10 температурных режимов; вода/вода, противоток, 14×2,5 мм, λw=16, давления 2/1,2 МПа абс., H≤10 м, D≤3 м, stock=true, single=false. Основной и тестовый наборы заготовок различаются. У v5/v6 заготовки и правило +20 % одинаковые; изменены зазоры и порядок поиска.', '',
 '| Показатель | Основной v12 | Прежний тестовый v5 | Зазоры v6 |','|---|---:|---:|---:|',
 `| Найдено | ${s.beforeFound} | ${previous.summary.afterFound} | ${s.afterFound} |`,
 `| Полных Teplo | ${s.beforeCalls} | ${previous.summary.afterCalls} | ${s.afterCalls} |`,
 `| Учтённых геометрических проверок | ${s.beforeGeometry} | ${previous.summary.afterGeometry} | ${s.afterGeometry} |`, '',
 `Общих с v5 успешных заданий ${pairs.length}. Расход трубы уменьшен в ${less.length}, рядов меньше в ${fewer.length}. Суммарная полная длина трубок для этих ${pairs.length} аппаратов: ${sum(pairs,c=>q.tubeMetres(old(c))).toFixed(3)} → ${sum(pairs,c=>q.tubeMetres(c.after.selected)).toFixed(3)} м. Это статистика данной серии, не гарантия для будущих режимов.`, '',
 `Относительно основного: общих успехов ${s.both}, новых ${s.gained.length}, потерянных ${s.lost.length}. Короче по H ${s.shorter}, длиннее ${s.longer}; сравнение только H уже не отражает новый критерий. Максимум Teplo в серии ${maxCalls}; полный успешный поиск за ≤20 — ${s.acceptedWithin20}.`, '',
 '## Где уменьшился расход трубы относительно v5','',
 '| Задание | Прежний H×D, мм | Прежние ряды / труба, м | Разумный H×D, мм | Новые ряды / труба, м |','|---|---|---|---|---|'
];
for(const c of less)lines.push(`| ${c.id} | ${g(old(c))} | ${old(c).rowCount} / ${metres(old(c))} | ${g(c.after.selected)} | ${c.after.selected.rowCount} / ${metres(c.after.selected)} |`);
lines.push('',`Относительно v5 новых успехов ${gained.length}: ${gained.map(c=>c.id).join(', ')||'нет'}. Потерянных ${lost.length}: ${lost.map(c=>c.id).join(', ')||'нет'}.`, '', '## Все изменённые геометрии относительно v5','', '| Задание | v5 H×D, мм | v6 H×D, мм | Зазоры v6: ряды / корпус / вытеснитель, мм |','|---|---|---|---|');
for(const c of changed)lines.push(`| ${c.id} | ${g(old(c))} | ${g(c.after.selected)} | ${gapText(c.after.selected)} |`);
lines.push('', '### Где корпус стал длиннее','');
for(const c of pairs.filter(c=>c.after.selected.geometry.height>old(c).geometry.height))lines.push(`${c.id}: ${g(old(c))}, ${old(c).rowCount} ряд(а), ${metres(old(c))} м трубы → ${g(c.after.selected)}, ${c.after.selected.rowCount} ряд(а), ${metres(c.after.selected)} м. Новый опорный предел трубы для дополнительных рядов ${c.after.selection.tubeLimitM.toFixed(3)} м; прежняя конструкция ${q.tubeMetres(old(c))>c.after.selection.tubeLimitM?'превышает':'не превышает'} этот предел. Сокращение высоты не является единственным условием разумного выбора.`);
lines.push('',`Фактические зазоры всех принятых альтернатив серии: ${Object.entries(used).map(([key,values])=>key+': '+[...values].sort((a,b)=>a-b).join(', ')+' мм').join('; ')}.`, '', '## Дополнительные 16 режимов','', '| Условия | Основной H×D / Teplo | Прежний v5 H×D / Teplo | Зазоры v6 H×D / Teplo | Зазоры v6, мм |','|---|---|---|---|---|');
for(const c of focused.cases)lines.push(`| ${c.id} | ${g(c.current.selected)} / ${c.current.stats.evaluations} | ${g(c.previous.selected)} / ${c.previous.stats.evaluations} | ${g(c.after.selected)} / ${c.after.stats.evaluations} | ${gapText(c.after.selected)} |`);
lines.push('', '## Изменения зазоров','',
 'Начальная фаза использует прежние 3 мм. До 1600 исходных форм дополнены максимум 800 предложениями зазоров: до 200 граничных форм с минимальными зазорами, затем независимые изменения одного параметра вокруг измеренных вариантов. Полного произведения сеток нет. Граничные формы позволяют искать компоновки, невозможные при прежних 3 мм. Резервные N дополнены геометрически возможными при минимальных зазорах, общий предел четырёх реально проверенных резервов сохранён.',
 'Зазоры меняют реальные проходные сечения, диаметры рядов, корпуса и вытеснителя. Для дробного do округление диаметра корпуса может немного увеличить фактический зазор относительно номинального, но верхний предел не превышается. Хордовый зазор по окружности остаётся 3 мм.', '',
 '## Проверки','',
 'Повторная исходная поверка выполнена для каждого принятого варианта, включая все альтернативы: геометрия приложения, Teplo/CoolProp, задание, Re/радиус, полная длина/заготовки. Поисковый бюджет проверен фактическим числом вызовов и отсутствием дублей. Контрольный повтор поверки в аудите не входит в бюджет поиска приложения. Нового независимого Python-прогона нет.',
 'Граничные тесты: ровно +20 % разрешено, превышение запрещено для дополнительных рядов, число трубок учитывается в полном расходе, результат не зависит от порядка поступления одних и тех же конструкций, single-coil сохраняет N=1, ошибка улучшения не уничтожает первый успех.', '',
 '- [Полная серия 150](audits/coil-sequential-150.json)',
 '- [Снимок v5](audits/coil-sequential-v5-snapshot.json)',
 '- [Дополнительные 16](audits/coil-sequential-focused-v6.json)',
 '- [Интерактивный пример](http://127.0.0.1:4174/assets/coil-sequential-lab.html#normal-free-0.5)', '',
 '```powershell','node tests/test-coil-sequential.cjs','node tests/audit-coil-sequential.cjs','node tests/audit-coil-sequential-focused.cjs','node tests/report-coil-sequential.cjs','node tests/test-coil-sequential-lab.cjs','```'
);
fs.writeFileSync(path.join(root,'docs/coil-sequential-experiment.md'),lines.join('\n')+'\n');console.log(JSON.stringify({summary:s,lessTube:less.length,fewerRows:fewer.length,maxCalls,focused:focused.cases.length}));
