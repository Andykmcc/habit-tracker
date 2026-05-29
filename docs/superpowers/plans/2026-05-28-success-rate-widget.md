# Success Rate Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Success Rate comparison widget (all-time vs last 90 days, with an up/down delta) above the calendar, and move the existing stats grid below the calendar.

**Architecture:** Add a `recentSuccessRate` field to the existing `stats` computed in `App.vue` (pure date-filtering over the in-memory `logs`). Add a new presentational `SuccessRateWidget.vue` that receives all-time and recent rates as props (mirrors `StatCard.vue` — no store access). Re-order `App.vue`'s template so the widget sits above the calendar and the stats grid moves below it.

**Tech Stack:** Vue 3 (`<script setup>` + TS), Pinia, date-fns, Tailwind, Vitest + @vue/test-utils.

---

## File Structure

- **Modify** `src/App.vue` — add `recentSuccessRate` to the `stats` computed; import and render `SuccessRateWidget`; move the stats grid below the calendar.
- **Modify** `src/App.test.ts` — add computation tests for `recentSuccessRate` and an integration assertion that the widget renders.
- **Create** `src/components/SuccessRateWidget.vue` — presentational comparison card.
- **Create** `src/components/SuccessRateWidget.test.ts` — component tests.

### Key definitions (used across tasks)

- **Tracked day:** a log whose `status` is `true` or `false`. `null`/missing excluded.
- **Window:** rolling 90 days, inclusive. Date keys are `yyyy-MM-dd` strings, so lexicographic comparison is valid: a day is in-window when `date >= cutoffStr && date <= todayStr`, where `cutoffStr = format(subDays(new Date(), 90), 'yyyy-MM-dd')` and `todayStr = format(new Date(), 'yyyy-MM-dd')`.
- **`recentSuccessRate` type:** `number | null` — `null` when there are zero tracked days in the window (widget shows `—`).
- **Widget prop names:** `allTimeRate: number`, `recentRate: number | null`.
- **Widget test classes:** `.all-time-rate`, `.recent-rate`, `.rate-delta`.

---

## Task 1: Add `recentSuccessRate` to the `stats` computed

**Files:**
- Modify: `src/App.vue` (the `stats` computed, ~lines 91–166; note it has TWO `return` statements — the early one at ~line 142 and the final one at ~line 160)
- Test: `src/App.test.ts` (add to the existing `describe('stats computed - new metrics', ...)` block)

- [ ] **Step 1: Write the failing tests**

Add these three `it` blocks inside the existing `describe('stats computed - new metrics', () => { ... })` in `src/App.test.ts`. They reuse the `today`/`subDays` helpers already declared at the top of that describe block.

```ts
        it('should calculate recentSuccessRate over the rolling 90-day window', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            const ninetyOneDaysAgoStr = format(subDays(today, 91), 'yyyy-MM-dd');
            const ninetyDaysAgoStr = format(subDays(today, 90), 'yyyy-MM-dd');

            // Outside window (91 days ago): success — must be EXCLUDED from recent
            store.upsertLog(ninetyOneDaysAgoStr, true);
            // Inside window boundary (exactly 90 days ago): fail — must be INCLUDED
            store.upsertLog(ninetyDaysAgoStr, false);
            // Inside window (today): success
            store.upsertLog(todayStr, true);

            const wrapper = mount(App, { global: { plugins: [pinia] } });
            const stats = (wrapper.vm as any).stats;

            // All-time: 3 tracked, 2 success => 67
            expect(stats.successRate).toBe(67);
            // Recent: 2 tracked in-window (90-ago fail + today success), 1 success => 50
            expect(stats.recentSuccessRate).toBe(50);
        });

        it('should return null recentSuccessRate when no tracked days fall in the window', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            const hundredDaysAgoStr = format(subDays(today, 100), 'yyyy-MM-dd');
            // Only tracked day is outside the window
            store.upsertLog(hundredDaysAgoStr, true);
            // A recent day exists but is skipped (null) => not tracked
            store.upsertLog(todayStr, null);

            const wrapper = mount(App, { global: { plugins: [pinia] } });
            const stats = (wrapper.vm as any).stats;

            expect(stats.recentSuccessRate).toBeNull();
        });

        it('should return null recentSuccessRate for empty logs', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            const wrapper = mount(App, { global: { plugins: [pinia] } });
            const stats = (wrapper.vm as any).stats;

            expect(stats.successRate).toBe(0);
            expect(stats.recentSuccessRate).toBeNull();
        });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/App.test.ts`
Expected: FAIL — the three new tests fail because `stats.recentSuccessRate` is `undefined` (`toBe(50)` / `toBeNull()` fail).

- [ ] **Step 3: Compute `recentSuccessRate` in the `stats` computed**

In `src/App.vue`, find the block right after `successRate` is computed (currently ~line 97):

```js
  const successRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;
```

Immediately after that line, insert:

