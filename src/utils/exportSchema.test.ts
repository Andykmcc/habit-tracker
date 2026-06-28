import { describe, it, expect } from 'vitest';
import { encodeSnapshot, decodeCsv, ImportError, CURRENT_SCHEMA_VERSION } from './exportSchema';
import type { Snapshot } from '../store';

const sample: Snapshot = {
  habits: {
    h1: { id: 'h1', name: 'Run', createdAt: '2026-01-01T08:00:00.000Z', color: '#22c55e', positiveLabel: 'Ran', negativeLabel: 'Missed' },
    h2: { id: 'h2', name: 'Read', createdAt: '2026-02-15T08:00:00.000Z' },
    h3: { id: 'h3', name: 'Meditate', createdAt: '2026-03-01T08:00:00.000Z' }, // zero logs
  },
  logs: {
    h1: { '2026-06-01': { status: true, note: 'Good run' }, '2026-06-02': { status: false } },
    h2: { '2026-06-01': { status: null, note: 'Read "The Hobbit"\nat night' } },
  },
};

describe('encode/decode round-trip', () => {
  it('preserves habits (incl. color/labels/createdAt), logs, and zero-log habits', () => {
    const csv = encodeSnapshot(sample);
    const { snapshot, version, warnings } = decodeCsv(csv);
    expect(version).toBe(CURRENT_SCHEMA_VERSION);
    expect(warnings).toEqual([]);
    expect(snapshot.habits).toEqual(sample.habits);
    expect(snapshot.logs).toEqual(sample.logs);
  });

  it('emits the normative v2 header as the first line', () => {
    const csv = encodeSnapshot(sample);
    expect(csv.split('\n')[0]).toBe(
      'Schema Version,Habit ID,Habit Name,Created At,Color,Positive Label,Negative Label,Date,Status,Note'
    );
  });

  it('round-trips each status value exactly', () => {
    const snap: Snapshot = {
      habits: { a: { id: 'a', name: 'A', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { a: { '2026-01-01': { status: true }, '2026-01-02': { status: false }, '2026-01-03': { status: null } } },
    };
    expect(decodeCsv(encodeSnapshot(snap)).snapshot.logs).toEqual(snap.logs);
  });
});

describe('decodeCsv errors', () => {
  const v2Row = (over: Partial<Record<string, string>> = {}) => {
    const f = { ver: '2', id: 'h1', name: 'Run', created: '2026-01-01T00:00:00.000Z', color: '', pos: '', neg: '', date: '2026-06-01', status: 'Completed', note: '', ...over };
    return [
      'Schema Version,Habit ID,Habit Name,Created At,Color,Positive Label,Negative Label,Date,Status,Note',
      `${f.ver},${f.id},${f.name},${f.created},${f.color},${f.pos},${f.neg},${f.date},${f.status},${f.note}`,
    ].join('\n');
  };

  it('EMPTY for empty / whitespace-only input', () => {
    expect(() => decodeCsv('')).toThrow(ImportError);
    expect(() => decodeCsv('   \n ')).toThrow(expect.objectContaining({ code: 'EMPTY' }));
  });

  it('UNRECOGNIZED for an unknown header', () => {
    expect(() => decodeCsv('foo,bar\n1,2')).toThrow(expect.objectContaining({ code: 'UNRECOGNIZED' }));
  });

  it('NEWER_VERSION when the schema version exceeds the current one', () => {
    expect(() => decodeCsv(v2Row({ ver: '3' }))).toThrow(expect.objectContaining({ code: 'NEWER_VERSION' }));
  });

  it('MALFORMED for a non-integer schema version', () => {
    expect(() => decodeCsv(v2Row({ ver: 'x' }))).toThrow(expect.objectContaining({ code: 'MALFORMED' }));
  });

  it('MALFORMED for a missing Habit ID', () => {
    expect(() => decodeCsv(v2Row({ id: '' }))).toThrow(expect.objectContaining({ code: 'MALFORMED' }));
  });

  it('MALFORMED for an invalid Date', () => {
    expect(() => decodeCsv(v2Row({ date: '2026-13-99' }))).toThrow(expect.objectContaining({ code: 'MALFORMED' }));
  });

  it('MALFORMED for an invalid Status', () => {
    expect(() => decodeCsv(v2Row({ status: 'Done' }))).toThrow(expect.objectContaining({ code: 'MALFORMED' }));
  });

  it('warns (not throws) on an invalid Created At and defaults it', () => {
    const { snapshot, warnings } = decodeCsv(v2Row({ created: 'not-a-date' }));
    expect(warnings.length).toBeGreaterThan(0);
    expect(typeof snapshot.habits.h1!.createdAt).toBe('string');
    expect(snapshot.habits.h1!.createdAt).not.toBe('not-a-date');
  });

  it('warns when one Habit ID appears with conflicting metadata (first wins)', () => {
    const csv = [
      'Schema Version,Habit ID,Habit Name,Created At,Color,Positive Label,Negative Label,Date,Status,Note',
      '2,h1,Run,2026-01-01T00:00:00.000Z,,,,2026-06-01,Completed,',
      '2,h1,Jog,2026-01-01T00:00:00.000Z,,,,2026-06-02,Completed,',
    ].join('\n');
    const { snapshot, warnings } = decodeCsv(csv);
    expect(snapshot.habits.h1!.name).toBe('Run');
    expect(warnings.some(w => w.includes('h1'))).toBe(true);
  });
});
