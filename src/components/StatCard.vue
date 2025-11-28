<script setup lang="ts">
defineProps<{
  name: string;
  value: number | string;
}>();
</script>

<template>
  <div class="bg-white p-4 rounded-xl shadow-sm text-center">
    <div class="text-2xl font-bold text-gray-900 stat-card-value">{{ value }}</div>
    <div class="text-xs text-gray-500 uppercase tracking-wide stat-card-name">{{ name }}</div>
  </div>
</template>
