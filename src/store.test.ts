import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useHabitStore } from './store';

describe('useHabitStore', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
    });

    it('should create a habit and set it as active', () => {
        const store = useHabitStore();

        // Create a habit
        const habitId = store.createHabit('Morning Routine');

        // Verify habit was created
        expect(store.habits[habitId]).toBeDefined();
        expect(store.habits[habitId]!.name).toBe('Morning Routine');

        // Verify it's set as active
        expect(store.activeHabitId).toBe(habitId);
        expect(store.activityName).toBe('Morning Routine');
    });

    it('should set activity name', () => {
        const store = useHabitStore();

        // Create a habit first
        store.createHabit('Daily Habit');

        // Change the name
        store.setActivityName('Morning Exercise');

        // Verify the change
        expect(store.activityName).toBe('Morning Exercise');
    });

    it('should upsert log entries', () => {
        const store = useHabitStore();

        // Create a habit first
        store.createHabit('Daily Habit');

        expect(store.logs).toEqual({});

        // Add a completed entry
        store.upsertLog('2025-11-28', true);
        expect(store.logs['2025-11-28']).toBe(true);

        // Add a failed entry
        store.upsertLog('2025-11-29', false);
        expect(store.logs['2025-11-29']).toBe(false);

        // Update existing entry
        store.upsertLog('2025-11-28', false);
        expect(store.logs['2025-11-28']).toBe(false);

        // Clear an entry
        store.upsertLog('2025-11-29', null);
        expect(store.logs['2025-11-29']).toBe(null);
    });

    it('should clear all logs', () => {
        const store = useHabitStore();

        // Create a habit first
        store.createHabit('Daily Habit');

        // Add some logs
        store.upsertLog('2025-11-28', true);
        store.upsertLog('2025-11-29', false);
        store.upsertLog('2025-11-30', true);

        // Verify logs exist
        expect(Object.keys(store.logs).length).toBe(3);

        // Clear all logs
        store.clearAllLogs();

        // Verify logs are empty
        expect(store.logs).toEqual({});
    });

    it('should switch between habits', () => {
        const store = useHabitStore();

        // Create two habits
        const habit1 = store.createHabit('Morning Exercise');
        const habit2 = store.createHabit('Evening Meditation');

        // Add logs to first habit
        store.setActiveHabit(habit1);
        store.upsertLog('2025-11-28', true);

        // Switch to second habit
        store.setActiveHabit(habit2);
        expect(store.activityName).toBe('Evening Meditation');
        expect(Object.keys(store.logs).length).toBe(0); // No logs yet

        // Add logs to second habit
        store.upsertLog('2025-11-28', false);
        expect(store.logs['2025-11-28']).toBe(false);

        // Switch back to first habit
        store.setActiveHabit(habit1);
        expect(store.logs['2025-11-28']).toBe(true); // Original log preserved
    });

    it('should delete a habit and switch to another', () => {
        const store = useHabitStore();

        // Create two habits
        const habit1 = store.createHabit('Habit 1');
        const habit2 = store.createHabit('Habit 2');

        store.setActiveHabit(habit1);
        expect(store.activeHabitId).toBe(habit1);

        // Delete active habit
        store.deleteHabit(habit1);

        // Should auto-switch to remaining habit
        expect(store.activeHabitId).toBe(habit2);
        expect(store.activityName).toBe('Habit 2');
    });
});
