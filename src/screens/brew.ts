// Brew tab: setup steps, then the timer, finish & tasting, slide to save.

import { extractionScale, field, kv, mugRating, phaseTable, slideToSave, timelineBar } from '../components';
import { saveBrew } from '../db';
import { go, h, replace } from '../dom';
import { beanTitle, formatRatio, formatSetting, formatTime, SCHEMA_VERSION, type Brew, type BrewSetup } from '../model';
import { clearSession, emptyTasting, getSession, persist, startTimer, type Session } from '../session';
import { apply, availableActions, canUndo, elapsedMs, phasesMs, result, status, undo, type TimerAction } from '../timer';
import { beansSection, brewerSection, grinderSection, waterSection } from './setupSections';

const STEPS = ['Beans', 'Grinder', 'Brewer', 'Water'];

export async function brewScreen(root: HTMLElement): Promise<() => void> {
  const session = await getSession();
  if (session.timer) return timerView(root, session);
  setupView(root, session);
  return () => {};
}

function canStart(s: BrewSetup): string | null {
  if (!(s.dose_g > 0)) return 'Enter the amount of beans.';
  if (!(s.ratio > 0)) return 'Enter the ratio.';
  return null;
}

function setupView(root: HTMLElement, session: Session) {
  const save = () => persist();
  const content = h('div');
  const stepsBar = h('nav', { class: 'steps', 'aria-label': 'Brew setup steps' });
  const footer = h('div', { class: 'footer-actions' });

  function render() {
    replace(
      stepsBar,
      STEPS.map((name, i) =>
        h('button', {
          type: 'button',
          class: i === session.step ? 'current' : i < session.step ? 'done' : '',
          'aria-current': i === session.step ? 'step' : null,
          onclick: () => setStep(i),
        }, name),
      ),
    );
    const sections = [beansSection, grinderSection, brewerSection, waterSection];
    replace(content, sections[session.step](session.setup, save));

    const back = session.step > 0 ? h('button', { type: 'button', class: 'btn btn-ghost', onclick: () => setStep(session.step - 1) }, 'Back') : null;
    if (session.step < STEPS.length - 1) {
      replace(footer, back, h('button', { type: 'button', class: 'btn btn-primary', onclick: () => setStep(session.step + 1) }, 'Next'));
    } else {
      replace(
        footer,
        back,
        h('button', {
          type: 'button',
          class: 'btn btn-primary',
          onclick: () => {
            const problem = canStart(session.setup);
            if (problem) {
              alert(problem);
              setStep(0);
              return;
            }
            startTimer();
            go('#/brew');
          },
        }, 'Start Brewing'),
      );
    }
  }

  function setStep(i: number) {
    (document.activeElement as HTMLElement | null)?.blur?.();
    session.step = i;
    persist();
    render();
    window.scrollTo({ top: 0 });
  }

  replace(root, h('div', { class: 'stack' }, h('h1', null, 'New brew'), stepsBar, content, footer));
  render();
}

function summaryCard(s: BrewSetup): HTMLElement {
  return h(
    'div',
    { class: 'card' },
    h('h3', { style: { marginBottom: '8px' } }, beanTitle(s.bean)),
    kv([
      ['Beans → water', `${s.dose_g} g → ${s.water_g} g`],
      ['Ratio', formatRatio(s.ratio)],
      ['Grind', `${formatSetting(s.grinder.setting)}${s.grinder.model ? ` · ${s.grinder.model}` : ''}`],
      ['Brewer', s.brewer || '–'],
      ['Paper', s.paper || '–'],
      ['Water temp', s.waterTemp_c === null ? '–' : `${s.waterTemp_c} °C`],
    ]),
  );
}

// ---- Wake lock ----

let wakeLock: WakeLockSentinel | null = null;
let wantWake = false;
async function acquireWake() {
  wantWake = true;
  try {
    if ('wakeLock' in navigator && !wakeLock && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => (wakeLock = null));
    }
  } catch {
    // not supported or denied: nothing to do
  }
}
function releaseWake() {
  wantWake = false;
  void wakeLock?.release();
  wakeLock = null;
}
document.addEventListener('visibilitychange', () => {
  if (wantWake && document.visibilityState === 'visible') void acquireWake();
});

// ---- Timer, finish & tasting ----

