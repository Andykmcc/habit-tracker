import { defineStore } from 'pinia';
import { useLocalStorage } from '@vueuse/core';

// Types
export type DailyLogs = Record<string, boolean | null>; // date (YYYY-MM-DD) -> completed (true), failed (false), or skipped (null/undefined)

// Constants
const STORAGE_KEY_LOGS = 'habit-tracker-logs';
const STORAGE_KEY_ACTIVITY = 'habit-tracker-activity-name';
const DEFAULT_ACTIVITY_NAME = 'Daily Habit';

export const useHabitStore = defineStore('habit', () => {
    // State - using useLocalStorage for automatic persistence
    const logs = useLocalStorage<DailyLogs>(STORAGE_KEY_LOGS, {});
    const activityName = useLocalStorage<string>(STORAGE_KEY_ACTIVITY, DEFAULT_ACTIVITY_NAME);

    // Actions
    const setActivityName = (name: string) => {
        activityName.value = name;
    };

    const upsertLog = (date: string, status: boolean | null) => {
        logs.value = { ...logs.value, [date]: status };
    };

    const clearAllLogs = () => {
        logs.value = {};
    };

    return {
        // State
        logs,
        activityName,

        // Actions
        setActivityName,
        upsertLog,
        clearAllLogs,
    };
});
