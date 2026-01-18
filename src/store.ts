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

const DEFAULT_ACTIVITY_NAME = 'Daily Habit';

// Helper: Generate unique ID
function generateId(): string {
    return `habit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}



// Helper: Get partition key
function getPartitionKey(habitId: string, year: number, month: number): string {
    // Month is 1-12
    const monthStr = month.toString().padStart(2, '0');
    return `habit:${habitId}:${year}:${monthStr}`;
}



// Run migration before creating store
// migrateToPartitionedSchema(); // MOVED INSIDE defineStore

export const useHabitStore = defineStore('habit', () => {


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
