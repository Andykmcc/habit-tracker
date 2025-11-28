<script setup lang="ts">
import { format } from 'date-fns';

// Props
defineProps<{
  currentDate: Date;
}>();

// Modern v-model using defineModel
const activityName = defineModel<string>({ required: true });
</script>

<template>
  <header class="text-center space-y-2">
    <input 
      v-model="activityName"
      type="text" 
      class="text-3xl font-bold text-center bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors w-full habit-header-name"
      placeholder="Name your habit..."
    />
    <p class="text-gray-500 habit-header-date">{{ format(currentDate, 'EEEE, MMMM do, yyyy') }}</p>
  </header>
</template>
