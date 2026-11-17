import { describe, expect, it } from 'vitest';
import { apply, availableActions, initialTimer, phasesMs, result, status, undo } from '../timer';

const labels = (s: ReturnType<typeof initialTimer>) => availableActions(s).map((a) => a.label);

describe('timer', () => {
  it('walks through bloom, pours, drawdown and finish', () => {
    let s = initialTimer();
    expect(status(s)).toBe('ready');
    expect(labels(s)).toEqual(['Start Bloom']);
    s = apply(s, 'bloom', 0);
    expect(labels(s)).toEqual(['Pour 1']);
    s = apply(s, 'pour', 40_000);
    expect(labels(s)).toEqual(['Pour 2', 'Drawdown']);
    s = apply(s, 'pour', 75_000);
    expect(labels(s)).toEqual(['Pour 3', 'Drawdown']);
    s = apply(s, 'drawdown', 105_000);
    expect(labels(s)).toEqual(['Finished']);
    s = apply(s, 'finish', 165_400);
    expect(status(s)).toBe('finished');
    expect(result(s)).toEqual({
      phases: [
        { name: 'Bloom', duration_s: 40 },
        { name: 'Pour 1', duration_s: 35 },
        { name: 'Pour 2', duration_s: 30 },
        { name: 'Drawdown', duration_s: 60 },
      ],
      total_s: 165,
    });
  });

  it('phase durations always add up to the total', () => {
    let s = apply(initialTimer(), 'bloom', 0);
    s = apply(s, 'pour', 5_600);
    s = apply(s, 'drawdown', 12_600);
    s = apply(s, 'finish', 25_700);
    const r = result(s);
    expect(r.phases.map((p) => p.duration_s)).toEqual([6, 7, 13]);
    expect(r.phases.reduce((a, p) => a + p.duration_s, 0)).toBe(r.total_s);
  });

  it('ignores actions that are not available', () => {
    let s = initialTimer();
    expect(apply(s, 'pour', 1)).toBe(s);
    s = apply(s, 'bloom', 0);
    expect(apply(s, 'drawdown', 5)).toBe(s);
    expect(apply(s, 'finish', 5)).toBe(s);
  });

  it('undo reverts the last tap and keeps running', () => {
    let s = apply(apply(apply(initialTimer(), 'bloom', 0), 'pour', 30_000), 'drawdown', 60_000);
    s = undo(s);
    expect(labels(s)).toEqual(['Pour 2', 'Drawdown']);
    expect(phasesMs(s, 70_000).at(-1)).toMatchObject({ name: 'Pour 1', ms: 40_000, done: false });
    s = apply(apply(s, 'drawdown', 71_000), 'finish', 90_000);
    s = undo(s);
    expect(status(s)).toBe('running');
    expect(labels(s)).toEqual(['Finished']);
    expect(undo(undo(undo(s))).events).toEqual([]);
  });
});
