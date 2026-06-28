import { describe, it, expect } from 'vitest';
import { parseRows, serializeRows } from './csv';

describe('serializeRows', () => {
  it('joins plain rows with commas and newlines', () => {
    expect(serializeRows([['a', 'b'], ['c', 'd']])).toBe('a,b\nc,d');
  });

  it('quotes fields containing comma, quote, or newline', () => {
    expect(serializeRows([['a,b', 'c"d', 'e\nf']]))
      .toBe('"a,b","c""d","e\nf"');
  });
});

describe('parseRows', () => {
  it('parses plain rows', () => {
    expect(parseRows('a,b\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('parses quoted fields with commas, escaped quotes, and newlines', () => {
    expect(parseRows('"a,b","c""d","e\nf"')).toEqual([['a,b', 'c"d', 'e\nf']]);
  });

  it('strips a leading BOM', () => {
    expect(parseRows(String.fromCharCode(0xFEFF) + 'a,b')).toEqual([['a', 'b']]);
  });

  it('handles CRLF line endings', () => {
    expect(parseRows('a,b\r\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('keeps trailing empty fields but drops a final newline', () => {
    expect(parseRows('a,b,\n')).toEqual([['a', 'b', '']]);
  });

  it('skips fully blank lines', () => {
    expect(parseRows('a,b\n\nc,d')).toEqual([['a', 'b'], ['c', 'd']]);
  });

  it('round-trips through serialize for tricky values', () => {
    const rows = [['1', 'Read, Write', 'Note "x"\nline2'], ['2', '✓', '']];
    expect(parseRows(serializeRows(rows))).toEqual(rows);
  });

  it('throws on an unterminated quoted field', () => {
    expect(() => parseRows('"abc')).toThrow('Unterminated quoted field');
  });

  it('preserves a single quoted empty field (distinct from a blank line)', () => {
    expect(parseRows('""')).toEqual([['']]);
  });

  it('returns [] for empty input', () => {
    expect(parseRows('')).toEqual([]);
  });
});
