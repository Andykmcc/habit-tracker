import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useHabitStore } from './store';

// Mock localStorage
const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => {
            store[key] = value.toString();
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
        key: (i: number) => Object.keys(store)[i] || null,
        get length() { return Object.keys(store).length; }
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

describe('Export Data', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
    });

    it('should export all logs correctly', () => {
        const store = useHabitStore();

        // Create habits
        const habit1Id = store.createHabit('Habit 1');
        const habit2Id = store.createHabit('Habit 2');

        // Add logs for Habit 1
        store.setActiveHabit(habit1Id);
        store.upsertLog('2025-01-01', true, 'Start of year');
        store.upsertLog('2025-01-02', false);

        // Add logs for Habit 2
        store.setActiveHabit(habit2Id);
        store.upsertLog('2025-01-01', true);
        store.upsertLog('2025-02-01', null, 'Skipped month'); // Should be skipped status

        // Get all logs
        const logs = store.getAllLogs();

        // Verify count
        expect(logs.length).toBe(4);

        // Verify content (sorted by date descending)
        // 2025-02-01
        expect(logs[0]).toEqual({
            date: '2025-02-01',
            habitName: 'Habit 2',
            status: 'Skipped',
            note: 'Skipped month'
        });

        // 2025-01-02
        expect(logs[1]).toEqual({
            date: '2025-01-02',
            habitName: 'Habit 1',
            status: 'Failed',
            note: ''
        });

        // 2025-01-01 (order between habits on same day is not guaranteed by sort, but date is)
        const jan1Logs = logs.filter(l => l.date === '2025-01-01');
        expect(jan1Logs.length).toBe(2);

        const habit1Log = jan1Logs.find(l => l.habitName === 'Habit 1');
        expect(habit1Log).toEqual({
            date: '2025-01-01',
            habitName: 'Habit 1',
            status: 'Completed',
            note: 'Start of year'
        });

        const habit2Log = jan1Logs.find(l => l.habitName === 'Habit 2');
        expect(habit2Log).toEqual({
            date: '2025-01-01',
            habitName: 'Habit 2',
            status: 'Completed',
            note: ''
        });
    });

    it('should return empty array if no logs', () => {
        const store = useHabitStore();
        store.createHabit('Habit 1');

        const logs = store.getAllLogs();
        expect(logs).toEqual([]);
    });
});
