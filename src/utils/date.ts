import { format } from 'date-fns';

// The canonical log-key format: a calendar day rendered as `yyyy-MM-dd`.
// This is the contract between the UI and the store's per-day log keys
// (see DailyLogs in store.ts), so it lives in one place.
export const toDateKey = (date: Date): string => format(date, 'yyyy-MM-dd');
