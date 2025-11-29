import { defineStore } from 'pinia';
import { useLocalStorage } from '@vueuse/core';
import { computed } from 'vue';

// Types
export type DailyLogs = Record<string, boolean | null>; // date (YYYY-MM-DD) -> completed (true), failed (false), or skipped (null/undefined)

export interface Habit {
    id: string;
    name: string;
    logs: DailyLogs;
    createdAt: string;
    color?: string;
}

// Constants
const STORAGE_KEY_HABITS = 'habit-tracker-habits';
const STORAGE_KEY_ACTIVE_HABIT = 'habit-tracker-active-habit-id';
const STORAGE_KEY_MIGRATED = 'habit-tracker-migrated';
// Old storage keys (for migration)
const OLD_STORAGE_KEY_LOGS = 'habit-tracker-logs';
const OLD_STORAGE_KEY_ACTIVITY = 'habit-tracker-activity-name';
const DEFAULT_ACTIVITY_NAME = 'Daily Habit';

// Helper: Generate unique ID
function generateId(): string {
    return `habit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Migration function
function migrateFromSingleHabit(): void {
    // Check if already migrated
    const migrated = localStorage.getItem(STORAGE_KEY_MIGRATED);
    if (migrated === 'true') return;

    // Get old data
    const oldLogsStr = localStorage.getItem(OLD_STORAGE_KEY_LOGS);
    const oldName = localStorage.getItem(OLD_STORAGE_KEY_ACTIVITY);

    // If old data exists, migrate it
    if (oldLogsStr || oldName) {
        const habitId = generateId();
        const habit: Habit = {
            id: habitId,
            name: oldName || DEFAULT_ACTIVITY_NAME,
            logs: oldLogsStr ? JSON.parse(oldLogsStr) : {},
            createdAt: new Date().toISOString(),
        };

        // Save migrated data in new format
        const habits = { [habitId]: habit };
        localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(habits));
        localStorage.setItem(STORAGE_KEY_ACTIVE_HABIT, habitId);

        // Remove old data
        localStorage.removeItem(OLD_STORAGE_KEY_LOGS);
        localStorage.removeItem(OLD_STORAGE_KEY_ACTIVITY);
    }

    // Mark as migrated
    localStorage.setItem(STORAGE_KEY_MIGRATED, 'true');
}

// Run migration before creating store
migrateFromSingleHabit();

export const useHabitStore = defineStore('habit', () => {
    // State - using useLocalStorage for automatic persistence
    const habits = useLocalStorage<Record<string, Habit>>(STORAGE_KEY_HABITS, {});
    const activeHabitId = useLocalStorage<string | null>(STORAGE_KEY_ACTIVE_HABIT, null);

    // Computed: Get active habit
    const activeHabit = computed(() => {
        if (!activeHabitId.value) return null;
        return habits.value[activeHabitId.value] || null;
    });

    // Computed: Get active habit's logs (for backward compatibility)
    const logs = computed(() => activeHabit.value?.logs || {});

    // Computed: Get active habit's name (for backward compatibility)
    const activityName = computed(() => activeHabit.value?.name || DEFAULT_ACTIVITY_NAME);

    // Actions
    const createHabit = (name: string): string => {
        const habitId = generateId();
        const habit: Habit = {
            id: habitId,
            name,
            logs: {},
            createdAt: new Date().toISOString(),
        };
        habits.value = { ...habits.value, [habitId]: habit };

        // Set as active if no active habit
        if (!activeHabitId.value) {
            activeHabitId.value = habitId;
        }

        return habitId;
    };

    const deleteHabit = (id: string): void => {
        const newHabits = { ...habits.value };
        delete newHabits[id];
        habits.value = newHabits;

        // If deleting active habit, switch to another or null
        if (activeHabitId.value === id) {
            const remainingIds = Object.keys(newHabits);
            activeHabitId.value = remainingIds.length > 0 ? remainingIds[0] : null;
        }
    };

    const setActiveHabit = (id: string): void => {
        if (habits.value[id]) {
            activeHabitId.value = id;
        }
    };

    const setActivityName = (name: string): void => {
        if (!activeHabit.value) return;

        habits.value = {
            ...habits.value,
            [activeHabit.value.id]: {
                ...activeHabit.value,
                name,
            },
        };
    };

    const upsertLog = (date: string, status: boolean | null): void => {
        if (!activeHabit.value) return;

        habits.value = {
            ...habits.value,
            [activeHabit.value.id]: {
                ...activeHabit.value,
                logs: { ...activeHabit.value.logs, [date]: status },
            },
        };
    };

    const clearAllLogs = (): void => {
        if (!activeHabit.value) return;

        habits.value = {
            ...habits.value,
            [activeHabit.value.id]: {
                ...activeHabit.value,
                logs: {},
            },
        };
    };

    return {
        // State
        habits,
        activeHabitId,
        activeHabit,
        logs,
        activityName,

        // Actions
        createHabit,
        deleteHabit,
        setActiveHabit,
        setActivityName,
        upsertLog,
        clearAllLogs,
    };
});
