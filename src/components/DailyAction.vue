<script setup lang="ts">
// Modern v-model using defineModel for status (true = completed, false = failed, null = not set)
const status = defineModel<boolean | null>({ required: true });

const toggleStatus = (newStatus: boolean) => {
  // If clicking the same status, clear it (set to null), otherwise set the new status
  status.value = status.value === newStatus ? null : newStatus;
};
</script>

<template>
  <div class="bg-white rounded-2xl shadow-sm p-8 text-center">
    <div class="flex items-center justify-center gap-8 mb-6 flex-wrap">
      <!-- Negative Button -->
      <button 
        @click="toggleStatus(false)"
        class="rounded-full flex items-center justify-center text-5xl transition-all duration-300 focus:outline-none border-4 p-10 daily-action-negative-btn"
        :class="status === false ? 'bg-red-500 text-white border-red-200 hover:bg-red-600' : 'bg-gray-100 text-gray-400 border-gray-100 hover:bg-gray-200'"
      >
        <span>✕</span>
      </button>

      <!-- Positive Button -->
      <button 
        @click="toggleStatus(true)"
        class="rounded-full flex items-center justify-center text-5xl transition-all duration-300 focus:outline-none border-4 p-10 daily-action-positive-btn"
        :class="status === true ? 'bg-cyan-500 text-white border-cyan-200 hover:bg-cyan-600' : 'bg-gray-100 text-gray-400 border-gray-100 hover:bg-gray-200'"
      >
        <span>✓</span>
      </button>
    </div>
  
    <p class="text-lg font-medium text-gray-500 daily-action-status">
      {{ status === true ? 'Completed!' : status === false ? 'Missed' : 'Mark today' }}
    </p>
  </div>
</template>
