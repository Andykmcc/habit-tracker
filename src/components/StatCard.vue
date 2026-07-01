<script setup lang="ts">
import StatFigure from './StatFigure.vue';

defineProps<{
  name: string;
  value: number | string;
}>();
</script>

<template>
  <div class="bg-white p-4 rounded-xl shadow-sm text-center">
    <StatFigure
      :value="value"
      :label="name"
      value-class="stat-card-value"
      label-class="stat-card-name"
    />
  </div>
</template>
