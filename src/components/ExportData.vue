<script setup lang="ts">
import { useHabitStore } from '../store';
import { generateCsvContent } from '../utils/export';

const store = useHabitStore();

const exportData = () => {
  const logs = store.getAllLogs();
  
  if (logs.length === 0) {
    alert('No data to export');
    return;
  }

  const csvContent = generateCsvContent(logs);

  // Create download link
  // Add BOM for Excel compatibility
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', `habit-tracker-export-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  
  // Cleanup disabled to rule out race conditions
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 2000);
};
</script>

<template>
  <div class="mt-8 text-center">
    <button 
      @click="exportData"
      class="relative px-6 py-3 rounded-lg text-sm font-medium focus:outline-none border-2 border-blue-300 text-blue-600 hover:bg-blue-50 transition-colors"
    >
      Export Data
    </button>
  </div>
</template>
