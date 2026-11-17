// IndexedDB storage, suggestions, grinders and JSON backup.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import {
  DEFAULT_RANGE,
  PRESET_PROCESSES,
  SUGGEST_FIELDS,
  rememberValue,
  suggestionValues,
  type Brew,
  type BrewSetup,
  type Grinder,
  type SuggestField,
} from './model';

interface MugDB extends DBSchema {
  brews: { key: string; value: Brew; indexes: { createdAt: string } };
  suggestions: { key: string; value: string[] };
  grinders: { key: string; value: Grinder };
  meta: { key: string; value: unknown };
}

export interface Backup {
  app: 'muginator';
  schemaVersion: number;
  exportedAt: string;
  brews: Brew[];
  suggestions: Partial<Record<SuggestField, string[]>>;
  grinders: Grinder[];
}

let dbPromise: Promise<IDBPDatabase<MugDB>> | null = null;

export function db(): Promise<IDBPDatabase<MugDB>> {
  dbPromise ??= openDB<MugDB>('muginator', 1, {
    upgrade(d) {
      const brews = d.createObjectStore('brews', { keyPath: 'id' });
      brews.createIndex('createdAt', 'createdAt');
      d.createObjectStore('suggestions');
      d.createObjectStore('grinders', { keyPath: 'name' });
      d.createObjectStore('meta');
    },
  });
  return dbPromise;
}

/** For tests: forget the open connection. */
export async function resetConnection(): Promise<void> {
  if (dbPromise) (await dbPromise).close();
  dbPromise = null;
}

// ---- Brews ----

/** All brews, newest first. */
export async function listBrews(): Promise<Brew[]> {
  const all = await (await db()).getAllFromIndex('brews', 'createdAt');
  return all.reverse();
}

export async function getBrew(id: string): Promise<Brew | undefined> {
  return (await db()).get('brews', id);
}

export async function lastBrew(): Promise<Brew | undefined> {
  const d = await db();
  const cursor = await d.transaction('brews').store.index('createdAt').openCursor(null, 'prev');
  return cursor?.value;
}

/** Save a brew and remember its text values as suggestions. */
export async function saveBrew(brew: Brew): Promise<void> {
  await (await db()).put('brews', brew);
  await rememberSetup(brew);
}

export async function deleteBrew(id: string): Promise<void> {
  await (await db()).delete('brews', id);
}

// ---- Suggestions ----

export async function getSuggestions(field: SuggestField): Promise<string[]> {
  const stored = (await (await db()).get('suggestions', field)) ?? [];
  if (field !== 'process') return stored;
  return [...stored, ...PRESET_PROCESSES.filter((p) => !stored.some((s) => s.toLowerCase() === p.toLowerCase()))];
}

export async function getStoredSuggestions(field: SuggestField): Promise<string[]> {
  return (await (await db()).get('suggestions', field)) ?? [];
}

export async function rememberSetup(s: BrewSetup): Promise<void> {
  const d = await db();
  const tx = d.transaction('suggestions', 'readwrite');
  const values = suggestionValues(s);
  for (const field of SUGGEST_FIELDS) {
    const v = values[field];
    if (!v.trim()) continue;
    const list = (await tx.store.get(field)) ?? [];
    await tx.store.put(rememberValue(list, v), field);
  }
  await tx.done;
}

export async function removeSuggestion(field: SuggestField, value: string): Promise<void> {
  const d = await db();
  const list = (await d.get('suggestions', field)) ?? [];
  await d.put('suggestions', list.filter((v) => v !== value), field);
}

// ---- Grinders ----

export async function getGrinder(name: string): Promise<Grinder | undefined> {
  if (!name.trim()) return undefined;
  const all = await listGrinders();
  return all.find((g) => g.name.toLowerCase() === name.trim().toLowerCase());
}

export async function listGrinders(): Promise<Grinder[]> {
  return (await db()).getAll('grinders');
}

export async function saveGrinder(g: Grinder): Promise<void> {
  await (await db()).put('grinders', { ...g, name: g.name.trim() });
}

export async function deleteGrinder(name: string): Promise<void> {
  await (await db()).delete('grinders', name);
}

export async function grinderRange(name: string): Promise<Grinder> {
  return (await getGrinder(name)) ?? { name, ...DEFAULT_RANGE };
}

// ---- Meta ----

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await (await db()).get('meta', key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await (await db()).put('meta', value, key);
}

// ---- Backup ----

export async function exportAll(now = new Date()): Promise<Backup> {
  const d = await db();
  const suggestions: Backup['suggestions'] = {};
  for (const f of SUGGEST_FIELDS) {
    const list = await d.get('suggestions', f);
    if (list?.length) suggestions[f] = list;
  }
  return {
    app: 'muginator',
    schemaVersion: 1,
    exportedAt: now.toISOString(),
    brews: await d.getAll('brews'),
    suggestions,
    grinders: await d.getAll('grinders'),
  };
}

export function parseBackup(text: string): Backup {
  const data = JSON.parse(text);
  if (!data || data.app !== 'muginator' || !Array.isArray(data.brews)) {
    throw new Error('This file is not a Muginator backup.');
  }
  return {
    app: 'muginator',
    schemaVersion: data.schemaVersion ?? 1,
    exportedAt: data.exportedAt ?? '',
    brews: data.brews.filter((b: Brew) => b && typeof b.id === 'string'),
    suggestions: data.suggestions ?? {},
    grinders: Array.isArray(data.grinders) ? data.grinders : [],
  };
}

/** Merge a backup in. Records match by id; the imported version wins. */
export async function importAll(backup: Backup): Promise<{ added: number; updated: number }> {
  const d = await db();
  const tx = d.transaction(['brews', 'suggestions', 'grinders'], 'readwrite');
  let added = 0;
  let updated = 0;
  const brews = tx.objectStore('brews');
  for (const b of backup.brews) {
    if (await brews.get(b.id)) updated++;
    else added++;
    await brews.put(b);
  }
  const sugg = tx.objectStore('suggestions');
  for (const f of SUGGEST_FIELDS) {
    const incoming = backup.suggestions[f];
    if (!incoming?.length) continue;
    let list = (await sugg.get(f)) ?? [];
    for (const v of [...incoming].reverse()) list = rememberValue(list, v);
    await sugg.put(list, f);
  }
  const grinders = tx.objectStore('grinders');
  for (const g of backup.grinders) {
    if (g?.name) await grinders.put(g);
  }
  await tx.done;
  return { added, updated };
}
