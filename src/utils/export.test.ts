import { describe, it, expect } from 'vitest';
import { generateCsvContent } from './export';
import type { ExportEntry } from '../store';

describe('generateCsvContent', () => {
    it('should generate correct headers', () => {
        const result = generateCsvContent([]);
        expect(result).toBe('Date,Habit Name,Status,Note');
    });

    it('should format entries correctly', () => {
        const entries: ExportEntry[] = [
            { date: '2025-01-01', habitName: 'Run', status: 'Completed', note: 'Good run' },
            { date: '2025-01-02', habitName: 'Read', status: 'Failed', note: '' }
        ];

        const result = generateCsvContent(entries);
        const lines = result.split('\n');

        expect(lines[0]).toBe('Date,Habit Name,Status,Note');
        expect(lines[1]).toBe('2025-01-01,Run,Completed,Good run');
        expect(lines[2]).toBe('2025-01-02,Read,Failed,');
    });

    it('should escape special characters', () => {
        const entries: ExportEntry[] = [
            {
                date: '2025-01-01',
                habitName: 'Read, Write',
                status: 'Completed',
                note: 'Read "The Hobbit"'
            }
        ];

        const result = generateCsvContent(entries);
        const lines = result.split('\n');

        // Expected: 2025-01-01,"Read, Write",Completed,"Read ""The Hobbit"""
        expect(lines[1]).toBe('2025-01-01,"Read, Write",Completed,"Read ""The Hobbit"""');
    });

    it('should handle newlines in fields', () => {
        const entries: ExportEntry[] = [
            {
                date: '2025-01-01',
                habitName: 'Journal',
                status: 'Completed',
                note: 'Line 1\nLine 2'
            }
        ];

        const result = generateCsvContent(entries);

        // Note: split('\n') might split the quoted newline too, so we check the raw string
        expect(result).toContain('"Line 1\nLine 2"');
    });
});
