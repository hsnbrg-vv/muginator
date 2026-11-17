// Per-bean dial-in: best brew, grind vs rating/extraction chart, all brews of the bean.

import { mugsStatic, segmented } from '../components';
import { grinderRange, listBrews } from '../db';
import { fmtDate, go, h, replace, s } from '../dom';
import { EXTRACTION_LABELS, extractionColor, formatRatio, formatSetting, formatTime, type Brew } from '../model';
import { backLink, brewAgain } from './brewDetail';
import { brewCard, groupBeans } from './history';

type YAxis = 'rating' | 'extraction';
let yAxis: YAxis = 'rating';

export async function beanDetailScreen(root: HTMLElement, key: string): Promise<void> {
  const group = groupBeans(await listBrews()).find((g) => g.key === key);
  if (!group) {
    replace(root, h('div', { class: 'stack' }, backLink('#/history/beans', 'Beans'), h('p', null, 'No brews of this bean.')));
    return;
  }

  const grinders = [...new Set(group.brews.map((b) => b.grinder.model))];
  let grinder = grinders[0];
  const chartBox = h('div', { class: 'chart' });

  async function drawChart() {
    const brews = group!.brews.filter((b) => b.grinder.model === grinder);
    const range = await grinderRange(grinder);
    replace(chartBox, scatter(brews, yAxis, range.step));
  }

  const best = group.best;
  replace(
    root,
    h(
      'div',
      { class: 'stack' },
      backLink('#/history/beans', 'Beans'),
      h('div', null, h('h1', null, group.title), h('p', { class: 'muted' }, `${group.brews.length} brew${group.brews.length > 1 ? 's' : ''}${group.avg !== null ? ` · average ${group.avg.toFixed(1)} mugs` : ''}`)),
      best
        ? h(
            'section',
            { class: 'card stack', style: { gap: '10px' } },
            h('div', { class: 'spread' }, h('h2', null, 'Best brew'), mugsStatic(best.tasting!.rating!)),
            h(
              'p',
              { class: 'muted' },
              `${fmtDate(best.createdAt)} · grind ${formatSetting(best.grinder.setting)} · ${formatRatio(best.ratio)} · ${best.dose_g} g · ${formatTime(best.timer.total_s)}${best.waterTemp_c !== null ? ` · ${best.waterTemp_c} °C` : ''}`,
            ),
            h(
              'div',
              { class: 'footer-actions', style: { marginTop: '0' } },
              h('a', { class: 'btn btn-ghost', href: `#/history/brew/${best.id}` }, 'Details'),
              h('button', { type: 'button', class: 'btn btn-primary', onclick: () => brewAgain(best) }, 'Brew again'),
            ),
          )
        : null,
      h(
        'section',
        { class: 'card stack' },
        h('h2', null, 'Dial-in'),
        segmented<YAxis>(
          [
            { value: 'rating', label: 'Rating' },
            { value: 'extraction', label: 'Extraction' },
          ],
          yAxis,
          (v) => {
            yAxis = v;
            void drawChart();
          },
        ),
        grinders.length > 1
          ? (() => {
              const sel = h('select', { 'aria-label': 'Grinder' }, grinders.map((g) => h('option', { value: g }, g || 'Unnamed grinder')));
              sel.addEventListener('change', () => {
                grinder = sel.value;
                void drawChart();
              });
              return sel;
            })()
          : null,
        chartBox,
      ),
      h('h2', null, 'All brews'),
      group.brews.map(brewCard),
    ),
  );
  await drawChart();
}

