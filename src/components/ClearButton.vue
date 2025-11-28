<script setup lang="ts">
import { ref } from 'vue';

// Emit clear event when hold is complete
const emit = defineEmits<{
  clear: [];
}>();

// Hold-to-clear functionality
const isClearing = ref(false);
let clearTimeout: number | null = null;

const startClearHold = () => {
  isClearing.value = true;
  
  clearTimeout = window.setTimeout(() => {
    emit('clear');
    isClearing.value = false;
  }, 3000); // 3 seconds
};

const stopClearHold = () => {
  if (clearTimeout) {
    window.clearTimeout(clearTimeout);
    clearTimeout = null;
  }
  isClearing.value = false;
};
</script>

<template>
  <div class="mt-8 text-center">
    <button 
      @mousedown="startClearHold"
      @mouseup="stopClearHold"
      @mouseleave="stopClearHold"
      @touchstart="startClearHold"
      @touchend="stopClearHold"
      @touchcancel="stopClearHold"
      class="relative px-6 py-3 rounded-lg text-sm font-medium focus:outline-none border-2 border-red-300 text-red-600 overflow-hidden"
      style="user-select: none; -webkit-user-select: none;"
    >
      <!-- Progress bar background -->
      <div 
        class="absolute inset-0 bg-red-100 origin-left"
        :class="isClearing ? 'clear-progress-active' : 'clear-progress-inactive'"
      ></div>
      
      <!-- Button text -->
      <span class="relative z-10">
        {{ isClearing ? 'Hold to Clear...' : 'Clear All History' }}
      </span>
    </button>
  </div>
</template>

<style scoped>
.clear-progress-inactive {
  width: 0%;
  transition: width 0.15s ease-out;
}

.clear-progress-active {
  width: 100%;
  transition: width 3s linear;
}
</style>
