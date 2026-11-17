// Reusable UI pieces.

import { h, replace } from './dom';
import { beanIcon, icon, mugIcon, ROAST_COLORS } from './icons';
import { EXTRACTION_LABELS, extractionColor, formatTime, matchSuggestions, type Phase } from './model';

let uid = 0;
const nextId = () => `c${++uid}`;

// ---- Text field with remembered suggestions ----

export function autocomplete(opts: {
  label: string;
  value: string;
  placeholder?: string;
  optional?: boolean;
  suggestions: () => Promise<string[]>;
  onInput: (v: string) => void;
  onCommit?: (v: string) => void;
}): HTMLElement {
  const id = nextId();
  const list = h('ul', { class: 'ac-list hidden', role: 'listbox', id: `${id}-list` });
  let all: string[] = [];
  let loaded = false;
  const input = h('input', {
    id,
    type: 'text',
    value: opts.value,
    placeholder: opts.placeholder ?? '',
    autocomplete: 'off',
    autocapitalize: 'words',
    spellcheck: false,
    'aria-autocomplete': 'list',
    'aria-controls': `${id}-list`,
  });

  function highlight(v: string, q: string): (Node | string)[] {
    const i = v.toLowerCase().indexOf(q.toLowerCase());
    if (!q || i < 0) return [v];
    return [v.slice(0, i), h('mark', null, v.slice(i, i + q.length)), v.slice(i + q.length)];
  }

  function show() {
    const q = input.value;
    const matches = matchSuggestions(all, q);
    if (!matches.length || document.activeElement !== input) {
      list.classList.add('hidden');
      return;
    }
    replace(
      list,
      matches.map((m) =>
        h(
          'li',
          { role: 'option' },
          h('button', {
            type: 'button',
            // pointerdown fires before the input blurs
            onpointerdown: (e: Event) => {
              e.preventDefault();
              input.value = m;
              opts.onInput(m);
              list.classList.add('hidden');
              opts.onCommit?.(m);
            },
          }, highlight(m, q.trim())),
        ),
      ),
    );
    list.classList.remove('hidden');
  }

  input.addEventListener('focus', async () => {
    if (!loaded) {
      all = await opts.suggestions();
      loaded = true;
    }
    show();
  });
  input.addEventListener('input', () => {
    opts.onInput(input.value);
    show();
  });
  input.addEventListener('blur', () => {
    list.classList.add('hidden');
    opts.onCommit?.(input.value.trim());
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });

  return h(
    'div',
    { class: 'field' },
    h('label', { for: id }, opts.label, opts.optional ? h('span', { class: 'optional' }, ' (optional)') : null),
    h('div', { class: 'ac' }, input, list),
  );
}

// ---- Number field ----

export function numberField(opts: {
  label: string;
  value: number | null;
  suffix: string;
  decimal?: boolean;
  optional?: boolean;
  placeholder?: string;
  onChange: (v: number | null) => void;
}): HTMLElement {
  const id = nextId();
  const input = h('input', {
    id,
    type: 'text',
    inputmode: opts.decimal ? 'decimal' : 'numeric',
    pattern: opts.decimal ? undefined : '[0-9]*',
    value: opts.value === null ? '' : String(opts.value),
    placeholder: opts.placeholder ?? '',
    autocomplete: 'off',
  });
  input.addEventListener('input', () => {
    const raw = input.value.replace(',', '.').replace(opts.decimal ? /[^0-9.]/g : /[^0-9]/g, '');
    if (raw !== input.value) input.value = raw;
    const n = parseFloat(raw);
    opts.onChange(raw === '' || Number.isNaN(n) ? null : n);
  });
  return h(
    'div',
    { class: 'field' },
    h('label', { for: id }, opts.label, opts.optional ? h('span', { class: 'optional' }, ' (optional)') : null),
    h('div', { class: 'input-suffix' }, input, h('span', null, opts.suffix)),
  );
}

// ---- Roast level: five beans, half steps ----

export function roastSelector(value: number | null, onChange: (v: number | null) => void): HTMLElement {
  const wrap = h('div', { class: 'icon-scale', role: 'group', 'aria-label': 'Roast level' });
  const label = h('span', { class: 'muted small' });
  let current = value;
  const names = ['Light', 'Light-medium', 'Medium', 'Medium-dark', 'Dark'];

  function render() {
    replace(
      wrap,
      [0, 1, 2, 3, 4].map((i) => {
        const fill = current === null ? 0 : Math.max(0, Math.min(1, current - i));
        const pick = (v: number) => () => {
          current = current === v ? null : v;
          onChange(current);
          render();
        };
        return h(
          'div',
          { class: 'roast-bean' },
          beanIcon(fill, ROAST_COLORS[i], `${i}-${uid}`),
          h('button', { type: 'button', 'aria-label': `Roast ${i + 0.5}`, onclick: pick(i + 0.5) }),
          h('button', { type: 'button', 'aria-label': `Roast ${i + 1}`, onclick: pick(i + 1) }),
        );
      }),
    );
    label.textContent = current === null ? 'Not set' : `${current} – ${names[Math.min(4, Math.ceil(current) - 1)]}`;
  }
  render();
  return h('div', { class: 'stack', style: { gap: '6px' } }, wrap, label);
}

// ---- Overall rating: five whole mugs ----

export function mugRating(value: number | null, onChange: (v: number | null) => void): HTMLElement {
  const wrap = h('div', { class: 'icon-scale', role: 'group', 'aria-label': 'Overall rating' });
  let current = value;
  function render() {
    replace(
      wrap,
      [1, 2, 3, 4, 5].map((n) =>
        h(
          'button',
          {
            type: 'button',
            class: 'mug-btn',
            'aria-label': `${n} mug${n > 1 ? 's' : ''}`,
            'aria-pressed': String(current === n),
            onclick: () => {
              current = current === n ? null : n;
              onChange(current);
              render();
            },
          },
          mugIcon(current !== null && n <= current),
        ),
      ),
    );
  }
  render();
  return wrap;
}

