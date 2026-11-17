// History tab: Brews list (search, filter, sort) and Beans list.

import { extractionDot, mugsStatic, segmented } from '../components';
import { listBrews } from '../db';
import { fmtDate, fmtDateTime, fmtMonth, go, h, replace } from '../dom';
import { icon } from '../icons';
import { beanKey, beanTitle, formatRatio, formatSetting, formatTime, type Brew } from '../model';

type Sort = 'newest' | 'oldest' | 'rating' | 'time';

interface Filters {
  query: string;
  roaster: string[];
  bean: string[];
  grinder: string[];
  brewer: string[];
  minRating: number;
  from: string;
  to: string;
  sort: Sort;
}

const filters: Filters = { query: '', roaster: [], bean: [], grinder: [], brewer: [], minRating: 0, from: '', to: '', sort: 'newest' };

const SORT_LABELS: Record<Sort, string> = { newest: 'Newest', oldest: 'Oldest', rating: 'Rating', time: 'Total time' };

function localDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function applyFilters(brews: Brew[], f: Filters): Brew[] {
  const q = f.query.trim().toLowerCase();
  const out = brews.filter((b) => {
    if (q) {
      const hay = [b.bean.variety, b.bean.roaster, b.bean.origin, b.tasting?.note ?? ''].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (f.roaster.length && !f.roaster.includes(b.bean.roaster)) return false;
    if (f.bean.length && !f.bean.includes(b.bean.variety)) return false;
    if (f.grinder.length && !f.grinder.includes(b.grinder.model)) return false;
    if (f.brewer.length && !f.brewer.includes(b.brewer)) return false;
    if (f.minRating && (b.tasting?.rating ?? 0) < f.minRating) return false;
    const day = localDate(b.createdAt);
    if (f.from && day < f.from) return false;
    if (f.to && day > f.to) return false;
    return true;
  });
  const by: Record<Sort, (a: Brew, b: Brew) => number> = {
    newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
    oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
    rating: (a, b) => (b.tasting?.rating ?? 0) - (a.tasting?.rating ?? 0) || b.createdAt.localeCompare(a.createdAt),
    time: (a, b) => b.timer.total_s - a.timer.total_s,
  };
  return out.sort(by[f.sort]);
}

export function brewCard(b: Brew): HTMLElement {
  return h(
    'a',
    { class: 'brew-card', href: `#/history/brew/${b.id}` },
    h(
      'div',
      { class: 'card' },
      h('div', { class: 'spread' }, h('span', { class: 'muted small' }, fmtDateTime(b.createdAt)), b.tasting?.rating ? mugsStatic(b.tasting.rating) : h('span', { class: 'badge' }, 'Add notes')),
      h('div', { class: 'row' }, h('span', { class: 'title grow' }, beanTitle(b.bean)), extractionDot(b.tasting?.extraction)),
      h(
        'div',
        { class: 'meta' },
        h('span', null, `${formatRatio(b.ratio)} · ${b.dose_g} g → ${b.water_g} g`),
        h('span', null, `Grind ${formatSetting(b.grinder.setting)}`),
        h('span', null, formatTime(b.timer.total_s)),
      ),
    ),
  );
}

export async function historyScreen(root: HTMLElement, tab: 'brews' | 'beans'): Promise<void> {
  const brews = await listBrews();
  const content = h('div', { class: 'stack' });
  replace(
    root,
    h(
      'div',
      { class: 'stack' },
      h('h1', null, 'History'),
      segmented(
        [
          { value: 'brews', label: 'Brews' },
          { value: 'beans', label: 'Beans' },
        ],
        tab,
        (v) => go(`#/history${v === 'beans' ? '/beans' : ''}`),
      ),
      content,
    ),
  );

  if (!brews.length) {
    replace(
      content,
      h('div', { class: 'empty' }, h('p', null, 'No brews yet. Your saved brews will show up here.'), h('a', { class: 'btn btn-primary', href: '#/brew' }, 'Start a brew')),
    );
    return;
  }
  if (tab === 'beans') beansList(content, brews);
  else brewsList(content, brews);
}

// ---- Brews ----

function uniq(values: string[]): string[] {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function brewsList(root: HTMLElement, brews: Brew[]) {
  const list = h('div', { class: 'stack' });
  const chips = h('div', { class: 'chips' });
  const search = h('input', { type: 'search', placeholder: 'Search beans, roasters, notes', value: filters.query, 'aria-label': 'Search' });
  search.addEventListener('input', () => {
    filters.query = search.value;
    render();
  });
  const sortSel = h(
    'select',
    { 'aria-label': 'Sort', style: { width: 'auto', minWidth: '0', flex: 'none' } },
    (Object.keys(SORT_LABELS) as Sort[]).map((k) => h('option', { value: k, selected: filters.sort === k }, SORT_LABELS[k])),
  );
  sortSel.addEventListener('change', () => {
    filters.sort = sortSel.value as Sort;
    render();
  });

  function render() {
    const shown = applyFilters(brews, filters);
    renderChips();
    if (!shown.length) {
      replace(list, h('div', { class: 'empty' }, h('p', null, 'No brews match.')));
      return;
    }
    const groups: Node[] = [];
    let month = '';
    const byDate = filters.sort === 'newest' || filters.sort === 'oldest';
    for (const b of shown) {
      const m = fmtMonth(b.createdAt);
      if (byDate && m !== month) {
        month = m;
        groups.push(h('div', { class: 'month' }, m));
      }
      groups.push(brewCard(b));
    }
    replace(list, groups);
  }

  function renderChips() {
    const c: HTMLElement[] = [];
    const chip = (label: string, clear: () => void) =>
      h('button', { type: 'button', class: 'chip', 'aria-label': `Remove filter ${label}`, onclick: () => { clear(); render(); } }, label, h('span', { class: 'x' }, '×'));
    for (const key of ['roaster', 'bean', 'grinder', 'brewer'] as const) {
      for (const v of filters[key]) c.push(chip(v, () => (filters[key] = filters[key].filter((x) => x !== v))));
    }
    if (filters.minRating) c.push(chip(`≥ ${filters.minRating} mugs`, () => (filters.minRating = 0)));
    if (filters.from) c.push(chip(`From ${fmtDate(filters.from)}`, () => (filters.from = '')));
    if (filters.to) c.push(chip(`To ${fmtDate(filters.to)}`, () => (filters.to = '')));
    replace(chips, c);
    chips.classList.toggle('hidden', !c.length);
  }

  const filterBtn = h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Filters', onclick: () => openFilters(brews, render) }, icon.filter());
  replace(root, h('div', { class: 'toolbar' }, search, filterBtn), h('div', { class: 'row' }, h('span', { class: 'muted small grow' }, ''), h('span', { class: 'muted small' }, 'Sort'), sortSel), chips, list);
  render();
}

function openFilters(brews: Brew[], onApply: () => void) {
  const draft: Filters = structuredClone(filters);
  const group = (title: string, key: 'roaster' | 'bean' | 'grinder' | 'brewer', values: string[]) =>
    values.length
      ? h(
          'div',
          { class: 'field' },
          h('span', { class: 'label' }, title),
          h(
            'div',
            { class: 'check-list' },
            values.map((v) => {
              const cb = h('input', { type: 'checkbox', checked: draft[key].includes(v) });
              cb.addEventListener('change', () => {
                draft[key] = cb.checked ? [...draft[key], v] : draft[key].filter((x) => x !== v);
              });
              return h('label', null, cb, h('span', null, v));
            }),
          ),
        )
      : null;

  const minSel = h(
    'select',
    { 'aria-label': 'Minimum rating' },
    [0, 1, 2, 3, 4, 5].map((n) => h('option', { value: String(n), selected: draft.minRating === n }, n ? `${n} mug${n > 1 ? 's' : ''} or more` : 'Any rating')),
  );
  minSel.addEventListener('change', () => (draft.minRating = Number(minSel.value)));
  const from = h('input', { type: 'date', value: draft.from, 'aria-label': 'From date' });
  const to = h('input', { type: 'date', value: draft.to, 'aria-label': 'To date' });
  from.addEventListener('change', () => (draft.from = from.value));
  to.addEventListener('change', () => (draft.to = to.value));

  const dialog = h(
    'dialog',
    { class: 'sheet', 'aria-label': 'Filters' },
    h(
      'div',
      { class: 'stack' },
      h('div', { class: 'spread' }, h('h2', null, 'Filters'), h('button', { type: 'button', class: 'link', onclick: () => dialog.close() }, 'Cancel')),
      group('Roaster', 'roaster', uniq(brews.map((b) => b.bean.roaster))),
      group('Bean', 'bean', uniq(brews.map((b) => b.bean.variety))),
      group('Grinder', 'grinder', uniq(brews.map((b) => b.grinder.model))),
      group('Brewer', 'brewer', uniq(brews.map((b) => b.brewer))),
      h('div', { class: 'field' }, h('span', { class: 'label' }, 'Rating'), minSel),
      h('div', { class: 'grid-2' }, h('div', { class: 'field' }, h('span', { class: 'label' }, 'From'), from), h('div', { class: 'field' }, h('span', { class: 'label' }, 'To'), to)),
      h(
        'div',
        { class: 'footer-actions' },
        h('button', {
          type: 'button',
          class: 'btn btn-ghost',
          onclick: () => {
            Object.assign(filters, { roaster: [], bean: [], grinder: [], brewer: [], minRating: 0, from: '', to: '' });
            dialog.close();
            onApply();
          },
        }, 'Clear all'),
        h('button', {
          type: 'button',
          class: 'btn btn-primary',
          onclick: () => {
            Object.assign(filters, draft, { query: filters.query, sort: filters.sort });
            dialog.close();
            onApply();
          },
        }, 'Show brews'),
      ),
    ),
  );
  dialog.addEventListener('close', () => dialog.remove());
  document.body.appendChild(dialog);
  dialog.showModal();
}

// ---- Beans ----

export interface BeanGroup {
  key: string;
  title: string;
  brews: Brew[];
  best: Brew | null;
  avg: number | null;
}

export function groupBeans(brews: Brew[]): BeanGroup[] {
  const map = new Map<string, Brew[]>();
  for (const b of brews) {
    const k = beanKey(b.bean);
    map.set(k, [...(map.get(k) ?? []), b]);
  }
  return [...map.entries()]
    .map(([key, list]) => {
      list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      const rated = list.filter((b) => b.tasting?.rating);
      const best = rated.length ? rated.reduce((a, b) => ((b.tasting!.rating! > a.tasting!.rating!) ? b : a)) : null;
      const avg = rated.length ? rated.reduce((s, b) => s + b.tasting!.rating!, 0) / rated.length : null;
      return { key, title: beanTitle(list[0].bean), brews: list, best, avg };
    })
    .sort((a, b) => b.brews[0].createdAt.localeCompare(a.brews[0].createdAt));
}

function beansList(root: HTMLElement, brews: Brew[]) {
  replace(
    root,
    groupBeans(brews).map((g) =>
      h(
        'a',
        { class: 'brew-card', href: `#/history/bean/${encodeURIComponent(g.key)}` },
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'spread' }, h('span', { class: 'title' }, g.title), icon.chevron()),
          h(
            'div',
            { class: 'meta' },
            h('span', null, `${g.brews.length} brew${g.brews.length > 1 ? 's' : ''}`),
            g.best ? h('span', null, `Best ${g.best.tasting!.rating} · avg ${g.avg!.toFixed(1)}`) : h('span', null, 'Not rated'),
            h('span', null, `Last ${fmtDate(g.brews[0].createdAt)}`),
          ),
        ),
      ),
    ),
  );
}
