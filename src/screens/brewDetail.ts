// A saved brew: all details, edit tasting notes, correct setup, brew again, delete.

import { extractionDot, extractionScale, field, kv, mugRating, mugsStatic, phaseTable, timelineBar } from '../components';
import { deleteBrew, getBrew, grinderRange, rememberSetup, saveBrew } from '../db';
import { fmtDateTime, go, h, replace, toast } from '../dom';
import { grindWheel } from '../grindWheel';
import { icon } from '../icons';
import { beanKey, beanTitle, daysOffRoast, EXTRACTION_LABELS, formatRatio, formatSetting, setupFrom, waterFor, type Brew, type Tasting } from '../model';
import { isBrewing, startFrom } from '../session';
import { noteField } from './brew';
import { beansSection, brewerSection, grinderSection, waterSection } from './setupSections';

export function backLink(href: string, label: string): HTMLElement {
  return h('a', { class: 'link', href, style: { display: 'inline-flex', alignItems: 'center', gap: '2px', paddingLeft: '0', textDecoration: 'none' } }, icon.back(), label);
}

function section(title: string, ...children: (Node | null)[]): HTMLElement {
  return h('section', { class: 'card' }, h('div', { class: 'section-title' }, h('h2', null, title)), children);
}

export function brewAgain(b: Brew): void {
  if (isBrewing() && !confirm('A brew is in progress. Replace it with this setup?')) return;
  startFrom(setupFrom(b));
  go('#/brew');
}

