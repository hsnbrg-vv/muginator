import { describe, expect, it } from 'vitest';
import { daysOffRoast, formatRatio, formatTime, matchSuggestions, rememberValue, waterFor, wrapSetting } from '../model';

describe('model', () => {
  it('calculates water from dose and ratio', () => {
    expect(waterFor(15, 16)).toBe(240);
    expect(waterFor(18, 15.5)).toBe(279);
    expect(waterFor(0, 16)).toBe(0);
    expect(waterFor(15, NaN)).toBe(0);
  });

  it('formats time and ratio', () => {
    expect(formatTime(185)).toBe('03:05');
    expect(formatRatio(16)).toBe('1:16');
    expect(formatRatio(15.5)).toBe('1:15.5');
  });

  it('wraps grinder settings around the range', () => {
    const k = { min: 0, max: 9.9, step: 0.1 };
    expect(wrapSetting(10, k)).toBe(0);
    expect(wrapSetting(-0.1, k)).toBe(9.9);
    expect(wrapSetting(4.34, k)).toBe(4.3);
    expect(wrapSetting(23, { min: 1, max: 40, step: 1 })).toBe(23);
    expect(wrapSetting(41, { min: 1, max: 40, step: 1 })).toBe(1);
  });

  it('counts days off roast', () => {
    expect(daysOffRoast('2026-11-02', new Date(2026, 10, 17, 8))).toBe(15);
    expect(daysOffRoast(null, new Date())).toBeNull();
  });

  it('matches suggestions prefix first, then substring', () => {
    const list = ['Hario V60', 'Origami', 'Kalita Wave', 'V60 Switch'];
    expect(matchSuggestions(list, 'v6')).toEqual(['V60 Switch', 'Hario V60']);
    expect(matchSuggestions(list, 'origami')).toEqual([]);
    expect(matchSuggestions(list, '')).toEqual(list);
  });

  it('remembers values most-recent first without duplicates', () => {
    expect(rememberValue(['A', 'b'], 'B')).toEqual(['B', 'A']);
    expect(rememberValue(['A'], '  ')).toEqual(['A']);
  });
});
