import { defineStore } from 'pinia';
import { useLocalStorage } from '@vueuse/core';
import { computed, ref, watch } from 'vue';

// Types
export interface DailyLog {
    status: boolean | null;
    note?: string;
}

export type DailyLogs = Record<string, DailyLog>; // date (YYYY-MM-DD) -> { status, note }

export interface ExportEntry {
    date: string;
    habitName: string;
    status: string;
    note: string;
}

export interface Habit {
    id: string;
    name: string;
    // logs are no longer stored here in the main object
    createdAt: string;
    color?: string;
}

// Constants
export const STORAGE_KEY_HABITS = 'habit-tracker-habits';
export const STORAGE_KEY_ACTIVE_HABIT = 'habit-tracker-active-habit-id';
export const STORAGE_KEY_MIGRATED = 'habit-tracker-migrated';
export const STORAGE_KEY_SCHEMA_VERSION = 'habit-tracker-schema-version';
export const CURRENT_SCHEMA_VERSION = 'v1';

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

// Helper: Get partition key
function getPartitionKey(habitId: string, year: number, month: number): string {
    // Month is 1-12
    const monthStr = month.toString().padStart(2, '0');
    return `habit:${habitId}:${year}:${monthStr}`;
}

// Migration function
export function migrateToPartitionedSchema(): void {
    const currentVersion = localStorage.getItem(STORAGE_KEY_SCHEMA_VERSION);
    if (currentVersion === CURRENT_SCHEMA_VERSION) return;

    // 1. Handle legacy single-habit migration first (if needed)
    const migratedLegacy = localStorage.getItem(STORAGE_KEY_MIGRATED);
    if (migratedLegacy !== 'true') {
        const oldLogsStr = localStorage.getItem(OLD_STORAGE_KEY_LOGS);
        const oldName = localStorage.getItem(OLD_STORAGE_KEY_ACTIVITY);
        if (oldLogsStr || oldName) {
            const habitId = generateId();
            const oldLogs = oldLogsStr ? JSON.parse(oldLogsStr) : {};
            const habit = {
                id: habitId,
                name: oldName || DEFAULT_ACTIVITY_NAME,
                logs: migrateLogs(oldLogs),
                createdAt: new Date().toISOString(),
            };
            // Save temporarily to habits key, will be partitioned in step 2
            const habits = { [habitId]: habit };
            localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(habits));
            localStorage.setItem(STORAGE_KEY_ACTIVE_HABIT, habitId);
            localStorage.removeItem(OLD_STORAGE_KEY_LOGS);
            localStorage.removeItem(OLD_STORAGE_KEY_ACTIVITY);
            localStorage.setItem(STORAGE_KEY_MIGRATED, 'true');
        }
    }

    // 2. Migrate from Monolithic Habit (with logs) to Partitioned
    const habitsStr = localStorage.getItem(STORAGE_KEY_HABITS);
    if (habitsStr) {
        const habits = JSON.parse(habitsStr);
        let hasChanges = false;

        for (const habitId in habits) {
            const habit = habits[habitId];
            if (habit.logs) {
                hasChanges = true;
                const logs = habit.logs as DailyLogs;

                // Group by Year-Month
                const partitions: Record<string, DailyLogs> = {};

                for (const [date, log] of Object.entries(logs)) {
                    const parts = date.split('-');
                    if (parts.length < 2) continue;
                    const year = parseInt(parts[0]!);
                    const month = parseInt(parts[1]!);
                    const key = getPartitionKey(habitId, year, month);

                    if (!partitions[key]) {
                        // Load existing if any
                        const existing = localStorage.getItem(key);
                        partitions[key] = existing ? JSON.parse(existing) : {};
                    }
                    partitions[key]![date] = log;
                }

                // Write partitions
                for (const [key, partitionLogs] of Object.entries(partitions)) {
                    localStorage.setItem(key, JSON.stringify(partitionLogs));
                }

                // Remove logs from habit object
                delete habit.logs;
            }
        }

        if (hasChanges) {
            localStorage.setItem(STORAGE_KEY_HABITS, JSON.stringify(habits));
        }
    }

    localStorage.setItem(STORAGE_KEY_SCHEMA_VERSION, CURRENT_SCHEMA_VERSION);
}

// Run migration before creating store
// migrateToPartitionedSchema(); // MOVED INSIDE defineStore