function timerView(root: HTMLElement, session: Session): () => void {
  const timer = () => session.timer!;
  const heading = h('div', { class: 'phase-heading', 'aria-live': 'polite' });
  const big = h('div', { class: 'big-time', role: 'timer' });
  const phaseLine = h('div', { class: 'phase-elapsed' });
  const body = h('div', { class: 'stack' });
  const actions = h('div', { class: 'timer-actions' });
  let tick = 0;

  function act(a: TimerAction) {
    session.timer = apply(timer(), a, Date.now());
    persist();
    navigator.vibrate?.(10);
    render();
  }

  function updateClock() {
    const t = timer();
    const now = Date.now();
    big.textContent = status(t) === 'finished' ? formatTime(result(t).total_s) : formatTime(elapsedMs(t, now) / 1000);
    const phases = phasesMs(t, now);
    const cur = phases[phases.length - 1];
    if (status(t) === 'running' && cur) phaseLine.textContent = `${cur.name} · ${formatTime(cur.ms / 1000)}`;
    const curLi = body.querySelector('li.current span');
    if (curLi && cur) curLi.textContent = formatTime(cur.ms / 1000);
  }

  function render() {
    const t = timer();
    const st = status(t);
    const now = Date.now();
    root.classList.toggle('finished', st === 'finished');

    if (st === 'ready') {
      heading.textContent = 'Ready';
      phaseLine.textContent = 'Tap Start Bloom when you pour the bloom water';
      replace(body, summaryCard(session.setup));
    } else if (st === 'running') {
      const phases = phasesMs(t, now);
      heading.textContent = phases[phases.length - 1].name;
      replace(
        body,
        h(
          'ul',
          { class: 'phase-list' },
          phases.map((p) => h('li', { class: p.done ? '' : 'current' }, h('strong', null, p.name), h('span', null, formatTime(p.ms / 1000)))),
        ),
      );
    } else {
      heading.textContent = 'Finished';
      phaseLine.textContent = '';
      const r = result(t);
      replace(body, h('div', { class: 'card stack' }, timelineBar(r.phases), phaseTable(r.phases, r.total_s)), tastingSection(session), h('div', { style: { height: '4px' } }), slideToSave('Slide to save', () => void saveCurrent(session)));
    }

    const buttons = availableActions(t).map((a, i) =>
      h('button', { type: 'button', class: `btn btn-xl btn-block ${i === 0 ? 'btn-primary' : 'btn-secondary'}`, onclick: () => act(a.action) }, a.label),
    );
    const links = h(
      'div',
      { class: 'timer-links' },
      st === 'ready'
        ? h('button', { type: 'button', class: 'link', onclick: () => { session.timer = null; persist(); go('#/brew'); } }, '← Back to setup')
        : h('button', {
            type: 'button',
            class: 'link',
            disabled: !canUndo(t),
            onclick: () => {
              session.timer = undo(t);
              persist();
              render();
            },
          }, st === 'finished' ? 'Undo finish' : 'Undo last tap'),
      st === 'ready'
        ? null
        : h('button', {
            type: 'button',
            class: 'link link-danger',
            onclick: () => {
              if (confirm('Discard this brew? The timer and any notes will be lost.')) {
                clearSession();
                go('#/brew');
              }
            },
          }, 'Discard brew'),
    );
    replace(actions, buttons, links);

    cancelAnimationFrame(tick);
    if (st === 'running') {
      void acquireWake();
      const loop = () => {
        updateClock();
        tick = requestAnimationFrame(loop);
      };
      loop();
    } else {
      if (st === 'finished') releaseWake();
      updateClock();
    }
  }

  const screen = h('div', { class: 'timer-screen' }, heading, big, phaseLine, body, actions);
  replace(root, screen);
  render();

  return () => {
    cancelAnimationFrame(tick);
    releaseWake();
  };
}

function tastingSection(session: Session): HTMLElement {
  const t = session.tasting;
  const wrap = h('div', { class: 'card stack' });
  let open = true;
  const save = () => persist();
  function render() {
    replace(
      wrap,
      h(
        'div',
        { class: 'spread' },
        h('h2', null, 'Tasting notes'),
        h('button', { type: 'button', class: 'link', 'aria-expanded': String(open), onclick: () => { open = !open; render(); } }, open ? 'Taste later' : 'Add now'),
      ),
      open
        ? [
            field('Overall', mugRating(t.rating, (v) => { t.rating = v; save(); })),
            field('Extraction', extractionScale(t.extraction, (v) => { t.extraction = v; save(); })),
            noteField(t.note, (v) => { t.note = v; save(); }),
          ]
        : h('p', { class: 'muted small' }, 'You can add tasting notes later from History.'),
    );
  }
  render();
  return wrap;
}

export function noteField(value: string, onChange: (v: string) => void): HTMLElement {
  const ta = h('textarea', { id: 'note', value, placeholder: 'How did it taste?', rows: 4 });
  ta.addEventListener('input', () => onChange(ta.value));
  return h('div', { class: 'field' }, h('label', { for: 'note' }, 'Note'), ta);
}

async function saveCurrent(session: Session) {
  const t = session.timer!;
  const r = result(t);
  const now = new Date().toISOString();
  const tasted = session.tasting.rating !== null || session.tasting.extraction !== null || session.tasting.note.trim() !== '';
  const brew: Brew = {
    ...session.setup,
    bean: { ...session.setup.bean, variety: session.setup.bean.variety.trim(), roaster: session.setup.bean.roaster.trim() },
    id: crypto.randomUUID(),
    schemaVersion: SCHEMA_VERSION,
    createdAt: new Date(t.events[0]?.at ?? Date.now()).toISOString(),
    updatedAt: now,
    timer: r,
    tasting: tasted ? { ...session.tasting, note: session.tasting.note.trim(), tastedAt: now } : null,
  };
  try {
    await saveBrew(brew);
  } catch (e) {
    alert(`Could not save the brew: ${(e as Error).message}`);
    return;
  }
  session.tasting = emptyTasting();
  clearSession();
  setTimeout(() => go(`#/history/brew/${brew.id}`), 350);
}
