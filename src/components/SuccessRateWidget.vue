<script setup lang="ts">
import { computed } from 'vue';
import StatFigure from './StatFigure.vue';

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
      <StatFigure
        class="text-center"
        :value="`${allTimeRate}%`"
        label="All-Time"
        value-class="all-time-rate"
      />
      <div class="text-center">
        <StatFigure
          :value="recentRate === null ? '—' : `${recentRate}%`"
          label="Last 90 Days"
          value-class="recent-rate"
        />
        <div
          v-if="hasRecent"
          class="text-xs font-medium mt-1 rate-delta"
          :class="deltaClass"
        >{{ deltaLabel }}</div>
      </div>
    </div>
  </div>
</template>