function scatter(brews: Brew[], axis: YAxis, step: number): Node {
  const pts = brews
    .map((b) => ({ b, x: b.grinder.setting, y: axis === 'rating' ? b.tasting?.rating ?? null : b.tasting?.extraction ?? null }))
    .filter((p): p is { b: Brew; x: number; y: number } => p.y !== null && p.y !== undefined);
  if (!pts.length) {
    return h('p', { class: 'muted' }, axis === 'rating' ? 'Rate some brews to see how grind affects taste.' : 'Mark extraction on some brews to see the trend.');
  }

  const W = 340;
  const H = 230;
  const m = { l: axis === 'rating' ? 28 : 78, r: 14, t: 12, b: 36 };
  let xMin = Math.min(...pts.map((p) => p.x));
  let xMax = Math.max(...pts.map((p) => p.x));
  const pad = Math.max(step * 2, (xMax - xMin) * 0.12);
  xMin -= pad;
  xMax += pad;
  const [yMin, yMax] = axis === 'rating' ? [0.5, 5.5] : [-2.5, 2.5];
  const X = (v: number) => m.l + ((v - xMin) / (xMax - xMin)) * (W - m.l - m.r);
  const Y = (v: number) => m.t + (1 - (v - yMin) / (yMax - yMin)) * (H - m.t - m.b);

  const yTicks = axis === 'rating' ? [1, 2, 3, 4, 5] : [-2, -1, 0, 1, 2];
  const xStep = niceStep((xMax - xMin) / 5);
  const xTicks: number[] = [];
  for (let v = Math.ceil(xMin / xStep) * xStep; v <= xMax; v += xStep) xTicks.push(Number(v.toFixed(4)));
  const latest = brews[0]?.id;

  // Jitter identical points slightly so they stay tappable.
  const seen = new Map<string, number>();
  const legend = h(
    'p',
    { class: 'muted small', style: { display: 'flex', flexWrap: 'wrap', gap: '4px 12px', alignItems: 'center', marginTop: '8px' } },
    [-1, 0, 1].map((x) => {
      const dot = h('span', { class: 'xdot', style: { '--c': extractionColor(x) } });
      return h('span', { class: 'row', style: { gap: '6px' } }, dot, x < 0 ? 'Sour' : x > 0 ? 'Bitter' : 'Balanced');
    }),
    h('span', null, 'Outlined = latest · tap a point to open'),
  );
  const svg = s(
    'svg',
    { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': `Grind setting versus ${axis}` },
    yTicks.map((v) => [
      s('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v), stroke: axis === 'extraction' && v === 0 ? 'var(--x-balanced)' : 'var(--border)', 'stroke-width': axis === 'extraction' && v === 0 ? 1.5 : 1, 'stroke-dasharray': axis === 'extraction' && v === 0 ? '4 3' : null }),
      s('text', { x: m.l - 6, y: Y(v) + 4, 'text-anchor': 'end' }, axis === 'rating' ? String(v) : EXTRACTION_LABELS[v]),
    ]),
    xTicks.map((v) => s('text', { x: X(v), y: H - m.b + 18, 'text-anchor': 'middle' }, formatSetting(v, xStep < 1 ? 0.1 : 1))),
    s('text', { x: (m.l + W - m.r) / 2, y: H - 2, 'text-anchor': 'middle', style: 'font-weight:600' }, 'Grind setting'),
    pts.map((p) => {
      const k = `${p.x}|${p.y}`;
      const n = seen.get(k) ?? 0;
      seen.set(k, n + 1);
      const cx = X(p.x) + (n ? (n % 2 ? 1 : -1) * Math.ceil(n / 2) * 7 : 0);
      const fill = extractionColor(p.b.tasting?.extraction) ?? 'var(--secondary)';
      const isLatest = p.b.id === latest;
      const g = s(
        'g',
        { class: 'pt', tabindex: 0, role: 'link', 'aria-label': `Grind ${formatSetting(p.x)}, ${axis} ${p.y}, ${fmtDate(p.b.createdAt)}` },
        s('circle', { cx, cy: Y(p.y), r: 16, fill: 'transparent' }),
        s('circle', { cx, cy: Y(p.y), r: 8, fill, stroke: isLatest ? 'var(--text)' : 'var(--surface)', 'stroke-width': isLatest ? 3 : 1.5 }),
      );
      const open = () => go(`#/history/brew/${p.b.id}`);
      g.addEventListener('click', open);
      g.addEventListener('keydown', (e) => {
        if ((e as KeyboardEvent).key === 'Enter') open();
      });
      return g;
    }),
  );
  return h('div', null, svg, legend);
}

function niceStep(raw: number): number {
  const pow = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}
