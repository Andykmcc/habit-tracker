import type { Snapshot, Habit, DailyLogs } from '../store';
import { parseRows, serializeRows } from './csv';

export const CURRENT_SCHEMA_VERSION = 2;

export type ImportErrorCode = 'EMPTY' | 'UNRECOGNIZED' | 'MALFORMED' | 'NEWER_VERSION';

export class ImportError extends Error {
  code: ImportErrorCode;
  constructor(code: ImportErrorCode, message: string) {
    super(message);
    this.name = 'ImportError';
    this.code = code;
  }
}

const V2_HEADER = [
  'Schema Version', 'Habit ID', 'Habit Name', 'Created At',
  'Color', 'Positive Label', 'Negative Label', 'Date', 'Status', 'Note',
];
const LEGACY_HEADER = ['Date', 'Habit Name', 'Status', 'Label', 'Note'];

const arraysEqual = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i]);

const statusToString = (status: boolean | null): string =>
  status === true ? 'Completed' : status === false ? 'Failed' : 'Skipped';

const parseStatus = (s: string, rowNum: number): boolean | null => {
  if (s === 'Completed') return true;
  if (s === 'Failed') return false;
  if (s === 'Skipped') return null;
  throw new ImportError('MALFORMED', `Row ${rowNum}: invalid Status "${s}"`);
};

const isValidDate = (s: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
};

const isValidIso = (s: string): boolean => s.length > 0 && !Number.isNaN(Date.parse(s));

// ---- Encode ----

export const encodeSnapshot = (snapshot: Snapshot): string => {
  const rows: string[][] = [V2_HEADER];
  const v = String(CURRENT_SCHEMA_VERSION);

  const habits = Object.values(snapshot.habits).sort((a, b) => a.id.localeCompare(b.id));
  for (const habit of habits) {
    const meta = [
      v, habit.id, habit.name, habit.createdAt,
      habit.color ?? '', habit.positiveLabel ?? '', habit.negativeLabel ?? '',
    ];
    const habitLogs = snapshot.logs[habit.id] ?? {};
    const dates = Object.keys(habitLogs).sort();
    if (dates.length === 0) {
      rows.push([...meta, '', '', '']);
      continue;
    }
    for (const date of dates) {
      const log = habitLogs[date]!;
      rows.push([...meta, date, statusToString(log.status), log.note ?? '']);
    }
  }

  return serializeRows(rows);
};

// ---- Decode ----

const decodeV2 = (rows: string[][]): { snapshot: Snapshot; version: number; warnings: string[] } => {
  const warnings: string[] = [];
  const habits: Record<string, Habit> = {};
  const logs: Record<string, DailyLogs> = {};
  const seenMeta = new Map<string, string>();
  let fileVersion: number | null = null;

  rows.slice(1).forEach((row, i) => {
    const rowNum = i + 2;
    const verRaw = (row[0] ?? '').trim();
    if (!/^\d+$/.test(verRaw)) {
      throw new ImportError('MALFORMED', `Row ${rowNum}: invalid Schema Version "${verRaw}"`);
    }
    const ver = parseInt(verRaw, 10);
    if (ver > CURRENT_SCHEMA_VERSION) {
      throw new ImportError('NEWER_VERSION', `This file was exported by a newer version of the app (format v${ver}). Please update the app to import it.`);
    }
    if (fileVersion === null) fileVersion = ver;
    else if (fileVersion !== ver) {
      throw new ImportError('MALFORMED', `Row ${rowNum}: inconsistent Schema Version (${ver} vs ${fileVersion})`);
    }

    const id = (row[1] ?? '').trim();
    if (!id) throw new ImportError('MALFORMED', `Row ${rowNum}: missing Habit ID`);

    const name = row[2] ?? '';
    let createdAt = (row[3] ?? '').trim();
    if (!isValidIso(createdAt)) {
      createdAt = new Date().toISOString();
      warnings.push(`Row ${rowNum}: invalid Created At for "${name}"; defaulted to now.`);
    }
    const habit: Habit = {
      id, name, createdAt,
      color: (row[4] ?? '') || undefined,
      positiveLabel: (row[5] ?? '') || undefined,
      negativeLabel: (row[6] ?? '') || undefined,
    };

    if (!habits[id]) {
      habits[id] = habit;
      seenMeta.set(id, JSON.stringify(habit));
    } else if (seenMeta.get(id) !== JSON.stringify(habit)) {
      warnings.push(`Habit ID "${id}" appears with differing details; kept the first occurrence.`);
    }

    const date = (row[7] ?? '').trim();
    if (date) {
      if (!isValidDate(date)) throw new ImportError('MALFORMED', `Row ${rowNum}: invalid Date "${date}"`);
      const status = parseStatus((row[8] ?? '').trim(), rowNum);
      const note = row[9] ?? '';
      (logs[id] ||= {})[date] = { status, note: note || undefined };
    }
  });

  return { snapshot: { habits, logs }, version: fileVersion ?? CURRENT_SCHEMA_VERSION, warnings };
};

export const decodeCsv = (text: string): { snapshot: Snapshot; version: number; warnings: string[] } => {
  if ((text.charCodeAt(0) === 0xFEFF ? text.slice(1) : text).trim() === '') {
    throw new ImportError('EMPTY', 'The file is empty.');
  }

  let rows: string[][];
  try {
    rows = parseRows(text);
  } catch (e) {
    throw new ImportError('MALFORMED', `Could not parse the CSV file: ${(e as Error).message}`);
  }
  if (rows.length === 0) throw new ImportError('EMPTY', 'The file is empty.');

  const header = rows[0]!;
  if (arraysEqual(header, V2_HEADER)) return decodeV2(rows);

  if (header[0] === 'Schema Version') {
    const verRaw = (rows[1]?.[0] ?? '').trim();
    const ver = parseInt(verRaw, 10);
    if (Number.isFinite(ver) && ver > CURRENT_SCHEMA_VERSION) {
      throw new ImportError('NEWER_VERSION', `This file was exported by a newer version of the app (format v${ver}). Please update the app to import it.`);
    }
    throw new ImportError('UNRECOGNIZED', 'The file looks like a habit export but its columns are not recognized.');
  }

  if (arraysEqual(header, LEGACY_HEADER)) {
    // Implemented in the next task.
    throw new ImportError('UNRECOGNIZED', 'Legacy import not yet implemented.');
  }

  throw new ImportError('UNRECOGNIZED', 'This file is not a recognized habit export.');
};
