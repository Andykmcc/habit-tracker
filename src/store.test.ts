import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useHabitStore } from './store';

describe('useHabitStore', () => {
    beforeEach(() => {
        // Create a fresh pinia instance before each test
        setActivePinia(createPinia());

        // Clear localStorage before each test
        localStorage.clear();
    });

    it('should set activity name', () => {
        const store = useHabitStore();

        // Initially should have default value
        expect(store.activityName).toBe('Daily Habit');

        // Set new activity name
        store.setActivityName('Morning Exercise');

        // Verify the change
        expect(store.activityName).toBe('Morning Exercise');
    });

    it('should upsert log entries', () => {
        const store = useHabitStore();

        // Initially logs should be empty
        expect(store.logs).toEqual({});

        // Add a completed entry
        store.upsertLog('2025-11-28', true);
        expect(store.logs['2025-11-28']).toBe(true);

        // Add a failed entry
        store.upsertLog('2025-11-27', false);
        expect(store.logs['2025-11-27']).toBe(false);

        // Add a null entry (cleared)
        store.upsertLog('2025-11-26', null);
        expect(store.logs['2025-11-26']).toBe(null);

        // Update an existing entry
        store.upsertLog('2025-11-28', false);
        expect(store.logs['2025-11-28']).toBe(false);

        // Verify all entries are present
        expect(Object.keys(store.logs).length).toBe(3);
    });

    it('should clear all logs', () => {
        const store = useHabitStore();

        // Add some logs first
        store.upsertLog('2025-11-28', true);
        store.upsertLog('2025-11-27', false);
        store.upsertLog('2025-11-26', null);

        // Verify logs exist
        expect(Object.keys(store.logs).length).toBe(3);

        // Clear all logs
        store.clearAllLogs();

        // Verify logs are empty
        expect(store.logs).toEqual({});
        expect(Object.keys(store.logs).length).toBe(0);
    });
});
