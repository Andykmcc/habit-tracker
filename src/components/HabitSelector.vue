<script setup lang="ts">
import { computed, ref } from 'vue';
import { useHabitStore } from '../store';

const store = useHabitStore();

// Computed
const habitsList = computed(() => Object.values(store.habits));
const hasHabits = computed(() => habitsList.value.length > 0);

// State
const showDropdown = ref(false);
const newHabitName = ref('');
const showNewHabitForm = ref(false);

// Actions
const selectHabit = (habitId: string) => {
  store.setActiveHabit(habitId);
  showDropdown.value = false;
};

const createNewHabit = () => {
  if (!newHabitName.value.trim()) return;
  
  const newId = store.createHabit(newHabitName.value.trim());
  store.setActiveHabit(newId);
  
  // Reset form
  newHabitName.value = '';
  showNewHabitForm.value = false;
  showDropdown.value = false;
};

const deleteHabit = (habitId: string, event: Event) => {
  event.stopPropagation();
  
  if (habitsList.value.length === 1) {
    alert("You can't delete your last habit!");
    return;
  }
  
  if (confirm('Are you sure you want to delete this habit? This cannot be undone.')) {
    store.deleteHabit(habitId);
  }
};

const toggleDropdown = () => {
  showDropdown.value = !showDropdown.value;
  if (!showDropdown.value) {
    showNewHabitForm.value = false;
  }
};
</script>

<template>
  <div class="relative habit-selector">
    <!-- Trigger button -->
    <button
      @click="toggleDropdown"
      class="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 habit-selector-trigger"
    >
      <span class="truncate max-w-[200px]">{{ store.activeHabit?.name || 'Select Habit' }}</span>
      <svg class="w-4 h-4" :class="{ 'rotate-180': showDropdown }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </button>

    <!-- Dropdown menu -->
    <div
      v-if="showDropdown"
      class="absolute left-1/2 -translate-x-1/2 bottom-12 z-50 mt-2 w-72 max-w-[min(18rem,calc(100vw-2rem))] bg-white rounded-lg shadow-lg border border-gray-200"
    >
      <!-- Habits list -->
      <div class="max-h-64 overflow-y-auto py-1">
        <button
          v-for="habit in habitsList"
          :key="habit.id"
          @click="selectHabit(habit.id)"
          class="w-full px-4 py-2 text-left hover:bg-gray-50 flex items-center justify-between group habit-selector-item"
          :class="{ 'bg-blue-50': habit.id === store.activeHabitId }"
        >
          <span class="truncate">{{ habit.name }}</span>
          <button
            v-if="habitsList.length > 1"
            @click="deleteHabit(habit.id, $event)"
            class="p-1 text-red-600 hover:bg-red-50 rounded habit-selector-delete"
            title="Delete habit"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </button>

        <!-- Empty state -->
        <div v-if="!hasHabits" class="px-4 py-6 text-center text-gray-500 text-sm">
          No habits yet. Create your first one!
        </div>
      </div>

      <!-- Divider -->
      <div class="border-t border-gray-200"></div>

      <!-- New habit form -->
      <div v-if="showNewHabitForm" class="p-3">
        <input
          v-model="newHabitName"
          @keyup.enter="createNewHabit"
          @keyup.esc="showNewHabitForm = false"
          type="text"
          placeholder="Habit name..."
          class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 habit-selector-new-input"
          autofocus
        />
        <div class="flex gap-2 mt-2">
          <button
            @click="createNewHabit"
            class="flex-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Create
          </button>
          <button
            @click="showNewHabitForm = false"
            class="flex-1 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>

      <!-- New habit button -->
      <button
        v-else
        @click="showNewHabitForm = true"
        class="w-full px-4 py-2 text-left text-sm font-medium text-blue-600 hover:bg-blue-50 flex items-center gap-2 habit-selector-new-btn"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        Create New Habit
      </button>
    </div>

    <!-- Backdrop to close dropdown -->
    <div
      v-if="showDropdown"
      @click="showDropdown = false"
      class="fixed inset-0 z-40"
    ></div>
  </div>
</template>

<style scoped>
.rotate-180 {
  transform: rotate(180deg);
  transition: transform 0.2s;
}
</style>
