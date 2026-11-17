import { s } from './dom';

function stroke(paths: string[], size = 24): SVGSVGElement {
  return s(
    'svg',
    { viewBox: `0 0 ${size} ${size}`, fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' },
    paths.map((d) => s('path', { d })),
  );
}

export const icon = {
  brew: () => stroke(['M5 9h11v5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z', 'M16 10h1.5a2.5 2.5 0 0 1 0 5H16', 'M8 3c-1 1.2 1 2 0 3.5', 'M12 3c-1 1.2 1 2 0 3.5']),
  history: () => stroke(['M3 12a9 9 0 1 0 3-6.7', 'M3 4v4h4', 'M12 7v5l3 2']),
  settings: () => stroke(['M4 6h10', 'M18 6h2', 'M4 12h4', 'M12 12h8', 'M4 18h12', 'M20 18h0', 'M16 4v4', 'M10 10v4', 'M18 16v4']),
  chevron: () => stroke(['M9 6l6 6-6 6']),
  back: () => stroke(['M15 6l-6 6 6 6']),
  filter: () => stroke(['M4 5h16l-6 8v5l-4 2v-7z']),
  arrow: () => stroke(['M5 12h14', 'M13 6l6 6-6 6']),
  check: () => stroke(['M5 12l5 5 9-10']),
};

/** Coffee bean for the roast selector. fill: 0 none, 0.5 left half, 1 full. */
export function beanIcon(fill: number, color: string, id: string): SVGSVGElement {
  const body = 'M26 4C13 4 6 18 6 32s7 28 20 28 20-14 20-28S39 4 26 4z';
  return s(
    'svg',
    { viewBox: '0 0 52 64', 'aria-hidden': 'true' },
    s('defs', null, s('clipPath', { id: `half-${id}` }, s('rect', { x: 0, y: 0, width: 26, height: 64 }))),
    s('path', { d: body, fill: '#fff', stroke: 'var(--outline)', 'stroke-width': 2.5 }),
    fill > 0 ? s('path', { d: body, fill: color, 'clip-path': fill < 1 ? `url(#half-${id})` : null }) : null,
    s('path', { d: body, fill: 'none', stroke: 'var(--outline)', 'stroke-width': 2.5 }),
    s('path', { d: 'M26 6c-8 10 8 20 0 30s8 18 0 26', fill: 'none', stroke: fill > 0 ? 'rgba(255,255,255,0.55)' : 'var(--border)', 'stroke-width': 2.5, 'stroke-linecap': 'round' }),
  );
}

export const ROAST_COLORS = ['#c9a27a', '#a8774c', '#86562f', '#62391d', '#3b2213'];

/** Stout mug used for ratings. */
export function mugIcon(filled: boolean): SVGSVGElement {
  return s(
    'svg',
    { viewBox: '0 0 48 48', 'aria-hidden': 'true' },
    s('path', { d: 'M33 18c8-1 8 13 0 12', fill: 'none', stroke: 'var(--outline)', 'stroke-width': 7, 'stroke-linecap': 'round' }),
    s('path', { d: 'M33 18c8-1 8 13 0 12', fill: 'none', stroke: filled ? 'var(--mug)' : '#fff', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    s('path', {
      d: 'M8 14h26v16a8 8 0 0 1-8 8h-10a8 8 0 0 1-8-8z',
      fill: filled ? 'var(--mug)' : '#fff',
      stroke: 'var(--outline)',
      'stroke-width': 2.5,
      'stroke-linejoin': 'round',
    }),
    filled ? s('path', { d: 'M27 16h6v14a6 6 0 0 1-6 6z', fill: '#e2c463' }) : null,
  );
}
