<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, subDays, isToday, parseISO, addMonths, subMonths } from 'date-fns';
import { 
  getActivityNameObservable, 
  setActivityName, 
  getLogsObservable, 
  upsertLog,
  clearAllLogs,
  type DailyLogs 
} from './store';
import { Subscription } from 'rxjs';

// State
const activityName = ref('');
const logs = ref<DailyLogs>({});
const currentDate = ref(new Date());
const viewingMonth = ref(new Date());

// Subscriptions
const subscriptions: Subscription[] = [];

onMounted(() => {
  subscriptions.push(
    getActivityNameObservable().subscribe(name => activityName.value = name),
    getLogsObservable().subscribe(data => logs.value = data)
  );
});

onUnmounted(() => {
  subscriptions.forEach(sub => sub.unsubscribe());
});

// Actions
const updateActivityName = (e: Event) => {
  const target = e.target as HTMLInputElement;
  setActivityName(target.value);
};

const setStatus = (status: boolean | null) => {
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  upsertLog(todayStr, status);
};

const prevMonth = () => {
  viewingMonth.value = subMonths(viewingMonth.value, 1);
};

const nextMonth = () => {
  viewingMonth.value = addMonths(viewingMonth.value, 1);
};

// Hold-to-clear functionality
const isClearing = ref(false);
let clearTimeout: number | null = null;

const startClearHold = () => {
  isClearing.value = true;
  
  clearTimeout = window.setTimeout(() => {
    clearAllLogs();
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

// Computed Stats
const todayStr = computed(() => format(new Date(), 'yyyy-MM-dd'));
const todayStatus = computed(() => logs.value[todayStr.value]);

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

// Calendar Days
const calendarDays = computed(() => {
  const start = startOfMonth(viewingMonth.value);
  const end = endOfMonth(viewingMonth.value);
  const days = eachDayOfInterval({ start, end });
  
  // Pad start
  const startDay = start.getDay(); // 0 = Sunday
  const padding = Array(startDay).fill(null);
  
  return [...padding, ...days];
});

const getDayStatus = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return logs.value[dateStr];
};

const getDayClasses = (day: Date | null, index: number) => {
  if (!day) return [];
  
  const classes = ['border-r', 'border-b', 'border-gray-200'];
  const col = index % 7;
  const row = Math.floor(index / 7);
  
  // Left border: if first column OR previous cell is empty
  const prev = calendarDays.value[index - 1];
  if (col === 0 || !prev) classes.push('border-l');
  
  // Top border: if first row OR cell above is empty
  const above = calendarDays.value[index - 7];
  if (row === 0 || !above) classes.push('border-t');
  
  return classes;
};

</script>

<template>
  <div class="min-h-screen bg-gray-50 text-gray-900 font-sans p-4 sm:p-8">
    <div class="max-w-md mx-auto space-y-8">
      
      <!-- Header -->
      <header class="text-center space-y-2">
        <input 
          type="text" 
          :value="activityName" 
          @input="updateActivityName"
          class="text-3xl font-bold text-center bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors w-full"
          placeholder="Name your habit..."
        />
        <p class="text-gray-500">{{ format(currentDate, 'EEEE, MMMM do, yyyy') }}</p>
      </header>

      <!-- Main Action -->
      <div class="bg-white rounded-2xl shadow-sm p-8 text-center">
        <div class="flex items-center justify-center gap-8 mb-6 flex-wrap">
          <!-- Negative Button -->
          <button 
            @click="setStatus(todayStatus === false ? null : false)"
            class="rounded-full flex items-center justify-center text-5xl transition-all duration-300 focus:outline-none border-4 p-10"
            :class="todayStatus === false ? 'bg-red-500 text-white border-red-200 hover:bg-red-600' : 'bg-gray-100 text-gray-400 border-gray-100 hover:bg-gray-200'"
          >
            <span>✕</span>
          </button>

          <!-- Positive Button -->
          <button 
            @click="setStatus(todayStatus === true ? null : true)"
            class="rounded-full flex items-center justify-center text-5xl transition-all duration-300 focus:outline-none border-4 p-10"
            :class="todayStatus === true ? 'bg-cyan-500 text-white border-cyan-200 hover:bg-cyan-600' : 'bg-gray-100 text-gray-400 border-gray-100 hover:bg-gray-200'"
          >
            <span>✓</span>
          </button>
        </div>
      
        <p class="text-lg font-medium text-gray-500">
          {{ todayStatus === true ? 'Completed!' : todayStatus === false ? 'Missed' : 'Mark today' }}
        </p>
        

      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 gap-4">
        <div class="bg-white p-4 rounded-xl shadow-sm text-center">
          <div class="text-2xl font-bold text-blue-600">{{ stats.currentStreak }}</div>
          <div class="text-xs text-gray-500 uppercase tracking-wide">Current Streak</div>
        </div>
        <div class="bg-white p-4 rounded-xl shadow-sm text-center">
          <div class="text-2xl font-bold text-purple-600">{{ stats.maxStreak }}</div>
          <div class="text-xs text-gray-500 uppercase tracking-wide">Best Streak</div>
        </div>
        <div class="bg-white p-4 rounded-xl shadow-sm text-center">
          <div class="text-2xl font-bold text-orange-600">{{ stats.totalDays }}</div>
          <div class="text-xs text-gray-500 uppercase tracking-wide">Total Days</div>
        </div>
        <div class="bg-white p-4 rounded-xl shadow-sm text-center">
          <div class="text-2xl font-bold text-teal-600">{{ stats.successRate }}%</div>
          <div class="text-xs text-gray-500 uppercase tracking-wide">Success Rate</div>
        </div>
      </div>

      <!-- Calendar -->
      <div class="bg-white rounded-2xl shadow-sm p-6">
        <div class="flex items-center justify-between mb-4">
          <button @click="prevMonth" class="p-2 hover:bg-gray-100 rounded-full text-gray-500">←</button>
          <h3 class="font-semibold text-lg">{{ format(viewingMonth, 'MMMM yyyy') }}</h3>
          <button @click="nextMonth" class="p-2 hover:bg-gray-100 rounded-full text-gray-500">→</button>
        </div>
        
        <div class="grid grid-cols-7 gap-1 text-center text-sm mb-2">
          <div v-for="day in ['S','M','T','W','T','F','S']" :key="day" class="text-gray-400 font-medium">
            {{ day }}
          </div>
        </div>
        
        <div class="grid grid-cols-7">
          <div 
            v-for="(day, index) in calendarDays" 
            :key="index" 
            class="aspect-square flex items-center justify-center"
            :class="getDayClasses(day, index)"
          >
            <template v-if="day">
              <div 
                class="w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors"
                :class="[
                  getDayStatus(day) === true ? 'bg-cyan-500 text-white' : 
                  getDayStatus(day) === false ? 'bg-red-500 text-white' : 
                  'bg-gray-100 text-gray-400',
                  isToday(day) ? 'ring-2 ring-blue-500 ring-offset-1 p-4' : ''
                ]"
              >
                {{ format(day, 'd') }}
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- Clear History Button -->
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

    </div>
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


