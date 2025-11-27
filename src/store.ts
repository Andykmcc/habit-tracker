import { BehaviorSubject } from 'rxjs';

// Types
export type DailyLogs = Record<string, boolean | null>; // date (YYYY-MM-DD) -> completed (true), failed (false), or skipped (null/undefined)

// Constants
const STORAGE_KEY_LOGS = 'habit-tracker-logs';
const STORAGE_KEY_ACTIVITY = 'habit-tracker-activity-name';
const DEFAULT_ACTIVITY_NAME = 'Daily Habit';

// State
const logsSubject$ = new BehaviorSubject<DailyLogs>({});
const activityNameSubject$ = new BehaviorSubject<string>(DEFAULT_ACTIVITY_NAME);

// Internal helper to save to localStorage
const saveState = () => {
    localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(logsSubject$.value));
    localStorage.setItem(STORAGE_KEY_ACTIVITY, activityNameSubject$.value);
};

// Exported Functions

export const initStore = () => {
    const storedLogs = localStorage.getItem(STORAGE_KEY_LOGS);
    if (storedLogs) {
        try {
            logsSubject$.next(JSON.parse(storedLogs));
        } catch (e) {
            console.error('Failed to parse logs from localStorage', e);
        }
    }

    const storedActivity = localStorage.getItem(STORAGE_KEY_ACTIVITY);
    if (storedActivity) {
        activityNameSubject$.next(storedActivity);
    }
};

export const getActivityNameObservable = () => {
    return activityNameSubject$.asObservable();
};

export const setActivityName = (name: string) => {
    activityNameSubject$.next(name);
    saveState();
};

export const getLogsObservable = () => {
    return logsSubject$.asObservable();
};

export const upsertLog = (date: string, status: boolean | null) => {
    const currentLogs = logsSubject$.value;
    const newLogs = { ...currentLogs, [date]: status };
    logsSubject$.next(newLogs);
    saveState();
};

export const clearAllLogs = () => {
    logsSubject$.next({});
    saveState();
};

// Derived Statistics Observables (Optional, can be done in component or here)
// For simplicity, we'll expose the raw logs and let the component/composables calculate stats,
// or we could add helper selectors here.