export function mugsStatic(rating: number): HTMLElement {
  return h('span', { class: 'mug-static', 'aria-label': `${rating} of 5 mugs` }, [1, 2, 3, 4, 5].map((n) => mugIcon(n <= rating)));
}

// ---- Extraction scale ----

export function extractionScale(value: number | null, onChange: (v: number | null) => void): HTMLElement {
  const wrap = h('div', { class: 'xscale', role: 'group', 'aria-label': 'Extraction' });
  let current = value;
  function render() {
    replace(
      wrap,
      [-2, -1, 0, 1, 2].map((x) =>
        h(
          'button',
          {
            type: 'button',
            class: x === 2 ? 'dark' : '',
            style: { '--c': extractionColor(x) },
            'aria-pressed': String(current === x),
            onclick: () => {
              current = current === x ? null : x;
              onChange(current);
              render();
            },
          },
          EXTRACTION_LABELS[x],
        ),
      ),
    );
  }
  render();
  return wrap;
}

export function extractionDot(x: number | null | undefined): HTMLElement | null {
  const c = extractionColor(x);
  if (!c) return null;
  const el = h('span', { class: 'xdot', title: EXTRACTION_LABELS[x as number], 'aria-label': EXTRACTION_LABELS[x as number] });
  el.style.setProperty('--c', c);
  return el;
}

// ---- Segmented control ----

export function segmented<T extends string>(options: { value: T; label: string }[], value: T, onChange: (v: T) => void): HTMLElement {
  const wrap = h('div', { class: 'segmented', role: 'group' });
  function render(v: T) {
    replace(
      wrap,
      options.map((o) =>
        h('button', {
          type: 'button',
          'aria-pressed': String(o.value === v),
          onclick: () => {
            render(o.value);
            onChange(o.value);
          },
        }, o.label),
      ),
    );
  }
  render(value);
  return wrap;
}

// ---- Timeline bar & phase table ----

export function timelineBar(phases: Phase[]): HTMLElement {
  let pours = 0;
  return h(
    'div',
    { class: 'timeline', role: 'img', 'aria-label': phases.map((p) => `${p.name} ${formatTime(p.duration_s)}`).join(', ') },
    phases.map((p) => {
      const kind = p.name === 'Bloom' ? 'bloom' : p.name === 'Drawdown' ? 'drawdown' : 'pour';
      const alt = kind === 'pour' && pours++ % 2 === 1;
      const short = kind === 'bloom' ? 'B' : kind === 'drawdown' ? 'D' : `P${p.name.split(' ')[1]}`;
      return h('div', { class: `tl-${kind}${alt ? ' alt' : ''}`, style: { flex: `${Math.max(p.duration_s, 1)} 1 0` } }, short);
    }),
  );
}

export function phaseTable(phases: Phase[], total_s: number): HTMLElement {
  return h(
    'table',
    { class: 'phase-table' },
    h(
      'tbody',
      null,
      phases.map((p) => h('tr', null, h('td', null, p.name), h('td', null, formatTime(p.duration_s)))),
      h('tr', null, h('td', null, 'Total'), h('td', null, formatTime(total_s))),
    ),
  );
}

// ---- Slide to save ----

export function slideToSave(label: string, onDone: () => void): HTMLElement {
  const knob = h('div', { class: 'slider-knob' }, icon.arrow());
  const fill = h('div', { class: 'slider-fill' });
  const text = h('span', { class: 'slider-label' }, label);
  const el = h('div', { class: 'slider', role: 'button', tabindex: 0, 'aria-label': label }, fill, text, knob);
  let startX = 0;
  let x = 0;
  let dragging = false;
  let done = false;
  const max = () => el.clientWidth - knob.offsetWidth - 12;

  function set(px: number, animate = false) {
    x = Math.max(0, Math.min(max(), px));
    knob.style.transition = fill.style.transition = animate ? 'transform 0.2s ease, width 0.2s ease' : 'none';
    knob.style.transform = `translateX(${x}px)`;
    fill.style.width = `${x + knob.offsetWidth / 2 + 6}px`;
    text.style.opacity = String(1 - x / max());
  }
  function finish() {
    done = true;
    el.classList.add('done');
    set(max(), true);
    knob.replaceChildren(icon.check());
    onDone();
  }
  knob.addEventListener('pointerdown', (e) => {
    if (done) return;
    dragging = true;
    startX = e.clientX - x;
    knob.setPointerCapture(e.pointerId);
  });
  knob.addEventListener('pointermove', (e) => {
    if (dragging) set(e.clientX - startX);
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    if (x >= max() * 0.9) finish();
    else set(0, true);
  };
  knob.addEventListener('pointerup', end);
  knob.addEventListener('pointercancel', end);
  // Keyboard / assistive tech: Enter or Space saves.
  el.addEventListener('keydown', (e) => {
    if (!done && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      finish();
    }
  });
  return el;
}

// ---- Small helpers ----

export function field(label: string, control: HTMLElement, optional = false): HTMLElement {
  return h('div', { class: 'field' }, h('span', { class: 'label' }, label, optional ? h('span', { class: 'optional' }, ' (optional)') : null), control);
}

export function kv(rows: [string, Node | string | null][]): HTMLElement {
  return h('dl', { class: 'kv' }, rows.filter(([, v]) => v !== null).map(([k, v]) => [h('dt', null, k), h('dd', null, v)]));
}
