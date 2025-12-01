<script setup lang="ts">
import { computed } from 'vue';
import { format, isToday } from 'date-fns';

// Modern v-model using defineModel for status (true = completed, false = failed, null = not set)
const status = defineModel<boolean | null>('status', { required: true });
const note = defineModel<string>('note', { default: '' });

// Props
const props = defineProps<{
  selectedDate: Date;
}>();

// Emits
const emit = defineEmits<{
  'return-to-today': [];
}>();

const toggleStatus = (newStatus: boolean) => {
  // If clicking the same status, clear it (set to null), otherwise set the new status
  status.value = status.value === newStatus ? null : newStatus;
};

const dateLabel = computed(() => {
  if (isToday(props.selectedDate)) {
    return 'Today';
  }
  return format(props.selectedDate, 'EEEE, MMMM d');
});
</script>

<template>
  <div class="bg-white rounded-2xl shadow-sm p-8 text-center">
    <!-- Date Header -->
    <div class="mb-4">
      <h2 class="text-xl font-semibold text-gray-700">{{ dateLabel }}</h2>
    </div>

    <div class="flex items-center justify-center gap-8 mb-6 flex-wrap">
      <!-- Negative Button -->
      <button 
        @click="toggleStatus(false)"
        class="rounded-full flex items-center justify-center text-5xl transition-all duration-300 focus:outline-none border-4 w-32 h-32 daily-action-negative-btn"
        :class="status === false ? 'bg-red-500 text-white border-red-200 hover:bg-red-600' : 'bg-gray-100 text-gray-400 border-gray-100 hover:bg-gray-200'"
      >
        <span>✕</span>
      </button>

      <!-- Positive Button -->
      <button 
        @click="toggleStatus(true)"
        class="rounded-full flex items-center justify-center text-5xl transition-all duration-300 focus:outline-none border-4 w-32 h-32 daily-action-positive-btn"
        :class="status === true ? 'bg-cyan-500 text-white border-cyan-200 hover:bg-cyan-600' : 'bg-gray-100 text-gray-400 border-gray-100 hover:bg-gray-200'"
      >
        <span>✓</span>
      </button>
    </div>
  
    <textarea 
      v-model="note"
      placeholder="Add a note for today (optional)"
      class="w-full mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-transparent resize-none daily-action-note"
      rows="2"
    ></textarea>
  </div>
</template>
