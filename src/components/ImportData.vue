<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useHabitStore } from '../store';
import type { ImportSummary } from '../store';
import type { ImportOptions } from '../utils/importMerge';
import { ImportError } from '../utils/exportSchema';

const store = useHabitStore();

const fileText = ref<string | null>(null);
const summary = ref<ImportSummary | null>(null);
const error = ref<string | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const options = reactive<ImportOptions>({ conflictWinner: 'imported', mirror: false });

// Mirror is a true restore: it implies imported-wins.
watch(() => options.mirror, (on) => {
  if (on) options.conflictWinner = 'imported';
});

const recompute = () => {
  if (fileText.value === null) return;
  try {
    summary.value = store.previewImport(fileText.value, { ...options });
    error.value = null;
  } catch (e) {
    summary.value = null;
    error.value = e instanceof ImportError ? e.message : 'Could not read this file.';
  }
};

watch(options, recompute);

const loadFile = async (file: File): Promise<void> => {
  reset();
  fileText.value = await file.text();
  recompute();
};

const onFileChange = (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) loadFile(file);
};

const apply = () => {
  if (fileText.value === null) return;
  try {
    store.importCsv(fileText.value, { ...options });
    close();
  } catch (e) {
    error.value = e instanceof ImportError ? e.message : 'Import failed unexpectedly.';
    summary.value = null;
  }
};

const reset = () => {
  fileText.value = null;
  summary.value = null;
  error.value = null;
  options.conflictWinner = 'imported';
  options.mirror = false;
};

const close = () => {
  reset();
  if (fileInput.value) fileInput.value.value = '';
};

defineExpose({ loadFile, apply, options, summary, error });
</script>

<template>
  <div class="text-center">
    <input
      ref="fileInput"
      type="file"
      accept=".csv,text/csv"
      class="hidden"
      @change="onFileChange"
    />
    <button
      data-test="import-button"
      class="relative px-6 py-3 rounded-lg text-sm font-medium focus:outline-none border-2 border-green-300 text-green-600 hover:bg-green-50 transition-colors"
      @click="fileInput?.click()"
    >
      Import Data
    </button>

    <div
      v-if="fileText !== null"
      class="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
    >
      <div class="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full text-left space-y-4">
        <h2 class="text-lg font-semibold">Import data</h2>

        <p v-if="error" data-test="error" class="text-red-600 text-sm">{{ error }}</p>

        <template v-else-if="summary">
          <fieldset class="space-y-2 text-sm">
            <legend class="font-medium mb-1">On conflict, keep:</legend>
            <label class="flex items-center gap-2">
              <input type="radio" value="imported" v-model="options.conflictWinner" :disabled="options.mirror" />
              Imported data
            </label>
            <label class="flex items-center gap-2">
              <input type="radio" value="local" v-model="options.conflictWinner" :disabled="options.mirror" />
              Existing local data
            </label>
          </fieldset>

          <label class="flex items-start gap-2 text-sm">
            <input type="checkbox" v-model="options.mirror" class="mt-1" />
            <span>Make my data exactly match this file (deletes local data not in the file)</span>
          </label>

          <div data-test="preview" class="text-sm bg-gray-50 rounded-lg p-3 space-y-0.5">
            <div>Habits: +{{ summary.habitsAdded }} added, {{ summary.habitsUpdated }} updated, {{ summary.habitsDeleted }} deleted</div>
            <div>Logs: +{{ summary.logsAdded }} added, {{ summary.logsOverwritten }} overwritten, {{ summary.logsDeleted }} deleted</div>
            <ul v-if="summary.warnings.length" class="text-amber-600 list-disc pl-5 pt-1">
              <li v-for="(w, i) in summary.warnings" :key="i">{{ w }}</li>
            </ul>
          </div>
        </template>

        <div class="flex justify-end gap-3 pt-2">
          <button class="px-4 py-2 text-sm text-gray-600" @click="close">Cancel</button>
          <button
            v-if="summary"
            data-test="apply"
            class="px-4 py-2 text-sm rounded-lg bg-green-600 text-white"
            @click="apply"
          >
            Apply
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
