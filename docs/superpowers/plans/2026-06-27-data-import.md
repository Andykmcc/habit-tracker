# Data Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add data import to the habit tracker, upgrading the export to a versioned, fully-reconstructable CSV and reconciling imported data against local data under a user-chosen, import-wide conflict rule.

**Architecture:** Four isolated, independently-tested units. `csv.ts` does low-level CSV parse/serialize. `exportSchema.ts` owns the versioned encode/decode (with a migration path for the legacy unversioned CSV). `importMerge.ts` is a pure merge engine. `store.ts` gains `getFullSnapshot`/`replaceAllData` (the only writer) plus `previewImport`/`importCsv` orchestrators. Import is all-or-nothing: decode validates and merge computes fully before any write. A new `ImportData.vue` drives the UI: pick file → choose conflict rule + mirror toggle → preview change counts → apply.

**Tech Stack:** Vue 3 (`<script setup>` + TS), Pinia, Vitest + @vue/test-utils, happy-dom. Tests use vitest globals (`describe`/`it`/`expect` need no import per `vite.config.ts`), but existing tests import them explicitly — follow that local convention.

---

## File Structure

- **Create** `src/utils/csv.ts` — `parseRows(text): string[][]`, `serializeRows(rows): string`. No habit knowledge.
- **Create** `src/utils/csv.test.ts` — parse/serialize round-trips, quoting, BOM, CRLF, blank lines, unterminated quote.
- **Create** `src/utils/exportSchema.ts` — `CURRENT_SCHEMA_VERSION`, `ImportError`, `encodeSnapshot`, `decodeCsv` (v2 + legacy v1 dispatch).
- **Create** `src/utils/exportSchema.test.ts` — round-trips, legacy decode, every error code.
- **Create** `src/utils/importMerge.ts` — `ImportOptions`, `MergeCounts`, `mergeSnapshots`, `reconcileLegacyHabitIds`.
- **Create** `src/utils/importMerge.test.ts` — all merge modes + reconcile.
- **Modify** `src/store.ts` — add `Snapshot` type, `ImportSummary` type, `getFullSnapshot`, `replaceAllData`, `previewImport`, `importCsv`. Remove `getAllLogs`/`ExportEntry` in the final task.
- **Create** `src/store.import.test.ts` — `getFullSnapshot`, `replaceAllData`, atomicity, active-habit reconciliation.
- **Modify** `src/components/ExportData.vue` — encode via `getFullSnapshot` + `encodeSnapshot`.
- **Modify** `src/components/ExportData.test.ts` — assert new v2 header/content.
- **Create** `src/components/ImportData.vue` — import UI.
- **Create** `src/components/ImportData.test.ts` — UI wiring, preview, apply, error.
- **Modify** `src/App.vue` — render `<ImportData />` beside `<ExportData />`.
- **Delete** (final task) `src/utils/export.ts`, `src/utils/export.test.ts`, `src/store.export.test.ts`.

### Key definitions (shared across tasks — names are normative)

```ts
// In src/store.ts (exported)
export interface Snapshot {
  habits: Record<string, Habit>;   // habitId -> Habit
  logs: Record<string, DailyLogs>; // habitId -> { 'YYYY-MM-DD' -> DailyLog }
}
export type ImportSummary = MergeCounts & { warnings: string[] };

// In src/utils/exportSchema.ts (exported)
export const CURRENT_SCHEMA_VERSION = 2;
export type ImportErrorCode = 'EMPTY' | 'UNRECOGNIZED' | 'MALFORMED' | 'NEWER_VERSION';
export class ImportError extends Error { code: ImportErrorCode; /* ... */ }
export function encodeSnapshot(snapshot: Snapshot): string;
export function decodeCsv(text: string): { snapshot: Snapshot; version: number; warnings: string[] };

// In src/utils/importMerge.ts (exported)
export interface ImportOptions { conflictWinner: 'imported' | 'local'; mirror: boolean; }
export interface MergeCounts {
  habitsAdded: number; habitsUpdated: number; habitsDeleted: number;
  logsAdded: number; logsOverwritten: number; logsDeleted: number;
}
export function mergeSnapshots(local: Snapshot, imported: Snapshot, options: ImportOptions): { result: Snapshot; counts: MergeCounts };
export function reconcileLegacyHabitIds(imported: Snapshot, local: Snapshot): Snapshot;
```

- **v2 CSV header (normative):** `Schema Version,Habit ID,Habit Name,Created At,Color,Positive Label,Negative Label,Date,Status,Note`
- **Legacy v1 header (normative):** `Date,Habit Name,Status,Label,Note`
- **Status bijection:** `Completed`↔`true`, `Failed`↔`false`, `Skipped`↔`null`.
- **Counts are relative to local state** (what the user gains/loses): under `conflictWinner: 'local'` a conflict that keeps the local value is NOT counted as overwritten.

> **Commit convention:** every commit message ends with the trailer
> `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` (shown in each commit step below). Run from the repo root. Run tests with `npx vitest --run <path>`.

---

## Task 1: Low-level CSV (`csv.ts`)

