<script setup lang="ts">
import { ref, computed } from 'vue';
import { format, subDays, parseISO } from 'date-fns';
import { useHabitStore } from './store';
import { storeToRefs } from 'pinia';
import HabitHeader from './components/HabitHeader.vue';
import StatCard from './components/StatCard.vue';
import DailyAction from './components/DailyAction.vue';
import Calendar from './components/Calendar.vue';
import ClearButton from './components/ClearButton.vue';

// Store
const store = useHabitStore();
const { logs } = storeToRefs(store);

// Writable computed for activityName to work with v-model
const activityName = computed({
  get: () => store.activityName,
  set: (value: string) => store.setActivityName(value)
});

// State
const currentDate = ref(new Date());

// Computed
const todayStr = computed(() => format(new Date(), 'yyyy-MM-dd'));

// Writable computed for todayStatus to work with v-model
const todayStatus = computed({
  get: () => store.logs[todayStr.value] ?? null,
  set: (status: boolean | null) => store.upsertLog(todayStr.value, status)
});

// Computed Stats
const stats = computed(() => {
  const entries = Object.entries(logs.value);
  // Count days with ANY status (true or false) as tracked days, excluding null/undefined
  const trackedDays = entries.filter(([_, val]) => val !== null && val !== undefined);
  const totalDays = trackedDays.length;
  const completedDays = trackedDays.filter(([_, val]) => val === true).length;
  const successRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  // Current Streak
  let currentStreak = 0;
  let checkDate = new Date();
  
  // Check today
  if (logs.value[format(checkDate, 'yyyy-MM-dd')] === true) {
    currentStreak++;
    checkDate = subDays(checkDate, 1);
  } else if (logs.value[format(checkDate, 'yyyy-MM-dd')] === false) {
    // Today is explicitly failed, streak is 0
    return { totalDays, successRate, currentStreak: 0, maxStreak: calculateMaxStreak() };
  } else {
    // Today is null, check yesterday
    checkDate = subDays(checkDate, 1);
  }
  
  // Check backwards
  while (true) {
    const status = logs.value[format(checkDate, 'yyyy-MM-dd')];
    if (status === true) {
      currentStreak++;
      checkDate = subDays(checkDate, 1);
    } else {
      // False or Null breaks streak
      break;
    }
  }

  return {
    totalDays,
    successRate,
    currentStreak,
    maxStreak: calculateMaxStreak()
  };
});

const calculateMaxStreak = () => {
  const sortedDates = Object.keys(logs.value)
    .filter(d => logs.value[d] === true)
    .sort();
  
  let maxStreak = 0;
  let tempStreak = 0;
  let lastDate: Date | null = null;

  for (const dateStr of sortedDates) {
    const d = parseISO(dateStr);
    if (!lastDate) {
      tempStreak = 1;
    } else {
      const diff = (d.getTime() - lastDate.getTime()) / (1000 * 3600 * 24);
      if (diff === 1) {
        tempStreak++;
      } else {
        tempStreak = 1;
      }
    }
    if (tempStreak > maxStreak) maxStreak = tempStreak;
    lastDate = d;
  }
  return maxStreak;
};

</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 sm:p-8">
    <div class="max-w-md mx-auto space-y-8">
      
      <!-- Header -->
      <HabitHeader v-model="activityName" :current-date="currentDate" />

      <!-- Main Action -->
      <DailyAction v-model="todayStatus" />

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 gap-4">
        <StatCard name="Current Streak" :value="stats.currentStreak" />
        <StatCard name="Best Streak" :value="stats.maxStreak" />
        <StatCard name="Total Days" :value="stats.totalDays" />
        <StatCard name="Success Rate" :value="`${stats.successRate}%`" />
      </div>

      <!-- Calendar -->
      <Calendar :logs="logs" />

      <!-- Clear History Button -->
      <ClearButton @clear="store.clearAllLogs()" />

    </div>
  </div>
</template>