```js
  // Rolling 90-day window (inclusive). Date keys are yyyy-MM-dd, so string compare is valid.
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const cutoffStr = format(subDays(new Date(), 90), 'yyyy-MM-dd');
  const recentTracked = trackedDays.filter(([date]) => date >= cutoffStr && date <= todayStr);
  const recentTotal = recentTracked.length;
  const recentCompleted = recentTracked.filter(([_, log]) => log?.status === true).length;
  const recentSuccessRate = recentTotal > 0 ? Math.round((recentCompleted / recentTotal) * 100) : null;
```

(`format` and `subDays` are already imported at the top of `App.vue`. `trackedDays` is the existing array of `[date, log]` entries.)

- [ ] **Step 4: Add `recentSuccessRate` to BOTH return statements**

There are two `return` objects in this computed. Update both.

Early return (currently ~line 142, the "today is explicitly failed" branch):

```js
    return { successRate, recentSuccessRate, currentStreak: 0, avgPositiveStreak, avgNegativeStreak };
```

Final return (currently ~line 160):

```js
  return {
    successRate,
    recentSuccessRate,
    currentStreak,
    avgPositiveStreak,
    avgNegativeStreak
  };
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run src/App.test.ts`
Expected: PASS — all App tests pass, including the three new ones.

- [ ] **Step 6: Commit**

```bash
git add src/App.vue src/App.test.ts
git commit -m "feat: add recentSuccessRate (rolling 90-day) to stats"
```

---

## Task 2: Create the `SuccessRateWidget` component

**Files:**
- Create: `src/components/SuccessRateWidget.vue`
- Test: `src/components/SuccessRateWidget.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/components/SuccessRateWidget.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SuccessRateWidget from './SuccessRateWidget.vue';

describe('SuccessRateWidget', () => {
    it('renders all-time and recent rates as percentages', () => {
        const wrapper = mount(SuccessRateWidget, {
            props: { allTimeRate: 72, recentRate: 68 }
        });
        expect(wrapper.find('.all-time-rate').text()).toBe('72%');
        expect(wrapper.find('.recent-rate').text()).toBe('68%');
    });

    it('shows an up delta when recent beats all-time', () => {
        const wrapper = mount(SuccessRateWidget, {
            props: { allTimeRate: 60, recentRate: 75 }
        });
        const delta = wrapper.find('.rate-delta');
        expect(delta.exists()).toBe(true);
        expect(delta.text()).toContain('▲');
        expect(delta.text()).toContain('15');
        expect(delta.classes()).toContain('text-green-600');
    });

    it('shows a down delta when recent trails all-time', () => {
        const wrapper = mount(SuccessRateWidget, {
            props: { allTimeRate: 80, recentRate: 65 }
        });
        const delta = wrapper.find('.rate-delta');
        expect(delta.text()).toContain('▼');
        expect(delta.text()).toContain('15');
        expect(delta.classes()).toContain('text-red-600');
    });

    it('shows a neutral delta with no arrow when rates are equal', () => {
        const wrapper = mount(SuccessRateWidget, {
            props: { allTimeRate: 70, recentRate: 70 }
        });
        const delta = wrapper.find('.rate-delta');
        expect(delta.text()).toContain('±0');
        expect(delta.text()).not.toContain('▲');
        expect(delta.text()).not.toContain('▼');
    });

    it('renders an em dash and no delta when recentRate is null', () => {
        const wrapper = mount(SuccessRateWidget, {
            props: { allTimeRate: 50, recentRate: null }
        });
        expect(wrapper.find('.recent-rate').text()).toBe('—');
        expect(wrapper.find('.rate-delta').exists()).toBe(false);
    });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/components/SuccessRateWidget.test.ts`
Expected: FAIL — cannot resolve `./SuccessRateWidget.vue` (file does not exist yet).

- [ ] **Step 3: Create the component**

Create `src/components/SuccessRateWidget.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  allTimeRate: number;
  recentRate: number | null;
}>();

const hasRecent = computed(() => props.recentRate !== null);

const delta = computed(() =>
  props.recentRate === null ? 0 : props.recentRate - props.allTimeRate
);

const deltaLabel = computed(() => {
  if (delta.value > 0) return `▲ ${delta.value} pts`;
  if (delta.value < 0) return `▼ ${Math.abs(delta.value)} pts`;
  return '±0 pts';
});

const deltaClass = computed(() => {
  if (delta.value > 0) return 'text-green-600';
  if (delta.value < 0) return 'text-red-600';
  return 'text-gray-400';
});
</script>

<template>
  <div class="bg-white p-4 rounded-xl shadow-sm">
    <div class="text-xs text-gray-500 uppercase tracking-wide text-center mb-3">
      Success Rate
    </div>
    <div class="flex items-start justify-around">
      <div class="text-center">
        <div class="text-2xl font-bold text-gray-900 all-time-rate">{{ allTimeRate }}%</div>
        <div class="text-xs text-gray-500 uppercase tracking-wide">All-Time</div>
      </div>
      <div class="text-center">
        <div class="text-2xl font-bold text-gray-900 recent-rate">
          {{ recentRate === null ? '—' : `${recentRate}%` }}
        </div>
        <div class="text-xs text-gray-500 uppercase tracking-wide">Last 90 Days</div>
        <div
          v-if="hasRecent"
          class="text-xs font-medium mt-1 rate-delta"
          :class="deltaClass"
        >{{ deltaLabel }}</div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/components/SuccessRateWidget.test.ts`
