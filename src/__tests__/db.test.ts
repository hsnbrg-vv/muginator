import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { exportAll, getSuggestions, importAll, lastBrew, listBrews, parseBackup, resetConnection, saveBrew } from '../db';
import { emptySetup, type Brew } from '../model';

function brew(id: string, createdAt: string, variety = 'Gesha'): Brew {
  const s = emptySetup();
  s.bean.variety = variety;
  s.brewer = 'Hario V60';
  return { ...s, id, schemaVersion: 1, createdAt, updatedAt: createdAt, timer: { phases: [], total_s: 0 }, tasting: null };
}

beforeEach(async () => {
  await resetConnection();
  await new Promise<void>((res) => {
    const r = indexedDB.deleteDatabase('muginator');
    r.onsuccess = () => res();
    r.onerror = () => res();
  });
});

describe('db', () => {
  it('lists brews newest first and remembers suggestions', async () => {
    await saveBrew(brew('a', '2026-11-01T08:00:00Z', 'Bourbon'));
    await saveBrew(brew('b', '2026-11-03T08:00:00Z', 'Gesha'));
    expect((await listBrews()).map((b) => b.id)).toEqual(['b', 'a']);
    expect((await lastBrew())?.id).toBe('b');
    expect(await getSuggestions('variety')).toEqual(['Gesha', 'Bourbon']);
    expect(await getSuggestions('process')).toContain('Washed');
  });

  it('round-trips export and import, imported version wins', async () => {
    await saveBrew(brew('a', '2026-11-01T08:00:00Z', 'Bourbon'));
    const backup = parseBackup(JSON.stringify(await exportAll()));
    backup.brews[0].bean.variety = 'Changed';
    backup.brews.push(brew('c', '2026-11-05T08:00:00Z', 'Typica'));
    const res = await importAll(backup);
    expect(res).toEqual({ added: 1, updated: 1 });
    const all = await listBrews();
    expect(all.map((b) => [b.id, b.bean.variety])).toEqual([
      ['c', 'Typica'],
      ['a', 'Changed'],
    ]);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('{"hello":1}')).toThrow();
  });
});