**Files:**
- Create: `src/utils/csv.ts`
- Test: `src/utils/csv.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/csv.test.ts`:

```ts
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
    expect(() => parseRows('"abc')).toThrow();
  });

  it('returns [] for empty input', () => {
    expect(parseRows('')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest --run src/utils/csv.test.ts`
Expected: FAIL — `parseRows`/`serializeRows` not found.

- [ ] **Step 3: Write the implementation**

Create `src/utils/csv.ts`:

```ts
export const serializeRows = (rows: string[][]): string => {
  const escape = (str: string): string => {
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return rows.map(row => row.map(escape).join(',')).join('\n');
};

export const parseRows = (text: string): string[][] => {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  let i = 0;

  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => { rows.push(row); row = []; };

  while (i < input.length) {
    const ch = input[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"') { inQuotes = true; i++; continue; }
    if (ch === ',') { pushField(); i++; continue; }
    if (ch === '\r') {
      pushField(); pushRow();
      i += input[i + 1] === '\n' ? 2 : 1;
      continue;
    }
    if (ch === '\n') { pushField(); pushRow(); i++; continue; }
    field += ch; i++;
  }

  if (inQuotes) throw new Error('Unterminated quoted field in CSV');
  if (field !== '' || row.length > 0) { pushField(); pushRow(); }

  // Drop fully-blank lines (a single empty field).
  return rows.filter(r => !(r.length === 1 && r[0] === ''));
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest --run src/utils/csv.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add src/utils/csv.ts src/utils/csv.test.ts
git commit -m "feat: add low-level CSV parse/serialize utility" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: `Snapshot` type + `getFullSnapshot` (`store.ts`)

**Files:**
- Modify: `src/store.ts` (add `Snapshot` interface near the other types ~line 13; add `getFullSnapshot` near `getAllLogs` ~line 236; export it in the return object ~line 277)
- Test: `src/store.import.test.ts` (new)

- [ ] **Step 1: Write the failing tests**

Create `src/store.import.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import { useHabitStore } from './store';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { store = {}; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('getFullSnapshot', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('captures all habits and logs grouped by habitId', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    const h2 = store.createHabit('Read');
    store.setActiveHabit(h1);
    store.upsertLog('2025-01-01', true, 'Good');
    store.upsertLog('2025-02-15', false);
    store.setActiveHabit(h2);
    store.upsertLog('2025-01-01', null, 'Skipped');

    const snap = store.getFullSnapshot();

    expect(Object.keys(snap.habits).sort()).toEqual([h1, h2].sort());
    expect(snap.habits[h1]!.name).toBe('Run');
    expect(snap.logs[h1]).toEqual({
      '2025-01-01': { status: true, note: 'Good' },
      '2025-02-15': { status: false },
    });
    expect(snap.logs[h2]).toEqual({ '2025-01-01': { status: null, note: 'Skipped' } });
  });

  it('includes habits with zero logs (no logs key for them)', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Empty');
    const snap = store.getFullSnapshot();
    expect(snap.habits[h1]!.name).toBe('Empty');
    expect(snap.logs[h1]).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest --run src/store.import.test.ts`
Expected: FAIL — `getFullSnapshot` is not a function.

- [ ] **Step 3: Add the `Snapshot` type**

In `src/store.ts`, after the `ExportEntry` interface (~line 19), add:

```ts
export interface Snapshot {
    habits: Record<string, Habit>;   // habitId -> Habit
    logs: Record<string, DailyLogs>; // habitId -> { date -> DailyLog }
}
```

- [ ] **Step 4: Implement `getFullSnapshot`**

In `src/store.ts`, add this action right after `getAllLogs` (~line 275):

```ts
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
```

Then add `getFullSnapshot` to the returned object (after `getAllLogs,` ~line 294):

```ts
        getAllLogs,
        getFullSnapshot,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest --run src/store.import.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/store.ts src/store.import.test.ts
git commit -m "feat: add Snapshot type and getFullSnapshot to store" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Encode + decode v2 (`exportSchema.ts`)

**Files:**
- Create: `src/utils/exportSchema.ts`
- Test: `src/utils/exportSchema.test.ts`

- [ ] **Step 1: Write the failing tests (round-trip + v2 errors)**

Create `src/utils/exportSchema.test.ts`:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest --run src/utils/exportSchema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `exportSchema.ts` (v2 only for now)**

Create `src/utils/exportSchema.ts`:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest --run src/utils/exportSchema.test.ts`
Expected: PASS (all round-trip + error tests). The legacy header path throws UNRECOGNIZED for now — no test exercises it yet.

- [ ] **Step 5: Commit**

```bash
git add src/utils/exportSchema.ts src/utils/exportSchema.test.ts
git commit -m "feat: add versioned CSV encode and v2 decode" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Legacy v1 decode (`exportSchema.ts`)

**Files:**
- Modify: `src/utils/exportSchema.ts` (add `decodeV1`; replace the legacy-header branch in `decodeCsv`)
- Test: `src/utils/exportSchema.test.ts` (add a `describe('legacy v1 decode', ...)` block)

- [ ] **Step 1: Write the failing tests**

Append to `src/utils/exportSchema.test.ts`:

```ts
describe('legacy v1 decode', () => {
  const legacy = [
    'Date,Habit Name,Status,Label,Note',
    '2025-01-01,Run,Completed,✓,Good run',
    '2025-01-02,Run,Failed,✕,',
    '2025-01-01,Read,Skipped,,"Read, later"',
  ].join('\n');

  it('decodes name-grouped habits with mapped statuses and notes', () => {
    const { snapshot, version, warnings } = decodeCsv(legacy);
    expect(version).toBe(1);
    expect(warnings.length).toBeGreaterThan(0); // lossy-import warning

    const byName = Object.values(snapshot.habits);
    const run = byName.find(h => h.name === 'Run')!;
    const read = byName.find(h => h.name === 'Read')!;
    expect(run).toBeTruthy();
    expect(read).toBeTruthy();
    expect(run.color).toBeUndefined();

    expect(snapshot.logs[run.id]).toEqual({
      '2025-01-01': { status: true, note: 'Good run' },
      '2025-01-02': { status: false },
    });
    expect(snapshot.logs[read.id]).toEqual({
      '2025-01-01': { status: null, note: 'Read, later' },
    });
  });

  it('MALFORMED for a bad status in a legacy row', () => {
    const bad = 'Date,Habit Name,Status,Label,Note\n2025-01-01,Run,Done,✓,';
    expect(() => decodeCsv(bad)).toThrow(expect.objectContaining({ code: 'MALFORMED' }));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest --run src/utils/exportSchema.test.ts`
Expected: FAIL — legacy path currently throws UNRECOGNIZED, so the first legacy test fails.

- [ ] **Step 3: Implement `decodeV1` and wire it in**

In `src/utils/exportSchema.ts`, add `decodeV1` directly above `decodeCsv`:

```ts
const decodeV1 = (rows: string[][]): { snapshot: Snapshot; warnings: string[] } => {
  const warnings: string[] = [];
  const nameToId = new Map<string, string>();
  const habits: Record<string, Habit> = {};
  const logs: Record<string, DailyLogs> = {};
  const createdAt = new Date().toISOString();
  let counter = 0;

  rows.slice(1).forEach((row, i) => {
    const rowNum = i + 2;
    const date = (row[0] ?? '').trim();
    const name = row[1] ?? '';
    const statusStr = (row[2] ?? '').trim();
    // row[3] (Label) is intentionally ignored — derived, not source of truth.
    const note = row[4] ?? '';

    if (!name) throw new ImportError('MALFORMED', `Row ${rowNum}: missing Habit Name`);

    let id = nameToId.get(name);
    if (!id) {
      id = `legacy-habit-${++counter}`;
      nameToId.set(name, id);
      habits[id] = { id, name, createdAt };
    }

    if (date) {
      if (!isValidDate(date)) throw new ImportError('MALFORMED', `Row ${rowNum}: invalid Date "${date}"`);
      const status = parseStatus(statusStr, rowNum);
      (logs[id] ||= {})[date] = { status, note: note || undefined };
    }
  });

  if (Object.keys(habits).length > 0) {
    warnings.push('Imported a legacy export: habit colors and custom labels were not available and were reset to defaults.');
  }
  return { snapshot: { habits, logs }, warnings };
};
```

Then replace the legacy-header branch inside `decodeCsv`:

```ts
  if (arraysEqual(header, LEGACY_HEADER)) {
    const { snapshot, warnings } = decodeV1(rows);
    return { snapshot, version: 1, warnings };
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest --run src/utils/exportSchema.test.ts`
Expected: PASS (round-trip + v2 errors + legacy).

- [ ] **Step 5: Commit**

```bash
git add src/utils/exportSchema.ts src/utils/exportSchema.test.ts
git commit -m "feat: add best-effort legacy v1 CSV decode" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Merge engine (`importMerge.ts`)

**Files:**
- Create: `src/utils/importMerge.ts`
- Test: `src/utils/importMerge.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/utils/importMerge.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mergeSnapshots, reconcileLegacyHabitIds } from './importMerge';
import type { Snapshot } from '../store';

const habit = (id: string, name = id) => ({ id, name, createdAt: '2026-01-01T00:00:00.000Z' });

const local: Snapshot = {
  habits: { h1: habit('h1', 'Run'), h2: habit('h2', 'Read') },
  logs: {
    h1: { '2026-06-01': { status: true, note: 'local' }, '2026-06-02': { status: false } },
    h2: { '2026-06-01': { status: true } },
  },
};
const imported: Snapshot = {
  habits: { h1: habit('h1', 'Run'), h3: habit('h3', 'Meditate') },
  logs: {
    h1: { '2026-06-01': { status: false, note: 'imported' }, '2026-06-03': { status: true } },
    h3: { '2026-06-01': { status: true } },
  },
};

describe('mergeSnapshots — union (mirror off)', () => {
  it('imported wins on conflict, keeps everything else', () => {
    const { result, counts } = mergeSnapshots(local, imported, { conflictWinner: 'imported', mirror: false });
    // conflict on h1/2026-06-01 -> imported value
    expect(result.logs.h1!['2026-06-01']).toEqual({ status: false, note: 'imported' });
    // local-only retained
    expect(result.logs.h1!['2026-06-02']).toEqual({ status: false });
    expect(result.habits.h2).toBeTruthy();
    // imported-only added
    expect(result.logs.h1!['2026-06-03']).toEqual({ status: true });
    expect(result.habits.h3).toBeTruthy();
    expect(counts.logsOverwritten).toBe(1);
    expect(counts.logsAdded).toBe(2); // h1/06-03 and h3/06-01
    expect(counts.habitsAdded).toBe(1); // h3
    expect(counts.habitsDeleted).toBe(0);
    expect(counts.logsDeleted).toBe(0);
  });

  it('local wins on conflict (overwritten count is 0)', () => {
    const { result, counts } = mergeSnapshots(local, imported, { conflictWinner: 'local', mirror: false });
    expect(result.logs.h1!['2026-06-01']).toEqual({ status: true, note: 'local' });
    expect(counts.logsOverwritten).toBe(0);
    expect(counts.logsAdded).toBe(2);
  });

  it('counts habit metadata changes as habitsUpdated', () => {
    const localR: Snapshot = { habits: { h1: habit('h1', 'Run') }, logs: {} };
    const importedR: Snapshot = { habits: { h1: { ...habit('h1', 'Running'), color: '#fff' } }, logs: {} };
    const imp = mergeSnapshots(localR, importedR, { conflictWinner: 'imported', mirror: false });
    expect(imp.result.habits.h1!.name).toBe('Running');
    expect(imp.counts.habitsUpdated).toBe(1);
    const loc = mergeSnapshots(localR, importedR, { conflictWinner: 'local', mirror: false });
    expect(loc.result.habits.h1!.name).toBe('Run');
    expect(loc.counts.habitsUpdated).toBe(0);
  });
});

describe('mergeSnapshots — mirror on', () => {
  it('result deep-equals imported regardless of conflictWinner', () => {
    for (const conflictWinner of ['imported', 'local'] as const) {
      const { result } = mergeSnapshots(local, imported, { conflictWinner, mirror: true });
      expect(result.habits).toEqual(imported.habits);
      expect(result.logs).toEqual(imported.logs);
    }
  });

  it('counts local-only logs and habits as deleted', () => {
    const { counts } = mergeSnapshots(local, imported, { conflictWinner: 'imported', mirror: true });
    // local-only: h1/06-02 (log) and all of h2 (habit + its 1 log)
    expect(counts.habitsDeleted).toBe(1); // h2
    expect(counts.logsDeleted).toBe(2);   // h1/06-02 + h2/06-01
  });

  it('empty import + mirror deletes everything', () => {
    const empty: Snapshot = { habits: {}, logs: {} };
    const { result, counts } = mergeSnapshots(local, empty, { conflictWinner: 'imported', mirror: true });
    expect(result).toEqual(empty);
    expect(counts.habitsDeleted).toBe(2);
    expect(counts.logsDeleted).toBe(3);
  });
});

describe('mergeSnapshots — edges', () => {
  it('empty local + import => everything added', () => {
    const empty: Snapshot = { habits: {}, logs: {} };
    const { result, counts } = mergeSnapshots(empty, imported, { conflictWinner: 'imported', mirror: false });
    expect(result.habits).toEqual(imported.habits);
    expect(result.logs).toEqual(imported.logs);
    expect(counts.habitsAdded).toBe(2);
    expect(counts.logsAdded).toBe(3);
  });

  it('is idempotent under imported-wins', () => {
    const once = mergeSnapshots(local, imported, { conflictWinner: 'imported', mirror: false }).result;
    const twice = mergeSnapshots(once, imported, { conflictWinner: 'imported', mirror: false });
    expect(twice.counts).toEqual({ habitsAdded: 0, habitsUpdated: 0, habitsDeleted: 0, logsAdded: 0, logsOverwritten: 0, logsDeleted: 0 });
  });
});

describe('reconcileLegacyHabitIds', () => {
  it('remaps imported habit ids onto local ids by matching name', () => {
    const localSnap: Snapshot = { habits: { 'real-1': habit('real-1', 'Run') }, logs: { 'real-1': { '2026-06-01': { status: true } } } };
    const legacy: Snapshot = { habits: { 'legacy-habit-1': habit('legacy-habit-1', 'Run') }, logs: { 'legacy-habit-1': { '2026-06-02': { status: false } } } };
    const out = reconcileLegacyHabitIds(legacy, localSnap);
    expect(out.habits['real-1']!.name).toBe('Run');
    expect(out.habits['legacy-habit-1']).toBeUndefined();
    expect(out.logs['real-1']).toEqual({ '2026-06-02': { status: false } });
  });

  it('keeps the provisional id when no local name matches', () => {
    const localSnap: Snapshot = { habits: {}, logs: {} };
    const legacy: Snapshot = { habits: { 'legacy-habit-1': habit('legacy-habit-1', 'New') }, logs: {} };
    const out = reconcileLegacyHabitIds(legacy, localSnap);
    expect(out.habits['legacy-habit-1']!.name).toBe('New');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest --run src/utils/importMerge.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `importMerge.ts`**

Create `src/utils/importMerge.ts`:

```ts
import type { Snapshot, Habit, DailyLog, DailyLogs } from '../store';

export interface ImportOptions {
  conflictWinner: 'imported' | 'local';
  mirror: boolean;
}

export interface MergeCounts {
  habitsAdded: number;
  habitsUpdated: number;
  habitsDeleted: number;
  logsAdded: number;
  logsOverwritten: number;
  logsDeleted: number;
}

const habitEqual = (a: Habit, b: Habit): boolean =>
  a.id === b.id && a.name === b.name && a.createdAt === b.createdAt &&
  (a.color ?? '') === (b.color ?? '') &&
  (a.positiveLabel ?? '') === (b.positiveLabel ?? '') &&
  (a.negativeLabel ?? '') === (b.negativeLabel ?? '');

const logEqual = (a: DailyLog, b: DailyLog): boolean =>
  a.status === b.status && (a.note ?? '') === (b.note ?? '');

export const mergeSnapshots = (
  local: Snapshot,
  imported: Snapshot,
  options: ImportOptions,
): { result: Snapshot; counts: MergeCounts } => {
  // Mirror implies imported-wins so the result equals the imported file exactly.
  const importedWins = options.mirror || options.conflictWinner === 'imported';
  const counts: MergeCounts = {
    habitsAdded: 0, habitsUpdated: 0, habitsDeleted: 0,
    logsAdded: 0, logsOverwritten: 0, logsDeleted: 0,
  };
  const habits: Record<string, Habit> = {};
  const logs: Record<string, DailyLogs> = {};

  const habitIds = new Set([...Object.keys(local.habits), ...Object.keys(imported.habits)]);
  for (const id of habitIds) {
    const l = local.habits[id];
    const im = imported.habits[id];

    if (l && !im) {
      if (options.mirror) {
        counts.habitsDeleted++;
        for (const _ of Object.keys(local.logs[id] ?? {})) counts.logsDeleted++;
        continue; // drop habit and its logs
      }
      habits[id] = l;
    } else if (!l && im) {
      habits[id] = im;
      counts.habitsAdded++;
    } else if (l && im) {
      const winner = importedWins ? im : l;
      habits[id] = winner;
      if (!habitEqual(l, winner)) counts.habitsUpdated++;
    }

    // Logs for surviving habits.
    const localLogs = local.logs[id] ?? {};
    const importedLogs = imported.logs[id] ?? {};
    const merged: DailyLogs = {};
    const dates = new Set([...Object.keys(localLogs), ...Object.keys(importedLogs)]);
    for (const date of dates) {
      const ll = localLogs[date];
      const il = importedLogs[date];
      if (ll && !il) {
        if (options.mirror) { counts.logsDeleted++; continue; }
        merged[date] = ll;
      } else if (!ll && il) {
        merged[date] = il;
        counts.logsAdded++;
      } else if (ll && il) {
        const winner = importedWins ? il : ll;
        merged[date] = winner;
        if (!logEqual(ll, winner)) counts.logsOverwritten++;
      }
    }
    if (Object.keys(merged).length > 0) logs[id] = merged;
  }

  return { result: { habits, logs }, counts };
};

export const reconcileLegacyHabitIds = (imported: Snapshot, local: Snapshot): Snapshot => {
  const nameToLocalId = new Map<string, string>();
  for (const h of Object.values(local.habits)) {
    if (!nameToLocalId.has(h.name)) nameToLocalId.set(h.name, h.id);
  }

  const habits: Record<string, Habit> = {};
  const logs: Record<string, DailyLogs> = {};
  for (const h of Object.values(imported.habits)) {
    const targetId = nameToLocalId.get(h.name) ?? h.id;
    habits[targetId] = { ...h, id: targetId };
    const hl = imported.logs[h.id];
    if (hl) logs[targetId] = { ...hl };
  }
  return { habits, logs };
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest --run src/utils/importMerge.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/utils/importMerge.ts src/utils/importMerge.test.ts
git commit -m "feat: add pure snapshot merge engine and legacy id reconcile" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Persist + orchestrate (`store.ts`)

**Files:**
- Modify: `src/store.ts` (import from `exportSchema`/`importMerge`; add `ImportSummary` type, `replaceAllData`, `previewImport`, `importCsv`; export them)
- Test: `src/store.import.test.ts` (add `describe` blocks for persistence + import)

- [ ] **Step 1: Write the failing tests**

Add `import { encodeSnapshot } from './utils/exportSchema';` to the imports at the top of `src/store.import.test.ts`, then append these `describe` blocks to the end of the file:

```ts
describe('replaceAllData', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('round-trips a snapshot through getFullSnapshot', () => {
    const store = useHabitStore();
    const snap = {
      habits: { a: { id: 'a', name: 'A', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { a: { '2026-06-01': { status: true, note: 'hi' }, '2026-07-01': { status: null } } },
    };
    store.replaceAllData(snap);
    expect(store.getFullSnapshot()).toEqual(snap);
  });

  it('removes habits/logs not present in the new snapshot (mirror)', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true);

    store.replaceAllData({
      habits: { b: { id: 'b', name: 'B', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: {},
    });

    const snap = store.getFullSnapshot();
    expect(snap.habits[h1]).toBeUndefined();
    expect(snap.habits.b).toBeTruthy();
    expect(store.activeHabitId).toBe('b'); // active reconciled to surviving habit
  });
});

describe('importCsv / previewImport', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('previewImport reports counts without writing', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');

    const csv = encodeSnapshot({
      habits: { [h1]: { id: h1, name: 'Run', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { [h1]: { '2026-06-01': { status: false, note: 'imported' }, '2026-06-02': { status: true } } },
    });

    const summary = store.previewImport(csv, { conflictWinner: 'imported', mirror: false });
    expect(summary.logsOverwritten).toBe(1);
    expect(summary.logsAdded).toBe(1);
    // unchanged on disk
    expect(store.getFullSnapshot().logs[h1]!['2026-06-01']).toEqual({ status: true, note: 'local' });
  });

  it('importCsv applies the merge to storage', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');

    const csv = encodeSnapshot({
      habits: { [h1]: { id: h1, name: 'Run', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { [h1]: { '2026-06-01': { status: false, note: 'imported' } } },
    });

    store.importCsv(csv, { conflictWinner: 'imported', mirror: false });
    expect(store.getFullSnapshot().logs[h1]!['2026-06-01']).toEqual({ status: false, note: 'imported' });
  });

  it('a decode error throws and leaves storage untouched (atomicity)', () => {
    const store = useHabitStore();
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');
    const before = store.getFullSnapshot();

    expect(() => store.importCsv('garbage,header\n1,2', { conflictWinner: 'imported', mirror: false }))
      .toThrow();
    expect(store.getFullSnapshot()).toEqual(before);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest --run src/store.import.test.ts`
Expected: FAIL — `replaceAllData`/`previewImport`/`importCsv` not functions.

- [ ] **Step 3: Add imports and the `ImportSummary` type**

At the top of `src/store.ts`, after the existing imports, add:

```ts
import { decodeCsv } from './utils/exportSchema';
import { mergeSnapshots, reconcileLegacyHabitIds } from './utils/importMerge';
import type { ImportOptions, MergeCounts } from './utils/importMerge';
```

After the `Snapshot` interface (added in Task 2), add:

```ts
export type ImportSummary = MergeCounts & { warnings: string[] };
```

- [ ] **Step 4: Implement `replaceAllData` and the orchestrators**

In `src/store.ts`, add these actions right after `getFullSnapshot`:

```ts
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
```

Add them to the returned object (after `getFullSnapshot,`):

```ts
        getFullSnapshot,
        replaceAllData,
        previewImport,
        importCsv,
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest --run src/store.import.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/store.ts src/store.import.test.ts
git commit -m "feat: add replaceAllData and import orchestrators to store" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: Switch export to the v2 format (`ExportData.vue`)

**Files:**
- Modify: `src/components/ExportData.vue`
- Test: `src/components/ExportData.test.ts` (update the two content assertions)

- [ ] **Step 1: Update the failing test**

In `src/components/ExportData.test.ts`, replace the two content assertions in the `triggers download when data exists` test (currently asserting the legacy header/row) with:

```ts
        // New v2 format: versioned header + reconstructable row.
        expect(content).toContain('Schema Version,Habit ID,Habit Name,Created At,Color,Positive Label,Negative Label,Date,Status,Note');
        expect(content).toContain(',Test Habit,');
        expect(content).toContain(',2025-01-01,Completed,');
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest --run src/components/ExportData.test.ts`
Expected: FAIL — output still has the legacy header.

- [ ] **Step 3: Update `ExportData.vue`**

Replace the `<script setup>` block's import and `exportData` body in `src/components/ExportData.vue`:

```ts
import { useHabitStore } from '../store';
import { encodeSnapshot } from '../utils/exportSchema';

const store = useHabitStore();

const exportData = () => {
  const snapshot = store.getFullSnapshot();

  if (Object.keys(snapshot.habits).length === 0) {
    alert('No data to export');
    return;
  }

  const csvContent = encodeSnapshot(snapshot);

  // Create download link. Add BOM for Excel compatibility.
  const blob = new Blob([String.fromCharCode(0xFEFF) + csvContent], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `habit-tracker-export-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 2000);
};
```

Leave the `<template>` unchanged.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest --run src/components/ExportData.test.ts`
Expected: PASS (3 tests). The "No data to export" test still passes — an empty pinia has no habits.

- [ ] **Step 5: Commit**

```bash
git add src/components/ExportData.vue src/components/ExportData.test.ts
git commit -m "feat: export the versioned, reconstructable v2 CSV" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Import UI (`ImportData.vue`)

**Files:**
- Create: `src/components/ImportData.vue`
- Test: `src/components/ImportData.test.ts`

The component exposes `loadFile(file: File)` (called by the file input's `@change` and directly by tests) so the file-reading path is testable without simulating native file dialogs.

- [ ] **Step 1: Write the failing tests**

Create `src/components/ImportData.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ImportData from './ImportData.vue';
import { useHabitStore } from '../store';
import { encodeSnapshot } from '../utils/exportSchema';

const file = (text: string) => new File([text], 'import.csv', { type: 'text/csv' });

describe('ImportData.vue', () => {
  let pinia: any;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
  });

  it('renders the import button', () => {
    const wrapper = mount(ImportData, { global: { plugins: [pinia] } });
    expect(wrapper.find('[data-test="import-button"]').text()).toContain('Import');
  });

  it('shows a change preview for a valid file', async () => {
    const store = useHabitStore(pinia);
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');

    const csv = encodeSnapshot({
      habits: { [h1]: { id: h1, name: 'Run', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { [h1]: { '2026-06-01': { status: false, note: 'imported' }, '2026-06-02': { status: true } } },
    });

    const wrapper = mount(ImportData, { global: { plugins: [pinia] } });
    await (wrapper.vm as any).loadFile(file(csv));
    await wrapper.vm.$nextTick();

    const preview = wrapper.find('[data-test="preview"]').text();
    expect(preview).toContain('1'); // at least one overwritten/added count shown
    expect(wrapper.find('[data-test="apply"]').exists()).toBe(true);
  });

  it('applies the import on confirm', async () => {
    const store = useHabitStore(pinia);
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');

    const csv = encodeSnapshot({
      habits: { [h1]: { id: h1, name: 'Run', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { [h1]: { '2026-06-01': { status: false, note: 'imported' } } },
    });

    const wrapper = mount(ImportData, { global: { plugins: [pinia] } });
    await (wrapper.vm as any).loadFile(file(csv));
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="apply"]').trigger('click');

    expect(store.getFullSnapshot().logs[h1]!['2026-06-01']).toEqual({ status: false, note: 'imported' });
  });

  it('shows an error message for an unrecognized file and offers no apply', async () => {
    const wrapper = mount(ImportData, { global: { plugins: [pinia] } });
    await (wrapper.vm as any).loadFile(file('foo,bar\n1,2'));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-test="error"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="apply"]').exists()).toBe(false);
  });

  it('mirror checkbox forces imported-wins', async () => {
    const wrapper = mount(ImportData, { global: { plugins: [pinia] } });
    const vm = wrapper.vm as any;
    vm.options.mirror = true;
    await wrapper.vm.$nextTick();
    expect(vm.options.conflictWinner).toBe('imported');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest --run src/components/ImportData.test.ts`
Expected: FAIL — component does not exist.

- [ ] **Step 3: Implement `ImportData.vue`**

Create `src/components/ImportData.vue`:

```vue
<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useHabitStore } from '../store';
import type { ImportSummary } from '../store';
import type { ImportOptions } from '../utils/importMerge';
import { ImportError } from '../utils/exportSchema';

const store = useHabitStore();

const fileText = ref<string | null>(null);
const summary = ref<ImportSummary | null>(null);
const error = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const options = reactive<ImportOptions>({ conflictWinner: 'imported', mirror: false });

// Mirror is a true restore: it implies imported-wins.
watch(() => options.mirror, (on) => {
  if (on) options.conflictWinner = 'imported';
});

const recompute = () => {
  if (fileText.value === null) return;
  try {
    summary.value = store.previewImport(fileText.value, { ...options });
    error.value = null;
  } catch (e) {
    summary.value = null;
    error.value = e instanceof ImportError ? e.message : 'Could not read this file.';
  }
};

watch(options, recompute);

const loadFile = async (file: File): Promise<void> => {
  reset();
  fileText.value = await file.text();
  recompute();
};

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) loadFile(file);
};

const apply = () => {
  if (fileText.value === null) return;
  store.importCsv(fileText.value, { ...options });
  close();
};

const reset = () => {
  fileText.value = null;
  summary.value = null;
  error.value = null;
  options.conflictWinner = 'imported';
  options.mirror = false;
};

const close = () => {
  reset();
  if (fileInput.value) fileInput.value.value = '';
};

defineExpose({ loadFile, apply, options, summary, error });
</script>

<template>
  <div class="text-center">
    <input
      ref="fileInput"
      type="file"
      accept=".csv,text/csv"
      class="hidden"
      @change="onFileChange"
    />
    <button
      data-test="import-button"
      class="relative px-6 py-3 rounded-lg text-sm font-medium focus:outline-none border-2 border-green-300 text-green-600 hover:bg-green-50 transition-colors"
      @click="fileInput?.click()"
    >
      Import Data
    </button>

    <div
      v-if="fileText !== null"
      class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
    >
      <div class="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full text-left space-y-4">
        <h2 class="text-lg font-semibold">Import data</h2>

        <p v-if="error" data-test="error" class="text-red-600 text-sm">{{ error }}</p>

        <template v-else-if="summary">
          <fieldset class="space-y-2 text-sm">
            <legend class="font-medium mb-1">On conflict, keep:</legend>
            <label class="flex items-center gap-2">
              <input type="radio" value="imported" v-model="options.conflictWinner" :disabled="options.mirror" />
              Imported data
            </label>
            <label class="flex items-center gap-2">
              <input type="radio" value="local" v-model="options.conflictWinner" :disabled="options.mirror" />
              Existing local data
            </label>
          </fieldset>

          <label class="flex items-start gap-2 text-sm">
            <input type="checkbox" v-model="options.mirror" class="mt-1" />
            <span>Make my data exactly match this file (deletes local data not in the file)</span>
          </label>

          <div data-test="preview" class="text-sm bg-gray-50 rounded-lg p-3 space-y-0.5">
            <div>Habits: +{{ summary.habitsAdded }} added, {{ summary.habitsUpdated }} updated, {{ summary.habitsDeleted }} deleted</div>
            <div>Logs: +{{ summary.logsAdded }} added, {{ summary.logsOverwritten }} overwritten, {{ summary.logsDeleted }} deleted</div>
            <ul v-if="summary.warnings.length" class="text-amber-600 list-disc pl-5 pt-1">
              <li v-for="(w, i) in summary.warnings" :key="i">{{ w }}</li>
            </ul>
          </div>
        </template>

        <div class="flex justify-end gap-3 pt-2">
          <button class="px-4 py-2 text-sm text-gray-600" @click="close">Cancel</button>
          <button
            v-if="summary"
            data-test="apply"
            class="px-4 py-2 text-sm rounded-lg bg-green-600 text-white"
            @click="apply"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest --run src/components/ImportData.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ImportData.vue src/components/ImportData.test.ts
git commit -m "feat: add ImportData component with preview and conflict options" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Wire `ImportData` into `App.vue`

**Files:**
- Modify: `src/App.vue` (import + render `ImportData` beside `ExportData`)
- Test: `src/App.test.ts` (add an assertion that the import button renders)

- [ ] **Step 1: Write the failing test**

In `src/App.test.ts`, add this test inside the top-level `describe` (reuse the existing mount pattern in that file — create a pinia, `setActivePinia`, then `mount(App, { global: { plugins: [pinia] } })`):

```ts
    it('renders the Import Data button', () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const wrapper = mount(App, { global: { plugins: [pinia] } });
        expect(wrapper.find('[data-test="import-button"]').exists()).toBe(true);
    });
```

If `mount`, `createPinia`, or `setActivePinia` are not already imported at the top of `src/App.test.ts`, add them to the existing imports from `@vue/test-utils` and `pinia`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest --run src/App.test.ts`
Expected: FAIL — no element with `data-test="import-button"`.

- [ ] **Step 3: Update `App.vue`**

Add the import beside the existing `ExportData` import (~line 13):

```ts
import ExportData from './components/ExportData.vue';
import ImportData from './components/ImportData.vue';
```

Render it in the Export/Clear row (~line 223):

```vue
      <!-- Data export / import / clear -->
      <div class="flex justify-center gap-4">
        <ExportData />
        <ImportData />
        <ClearButton @clear="store.clearAllLogs()" />
      </div>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest --run src/App.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/App.vue src/App.test.ts
git commit -m "feat: surface Import Data button in the app" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 10: Remove the superseded legacy export path

`getAllLogs`/`ExportEntry`/`src/utils/export.ts` are now dead — replaced by `getFullSnapshot` + `encodeSnapshot`. Remove them so there is a single export path.

**Files:**
- Delete: `src/utils/export.ts`, `src/utils/export.test.ts`, `src/store.export.test.ts`
- Modify: `src/store.ts` (remove `ExportEntry`, `getAllLogs`, and its entry in the return object)

- [ ] **Step 1: Confirm nothing else references the symbols**

Run: `grep -rn "getAllLogs\|ExportEntry\|generateCsvContent\|utils/export" src/`
Expected: matches ONLY in `src/store.ts`, `src/utils/export.ts`, `src/utils/export.test.ts`, `src/store.export.test.ts`. In particular `src/components/ExportData.vue` must NOT appear (Task 7 already migrated it to `exportSchema`). If anything else references them, stop and reassess.

- [ ] **Step 2: Delete the obsolete files**

```bash
git rm src/utils/export.ts src/utils/export.test.ts src/store.export.test.ts
```

- [ ] **Step 3: Remove `ExportEntry` and `getAllLogs` from `store.ts`**

In `src/store.ts`:
- Delete the `ExportEntry` interface (~lines 13–19).
- Delete the entire `getAllLogs` action (~lines 236–275).
- Remove the `getAllLogs,` line from the returned object.

- [ ] **Step 4: Run the FULL suite + typecheck**

Run: `npx vitest --run`
Expected: PASS — all remaining suites green (no reference to the deleted symbols).

Run: `npx vue-tsc -b`
Expected: no type errors.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove superseded getAllLogs/ExportEntry export path" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] Run `npx vitest --run` — all suites pass.
- [ ] Run `npx vue-tsc -b` — no type errors.
- [ ] Run `npm run build` — production build succeeds.
- [ ] Manual smoke test (`npm run dev`): export data → reload → import the file with "Imported wins" (no changes expected, idempotent) → import with mirror on against a trimmed file (confirm deletions appear in the preview before applying).
