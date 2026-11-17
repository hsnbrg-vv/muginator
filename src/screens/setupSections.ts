// Form sections for a brew setup. Used by the brew flow and by "Correct setup" on a saved brew.

import { autocomplete, field, numberField, roastSelector } from '../components';
import { getGrinder, getSuggestions, saveGrinder } from '../db';
import { h, replace, todayISO } from '../dom';
import { grindWheel } from '../grindWheel';
import { DEFAULT_RANGE, daysOffRoast, formatRatio, waterFor, type BrewSetup } from '../model';

type OnChange = () => void;

function waterLine(setup: BrewSetup): HTMLElement {
  const el = h('div', { class: 'card tight spread' });
  const update = () => {
    setup.water_g = waterFor(setup.dose_g, setup.ratio);
    replace(
      el,
      h('span', { class: 'muted' }, 'Water'),
      h('strong', { style: { fontFamily: 'var(--font-display)', fontSize: '22px' } }, setup.water_g ? `${setup.water_g} g` : '–', setup.ratio ? h('span', { class: 'muted small' }, `  ${formatRatio(setup.ratio)}`) : null),
    );
  };
  update();
  (el as HTMLElement & { update?: () => void }).update = update;
  return el;
}

export function beansSection(setup: BrewSetup, onChange: OnChange): HTMLElement {
  const b = setup.bean;
  const water = waterLine(setup);
  const refreshWater = () => (water as HTMLElement & { update: () => void }).update();

  const roastInfo = h('span', { class: 'muted small' });
  const showDays = () => {
    const d = daysOffRoast(b.roastDate, new Date());
    roastInfo.textContent = d === null ? '' : d === 1 ? '1 day off roast' : `${d} days off roast`;
  };
  const dateInput = h('input', { type: 'date', value: b.roastDate ?? '', max: todayISO(), 'aria-label': 'Roast date' });
  dateInput.addEventListener('change', () => {
    b.roastDate = dateInput.value || null;
    showDays();
    onChange();
  });
  showDays();

  return h(
    'div',
    { class: 'stack' },
    autocomplete({ label: 'Bean variety', value: b.variety, placeholder: 'e.g. Gesha', suggestions: () => getSuggestions('variety'), onInput: (v) => { b.variety = v; onChange(); } }),
    autocomplete({ label: 'Roaster', value: b.roaster, suggestions: () => getSuggestions('roaster'), onInput: (v) => { b.roaster = v; onChange(); } }),
    h(
      'div',
      { class: 'grid-2' },
      autocomplete({ label: 'Origin', optional: true, value: b.origin, placeholder: 'e.g. Ethiopia', suggestions: () => getSuggestions('origin'), onInput: (v) => { b.origin = v; onChange(); } }),
      autocomplete({ label: 'Process', optional: true, value: b.process, suggestions: () => getSuggestions('process'), onInput: (v) => { b.process = v; onChange(); } }),
    ),
    field('Roast level', roastSelector(b.roastLevel, (v) => { b.roastLevel = v; onChange(); })),
    field('Roast date', h('div', { class: 'stack', style: { gap: '6px' } }, dateInput, roastInfo), true),
    h(
      'div',
      { class: 'grid-2' },
      numberField({ label: 'Beans', value: setup.dose_g || null, suffix: 'g', onChange: (v) => { setup.dose_g = v ?? 0; refreshWater(); onChange(); } }),
      numberField({ label: 'Ratio 1 :', value: setup.ratio || null, suffix: '', decimal: true, placeholder: '16', onChange: (v) => { setup.ratio = v ?? 0; refreshWater(); onChange(); } }),
    ),
    water,
  );
}

export function grinderSection(setup: BrewSetup, onChange: OnChange): HTMLElement {
  const wheel = grindWheel({
    range: DEFAULT_RANGE,
    value: setup.grinder.setting,
    onChange: (v) => {
      setup.grinder.setting = v;
      onChange();
    },
  });
  const rangeBox = h('div');
  let checkedFor = '';

  async function applyModel(name: string) {
    if (name === checkedFor) return;
    checkedFor = name;
    replace(rangeBox);
    if (!name) {
      wheel.setRange(DEFAULT_RANGE, setup.grinder.setting);
      return;
    }
    const g = await getGrinder(name);
    if (g) {
      wheel.setRange(g, setup.grinder.setting);
      setup.grinder.setting = wheel.value();
      onChange();
      return;
    }
    // New grinder: ask for its range once.
    const r = { ...DEFAULT_RANGE };
    replace(
      rangeBox,
      h(
        'div',
        { class: 'card stack' },
        h('div', null, h('h3', null, `New grinder: ${name}`), h('p', { class: 'muted small' }, 'Set its adjustment range. You can change it later in Settings.')),
        h(
          'div',
          { class: 'grid-2', style: { gridTemplateColumns: '1fr 1fr 1fr' } },
          numberField({ label: 'Min', value: r.min, suffix: '', decimal: true, onChange: (v) => (r.min = v ?? 0) }),
          numberField({ label: 'Max', value: r.max, suffix: '', decimal: true, onChange: (v) => (r.max = v ?? 0) }),
          numberField({ label: 'Step', value: r.step, suffix: '', decimal: true, onChange: (v) => (r.step = v ?? 0) }),
        ),
        h('button', {
          type: 'button',
          class: 'btn btn-secondary',
          onclick: async () => {
            if (!(r.step > 0) || !(r.max > r.min)) {
              alert('Max must be greater than min, and step greater than 0.');
              return;
            }
            await saveGrinder({ name, ...r });
            wheel.setRange(r, setup.grinder.setting);
            setup.grinder.setting = wheel.value();
            onChange();
            replace(rangeBox);
          },
        }, 'Save range'),
      ),
    );
    wheel.setRange(DEFAULT_RANGE, setup.grinder.setting);
  }

  const model = autocomplete({
    label: 'Grinder',
    value: setup.grinder.model,
    placeholder: 'e.g. 1Zpresso K-Ultra',
    suggestions: () => getSuggestions('grinder'),
    onInput: (v) => {
      setup.grinder.model = v;
      onChange();
    },
    onCommit: (v) => void applyModel(v),
  });
  void applyModel(setup.grinder.model.trim());

  return h('div', { class: 'stack' }, model, rangeBox, field('Grind setting', wheel.el));
}

export function brewerSection(setup: BrewSetup, onChange: OnChange): HTMLElement {
  return h(
    'div',
    { class: 'stack' },
    autocomplete({ label: 'Brewer', value: setup.brewer, placeholder: 'e.g. Hario V60 02', suggestions: () => getSuggestions('brewer'), onInput: (v) => { setup.brewer = v; onChange(); } }),
    autocomplete({ label: 'Filter paper', value: setup.paper, placeholder: 'e.g. Cafec Abaca', suggestions: () => getSuggestions('paper'), onInput: (v) => { setup.paper = v; onChange(); } }),
  );
}

export function waterSection(setup: BrewSetup, onChange: OnChange): HTMLElement {
  return h(
    'div',
    { class: 'stack' },
    numberField({ label: 'Water temperature', optional: true, value: setup.waterTemp_c, suffix: '°C', placeholder: '–', onChange: (v) => { setup.waterTemp_c = v === null ? null : Math.round(v); onChange(); } }),
    waterLine(setup),
    h('p', { class: 'muted small' }, `${setup.dose_g || '–'} g beans at ${setup.ratio ? formatRatio(setup.ratio) : '–'}`),
  );
}
