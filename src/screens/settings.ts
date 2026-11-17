// Settings: backup, grinders, suggestions, storage status, version.

import { numberField } from '../components';
import { deleteGrinder, exportAll, getMeta, getStoredSuggestions, importAll, listGrinders, parseBackup, removeSuggestion, saveGrinder, setMeta } from '../db';
import { fmtDate, h, replace, toast } from '../dom';
import { SUGGEST_FIELDS, SUGGEST_LABELS, type Grinder } from '../model';

declare const __APP_VERSION__: string;

export async function settingsScreen(root: HTMLElement): Promise<void> {
  const backup = h('section', { class: 'card stack' });
  const grinders = h('section', { class: 'card stack' });
  const suggestions = h('section', { class: 'card stack' });
  const storage = h('section', { class: 'card stack' });

  replace(
    root,
    h(
      'div',
      { class: 'stack' },
      h('h1', null, 'Settings'),
      backup,
      grinders,
      suggestions,
      storage,
      h('p', { class: 'muted small center' }, `Muginator ${__APP_VERSION__}`),
    ),
  );

  await Promise.all([renderBackup(backup), renderGrinders(grinders), renderSuggestions(suggestions), renderStorage(storage)]);
}

async function renderBackup(el: HTMLElement) {
  const last = await getMeta<string>('lastExport');
  const stale = !last || Date.now() - new Date(last).getTime() > 30 * 86_400_000;
  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file) return;
    try {
      const data = parseBackup(await file.text());
      if (!confirm(`Import ${data.brews.length} brews from this file? Brews with the same id will be replaced by the imported version.`)) return;
      const res = await importAll(data);
      toast(`Imported: ${res.added} new, ${res.updated} updated`);
      void renderBackup(el);
    } catch (e) {
      alert(`Import failed: ${(e as Error).message}`);
    }
  });

  replace(
    el,
    h('h2', null, 'Backup'),
    h('p', { class: 'muted small' }, 'Brews are stored on this phone only. Export them now and then to Files or iCloud Drive.'),
    stale ? h('div', { class: 'notice' }, last ? `Last export was ${fmtDate(last)}. Time for a fresh backup.` : 'You have not exported a backup yet.') : h('p', { class: 'small' }, `Last export: ${fmtDate(last!)}`),
    h(
      'div',
      { class: 'footer-actions', style: { marginTop: '0' } },
      h('button', { type: 'button', class: 'btn btn-primary', onclick: () => void doExport(el) }, 'Export'),
      h('button', { type: 'button', class: 'btn btn-secondary', onclick: () => fileInput.click() }, 'Import'),
    ),
    fileInput,
  );
}

async function doExport(el: HTMLElement) {
  const now = new Date();
  const data = await exportAll(now);
  const name = `muginator-backup-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.json`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const file = new File([blob], name, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
    } else {
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: name });
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return; // share sheet closed
    alert(`Export failed: ${(e as Error).message}`);
    return;
  }
  await setMeta('lastExport', now.toISOString());
  toast(`Exported ${data.brews.length} brews`);
  void renderBackup(el);
}

async function renderGrinders(el: HTMLElement) {
  const list = await listGrinders();
  replace(
    el,
    h('h2', null, 'Grinders'),
    list.length
      ? list.map((g) => grinderRow(g, () => void renderGrinders(el)))
      : h('p', { class: 'muted small' }, 'Grinders appear here after you set their range during a brew.'),
  );
}

function grinderRow(g: Grinder, refresh: () => void): HTMLElement {
  const draft = { ...g };
  return h(
    'details',
    { class: 'card tight', style: { background: 'var(--bg)' } },
    h('summary', { style: { fontWeight: '700', cursor: 'pointer', minHeight: '32px' } }, `${g.name} · ${g.min}–${g.max}, step ${g.step}`),
    h(
      'div',
      { class: 'stack', style: { marginTop: '12px' } },
      h(
        'div',
        { class: 'grid-2', style: { gridTemplateColumns: '1fr 1fr 1fr' } },
        numberField({ label: 'Min', value: g.min, suffix: '', decimal: true, onChange: (v) => (draft.min = v ?? 0) }),
        numberField({ label: 'Max', value: g.max, suffix: '', decimal: true, onChange: (v) => (draft.max = v ?? 0) }),
        numberField({ label: 'Step', value: g.step, suffix: '', decimal: true, onChange: (v) => (draft.step = v ?? 0) }),
      ),
      h(
        'div',
        { class: 'footer-actions', style: { marginTop: '0' } },
        h('button', {
          type: 'button',
          class: 'btn btn-danger btn-sm',
          onclick: async () => {
            if (!confirm(`Forget the range for ${g.name}? Saved brews are not affected.`)) return;
            await deleteGrinder(g.name);
            refresh();
          },
        }, 'Remove'),
        h('button', {
          type: 'button',
          class: 'btn btn-primary btn-sm',
          onclick: async () => {
            if (!(draft.step > 0) || !(draft.max > draft.min)) {
              alert('Max must be greater than min, and step greater than 0.');
              return;
            }
            await saveGrinder(draft);
            toast('Grinder saved');
            refresh();
          },
        }, 'Save'),
      ),
    ),
  );
}

async function renderSuggestions(el: HTMLElement) {
  const fields = await Promise.all(SUGGEST_FIELDS.map(async (f) => [f, await getStoredSuggestions(f)] as const));
  const any = fields.some(([, v]) => v.length);
  replace(
    el,
    h('h2', null, 'Remembered values'),
    h('p', { class: 'muted small' }, 'Tap × to stop suggesting a value. Saved brews keep their values.'),
    any
      ? fields
          .filter(([, v]) => v.length)
          .map(([f, values]) =>
            h(
              'div',
              { class: 'field' },
              h('span', { class: 'label' }, SUGGEST_LABELS[f]),
              h(
                'div',
                { class: 'chips' },
                values.map((v) =>
                  h('button', {
                    type: 'button',
                    class: 'chip',
                    'aria-label': `Forget ${v}`,
                    onclick: async () => {
                      await removeSuggestion(f, v);
                      void renderSuggestions(el);
                    },
                  }, v, h('span', { class: 'x' }, '×')),
                ),
              ),
            ),
          )
      : h('p', { class: 'muted small' }, 'Nothing remembered yet.'),
  );
}

async function renderStorage(el: HTMLElement) {
  const persisted = (await navigator.storage?.persisted?.()) ?? false;
  replace(
    el,
    h('h2', null, 'Storage'),
    h('p', { class: 'small' }, persisted ? 'Persistent storage is on: the browser will not clear your brews to save space.' : 'Persistent storage is not granted. Add Muginator to the Home Screen and keep backups.'),
    persisted
      ? null
      : h('button', {
          type: 'button',
          class: 'btn btn-secondary',
          onclick: async () => {
            const ok = (await navigator.storage?.persist?.()) ?? false;
            toast(ok ? 'Persistent storage granted' : 'The browser did not grant it');
            void renderStorage(el);
          },
        }, 'Request persistent storage'),
  );
}
