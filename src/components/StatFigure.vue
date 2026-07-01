<script setup lang="ts">
// A single statistic: a large value above a small uppercase caption. Shared by
// StatCard and SuccessRateWidget so the value/label styling lives in one place.
// The optional *Class props are seams for callers (and tests) to hook a figure.
defineProps<{
  value: number | string;
  label: string;
  valueClass?: string;
  labelClass?: string;
}>();
</script>

<template>
  <div>
    <div class="text-2xl font-bold text-gray-900" :class="valueClass">{{ value }}</div>
    <div class="text-xs text-gray-500 uppercase tracking-wide" :class="labelClass">{{ label }}</div>
  </div>
</template>
