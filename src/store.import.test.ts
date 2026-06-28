import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useHabitStore } from './store';

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
