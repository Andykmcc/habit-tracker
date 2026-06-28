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
