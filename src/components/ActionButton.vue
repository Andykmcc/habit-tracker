<script setup lang="ts">
import { computed } from 'vue';

// Shared styling for the Export / Import / Clear data-action buttons. Only the
// color trio differs between them; everything else (listeners, extra classes,
// data-test, inline style, slot content) falls through to the <button>.
const props = defineProps<{
  variant: 'blue' | 'green' | 'red';
}>();

defineOptions({ inheritAttrs: false });

const VARIANTS = {
  blue: 'border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors',
  green: 'border-green-300 text-green-600 hover:bg-green-50 transition-colors',
  red: 'border-red-300 text-red-600',
} as const;

const variantClass = computed(() => VARIANTS[props.variant]);
</script>

<template>
  <div class="text-center">
    <button
      v-bind="$attrs"
      class="relative px-6 py-3 rounded-lg text-sm font-medium focus:outline-none border-2"
      :class="variantClass"
    >
      <slot />
    </button>
  </div>
</template>
