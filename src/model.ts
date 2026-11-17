// Brew data types and pure helpers.

export const SCHEMA_VERSION = 1;

export interface Phase {
  name: string;
  duration_s: number;
}

export interface Tasting {
  /** Whole mugs 1–5, or null when not rated. */
  rating: number | null;
  /** −2 very sour … 0 balanced … +2 very bitter, or null. */
  extraction: number | null;
  note: string;
  tastedAt: string | null;
}

export interface Bean {
  variety: string;
  roaster: string;
  origin: string;
  process: string;
  /** 0.5–5 in halves, or null. */
  roastLevel: number | null;
  /** YYYY-MM-DD, or null. */
  roastDate: string | null;
}

export interface BrewSetup {
  bean: Bean;
  dose_g: number;
  ratio: number;
  water_g: number;
  grinder: { model: string; setting: number };
  brewer: string;
  paper: string;
  waterTemp_c: number | null;
}

export interface Brew extends BrewSetup {
  id: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
  timer: { phases: Phase[]; total_s: number };
  tasting: Tasting | null;
}

export interface Grinder {
  name: string;
  min: number;
  max: number;
  step: number;
}

export const DEFAULT_RANGE = { min: 0, max: 9.9, step: 0.1 };

export const SUGGEST_FIELDS = ['variety', 'roaster', 'origin', 'process', 'grinder', 'brewer', 'paper'] as const;
export type SuggestField = (typeof SUGGEST_FIELDS)[number];

export const SUGGEST_LABELS: Record<SuggestField, string> = {
  variety: 'Bean variety',
  roaster: 'Roaster',
  origin: 'Origin',
  process: 'Process',
  grinder: 'Grinder',
  brewer: 'Brewer',
  paper: 'Filter paper',
};

export const PRESET_PROCESSES = ['Washed', 'Natural', 'Honey', 'Anaerobic'];

export function emptySetup(): BrewSetup {
  return {
    bean: { variety: '', roaster: '', origin: '', process: '', roastLevel: null, roastDate: null },
    dose_g: 15,
    ratio: 16,
    water_g: 240,
    grinder: { model: '', setting: 5 },
    brewer: '',
    paper: '',
    waterTemp_c: null,
  };
}

/** Copy the setup part of a brew (for prefill / brew again). */
export function setupFrom(b: BrewSetup): BrewSetup {
  return {
    bean: { ...b.bean },
    dose_g: b.dose_g,
    ratio: b.ratio,
    water_g: b.water_g,
    grinder: { ...b.grinder },
    brewer: b.brewer,
    paper: b.paper,
    waterTemp_c: b.waterTemp_c,
  };
}

export function waterFor(dose: number, ratio: number): number {
  if (!Number.isFinite(dose) || !Number.isFinite(ratio) || dose <= 0 || ratio <= 0) return 0;
  return Math.round(dose * ratio);
}

/** Whole days between roast date and the given moment (local dates). */
export function daysOffRoast(roastDate: string | null, at: Date): number | null {
  if (!roastDate) return null;
  const [y, m, d] = roastDate.split('-').map(Number);
  if (!y || !m || !d) return null;
  const roast = Date.UTC(y, m - 1, d);
  const day = Date.UTC(at.getFullYear(), at.getMonth(), at.getDate());
  return Math.round((day - roast) / 86_400_000);
}

export function formatTime(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function formatRatio(ratio: number): string {
  return `1:${Number.isInteger(ratio) ? ratio : ratio.toFixed(1).replace(/\.0$/, '')}`;
}

export function decimalsOf(step: number): number {
  const s = String(step);
  const i = s.indexOf('.');
  return i < 0 ? 0 : s.length - i - 1;
}

export function formatSetting(value: number, step = 0.1): string {
  return value.toFixed(decimalsOf(step));
}

/** Snap a value to the grinder's step grid and wrap it into [min, max]. */
export function wrapSetting(value: number, g: Pick<Grinder, 'min' | 'max' | 'step'>): number {
  const count = Math.round((g.max - g.min) / g.step) + 1;
  let i = Math.round((value - g.min) / g.step) % count;
  if (i < 0) i += count;
  return Number((g.min + i * g.step).toFixed(decimalsOf(g.step)));
}

export const EXTRACTION_LABELS: Record<number, string> = {
  [-2]: 'Very sour',
  [-1]: 'Sour',
  0: 'Balanced',
  1: 'Bitter',
  2: 'Very bitter',
};

export function extractionColor(x: number | null | undefined): string | null {
  switch (x) {
    case -2: return 'var(--x-very-sour)';
    case -1: return 'var(--x-sour)';
    case 0: return 'var(--x-balanced)';
    case 1: return 'var(--x-bitter)';
    case 2: return 'var(--x-very-bitter)';
    default: return null;
  }
}

/** Identity of a coffee: variety + roaster, case-insensitive. */
export function beanKey(b: Pick<Bean, 'variety' | 'roaster'>): string {
  return `${b.variety.trim().toLowerCase()}|${b.roaster.trim().toLowerCase()}`;
}

export function beanTitle(b: Pick<Bean, 'variety' | 'roaster'>): string {
  const v = b.variety.trim() || 'Unnamed bean';
  return b.roaster.trim() ? `${v} · ${b.roaster.trim()}` : v;
}

/** Suggestions: case-insensitive prefix matches first, then substring matches. */
export function matchSuggestions(values: string[], query: string, limit = 6): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return values.slice(0, limit);
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const v of values) {
    const l = v.toLowerCase();
    if (l === q) continue;
    if (l.startsWith(q)) prefix.push(v);
    else if (l.includes(q)) contains.push(v);
  }
  return [...prefix, ...contains].slice(0, limit);
}

/** Add a value to a suggestion list, most recent first, de-duplicated case-insensitively. */
export function rememberValue(list: string[], value: string): string[] {
  const v = value.trim();
  if (!v) return list;
  return [v, ...list.filter((x) => x.toLowerCase() !== v.toLowerCase())];
}

export function suggestionValues(s: BrewSetup): Record<SuggestField, string> {
  return {
    variety: s.bean.variety,
    roaster: s.bean.roaster,
    origin: s.bean.origin,
    process: s.bean.process,
    grinder: s.grinder.model,
    brewer: s.brewer,
    paper: s.paper,
  };
}
