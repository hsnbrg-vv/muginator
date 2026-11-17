// Pure brew-timer state machine. Each tap records the start of the next phase;
// a phase lasts from its start until the next tap. Timestamps are epoch ms so an
// in-progress brew survives the page being reloaded by iOS.

import type { Phase } from './model';

export type PhaseKind = 'bloom' | 'pour' | 'drawdown';

export interface TimerState {
  events: { kind: PhaseKind; at: number }[];
  finishedAt: number | null;
}

export type TimerAction = 'bloom' | 'pour' | 'drawdown' | 'finish';

export function initialTimer(): TimerState {
  return { events: [], finishedAt: null };
}

export function status(s: TimerState): 'ready' | 'running' | 'finished' {
  if (s.finishedAt !== null) return 'finished';
  return s.events.length ? 'running' : 'ready';
}

export function currentKind(s: TimerState): PhaseKind | null {
  return s.events.length ? s.events[s.events.length - 1].kind : null;
}

export function phaseName(s: TimerState, index: number): string {
  const kind = s.events[index].kind;
  if (kind === 'bloom') return 'Bloom';
  if (kind === 'drawdown') return 'Drawdown';
  const n = s.events.slice(0, index + 1).filter((e) => e.kind === 'pour').length;
  return `Pour ${n}`;
}

function pourCount(s: TimerState): number {
  return s.events.filter((e) => e.kind === 'pour').length;
}

/** Actions currently available: [primary, secondary]. */
export function availableActions(s: TimerState): { action: TimerAction; label: string }[] {
  const st = status(s);
  if (st === 'finished') return [];
  if (st === 'ready') return [{ action: 'bloom', label: 'Start Bloom' }];
  const kind = currentKind(s);
  if (kind === 'drawdown') return [{ action: 'finish', label: 'Finished' }];
  const next = { action: 'pour' as const, label: `Pour ${pourCount(s) + 1}` };
  if (kind === 'bloom') return [next];
  return [next, { action: 'drawdown', label: 'Drawdown' }];
}

export function apply(s: TimerState, action: TimerAction, now: number): TimerState {
  if (!availableActions(s).some((a) => a.action === action)) return s;
  if (action === 'finish') return { ...s, finishedAt: now };
  return { events: [...s.events, { kind: action, at: now }], finishedAt: null };
}

/** Revert the last tap. The timer keeps running. */
export function undo(s: TimerState): TimerState {
  if (s.finishedAt !== null) return { ...s, finishedAt: null };
  return { events: s.events.slice(0, -1), finishedAt: null };
}

export function canUndo(s: TimerState): boolean {
  return s.events.length > 0;
}

export function elapsedMs(s: TimerState, now: number): number {
  if (!s.events.length) return 0;
  return (s.finishedAt ?? now) - s.events[0].at;
}

/** Phases with their durations in ms; the current phase runs until `now`. */
export function phasesMs(s: TimerState, now: number): { name: string; kind: PhaseKind; ms: number; done: boolean }[] {
  return s.events.map((e, i) => {
    const next = s.events[i + 1]?.at ?? s.finishedAt;
    return { name: phaseName(s, i), kind: e.kind, ms: (next ?? now) - e.at, done: next !== null && next !== undefined };
  });
}

/**
 * Whole-second result. Phase boundaries are rounded (not each duration), so the
 * phase durations always add up exactly to the total.
 */
export function result(s: TimerState): { phases: Phase[]; total_s: number } {
  if (!s.events.length) return { phases: [], total_s: 0 };
  const start = s.events[0].at;
  const end = s.finishedAt ?? s.events[s.events.length - 1].at;
  const bounds = [...s.events.map((e) => e.at), end].map((t) => Math.round((t - start) / 1000));
  return {
    phases: s.events.map((_, i) => ({ name: phaseName(s, i), duration_s: bounds[i + 1] - bounds[i] })),
    total_s: bounds[bounds.length - 1],
  };
}
