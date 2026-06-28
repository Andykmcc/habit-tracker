import { describe, it, expect } from 'vitest';
import { mergeSnapshots, reconcileLegacyHabitIds } from './importMerge';
import type { Snapshot } from '../store';

const habit = (id: string, name = id) => ({ id, name, createdAt: '2026-01-01T00:00:00.000Z' });

const local: Snapshot = {
  habits: { h1: habit('h1', 'Run'), h2: habit('h2', 'Read') },
  logs: {
    h1: { '2026-06-01': { status: true, note: 'local' }, '2026-06-02': { status: false } },
    h2: { '2026-06-01': { status: true } },
  },
};
const imported: Snapshot = {
  habits: { h1: habit('h1', 'Run'), h3: habit('h3', 'Meditate') },
  logs: {
    h1: { '2026-06-01': { status: false, note: 'imported' }, '2026-06-03': { status: true } },
    h3: { '2026-06-01': { status: true } },
  },
};

describe('mergeSnapshots — union (mirror off)', () => {
  it('imported wins on conflict, keeps everything else', () => {
    const { result, counts } = mergeSnapshots(local, imported, { conflictWinner: 'imported', mirror: false });
    // conflict on h1/2026-06-01 -> imported value
    expect(result.logs.h1!['2026-06-01']).toEqual({ status: false, note: 'imported' });
    // local-only retained
    expect(result.logs.h1!['2026-06-02']).toEqual({ status: false });
    expect(result.habits.h2).toBeTruthy();
    // imported-only added
    expect(result.logs.h1!['2026-06-03']).toEqual({ status: true });
    expect(result.habits.h3).toBeTruthy();
    expect(counts.logsOverwritten).toBe(1);
    expect(counts.logsAdded).toBe(2); // h1/06-03 and h3/06-01
    expect(counts.habitsAdded).toBe(1); // h3
    expect(counts.habitsDeleted).toBe(0);
    expect(counts.logsDeleted).toBe(0);
  });

  it('local wins on conflict (overwritten count is 0)', () => {
    const { result, counts } = mergeSnapshots(local, imported, { conflictWinner: 'local', mirror: false });
    expect(result.logs.h1!['2026-06-01']).toEqual({ status: true, note: 'local' });
    expect(counts.logsOverwritten).toBe(0);
    expect(counts.logsAdded).toBe(2);
  });

  it('counts habit metadata changes as habitsUpdated', () => {
    const localR: Snapshot = { habits: { h1: habit('h1', 'Run') }, logs: {} };
    const importedR: Snapshot = { habits: { h1: { ...habit('h1', 'Running'), color: '#fff' } }, logs: {} };
    const imp = mergeSnapshots(localR, importedR, { conflictWinner: 'imported', mirror: false });
    expect(imp.result.habits.h1!.name).toBe('Running');
    expect(imp.counts.habitsUpdated).toBe(1);
    const loc = mergeSnapshots(localR, importedR, { conflictWinner: 'local', mirror: false });
    expect(loc.result.habits.h1!.name).toBe('Run');
    expect(loc.counts.habitsUpdated).toBe(0);
  });
});

describe('mergeSnapshots — mirror on', () => {
  it('result deep-equals imported regardless of conflictWinner', () => {
    for (const conflictWinner of ['imported', 'local'] as const) {
      const { result } = mergeSnapshots(local, imported, { conflictWinner, mirror: true });
      expect(result.habits).toEqual(imported.habits);
      expect(result.logs).toEqual(imported.logs);
    }
  });

  it('counts all six change categories under mirror', () => {
    const { counts } = mergeSnapshots(local, imported, { conflictWinner: 'imported', mirror: true });
    expect(counts).toEqual({
      habitsAdded: 1,     // h3
      habitsUpdated: 0,   // h1 metadata identical
      habitsDeleted: 1,   // h2
      logsAdded: 2,       // h1/06-03 + h3/06-01
      logsOverwritten: 1, // h1/06-01 (local true/'local' -> imported false/'imported')
      logsDeleted: 2,     // h1/06-02 + h2/06-01
    });
  });

  it('empty import + mirror deletes everything', () => {
    const empty: Snapshot = { habits: {}, logs: {} };
    const { result, counts } = mergeSnapshots(local, empty, { conflictWinner: 'imported', mirror: true });
    expect(result).toEqual(empty);
    expect(counts.habitsDeleted).toBe(2);
    expect(counts.logsDeleted).toBe(3);
  });
});

describe('mergeSnapshots — edges', () => {
  it('empty local + import => everything added', () => {
    const empty: Snapshot = { habits: {}, logs: {} };
    const { result, counts } = mergeSnapshots(empty, imported, { conflictWinner: 'imported', mirror: false });
    expect(result.habits).toEqual(imported.habits);
    expect(result.logs).toEqual(imported.logs);
    expect(counts.habitsAdded).toBe(2);
    expect(counts.logsAdded).toBe(3);
  });

  it('is idempotent under imported-wins', () => {
    const once = mergeSnapshots(local, imported, { conflictWinner: 'imported', mirror: false }).result;
    const twice = mergeSnapshots(once, imported, { conflictWinner: 'imported', mirror: false });
    expect(twice.counts).toEqual({ habitsAdded: 0, habitsUpdated: 0, habitsDeleted: 0, logsAdded: 0, logsOverwritten: 0, logsDeleted: 0 });
  });
});

describe('reconcileLegacyHabitIds', () => {
  it('remaps imported habit ids onto local ids by matching name', () => {
    const localSnap: Snapshot = { habits: { 'real-1': habit('real-1', 'Run') }, logs: { 'real-1': { '2026-06-01': { status: true } } } };
    const legacy: Snapshot = { habits: { 'legacy-habit-1': habit('legacy-habit-1', 'Run') }, logs: { 'legacy-habit-1': { '2026-06-02': { status: false } } } };
    const out = reconcileLegacyHabitIds(legacy, localSnap);
    expect(out.habits['real-1']!.name).toBe('Run');
    expect(out.habits['legacy-habit-1']).toBeUndefined();
    expect(out.logs['real-1']).toEqual({ '2026-06-02': { status: false } });
  });

  it('keeps the provisional id when no local name matches', () => {
    const localSnap: Snapshot = { habits: {}, logs: {} };
    const legacy: Snapshot = { habits: { 'legacy-habit-1': habit('legacy-habit-1', 'New') }, logs: {} };
    const out = reconcileLegacyHabitIds(legacy, localSnap);
    expect(out.habits['legacy-habit-1']!.name).toBe('New');
  });
});
