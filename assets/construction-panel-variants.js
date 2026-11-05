'use strict';

const twoBlockComparison = document.querySelector('[data-two-block-comparison]') !== null;
const originalVariants = [
  ['Единая форма', 'Одинаковые подписи, высота и рамки всех полей.', 'plain', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes']],
  ['Четыре раздела', 'Границы и заголовки разделяют разные задачи.', 'sections', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes']],
  ['Две колонки', 'Тип и схема в одной строке, ниже параметры с общей шириной.', 'paired', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes'], 'select'],
  ['Компактная форма', 'Короткие отступы и переключатели внутри строк.', 'compact', ['type flow', 'size reserve single', 'material conductivity refine tubes']],
  ['Вложенные карточки', 'Четыре отдельные карточки для быстрого чтения.', 'cards', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes']],
  ['Акцент на габаритах', 'Длина и диаметр выделены в самостоятельный блок.', 'dimensions', ['type flow', 'size', 'reserve single', 'material conductivity refine tubes']],
  ['Аппарат и трубы', 'Два крупных блока, каждый со своими параметрами.', 'two-blocks', ['type flow size reserve single', 'material conductivity refine tubes']],
  ['Разделы с направляющей', 'Тонкая линия слева объединяет поля одного раздела.', 'rail', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes']],
  ['Таблица параметров', 'Подписи слева, значения справа на одной линии.', 'table', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes'], 'select'],
  ['Сетка размеров', 'Габариты, запас и теплопроводность в числовой сетке.', 'tiles', ['type flow', 'size reserve conductivity', 'material', 'single refine tubes']],
  ['Ровные строки', 'Значения в конце строки, единицы измерения рядом.', 'rows', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes'], 'select'],
  ['Габариты сверху', 'Длина и диаметр видны сразу при открытии панели.', 'size-first', ['size', 'type flow', 'material conductivity', 'reserve single refine tubes'], 'select'],
  ['Вертикальный выбор', 'Две строки со схемами движения и радиокнопками.', 'radio-list', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes'], 'radios'],
  ['Одинаковые тумблеры', 'Обе настройки выглядят как равноправные переключатели.', 'switches', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes']],
  ['Опции с пояснениями', 'Под каждой галочкой коротко описано её действие.', 'option-cards', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes']],
  ['Лёгкие поля', 'Тонкая нижняя линия и общий список параметров.', 'minimal', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes'], 'select'],
  ['Сворачиваемые группы', 'Каждый раздел можно свернуть отдельно.', 'accordion', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes']],
  ['Порядок заполнения', 'Нумерация подсказывает последовательность действий.', 'steps', ['type flow', 'size reserve', 'material conductivity', 'single refine tubes']],
  ['Две зоны внимания', 'Схема движения и габариты выделены, настройки вынесены вниз.', 'bands', ['type flow size', 'material conductivity', 'reserve single refine tubes']],
  ['Две вкладки', 'Параметры аппарата и настройки подбора открываются отдельно.', 'tabs', ['type flow size', 'material conductivity reserve single refine tubes'], 'select'],
];

const twoBlockGroups = ['type flow dimensionsOption size reserve', 'material pipeOptions'];
const twoBlockVariants = [
  ['Две карточки', 'Ближе всего к варианту №7. В каждом блоке своя рамка.', 'cards'],
  ['Чистые разделы', 'Заголовки и линии разделяют поля на общей поверхности.', 'dividers'],
  ['Строки параметров', 'Подписи слева, значения справа. Длина и диаметр стоят друг под другом.', 'rows'],
  ['Вложенные размеры', 'Раскрытые поля габаритов и типоразмера выделены отступом и линией.', 'inset'],
  ['Компактная сетка', 'Тип и схема стоят рядом. Галочки выровнены по правому краю.', 'grid'],
  ['Трубы с пояснениями', 'Под каждой настройкой труб есть краткая подсказка.', 'notes'],
  ['Выделенные настройки', 'Материал расположен в основной части, обе галочки собраны в нижней плашке.', 'footer'],
].map(([name, note, style]) => [name, note, 'two-blocks', twoBlockGroups, ['rows','grid'].includes(style) ? 'select' : '', `two-block-${style}`]);
const variants = twoBlockComparison ? twoBlockVariants : originalVariants;
const categories = ['Единая форма', 'Разделы и карточки', 'Числа и таблицы', 'Управление и плотность', 'Навигация внутри панели'];
const defaults = {type:'coil', flow:'counter', length:'1800', diameter:'600', reserve:'0', dimensions:false, single:true, material:'steel', conductivity:'16', refine:false, tube:'14', wall:'2.5'};
const warning = 'Один змеевик не подходит по числу Рейнольдса для заданного расхода. Выключите настройку «Только один змеевик».';
const groupTitles = ['Схема аппарата', 'Габариты', 'Материал и стенка', 'Настройки подбора'];
const icon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 6h14v8H3zM6 3v14m8-14v14"/></svg>';

function numberField(key, title, unit, readOnly = false) {
  return `<label class="demo-field"><span>${title}</span><span class="demo-control"><input type="number" data-field="${key}" step="any" min="0" ${readOnly ? 'readonly' : ''}><small>${unit}</small></span></label>`;
}

function selectField(key, title, options, animated = false) {
  if (animated) {
    const id = `rows-${key}`;
    const chevron = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 7 6 6 6-6"/></svg>';
    const tick = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5.25 12.7 4.15 4.15L18.75 6.87"/></svg>';
    return `<div class="demo-field"><span id="${id}-title">${title}</span><div class="demo-dropdown">
      <input type="hidden" data-field="${key}">
      <button class="demo-dd-trigger" type="button" aria-haspopup="listbox" aria-expanded="false" aria-controls="${id}-menu" aria-labelledby="${id}-title ${id}-value"><span id="${id}-value" class="demo-dd-value"></span>${chevron}</button>
      <div class="demo-dd-menu" id="${id}-menu" role="listbox" aria-labelledby="${id}-title" hidden inert>${options.map(([value,label]) => `<button class="demo-dd-item" type="button" role="option" data-value="${value}" aria-selected="false" tabindex="-1"><span>${label}</span>${tick}</button>`).join('')}</div>
    </div></div>`;
  }
  return `<label class="demo-field"><span>${title}</span><select data-field="${key}">${options.map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}</select></label>`;
}

function optionField(key, title, note) {
  return `<label class="demo-option"><input type="checkbox" data-field="${key}"><span>${title}<small>${note}</small></span></label>`;
}

function flowField(id, kind, animated) {
  const options = [['counter','Противоток'], ['parallel','Прямоток']];
  if (kind === 'select') return selectField('flow', 'Схема движения', options, animated);
  return `<div class="demo-field"><span id="flow-${id}">Схема движения</span><div class="demo-flow ${kind === 'radios' ? 'flow-radios' : ''}" role="group" aria-labelledby="flow-${id}">${options.map(([value, label]) => `<label><input type="radio" name="flow-${id}" data-field="flow" value="${value}"><span>${label}</span></label>`).join('')}</div></div>`;
}

function renderCard(variant, index) {
  const [name, note, kind, groups, flowKind, extraClass = ''] = variant;
  const id = index + 1;
  const animated = extraClass === 'two-block-rows';
  const refineControls = 'rows-tube-fields';
  const fields = {
    type: selectField('type', 'Тип теплообменника', [['coil','Змеевиковый'],['shell','Кожухотрубный'],['double','Труба в трубе']], animated),
    flow: flowField(id, flowKind, animated),
    dimensionsOption: optionField('dimensions', 'Уточнить габариты', 'Указать предельную длину и диаметр'),
    size: `<div class="demo-size" ${twoBlockComparison ? 'data-optional-size hidden' : ''}>${numberField('length', 'Длина L', 'мм')}${numberField('diameter', 'Внешний диаметр', 'мм')}</div>`,
    reserve: numberField('reserve', 'Запас по UA', '%', true),
    single: optionField('single', 'Только один змеевик', 'Без ограничения по длине заготовки'),
    material: selectField('material', 'Материал труб', [['steel','Нерж. сталь 12Х18Н10Т'],['aisi','Нерж. сталь AISI 316L'],['copper','Медь М1']], animated),
    conductivity: numberField('conductivity', 'Теплопроводность стенки λw', 'Вт/(м·К)'),
    refine: optionField('refine', 'Уточнить типоразмер труб', 'Ввести диаметр и толщину стенки'),
    tubes: `<div class="demo-tubes" hidden>${numberField('tube', 'Диаметр dₙ', 'мм')}${numberField('wall', 'Стенка δ', 'мм')}</div>`,
  };
  if (animated) {
    fields.refine = `<label class="demo-option demo-refine"><input type="checkbox" data-field="refine" aria-controls="${refineControls}"><span class="demo-refine-box" aria-hidden="true"><svg viewBox="0 0 10.1668 10.1668"><path pathLength="1" d="M1 5.52L3.92 9.17L9.17 1"/></svg></span><span>Уточнить типоразмер труб</span></label>`;
    fields.tubes = `<div class="demo-tube-reveal" id="${refineControls}" inert><div>${fields.tubes.replace(' hidden', '')}</div></div>`;
  }
  fields.pipeOptions = `<div class="demo-pipe-options">${fields.refine}${fields.tubes}${fields.single}</div>`;
  const sections = groups.map((group, part) => {
    const content = group.split(' ').map(field => fields[field]).join('');
    const title = kind === 'tabs' ? ['Аппарат', 'Трубы и подбор'][part]
      : kind === 'two-blocks' ? ['Аппарат', 'Трубы'][part]
      : kind === 'size-first' ? ['Габариты', 'Схема аппарата', 'Материал и стенка', 'Настройки подбора'][part]
      : kind === 'bands' ? ['Аппарат', 'Трубы', 'Настройки подбора'][part] : groupTitles[part];
    if (kind === 'accordion') return `<details class="demo-group" open><summary>${title}</summary><div class="demo-fields">${content}</div></details>`;
    return `<section class="demo-group" data-part="${part}" ${kind === 'tabs' && part > 0 ? 'hidden' : ''}><h4><span class="group-step">${part + 1}</span>${title}</h4><div class="demo-fields">${content}</div></section>`;
  }).join('');
  const tabs = kind === 'tabs' ? '<div class="demo-tabs" aria-label="Разделы конструкции"><button type="button" data-demo-tab="0" aria-pressed="true">Аппарат</button><button type="button" data-demo-tab="1" aria-pressed="false">Трубы и подбор</button></div>' : '';
  return `<article class="panel-variant ${kind} ${extraClass}" id="variant-${id}" aria-labelledby="variant-title-${id}">
    <header class="variant-caption"><span class="number">${String(id).padStart(2, '0')}</span><div><h3 id="variant-title-${id}">${name}</h3><p>${note}</p></div></header>
    <div class="demo-panel"><header class="demo-heading"><span>01</span><strong>Конструкция</strong>${icon}</header>
      ${tabs}<div class="demo-body">${sections}</div>
      <p class="demo-warning"><span aria-hidden="true">△</span><span>${warning}</span></p>
    </div>
  </article>`;
}

const gallery = document.getElementById('panel-gallery');
gallery.innerHTML = twoBlockComparison
  ? `<div class="panel-grid">${variants.map(renderCard).join('')}</div>`
  : categories.map((title, index) => `<section class="panel-family" aria-labelledby="family-${index}"><h2 id="family-${index}">${title}</h2><div class="panel-grid">${variants.slice(index * 4, index * 4 + 4).map((variant, i) => renderCard(variant, index * 4 + i)).join('')}</div></section>`).join('');
document.getElementById('panel-index').innerHTML = variants.map(([name], i) => `<a href="#variant-${i + 1}" title="${name}">${String(i + 1).padStart(2, '0')}</a>`).join('');

const warningControl = document.getElementById('show-warning');
const fields = [...document.querySelectorAll('[data-field]')];
const tubeGroups = gallery.querySelectorAll('.demo-tubes:not(.demo-tube-reveal .demo-tubes)');
const tubeReveal = gallery.querySelector('.demo-tube-reveal');
const dimensionGroups = gallery.querySelectorAll('[data-optional-size]');
const warnings = gallery.querySelectorAll('.demo-warning');
let state = {...defaults};

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const dropdowns = Array.from(gallery.querySelectorAll('.demo-dropdown'), root => {
  const trigger = root.querySelector('.demo-dd-trigger');
  const menu = root.querySelector('.demo-dd-menu');
  const label = root.querySelector('.demo-dd-value');
  const field = root.querySelector('[data-field]');
  const items = Array.from(menu.querySelectorAll('[role="option"]'));
  let closeTimer, labelTimer, selected;

  function sync() {
    const next = items.find(item => item.dataset.value === field.value);
    if (!next || next === selected) return;
    for (const item of items) item.setAttribute('aria-selected', String(item === next));
    clearTimeout(labelTimer);
    const title = next.textContent.trim();
    if (!selected || reducedMotion.matches) {
      label.classList.remove('is-exit');
      label.textContent = title;
    } else {
      label.classList.add('is-exit');
      labelTimer = setTimeout(() => {
        label.textContent = title;
        label.classList.replace('is-exit', 'is-enter-start');
        void label.offsetHeight;
        label.classList.remove('is-enter-start');
      }, 150);
    }
    selected = next;
  }

  function close(returnFocus = false) {
    if (trigger.getAttribute('aria-expanded') !== 'true') return;
    trigger.setAttribute('aria-expanded', 'false');
    menu.classList.remove('is-open');
    menu.classList.add('is-closing');
    if (returnFocus) trigger.focus();
    menu.inert = true;
    items.forEach(item => { item.tabIndex = -1; });
    closeTimer = setTimeout(() => {
      menu.hidden = true;
      root.classList.remove('is-active');
      menu.classList.remove('is-closing');
    }, reducedMotion.matches ? 0 : 150);
  }

  function focusItem(item) {
    items.forEach(option => { option.tabIndex = option === item ? 0 : -1; });
    item.focus();
  }

  function open(focus) {
    dropdowns.forEach(other => { if (other.root !== root) other.close(); });
    clearTimeout(closeTimer);
    menu.hidden = false;
    menu.inert = false;
    menu.classList.remove('is-closing');
    const anchor = root.getBoundingClientRect();
    const below = innerHeight - anchor.bottom;
    menu.classList.toggle('opens-up', menu.offsetHeight + 8 > below && anchor.top > below);
    void menu.offsetWidth;
    menu.classList.add('is-open');
    root.classList.add('is-active');
    trigger.setAttribute('aria-expanded', 'true');
    if (focus) focusItem(focus);
    else if (selected) selected.tabIndex = 0;
  }

  trigger.addEventListener('click', event => {
    if (trigger.getAttribute('aria-expanded') === 'true') close();
    else open(event.detail === 0 ? selected : null);
  });
  root.addEventListener('keydown', event => {
    const {key} = event;
    if (key === 'Escape' && trigger.getAttribute('aria-expanded') === 'true') {
      event.preventDefault();
      close(true);
    } else if (['ArrowDown','ArrowUp','Home','End'].includes(key)) {
      event.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next = key === 'Home' ? items[0] : key === 'End' ? items.at(-1)
        : index === -1 ? selected : items[(index + (key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
      if (trigger.getAttribute('aria-expanded') === 'true') focusItem(next);
      else open(next);
    }
  });
  menu.addEventListener('click', event => {
    const item = event.target.closest('[role="option"]');
    if (!item) return;
    field.value = item.dataset.value;
    field.dispatchEvent(new Event('input', {bubbles:true}));
    close(true);
  });
  root.addEventListener('pointerdown', event => {
    const button = event.target.closest('button');
    if (event.pointerType === 'mouse' || reducedMotion.matches || !button) return;
    const start = performance.now();
    button.classList.add('is-pressed');
    const release = end => {
      if (end.pointerId !== event.pointerId) return;
      document.removeEventListener('pointerup', release, true);
      document.removeEventListener('pointercancel', release, true);
      setTimeout(() => button.classList.remove('is-pressed'), Math.max(0, 150 - (performance.now() - start)));
    };
    document.addEventListener('pointerup', release, true);
    document.addEventListener('pointercancel', release, true);
  }, {passive:true});
  document.addEventListener('pointerdown', event => { if (!root.contains(event.target)) close(); });
  root.addEventListener('focusout', event => { if (!root.contains(event.relatedTarget)) close(); });
  return {root, sync, close};
});

function updatePreviews() {
  for (const input of fields) {
    const value = state[input.dataset.field];
    if (input.type === 'checkbox') input.checked = value;
    else if (input.type === 'radio') input.checked = input.value === value;
    else if (input.value !== value) input.value = value;
  }
  for (const group of tubeGroups) group.hidden = !state.refine;
  if (tubeReveal) {
    tubeReveal.classList.toggle('is-open', state.refine);
    tubeReveal.inert = !state.refine;
  }
  dropdowns.forEach(dropdown => dropdown.sync());
  for (const group of dimensionGroups) group.hidden = !state.dimensions;
  for (const message of warnings) message.hidden = !warningControl.checked || !state.single;
}

document.addEventListener('input', event => {
  const field = event.target;
  if (field === warningControl) updatePreviews();
  else if (field.matches('[data-field]')) {
    state[field.dataset.field] = field.type === 'checkbox' ? field.checked : field.value;
    updatePreviews();
  }
});
document.getElementById('reset-previews').addEventListener('click', () => {
  state = {...defaults};
  warningControl.checked = true;
  updatePreviews();
});
gallery.addEventListener('click', event => {
  const tab = event.target.closest('[data-demo-tab]');
  if (!tab) return;
  const card = tab.closest('.panel-variant');
  for (const button of card.querySelectorAll('[data-demo-tab]')) button.setAttribute('aria-pressed', String(button === tab));
  for (const part of card.querySelectorAll('[data-part]')) part.hidden = part.dataset.part !== tab.dataset.demoTab;
});
updatePreviews();
