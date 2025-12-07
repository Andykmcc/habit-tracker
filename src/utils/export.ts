import type { ExportEntry } from '../store';

export const generateCsvContent = (logs: ExportEntry[]): string => {
    // CSV Header
    const headers = ['Date', 'Habit Name', 'Status', 'Note'];

    const rows = logs.map(log => {
        // Escape quotes and wrap in quotes if necessary
        const escape = (str: string) => {
            if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                return `"${str.replace(/"/g, '""')}"`;
            }
            return str;
        };

        return [
            escape(log.date),
            escape(log.habitName),
            escape(log.status),
            escape(log.note)
        ].join(',');
    });

    return [headers.join(','), ...rows].join('\n');
};
