import { describe, it, expect } from 'vitest';
import { toDateKey } from './date';

describe('toDateKey', () => {
  it('formats a local calendar day as yyyy-MM-dd', () => {
    // Month is 0-indexed in the Date constructor; local time by design.
    expect(toDateKey(new Date(2025, 0, 5))).toBe('2025-01-05');
    expect(toDateKey(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('zero-pads month and day', () => {
    expect(toDateKey(new Date(2025, 8, 9))).toBe('2025-09-09');
  });
});
