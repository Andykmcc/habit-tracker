<script setup lang="ts">
import { ref } from 'vue';
import { format } from 'date-fns';

// Props
defineProps<{
  currentDate: Date;
}>();

// Modern v-model using defineModel
const activityName = defineModel<string>({ required: true });

// The field is allowed to be empty while editing — clearing it with backspace
// before typing a new name is the normal mobile rename gesture. Only once the
// user leaves the field do we fall back, restoring the name they started with
// rather than stranding the habit nameless.
const nameBeforeEdit = ref('');

const onFocus = () => {
  nameBeforeEdit.value = activityName.value;
};

const onBlur = () => {
  if (!activityName.value.trim() && nameBeforeEdit.value) {
    activityName.value = nameBeforeEdit.value;
  }
};
</script>

<template>
  <header class="text-center space-y-2 mb-4">
    <input
      spellcheck="false"
      v-model="activityName"
      @focus="onFocus"
      @blur="onBlur"
      type="text"
      class="text-3xl font-bold text-center bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none transition-colors w-full habit-header-name"
      placeholder="Name your habit..."
    />
    <p class="text-gray-500 habit-header-date">{{ format(currentDate, 'EEEE, MMMM do, yyyy') }}</p>
  </header>
</template>
