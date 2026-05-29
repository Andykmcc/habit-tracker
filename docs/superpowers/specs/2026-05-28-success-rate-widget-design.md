# Success Rate Widget — Design

**Date:** 2026-05-28
**Status:** Approved (pending spec review)

## Goal

Replace the standalone "Success Rate" stat card with a dedicated **Success Rate
comparison widget** that shows the user's all-time success rate alongside their
**last-90-days** success rate, plus a delta indicating whether recent
performance is up or down versus their all-time baseline.

A predictive "probability tomorrow is a negative day" feature was considered and
**explicitly dropped** from scope.

## Definitions

- **Tracked day**: a date whose log `status` is `true` (success) or `false`
  (fail). Days with `status === null` or no entry (skipped/untracked) are
  **excluded** from all rate math — both numerator and denominator. This matches
  the existing `successRate` logic in `App.vue`.
- **Success rate** = `round(100 × successes / tracked)` over the relevant set of
  tracked days.
- **Last 90 days window**: rolling, inclusive. A tracked day counts if its date
  is `>= subDays(today, 90)` and `<= today`.

## Computation

Extend the existing `stats` computed in `src/App.vue` (currently at ~line 91).

Add one field:

- `recentSuccessRate: number | null`
  - Filter `logs` to tracked days within the rolling 90-day window.
  - If the window contains **0 tracked days**, the value is `null` (the widget
    renders `—`, not a misleading `0%`).
  - Otherwise `round(100 × recentSuccesses / recentTracked)`.

The existing `successRate` (all-time) is unchanged. Note: the all-time card
currently shows `0%` when there is no data; this behavior is intentionally left
as-is to avoid scope creep.

This computation is pure date-filtering over the in-memory `logs` ref — no new
storage, no migration.

## Component

New file: `src/components/SuccessRateWidget.vue`

- **Purely presentational** (mirrors `StatCard.vue` — no store access). All
  values are passed in by `App.vue`.
- **Props:**
  - `allTimeRate: number` — already a whole-number percentage.
  - `recentRate: number | null` — whole-number percentage, or `null` when no
    tracked days exist in the window.
- **Rendering:**
  - Full-width card titled "Success Rate".
  - Two figures side by side: **All-Time** and **Last 90 Days**.
  - **Delta** (only when `recentRate !== null`): `recentRate - allTimeRate`,
    shown in percentage points with a direction marker:
    - `> 0` → `▲` green
    - `< 0` → `▼` red
    - `= 0` → gray `±0 pts`, no arrow
  - When `recentRate === null`: the "Last 90 Days" figure shows `—` and the
    delta is hidden.
- **Styling:** match existing card aesthetic (`bg-white p-4 rounded-xl
  shadow-sm`), Tailwind, consistent type scale with `StatCard`.

### Example (conceptual)

```
┌─────────────────────────────────────┐
│             SUCCESS RATE             │
│   All-Time          Last 90 Days     │
│     72%               68% ▼ 4 pts    │
└─────────────────────────────────────┘
```

## App.vue integration

- Render `<SuccessRateWidget :all-time-rate="stats.successRate"
  :recent-rate="stats.recentSuccessRate" />` as a full-width section, placed
  **above** the streak grid.
- **Remove** the existing `<StatCard name="Success Rate" ... />` from the 2×2
  grid so the all-time rate is not duplicated.
- The remaining three streak cards (Current Streak, Avg Positive Streak, Avg
  Negative Streak) stay in the `grid grid-cols-2` layout, producing a 2 + 1
  arrangement. This minor cosmetic gap is accepted for now; switching the streak
  grid to `grid-cols-3` is a trivial follow-up if desired.

## Edge cases

| Case | Behavior |
| --- | --- |
| No logs at all | All-time `0%` (unchanged); recent `—`, no delta. |
| Logs exist but none in last 90 days | All-time computed; recent `—`, no delta. |
| Tracked day exactly 90 days ago | **Included** (window is inclusive). |
| Recent == all-time | Delta neutral/`0`, no arrow. |
| Window has only skipped (`null`) days | Treated as 0 tracked → recent `—`. |

## Testing

Follow the existing vitest + `@vue/test-utils` patterns.

1. **Computation tests** (in `App.test.ts` or a focused stats test):
   - Normal mix of success/fail across recent and old days → correct all-time
     and recent rates.
   - Window boundary: a fail exactly 90 days ago is counted; a fail 91 days ago
     is not.
   - All-skipped (`null`) recent window → `recentSuccessRate === null`.
   - Empty logs → all-time `0`, recent `null`.
2. **Component tests** (`SuccessRateWidget.test.ts`):
   - Renders both figures and the percentage signs.
   - `recentRate` higher than `allTimeRate` → `▲` and positive delta.
   - `recentRate` lower → `▼` and negative delta.
   - `recentRate === null` → renders `—`, no delta element.
   - `recentRate === allTimeRate` → neutral delta, no arrow.

## Out of scope

- Predictive "probability tomorrow is negative" feature (dropped).
- Changing the all-time card's `0%`-on-no-data behavior.
- Restructuring the streak grid beyond removing the Success Rate card.