export const useHabitStore = defineStore('habit', () => {
    // Run migration on store initialization
    migrateToPartitionedSchema();

    // State
    const habits = useLocalStorage<Record<string, Habit>>(STORAGE_KEY_HABITS, {});
    const activeHabitId = useLocalStorage<string | null>(STORAGE_KEY_ACTIVE_HABIT, null);

    // Logs are now loaded into memory for the active habit
    const logs = ref<DailyLogs>({});

    // Computed: Get active habit
    const activeHabit = computed(() => {
        if (!activeHabitId.value) return null;
        return habits.value[activeHabitId.value] || null;
    });

    // Computed: Get active habit's name
    const activityName = computed(() => activeHabit.value?.name || DEFAULT_ACTIVITY_NAME);

    // Load logs for a habit
    const loadLogs = (habitId: string) => {
        logs.value = {};
        if (!habitId) return;

        // Scan localStorage for keys matching `habit:${habitId}:*`
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`habit:${habitId}:`)) {
                try {
                    const partitionLogs = JSON.parse(localStorage.getItem(key) || '{}');
                    Object.assign(logs.value, partitionLogs);
                } catch (e) {
                    console.error(`Failed to parse logs for key ${key}`, e);
                }
            }
        }
    };

    // Watch active habit to load logs
    watch(activeHabitId, (newId) => {
        if (newId) {
            loadLogs(newId);
        } else {
            logs.value = {};
        }
    }, { immediate: true });

    // Actions
    const createHabit = (name: string): string => {
        const habitId = generateId();
        const habit: Habit = {
            id: habitId,
            name,
            createdAt: new Date().toISOString(),
        };
        habits.value = { ...habits.value, [habitId]: habit };

        // Set as active if no active habit
        if (!activeHabitId.value) {
            activeHabitId.value = habitId;
            loadLogs(habitId);
        }

        return habitId;
    };

    const deleteHabit = (id: string): void => {
        const newHabits = { ...habits.value };
        delete newHabits[id];
        habits.value = newHabits;

        // Delete partitioned data
        const keysToDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`habit:${id}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(k => localStorage.removeItem(k));

        // If deleting active habit, switch to another or null
        if (activeHabitId.value === id) {
            const remainingIds = Object.keys(newHabits);
            const newActiveId = remainingIds.length > 0 ? remainingIds[0] : null;
            activeHabitId.value = newActiveId;
            if (newActiveId) {
                loadLogs(newActiveId);
            } else {
                logs.value = {};
            }
        }
    };

    const setActiveHabit = (id: string): void => {
        if (habits.value[id]) {
            activeHabitId.value = id;
            loadLogs(id);
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

    const updateLog = (date: string, updateFn: (existing: DailyLog) => DailyLog) => {
        if (!activeHabit.value) return;
        const habitId = activeHabit.value.id;

        // Update in-memory
        const existing = logs.value[date] || { status: null };
        const updated = updateFn(existing);
        logs.value = { ...logs.value, [date]: updated };

        // Update storage
        const parts = date.split('-');
        if (parts.length < 2) return;
        const year = parseInt(parts[0]!);
        const month = parseInt(parts[1]!);
        const key = getPartitionKey(habitId, year, month);

        const partitionStr = localStorage.getItem(key);
        const partition = partitionStr ? JSON.parse(partitionStr) : {};
        partition[date] = updated;
        localStorage.setItem(key, JSON.stringify(partition));
    };

    const upsertLog = (date: string, status: boolean | null, note?: string): void => {
        updateLog(date, (existing) => ({
            status,
            note: note !== undefined ? note : existing.note,
        }));
    };

    const setNote = (date: string, note: string): void => {
        updateLog(date, (existing) => ({
            status: existing.status ?? null,
            note: note || undefined, // Clear note if empty string
        }));
    };

    const clearAllLogs = (): void => {
        if (!activeHabit.value) return;
        const habitId = activeHabit.value.id;

        // Clear in-memory
        logs.value = {};

        // Clear storage
        const keysToDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`habit:${habitId}:`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(k => localStorage.removeItem(k));
    };

    const getAllLogs = (): ExportEntry[] => {
        const allEntries: ExportEntry[] = [];

        for (const habit of Object.values(habits.value)) {
            // Scan localStorage for keys matching `habit:${habit.id}:*`
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(`habit:${habit.id}:`)) {
                    try {
                        const partitionLogs = JSON.parse(localStorage.getItem(key) || '{}') as DailyLogs;
                        for (const [date, log] of Object.entries(partitionLogs)) {
                            let statusStr = 'Skipped';
                            if (log.status === true) statusStr = 'Completed';
                            if (log.status === false) statusStr = 'Failed';

                            allEntries.push({
                                date,
                                habitName: habit.name,
                                status: statusStr,
                                note: log.note || '',
                            });
                        }
                    } catch (e) {
                        console.error(`Failed to parse logs for key ${key}`, e);
                    }
                }
            }
        }

        // Sort by date descending
        return allEntries.sort((a, b) => b.date.localeCompare(a.date));
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
        getAllLogs,
    };
});
