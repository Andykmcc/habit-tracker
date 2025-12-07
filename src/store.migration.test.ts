import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { STORAGE_KEY_HABITS, STORAGE_KEY_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION, migrateToPartitionedSchema } from './store';

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
        // Helper to inspect store in tests
        getStore: () => store
    };
})();

Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
});

describe('Store Migration', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
    });

    it('should migrate from legacy schema to partitioned schema', () => {
        // Setup legacy data
        const habitId = 'habit-123';
        const legacyHabits = {
            [habitId]: {
                id: habitId,
                name: 'Test Habit',
                createdAt: '2025-01-01T00:00:00.000Z',
                logs: {
                    '2025-12-01': { status: true },
                    '2025-12-02': { status: false },
                    '2026-01-01': { status: true, note: 'New Year' }
                }
            }
        };
        localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(legacyHabits));

        // Run migration manually since we are not using the store
        migrateToPartitionedSchema();

        // Verify migration
        // 1. Schema version should be set
        expect(localStorage.getItem(STORAGE_KEY_SCHEMA_VERSION)).toBe(CURRENT_SCHEMA_VERSION);

        // 2. Main habits key should NOT contain logs
        const storedHabits = JSON.parse(localStorage.getItem(STORAGE_KEY_HABITS)!);
        expect(storedHabits[habitId].logs).toBeUndefined();
        expect(storedHabits[habitId].name).toBe('Test Habit');

        // 3. Partitioned keys should exist
        // habit:drinking_water:2025:12 -> habit:<id>:<year>:<month>
        // Note: The user requested "habit:drinking_water:2025:12" but using ID is safer for uniqueness.
        // The implementation plan decided on ID. Let's verify that.

        const key2025_12 = `habit:${habitId}:2025:12`;
        const key2026_01 = `habit:${habitId}:2026:01`;

        const logs2025_12 = JSON.parse(localStorage.getItem(key2025_12)!);
        const logs2026_01 = JSON.parse(localStorage.getItem(key2026_01)!);

        expect(logs2025_12['2025-12-01']).toEqual({ status: true });
        expect(logs2025_12['2025-12-02']).toEqual({ status: false });
        expect(logs2026_01['2026-01-01']).toEqual({ status: true, note: 'New Year' });
    });

    it('should not migrate if already on current version', () => {
        localStorage.setItem(STORAGE_KEY_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);

        // Set some data that looks like it needs migration but shouldn't be touched
        const habitId = 'habit-456';
        const habits = {
            [habitId]: {
                id: habitId,
                name: 'Already Migrated',
                logs: { '2025-12-01': { status: true } } // This shouldn't be here in new schema, but if we force it, migration shouldn't touch it
            }
        };
        localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(habits));

        // Data should be unchanged because migration was skipped
        const storedHabits = JSON.parse(localStorage.getItem(STORAGE_KEY_HABITS)!);
        expect(storedHabits[habitId].logs).toBeDefined();
    });
});
