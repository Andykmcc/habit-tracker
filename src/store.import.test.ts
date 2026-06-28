import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useHabitStore } from './store';
import { encodeSnapshot } from './utils/exportSchema';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('getFullSnapshot', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('captures all habits and logs grouped by habitId', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    const h2 = store.createHabit('Read');
    store.setActiveHabit(h1);
    store.upsertLog('2025-01-01', true, 'Good');
    store.upsertLog('2025-02-15', false);
    store.setActiveHabit(h2);
    store.upsertLog('2025-01-01', null, 'Skipped');

    const snap = store.getFullSnapshot();

    expect(Object.keys(snap.habits).sort()).toEqual([h1, h2].sort());
    expect(snap.habits[h1]!.name).toBe('Run');
    expect(snap.logs[h1]).toEqual({
      '2025-01-01': { status: true, note: 'Good' },
      '2025-02-15': { status: false },
    });
    expect(snap.logs[h2]).toEqual({ '2025-01-01': { status: null, note: 'Skipped' } });
  });

  it('includes habits with zero logs (no logs key for them)', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Empty');
    const snap = store.getFullSnapshot();
    expect(snap.habits[h1]!.name).toBe('Empty');
    expect(snap.logs[h1]).toBeUndefined();
  });
});

describe('replaceAllData', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('round-trips a snapshot through getFullSnapshot', () => {
    const store = useHabitStore();
    const snap = {
      habits: { a: { id: 'a', name: 'A', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { a: { '2026-06-01': { status: true, note: 'hi' }, '2026-07-01': { status: null } } },
    };
    store.replaceAllData(snap);
    expect(store.getFullSnapshot()).toEqual(snap);
  });

  it('clears active habit and logs when replaced with an empty snapshot', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true);

    store.replaceAllData({ habits: {}, logs: {} });

    expect(store.getFullSnapshot()).toEqual({ habits: {}, logs: {} });
    expect(store.activeHabitId).toBeNull();
  });

  it('removes habits/logs not present in the new snapshot (mirror)', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true);

    store.replaceAllData({
      habits: { b: { id: 'b', name: 'B', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: {},
    });

    const snap = store.getFullSnapshot();
    expect(snap.habits[h1]).toBeUndefined();
    expect(snap.habits.b).toBeTruthy();
    expect(store.activeHabitId).toBe('b'); // active reconciled to surviving habit
  });
});

describe('importCsv / previewImport', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('previewImport reports counts without writing', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');

    const csv = encodeSnapshot({
      habits: { [h1]: { id: h1, name: 'Run', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { [h1]: { '2026-06-01': { status: false, note: 'imported' }, '2026-06-02': { status: true } } },
    });

    const summary = store.previewImport(csv, { conflictWinner: 'imported', mirror: false });
    expect(summary.logsOverwritten).toBe(1);
    expect(summary.logsAdded).toBe(1);
    expect(summary.warnings).toEqual([]); // clean v2 file => no warnings
    // unchanged on disk
    expect(store.getFullSnapshot().logs[h1]!['2026-06-01']).toEqual({ status: true, note: 'local' });
  });

  it('importCsv applies the merge to storage', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');

    const csv = encodeSnapshot({
      habits: { [h1]: { id: h1, name: 'Run', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { [h1]: { '2026-06-01': { status: false, note: 'imported' } } },
    });

    store.importCsv(csv, { conflictWinner: 'imported', mirror: false });
    expect(store.getFullSnapshot().logs[h1]!['2026-06-01']).toEqual({ status: false, note: 'imported' });
  });

  it('imports a legacy v1 CSV end-to-end, reconciling onto the matching local habit and surfacing a warning', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');

    const legacyCsv = [
      'Date,Habit Name,Status,Label,Note',
      '2026-06-02,Run,Failed,✕,',
    ].join('\n');

    const summary = store.importCsv(legacyCsv, { conflictWinner: 'imported', mirror: false });

    const snap = store.getFullSnapshot();
    // legacy habit matched local "Run" by name -> reconciled onto h1, no duplicate habit
    expect(Object.keys(snap.habits)).toEqual([h1]);
    expect(snap.logs[h1]).toEqual({
      '2026-06-01': { status: true, note: 'local' }, // untouched local log
      '2026-06-02': { status: false },               // added from the legacy import
    });
    expect(summary.logsAdded).toBe(1);
    expect(summary.warnings.some(w => w.toLowerCase().includes('legacy'))).toBe(true);
  });

  it('a decode error throws and leaves storage untouched (atomicity)', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');
    const before = store.getFullSnapshot();

    expect(() => store.importCsv('garbage,header\n1,2', { conflictWinner: 'imported', mirror: false }))
      .toThrow();
    expect(store.getFullSnapshot()).toEqual(before);
  });
});
