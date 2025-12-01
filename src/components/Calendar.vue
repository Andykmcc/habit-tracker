<script setup lang="ts">
import { ref, computed } from 'vue';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from 'date-fns';
import type { DailyLogs } from '../store';

// Props
const props = defineProps<{
  logs: DailyLogs;
  selectedDate: Date;
}>();

// Emits
const emit = defineEmits<{
  'date-selected': [date: Date];
}>();

// State
const viewingMonth = ref(new Date());

// Actions
const prevMonth = () => {
  viewingMonth.value = subMonths(viewingMonth.value, 1);
};

const nextMonth = () => {
  viewingMonth.value = addMonths(viewingMonth.value, 1);
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
  return props.logs[dateStr]?.status;
};

const hasNote = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  return !!props.logs[dateStr]?.note;
};

const isClickable = (date: Date) => {
  // Allow clicking on past dates and today, but not future dates
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate <= today;
};

const isSelected = (date: Date) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const selectedStr = format(props.selectedDate, 'yyyy-MM-dd');
  return dateStr === selectedStr;
};

const handleDateClick = (date: Date) => {
  if (isClickable(date)) {
    emit('date-selected', date);
  }
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
            class="relative w-full h-full flex flex-col items-center justify-center"
            :class="isClickable(day) ? 'cursor-pointer' : 'cursor-default'"
            @click="handleDateClick(day)"
          >
            <div 
              class="w-8 h-8 flex items-center justify-center rounded-full text-sm transition-colors"
              :class="[
                getDayStatus(day) === true ? 'bg-cyan-500 text-white' : 
                getDayStatus(day) === false ? 'bg-red-500 text-white' : 
                'bg-gray-100 text-gray-400',
                isToday(day) ? 'ring-2 ring-blue-500 ring-offset-1' : '',
                isSelected(day) ? 'ring-2 ring-purple-500 ring-offset-2' : ''
              ]"
            >
              {{ format(day, 'd') }}
            </div>
            <!-- Note indicator -->
            <div 
              v-if="hasNote(day)"
              class="absolute top-1 right-1 w-1 h-1 bg-blue-400 rounded-full"
            />
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
