# Data Import — Design

**Date:** 2026-06-27
**Status:** Approved (pending spec review)

## Goal

Add the ability to **import** previously exported data back into the app. The
existing CSV export is **lossy and not round-trippable**, so this work also
**upgrades the export format** to a richer, **versioned** CSV that can fully
reconstruct app state, while staying a clean single-table CSV that opens in any
spreadsheet.

Importing must safely reconcile imported data against whatever already exists
locally, under a simple **import-wide** conflict rule the user chooses at import
time. Because a bad import can **destroy local data**, correctness and test
coverage are treated as primary requirements (see [Testing](#testing)).

## Why the current export can't be imported

`getAllLogs()` → `generateCsvContent()` produces a flattened CSV
(`Date, Habit Name, Status, Label, Note`) that drops everything needed to
reconstruct state:

- Habit `id`, `createdAt`, `color`, and the raw `positiveLabel`/`negativeLabel`
  config (only the derived emoji/label is written, and only on rows with a
  status).
- `status` is a display string (`Completed`/`Failed`/`Skipped`), not the raw
  `boolean | null`.
- Habits are identified only by **name**, so duplicate names collide and a
  rename looks like a brand-new habit.

There is also **no existing versioning/migration infrastructure** in the app.

## In-memory data model

The canonical shape passed between encode/decode/merge/persist:

```ts
interface Snapshot {
  habits: Record<string, Habit>;   // habitId -> Habit
  logs: Record<string, DailyLogs>; // habitId -> { 'YYYY-MM-DD' -> DailyLog }
}
```

`Habit` and `DailyLog` are the existing `store.ts` types. A habit with **zero
logs** has an entry in `habits` and either no key or an empty object in `logs`.

## 1. Versioned CSV format ("v2")

One wide table, **one row per log entry**, habit metadata repeated on each row. A
leading `Schema Version` column carries the version on every row — redundant but
keeps the file a single clean table (a `#`-comment header line would break
spreadsheet import, so it is rejected).

**Columns (v2):**

```
Schema Version,Habit ID,Habit Name,Created At,Color,Positive Label,Negative Label,Date,Status,Note
```

**Example:**

```
Schema Version,Habit ID,Habit Name,Created At,Color,Positive Label,Negative Label,Date,Status,Note
2,habit-123,Run,2026-01-01T08:00:00.000Z,#22c55e,Ran,Missed,2026-06-01,Completed,Good run
2,habit-123,Run,2026-01-01T08:00:00.000Z,#22c55e,Ran,Missed,2026-06-02,Failed,
2,habit-456,Read,2026-02-15T08:00:00.000Z,,,,2026-06-01,Completed,"Read ""The Hobbit"""
2,habit-789,Meditate,2026-03-01T08:00:00.000Z,#8b5cf6,,,,,
```

Rules:

- `Status` is human-readable but a strict bijection: `Completed`↔`true`,
  `Failed`↔`false`, `Skipped`↔`null`.
- The old derived `Label` emoji column is **dropped** in favor of raw
  `Positive Label`/`Negative Label` (the real source of truth). The new header
  therefore differs from the legacy header, which doubles as a version signal.
- A row with an **empty `Date`** is metadata-only, so habits with zero logs
  survive a round-trip (last row above).
- On decode, habit metadata is collected from **any row** bearing that Habit ID
  (deduped; **first row wins** if rows disagree — see warnings). Log entries come
  only from rows with a non-empty `Date`.

**Not captured (intentional):** `activeHabitId` and pure UI prefs
(`habit-tracker-onboarding-dismissed`). These are local state, not user data.
After import, active habit = keep current if it still exists, else the first
habit, else `null`.

## 2. Versioning & migration

Standard practice: **stamp a version, migrate older → current on read, refuse
anything newer than we understand.**

- **`CURRENT_SCHEMA_VERSION = 2`.**
- **Detect version** from the header row:
  - Header begins with `Schema Version` → read the integer from the data rows.
  - Header is exactly the legacy `Date,Habit Name,Status,Label,Note` → **v1
    (legacy)**.
  - Anything else → reject (`UNRECOGNIZED`).
- **Migrate forward** via version dispatch (`decodeV1`, `decodeV2`, …) that
  normalizes any supported version into a `Snapshot`. Structured so a future v3
  is one added step.
- **Refuse newer:** `version > CURRENT_SCHEMA_VERSION` → `NEWER_VERSION` error
  ("this backup was made by a newer version of the app; please update"). Never
  guess. This guard protects the export-on-new → import-on-old direction once
  more than one version exists in the wild.

The user's stated scenario — **export on old → import on new** — is the
backward-compat path the dispatch handles: the new app reads the old/unversioned
CSV and upgrades it.

**Legacy v1 import is explicitly best-effort (an accepted limit):**

- Habits are matched by **name** to an existing local habit; if none matches, a
  new habit is created with a generated id.
- `createdAt` defaults to import time; `color` and custom labels are lost.
- `Status` string → `boolean | null` as above; notes preserved.
- Each lossy assumption is recorded as a **warning** surfaced in the preview.

## 3. Merge engine & conflict modes

A **pure, storage-free** function — the heart of the feature and the most
heavily tested unit:

```ts
mergeSnapshots(
  local: Snapshot,
  imported: Snapshot,
  options: { conflictWinner: 'imported' | 'local'; mirror: boolean },
): { result: Snapshot; summary: ImportSummary }
```

Two settings, chosen at import time:

| Setting | Options | Effect |
|---|---|---|
| **On conflict** (same key, different value) | `imported` / `local` | Which value survives when both sides have data for the same `(habitId, date)` log, or the same habit's metadata fields |
| **Mirror file** ("zero out") | `false` (default) / `true` | `false` = union (keep everything). `true` = delete local-only logs **and** habits so the result equals the file; implies imported-wins |

Keys:

- Log conflicts keyed by **`(habitId, date)`**.
- Habit-metadata conflicts keyed by **`habitId`**.
- Legacy v1 (no IDs) is name-matched into ids during decode, so by the time data
  reaches the merge engine it is always id-keyed.

Mapping to the user's words: "imported overwrites local" = `conflictWinner:
'imported'`; "local wins" = `conflictWinner: 'local'`; "zero out" =
`mirror: true`.

**Change summary** — all counts are **changes relative to local state** (what the
user is about to gain or lose), so under local-wins a conflict that keeps the
local value counts as **no change**. Drives the preview and is asserted in tests:

```ts
interface ImportSummary {
  habitsAdded: number;     // in import, not local
  habitsUpdated: number;   // metadata that ends up different from local
  habitsDeleted: number;   // mirror only: local habit not in import
  logsAdded: number;       // (habitId, date) in import, not local
  logsOverwritten: number; // conflict where the resolved value differs from local
  logsDeleted: number;     // mirror only: local log not in import
  warnings: string[];      // from decode (legacy/lossy/dedup conflicts)
}
```

## 4. Validation rules (decode)

Decode is **strict where silent corruption is possible**, lenient only on
cosmetic fields. Any strict failure throws and **aborts the whole import** (no
partial state):

| Field | Rule | On violation |
|---|---|---|
| File | non-empty after BOM/whitespace strip; header present | `EMPTY` / `UNRECOGNIZED` |
| `Schema Version` | positive integer, **consistent** across rows, ≤ current | `MALFORMED` / `NEWER_VERSION` |
| Header columns | match the expected set for the detected version | `UNRECOGNIZED` |
| `Habit ID` (v2) | non-empty | `MALFORMED` |
| `Date` (when present) | matches `YYYY-MM-DD` and is a real calendar date | `MALFORMED` |
| `Status` (when `Date` present) | one of `Completed`/`Failed`/`Skipped` | `MALFORMED` |
| `Created At` | valid ISO; **lenient** → defaults to import time + warning | warning only |
| `Color`, labels, `Note` | any string, may be empty | accepted |
| Same `Habit ID`, differing metadata across rows | first row wins | warning only |

Errors are typed (`ImportError` with a `code` of `EMPTY`, `UNRECOGNIZED`,
`MALFORMED`, or `NEWER_VERSION`) so the UI maps each to a clear message. Error
messages include the offending row number where applicable.

## 5. Module architecture

Clean, isolated, each independently testable:

- **`src/utils/csv.ts`** *(new)* — low-level CSV only: `parseRows(text):
  string[][]` (RFC-4180-ish: quoted fields, doubled `""`, embedded commas and
  newlines, CRLF/LF, leading BOM) and `serializeRows(rows): string`. No habit
  knowledge.
- **`src/utils/exportSchema.ts`** *(new)* — domain encode/decode + versioning:
  `CURRENT_SCHEMA_VERSION`, `encodeSnapshot(snapshot): string`, `decodeCsv(text):
  { snapshot, version, warnings }`. Throws typed `ImportError`.
- **`src/utils/importMerge.ts`** *(new)* — pure `mergeSnapshots` + summary.
- **`src/store.ts`** *(modify)* — add `getFullSnapshot(): Snapshot` (all habits +
  all logs, including empty habits) and `replaceAllData(snapshot): void` (atomic
  persist: rewrite the habits map and habit partitions to match the snapshot;
  for mirror, delete partitions/habits not present in the result). Add an
  `importCsv(text, options): ImportSummary` orchestrator that
  decode → merge → persist and returns the summary.
- **`src/components/ImportData.vue`** *(new)* — file picker → options (conflict
  radio + mirror checkbox) → **change preview** (counts + warnings) → Apply.
- **`src/components/ExportData.vue`** + **`src/utils/export.ts`** *(modify)* — emit
  the new v2 CSV from `getFullSnapshot()`.

**Atomicity:** decode fully validates and merge fully computes **before any
write**. `replaceAllData` is the only writer and applies the already-computed
result in one pass. Any decode/merge error aborts with nothing persisted.

## 6. UI flow

An **Import** button beside the existing Export/Clear row → hidden file input →
on a valid file, a dialog showing:

1. **On conflict:** Imported wins (default) / Local wins.
2. **Mirror checkbox:** "Make my data exactly match this file (deletes local
   data not in the file)" — default off; when on, conflict resolution is forced
   to imported-wins.
3. **Change preview:** e.g. "+3 habits, 41 logs added, 5 overwritten, 12
   deleted" plus any decode warnings.
4. **Apply** / **Cancel.**

The preview exists specifically because mirror mode deletes data — the user
sees deletion counts before committing. On a decode error, the dialog shows the
mapped error message and no Apply.

## 7. Accepted limits

- No per-entry / interactive conflict resolution — one import-wide rule.
- Legacy (current) CSVs import best-effort, with losses recorded as warnings.
- Newer-than-supported files are rejected, not guessed.
- `activeHabitId` and UI prefs are not part of export/import.

## Testing

Test coverage is a **primary deliverable**. A bad import can destroy data, so we
cover ideal round-trips, every validation/error path, all merge modes, and the
atomicity guarantee. vitest + `@vue/test-utils`, matching existing patterns.

### `csv.ts` — low-level parse/serialize (`csv.test.ts`)

- `serializeRows` → `parseRows` round-trip for: plain values; values with
  commas; values with embedded `"` (doubled); values with embedded newlines;
  unicode (emoji labels).
- Parse handles: trailing newline; **CRLF and LF**; leading **BOM**; empty
  trailing fields; blank lines.
- Parse rejects/handles gracefully: unterminated quote; ragged row width
  (documented behavior).

### `exportSchema.ts` — encode/decode + versioning (`exportSchema.test.ts`)

**Ideal:**
- `encodeSnapshot` → `decodeCsv` **full round-trip** preserves habits (incl.
  `color`, raw labels, `createdAt`), logs (`true`/`false`/`null` + notes), and
  **habits with zero logs**.
- Notes containing commas, quotes, and newlines survive the round-trip.
- Status bijection: each of `true`/`false`/`null` round-trips exactly.

**Legacy v1:**
- A current-format (5-column, unversioned) CSV decodes: habits name-matched,
  statuses mapped, notes preserved, `createdAt` defaulted, **warnings emitted**
  for the lossy fields.

**Error cases (each asserts the specific `ImportError.code`):**
- Empty file / whitespace-only → `EMPTY`.
- Unknown header → `UNRECOGNIZED`.
- `Schema Version` = `3` (> current) → `NEWER_VERSION`.
- Non-integer / inconsistent `Schema Version` across rows → `MALFORMED`.
- Missing `Habit ID` in a v2 row → `MALFORMED`.
- Bad `Date` (`2026-13-99`, `06/01/2026`) → `MALFORMED`, message names the row.
- Bad `Status` (`Done`) on a dated row → `MALFORMED`.
- Invalid `Created At` → decodes with a **warning**, defaulted (lenient).
- Duplicate `Habit ID` with conflicting metadata → first wins + **warning**.

### `importMerge.ts` — merge engine (`importMerge.test.ts`)

The most exhaustive suite. For a local + imported pair, assert both the
`result` snapshot and the `summary` counts.

- **Union, no conflict:** disjoint habits/logs → both present; correct
  `*Added` counts; nothing deleted/overwritten.
- **Conflict, imported wins:** same `(habitId, date)` different status/note →
  imported value in result; `logsOverwritten` counted.
- **Conflict, local wins:** same key → local value retained; `logsOverwritten`
  = 0 (or counts unchanged values as not-overwritten — asserted explicitly).
- **Habit metadata conflict** (renamed/recolored same id) → resolved per
  `conflictWinner`; `habitsUpdated` counted.
- **Mirror = true:**
  - Local-only **logs** deleted → `logsDeleted` counted, absent from result.
  - Local-only **habits** deleted → `habitsDeleted` counted, absent from
    result.
  - Result is **exactly** the imported snapshot (deep-equal) regardless of
    `conflictWinner`.
- **Mirror = false:** local-only logs and habits are **retained** (regression
  guard against accidental deletion).
- **Idempotence:** importing the same file twice with imported-wins yields no
  further changes the second time (all summary deltas zero).
- **Empty local** (fresh install) + imported → equals imported, all adds.
- **Empty imported** + mirror=true → deletes everything (explicitly asserted as
  the documented, dangerous behavior).

### `store.ts` — persistence (`store.import.test.ts`)

- `getFullSnapshot` returns all habits (including zero-log habits) and all
  partitioned logs, correctly grouped by `habitId`.
- `replaceAllData` writes the habits map and rewrites partitions to match;
  **partitions/habits absent from the snapshot are removed** (mirror path).
- `replaceAllData` followed by `getFullSnapshot` round-trips a snapshot.
- `importCsv` end-to-end: decode → merge → persist updates localStorage; a
  decode error throws and **leaves localStorage unchanged** (atomicity).
- Active-habit reconciliation after import (current kept if present, else first,
  else null).

### `ExportData.vue` (`ExportData.test.ts`, updated)

- Emits a v2 CSV whose header is the new column set and whose first cell is the
  schema version.
- Round-trips through `decodeCsv` back to the store's snapshot.

### `ImportData.vue` (`ImportData.test.ts`, new)

- Renders the conflict radio + mirror checkbox; mirror forces imported-wins.
- Valid file → preview shows the summary counts and any warnings; Apply calls
  the store and persists.
- Decode error → mapped error message shown, **no Apply**, store untouched.
- Cancel makes no changes.

## Out of scope

- Interactive per-entry conflict resolution.
- Importing non-CSV formats (JSON, etc.).
- Round-tripping `activeHabitId` or UI preferences.
- Preserving color/custom-labels from legacy v1 files (lost by definition).
