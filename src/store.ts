import { defineStore } from 'pinia';
import { useLocalStorage } from '@vueuse/core';
import { computed } from 'vue';

// Types
export interface DailyLog {
    status: boolean | null;
    note?: string;
}

export type DailyLogs = Record<string, DailyLog>; // date (YYYY-MM-DD) -> { status, note }

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

// Helper: Migrate logs from old format (boolean | null) to new format ({ status, note })
function migrateLogs(logs: any): DailyLogs {
    const migratedLogs: DailyLogs = {};
    for (const [date, value] of Object.entries(logs)) {
        // If value is already an object with status, keep it
        if (typeof value === 'object' && value !== null && 'status' in value) {
            migratedLogs[date] = value as DailyLog;
        } else {
            // Convert boolean/null to new format
            migratedLogs[date] = { status: value as boolean | null };
        }
    }
    return migratedLogs;
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
        const oldLogs = oldLogsStr ? JSON.parse(oldLogsStr) : {};
        const habit: Habit = {
            id: habitId,
            name: oldName || DEFAULT_ACTIVITY_NAME,
            logs: migrateLogs(oldLogs),
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
    const habits = useLocalStorage<Record<string, Habit>>(STORAGE_KEY_HABITS, {}, {
        serializer: {
            read: (v: any) => {
                const parsed = JSON.parse(v);
                // Migrate existing habits to new log format
                for (const habitId in parsed) {
                    if (parsed[habitId].logs) {
                        parsed[habitId].logs = migrateLogs(parsed[habitId].logs);
                    }
                }
                return parsed;
            },
            write: (v: any) => JSON.stringify(v),
        },
    });
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

    const upsertLog = (date: string, status: boolean | null, note?: string): void => {
        if (!activeHabit.value) return;

        const existingLog = activeHabit.value.logs[date];
        const updatedLog: DailyLog = {
            status,
            note: note !== undefined ? note : existingLog?.note,
        };

        habits.value = {
            ...habits.value,
            [activeHabit.value.id]: {
                ...activeHabit.value,
                logs: { ...activeHabit.value.logs, [date]: updatedLog },
            },
        };
    };

    const setNote = (date: string, note: string): void => {
        if (!activeHabit.value) return;

        const existingLog = activeHabit.value.logs[date];
        const updatedLog: DailyLog = {
            status: existingLog?.status ?? null,
            note: note || undefined, // Clear note if empty string
        };

        habits.value = {
            ...habits.value,
            [activeHabit.value.id]: {
                ...activeHabit.value,
                logs: { ...activeHabit.value.logs, [date]: updatedLog },
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
        setNote,
        clearAllLogs,
    };
});
