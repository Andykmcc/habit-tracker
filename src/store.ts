import { defineStore } from 'pinia';
import { useLocalStorage } from '@vueuse/core';
import { computed, ref, watch } from 'vue';
import { decodeCsv } from './utils/exportSchema';
import { mergeSnapshots, reconcileLegacyHabitIds } from './utils/importMerge';
import type { ImportOptions, MergeCounts } from './utils/importMerge';

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
    label: string;
    note: string;
}

export interface Snapshot {
    habits: Record<string, Habit>;   // habitId -> Habit
    logs: Record<string, DailyLogs>; // habitId -> { date -> DailyLog }
}

export type ImportSummary = MergeCounts & { warnings: string[] };

export interface Habit {
    id: string;
    name: string;
    // logs are no longer stored here in the main object
    createdAt: string;
    color?: string;
    positiveLabel?: string;
    negativeLabel?: string;
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

    const setCustomLabels = (positiveLabel: string, negativeLabel: string): void => {
        if (!activeHabit.value) return;

        habits.value = {
            ...habits.value,
            [activeHabit.value.id]: {
                ...activeHabit.value,
                positiveLabel: positiveLabel || undefined,
                negativeLabel: negativeLabel || undefined,
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
                            let labelStr = '';
                            if (log.status === true) {
                                statusStr = 'Completed';
                                labelStr = habit.positiveLabel || '✓';
                            }
                            if (log.status === false) {
                                statusStr = 'Failed';
                                labelStr = habit.negativeLabel || '✕';
                            }

                            allEntries.push({
                                date,
                                habitName: habit.name,
                                status: statusStr,
                                label: labelStr,
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

    const getFullSnapshot = (): Snapshot => {
        const habitsCopy: Record<string, Habit> = {};
        for (const [id, h] of Object.entries(habits.value)) {
            habitsCopy[id] = { ...h };
        }

        const logsByHabit: Record<string, DailyLogs> = {};
        for (const habit of Object.values(habits.value)) {
            const habitLogs: DailyLogs = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(`habit:${habit.id}:`)) {
                    try {
                        const partition = JSON.parse(localStorage.getItem(key) || '{}') as DailyLogs;
                        Object.assign(habitLogs, partition);
                    } catch (e) {
                        console.error(`Failed to parse logs for key ${key}`, e);
                    }
                }
            }
            if (Object.keys(habitLogs).length > 0) {
                logsByHabit[habit.id] = habitLogs;
            }
        }

        return { habits: habitsCopy, logs: logsByHabit };
    };

    const replaceAllData = (snapshot: Snapshot): void => {
        // 1. Remove every existing log partition (keys "habit:<id>:<y>:<m>").
        const keysToDelete: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('habit:')) keysToDelete.push(key);
        }
        keysToDelete.forEach(k => localStorage.removeItem(k));

        // 2. Write the snapshot's logs back into partitions.
        for (const [habitId, habitLogs] of Object.entries(snapshot.logs)) {
            const partitions: Record<string, DailyLogs> = {};
            for (const [date, log] of Object.entries(habitLogs)) {
                const parts = date.split('-');
                if (parts.length < 2) continue;
                const year = parseInt(parts[0]!);
                const month = parseInt(parts[1]!);
                const pKey = getPartitionKey(habitId, year, month);
                (partitions[pKey] ||= {})[date] = log;
            }
            for (const [pKey, part] of Object.entries(partitions)) {
                localStorage.setItem(pKey, JSON.stringify(part));
            }
        }

        // 3. Replace the habits map.
        habits.value = { ...snapshot.habits };

        // 4. Reconcile the active habit and reload its in-memory logs.
        const ids = Object.keys(snapshot.habits);
        if (activeHabitId.value && snapshot.habits[activeHabitId.value]) {
            loadLogs(activeHabitId.value);
        } else if (ids.length > 0) {
            activeHabitId.value = ids[0]!;
            loadLogs(ids[0]!);
        } else {
            activeHabitId.value = null;
            logs.value = {};
        }
    };

    const buildImport = (text: string, options: ImportOptions): { result: Snapshot; summary: ImportSummary } => {
        const decoded = decodeCsv(text); // throws ImportError on bad input
        const localSnapshot = getFullSnapshot();
        const importedSnapshot = decoded.version === 1
            ? reconcileLegacyHabitIds(decoded.snapshot, localSnapshot)
            : decoded.snapshot;
        const { result, counts } = mergeSnapshots(localSnapshot, importedSnapshot, options);
        return { result, summary: { ...counts, warnings: decoded.warnings } };
    };

    const previewImport = (text: string, options: ImportOptions): ImportSummary =>
        buildImport(text, options).summary;

    const importCsv = (text: string, options: ImportOptions): ImportSummary => {
        const { result, summary } = buildImport(text, options);
        replaceAllData(result);
        return summary;
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
        setCustomLabels,
        upsertLog,
        setNote,
        clearAllLogs,
        getAllLogs,
        getFullSnapshot,
        replaceAllData,
        previewImport,
        importCsv,
    };
});