Expected: PASS — all five component tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/SuccessRateWidget.vue src/components/SuccessRateWidget.test.ts
git commit -m "feat: add SuccessRateWidget comparison component"
```

---

## Task 3: Wire the widget into App.vue and reorder layout

**Files:**
- Modify: `src/App.vue` (imports, template)
- Test: `src/App.test.ts` (add an integration assertion)

- [ ] **Step 1: Write the failing test**

Add this `it` block to `src/App.test.ts`, inside the top-level `describe('App', ...)` (e.g. right after the existing `'should render without error'` test). Add the import at the top of the file alongside the other imports.

At the top of `src/App.test.ts`, add:

```ts
import SuccessRateWidget from './components/SuccessRateWidget.vue';
```

Then the test:

```ts
    it('renders the SuccessRateWidget wired to stats', () => {
        const pinia = createPinia();
        setActivePinia(pinia);
        const store = useHabitStore();
        store.createHabit('Test Habit');
        store.upsertLog(format(new Date(), 'yyyy-MM-dd'), true);

        const wrapper = mount(App, { global: { plugins: [pinia] } });
        const widget = wrapper.findComponent(SuccessRateWidget);

        expect(widget.exists()).toBe(true);
        // One tracked success today => both all-time and recent are 100
        expect(widget.props('allTimeRate')).toBe(100);
        expect(widget.props('recentRate')).toBe(100);
    });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/App.test.ts`
Expected: FAIL — `findComponent(SuccessRateWidget)` does not exist (`widget.exists()` is `false`), because the widget is not yet rendered in `App.vue`.

- [ ] **Step 3: Import the widget in App.vue**

In `src/App.vue`, add the import next to the other component imports (after the `StatCard` import line):

```js
import SuccessRateWidget from './components/SuccessRateWidget.vue';
```

- [ ] **Step 4: Render the widget above the calendar and move the stats grid below it**

In the `<template>`, the current order is: Stats Grid → Calendar. Change it to: SuccessRateWidget → Calendar → Stats Grid.

Replace this current block:

```html
      <!-- Stats Grid -->
      <div class="grid grid-cols-2 gap-4">
        <StatCard name="Current Streak" :value="stats.currentStreak" />
        <StatCard name="Avg Positive Streak" :value="stats.avgPositiveStreak" />
        <StatCard name="Avg Negative Streak" :value="stats.avgNegativeStreak" />
        <StatCard name="Success Rate" :value="`${stats.successRate}%`" />
      </div>

      <!-- Calendar -->
      <Calendar 
        :logs="logs" 
        :selected-date="selectedDate"
        @date-selected="selectDate"
      />
```

with this (widget moves above the calendar; the unchanged stats grid moves below it):

```html
      <!-- Success Rate Widget -->
      <SuccessRateWidget
        :all-time-rate="stats.successRate"
        :recent-rate="stats.recentSuccessRate"
      />

      <!-- Calendar -->
      <Calendar 
        :logs="logs" 
        :selected-date="selectedDate"
        @date-selected="selectDate"
      />

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 gap-4">
        <StatCard name="Current Streak" :value="stats.currentStreak" />
        <StatCard name="Avg Positive Streak" :value="stats.avgPositiveStreak" />
        <StatCard name="Avg Negative Streak" :value="stats.avgNegativeStreak" />
        <StatCard name="Success Rate" :value="`${stats.successRate}%`" />
      </div>
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/App.test.ts`
Expected: PASS — the integration test passes; all other App tests still pass.

- [ ] **Step 6: Run the full suite and type check**

Run: `npm test`
Expected: PASS — entire vitest suite passes with coverage.

Run: `npx vue-tsc -b`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/App.vue src/App.test.ts
git commit -m "feat: show SuccessRateWidget above calendar, move stats grid below"
```

---

## Self-Review Notes

- **Spec coverage:** rolling-90-day `recentSuccessRate` (Task 1), `null` → `—` no-data handling (Tasks 1 & 2), inclusive window boundary (Task 1 test), comparison widget with ▲/▼/±0 delta in pts (Task 2), all-time card kept in grid (unchanged in Task 3), widget above calendar + grid moved below (Task 3). All covered.
- **Type consistency:** `recentSuccessRate: number | null` is produced in `App.vue` and consumed as the `recentRate: number | null` prop; prop names `allTimeRate`/`recentRate` and classes `.all-time-rate`/`.recent-rate`/`.rate-delta` are identical across the component, its tests, and the App integration test.
- **Negative-day definition:** unchanged from existing code — only `true`/`false` are tracked; `null`/skipped excluded from both rates.
