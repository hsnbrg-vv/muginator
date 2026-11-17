// The brew in progress: setup draft, current step, timer and tasting.
// Kept in localStorage so a reload (iOS sometimes does this) doesn't lose it.

import { lastBrew } from './db';
import { emptySetup, setupFrom, type BrewSetup, type Tasting } from './model';
import { initialTimer, type TimerState } from './timer';

export interface Session {
  setup: BrewSetup;
  step: number;
  /** null until "Start Brewing" is tapped. */
  timer: TimerState | null;
  tasting: Tasting;
}

const KEY = 'muginator-session';

export function emptyTasting(): Tasting {
  return { rating: null, extraction: null, note: '', tastedAt: null };
}

let current: Session | null = null;

function load(): Session | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function persist(): void {
  try {
    if (current) localStorage.setItem(KEY, JSON.stringify(current));
    else localStorage.removeItem(KEY);
  } catch {
    // storage unavailable: the session just won't survive a reload
  }
}

/** The current session; a new one is prefilled from the last saved brew. */
export async function getSession(): Promise<Session> {
  current ??= load();
  if (!current) {
    const last = await lastBrew();
    current = { setup: last ? setupFrom(last) : emptySetup(), step: 0, timer: null, tasting: emptyTasting() };
    persist();
  }
  return current;
}

export function peekSession(): Session | null {
  current ??= load();
  return current;
}

/** Start a fresh session from the given setup (Brew again). */
export function startFrom(setup: BrewSetup): void {
  current = { setup: setupFrom(setup), step: 0, timer: null, tasting: emptyTasting() };
  persist();
}

export function startTimer(): void {
  if (current) {
    current.timer = initialTimer();
    persist();
  }
}

export function clearSession(): void {
  current = null;
  persist();
}

export function isBrewing(): boolean {
  return !!peekSession()?.timer;
}
