<script setup lang="ts">
import { useHabitStore } from '../store';
import { encodeSnapshot } from '../utils/exportSchema';
import ActionButton from './ActionButton.vue';

const store = useHabitStore();

const exportData = () => {
  const snapshot = store.getFullSnapshot();

  if (Object.keys(snapshot.habits).length === 0) {
    alert('No data to export');
    return;
  }

  const csvContent = encodeSnapshot(snapshot);

  // Create download link. Add BOM for Excel compatibility.
  const blob = new Blob([String.fromCharCode(0xFEFF) + csvContent], { type: 'text/csv;charset=utf-8' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', `habit-tracker-export-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, 2000);
};
</script>

<template>
  <ActionButton variant="blue" @click="exportData">Export Data</ActionButton>
</template>