export async function brewDetailScreen(root: HTMLElement, id: string): Promise<() => void> {
  const brew = await getBrew(id);
  if (!brew) {
    replace(root, h('div', { class: 'stack' }, backLink('#/history', 'History'), h('p', null, 'This brew no longer exists.')));
    return () => {};
  }
  const range = await grinderRange(brew.grinder.model);
  const b = brew;

  function view() {
    const days = daysOffRoast(b.bean.roastDate, new Date(b.createdAt));
    const t = b.tasting;
    const wheel = grindWheel({ range, value: b.grinder.setting, interactive: false, readout: false, height: 64 });

    replace(
      root,
      h(
        'div',
        { class: 'stack' },
        backLink('#/history', 'History'),
        h('div', null, h('h1', null, beanTitle(b.bean)), h('p', { class: 'muted' }, fmtDateTime(b.createdAt))),
        h('button', { type: 'button', class: 'btn btn-primary btn-block', onclick: () => brewAgain(b) }, 'Brew again'),
        section(
          'Tasting',
          t && (t.rating || t.extraction !== null || t.note)
            ? h(
                'div',
                { class: 'stack', style: { gap: '10px' } },
                t.rating ? mugsStatic(t.rating) : null,
                t.extraction !== null ? h('div', { class: 'row' }, extractionDot(t.extraction), h('span', null, EXTRACTION_LABELS[t.extraction])) : null,
                t.note ? h('p', { class: 'note' }, t.note) : null,
                h('button', { type: 'button', class: 'btn btn-secondary btn-sm', style: { alignSelf: 'flex-start' }, onclick: editTasting }, 'Edit notes'),
              )
            : h('div', { class: 'stack', style: { gap: '10px' } }, h('p', { class: 'muted' }, 'No tasting notes yet.'), h('button', { type: 'button', class: 'btn btn-secondary', onclick: editTasting }, 'Add tasting notes')),
        ),
        section(
          'Beans',
          kv([
            ['Variety', b.bean.variety || '–'],
            ['Roaster', b.bean.roaster || '–'],
            ['Origin', b.bean.origin || null],
            ['Process', b.bean.process || null],
            ['Roast level', b.bean.roastLevel === null ? '–' : `${b.bean.roastLevel} / 5`],
            ['Roast date', b.bean.roastDate ? `${b.bean.roastDate}${days !== null ? ` (${days} d)` : ''}` : null],
            ['Beans', `${b.dose_g} g`],
            ['Ratio', formatRatio(b.ratio)],
          ]),
        ),
        section('Grind', h('div', { class: 'stack', style: { gap: '10px' } }, kv([['Grinder', b.grinder.model || '–'], ['Setting', formatSetting(b.grinder.setting, range.step)]]), wheel.el)),
        section('Brewer & paper', kv([['Brewer', b.brewer || '–'], ['Filter paper', b.paper || '–']])),
        section('Water', kv([['Amount', `${b.water_g} g`], ['Temperature', b.waterTemp_c === null ? '–' : `${b.waterTemp_c} °C`]])),
        section('Timer', h('div', { class: 'stack', style: { gap: '10px' } }, timelineBar(b.timer.phases), phaseTable(b.timer.phases, b.timer.total_s))),
        h(
          'div',
          { class: 'footer-actions' },
          h('button', { type: 'button', class: 'btn btn-ghost', onclick: editSetup }, 'Correct setup'),
          h('button', {
            type: 'button',
            class: 'btn btn-danger',
            onclick: async () => {
              if (!confirm('Delete this brew permanently? This cannot be undone.')) return;
              await deleteBrew(b.id);
              toast('Brew deleted');
              go('#/history');
            },
          }, 'Delete'),
        ),
        h('a', { class: 'link', href: `#/history/bean/${encodeURIComponent(beanKey(b.bean))}`, style: { alignSelf: 'center' } }, 'All brews of this bean'),
      ),
    );
  }

  function editTasting() {
    const draft: Tasting = b.tasting ? { ...b.tasting } : { rating: null, extraction: null, note: '', tastedAt: null };
    replace(
      root,
      h(
        'div',
        { class: 'stack' },
        h('button', { type: 'button', class: 'link', style: { alignSelf: 'flex-start', paddingLeft: '0' }, onclick: view }, 'Cancel'),
        h('h1', null, 'Tasting notes'),
        h('p', { class: 'muted' }, `${beanTitle(b.bean)} · ${fmtDateTime(b.createdAt)}`),
        h(
          'div',
          { class: 'card stack' },
          field('Overall', mugRating(draft.rating, (v) => (draft.rating = v))),
          field('Extraction', extractionScale(draft.extraction, (v) => (draft.extraction = v))),
          noteField(draft.note, (v) => (draft.note = v)),
        ),
        h('button', {
          type: 'button',
          class: 'btn btn-primary btn-block',
          onclick: async () => {
            const now = new Date().toISOString();
            const empty = draft.rating === null && draft.extraction === null && !draft.note.trim();
            b.tasting = empty ? null : { ...draft, note: draft.note.trim(), tastedAt: now };
            b.updatedAt = now;
            await saveBrew(b);
            toast('Tasting notes saved');
            view();
          },
        }, 'Save notes'),
      ),
    );
    window.scrollTo({ top: 0 });
  }

  function editSetup() {
    const draft = setupFrom(b);
    const noop = () => {};
    replace(
      root,
      h(
        'div',
        { class: 'stack' },
        h('button', { type: 'button', class: 'link', style: { alignSelf: 'flex-start', paddingLeft: '0' }, onclick: view }, 'Cancel'),
        h('h1', null, 'Correct setup'),
        h('p', { class: 'muted' }, 'Fix any values recorded wrong. Timer and tasting notes stay as they are.'),
        section('Beans', beansSection(draft, noop)),
        section('Grinder', grinderSection(draft, noop)),
        section('Brewer & paper', brewerSection(draft, noop)),
        section('Water', waterSection(draft, noop)),
        h('button', {
          type: 'button',
          class: 'btn btn-primary btn-block',
          onclick: async () => {
            (document.activeElement as HTMLElement | null)?.blur?.();
            if (!(draft.dose_g > 0) || !(draft.ratio > 0)) {
              alert('Beans and ratio must be greater than 0.');
              return;
            }
            draft.water_g = waterFor(draft.dose_g, draft.ratio);
            Object.assign(b, draft, { updatedAt: new Date().toISOString() });
            await saveBrew(b);
            await rememberSetup(b);
            toast('Brew updated');
            go(`#/history/brew/${b.id}`);
          },
        }, 'Save changes'),
      ),
    );
    window.scrollTo({ top: 0 });
  }

  view();
  return () => {};
}
