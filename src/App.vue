<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { format, subDays, parseISO } from 'date-fns';
import { useHabitStore } from './store';
import { storeToRefs } from 'pinia';
import HabitHeader from './components/HabitHeader.vue';
import StatCard from './components/StatCard.vue';
import DailyAction from './components/DailyAction.vue';
import Calendar from './components/Calendar.vue';
import ClearButton from './components/ClearButton.vue';
import HabitSelector from './components/HabitSelector.vue';
import ExportData from './components/ExportData.vue';

import OnboardingToast from './components/OnboardingToast.vue';

// Check for new user BEFORE initializing store (which might create the key)
// If the key is missing, it's a new user.
const isNewUser = localStorage.getItem('habit-tracker-habits') === null;

// Store
const store = useHabitStore();
const { logs } = storeToRefs(store);

// Onboarding State
const showOnboarding = ref(false);

// Ensure a habit exists
onMounted(() => {
  if (Object.keys(store.habits).length === 0) {
    store.createHabit('Daily Habit');
  }

  // Check if we should show onboarding
  const isDismissed = localStorage.getItem('habit-tracker-onboarding-dismissed') === 'true';
  const isInstalled = window.matchMedia('(display-mode: standalone)').matches;

  if (isNewUser && !isDismissed && !isInstalled) {
    showOnboarding.value = true;
  }
});

const dismissOnboarding = () => {
  showOnboarding.value = false;
  localStorage.setItem('habit-tracker-onboarding-dismissed', 'true');
};

// Writable computed for activityName to work with v-model
const activityName = computed({
  get: () => store.activityName,
  set: (value: string) => store.setActivityName(value)
});

// State
const currentDate = ref(new Date());
const selectedDate = ref(new Date()); // Currently selected date for viewing/editing

// Computed
const selectedDateStr = computed(() => format(selectedDate.value, 'yyyy-MM-dd'));

// Writable computed for selected date's status to work with v-model
const selectedStatus = computed({
  get: () => store.logs[selectedDateStr.value]?.status ?? null,
  set: (status: boolean | null) => store.upsertLog(selectedDateStr.value, status)
});

// Writable computed for selected date's note to work with v-model
const selectedNote = computed({
  get: () => store.logs[selectedDateStr.value]?.note ?? '',
  set: (note: string) => store.setNote(selectedDateStr.value, note)
});

// Function to select a date
const selectDate = (date: Date) => {
  selectedDate.value = date;
};

// Computed Stats
const stats = computed(() => {
  const entries = Object.entries(logs.value);
  // Count days with ANY status (true or false) as tracked days, excluding null/undefined
  const trackedDays = entries.filter(([_, log]) => log?.status !== null && log?.status !== undefined);
  const totalDays = trackedDays.length;
  const completedDays = trackedDays.filter(([_, log]) => log?.status === true).length;
  const successRate = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

  // Current Streak
  let currentStreak = 0;
  let checkDate = new Date();
  
  // Check today
  const todayStatus = logs.value[format(checkDate, 'yyyy-MM-dd')]?.status;
  if (todayStatus === true) {
    currentStreak++;
    checkDate = subDays(checkDate, 1);
  } else if (todayStatus === false) {
    // Today is explicitly failed, streak is 0
    return { totalDays, successRate, currentStreak: 0, maxStreak: calculateMaxStreak() };
  } else {
    // Today is null, check yesterday
    checkDate = subDays(checkDate, 1);
  }
  
  // Check backwards
  while (true) {
    const status = logs.value[format(checkDate, 'yyyy-MM-dd')]?.status;
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
    .filter(d => logs.value[d]?.status === true)
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
  <div class="min-h-screen bg-gray-50 text-gray-900 font-sans p-2 py-4 sm:p-4">
    <div class="max-w-md mx-auto space-y-8">
      
      <!-- Header -->
      <HabitHeader v-model="activityName" :current-date="currentDate" />

      <!-- Main Action -->
      <DailyAction 
        v-model:status="selectedStatus" 
        v-model:note="selectedNote" 
        :selected-date="selectedDate"
        @return-to-today="selectDate(new Date())"
      />

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 gap-4">
        <StatCard name="Current Streak" :value="stats.currentStreak" />
        <StatCard name="Best Streak" :value="stats.maxStreak" />
        <StatCard name="Total Days" :value="stats.totalDays" />
        <StatCard name="Success Rate" :value="`${stats.successRate}%`" />
      </div>

      <!-- Calendar -->
      <Calendar 
        :logs="logs" 
        :selected-date="selectedDate"
        @date-selected="selectDate"
      />

      <!-- Habit selector and name -->
      <div class="flex items-center justify-center gap-3 mb-2">
        <HabitSelector />
      </div>

      <!-- Clear History Button -->
      <div class="flex justify-center gap-4">
        <ExportData />
        <ClearButton @clear="store.clearAllLogs()" />
      </div>

      <OnboardingToast 
        :show="showOnboarding" 
        @dismiss="dismissOnboarding" 
      />

    </div>
  </div>
</template>