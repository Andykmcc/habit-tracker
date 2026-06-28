import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ImportData from './ImportData.vue';
import { useHabitStore } from '../store';
import { encodeSnapshot } from '../utils/exportSchema';

const file = (text: string) => new File([text], 'import.csv', { type: 'text/csv' });

describe('ImportData.vue', () => {
  let pinia: any;
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    localStorage.clear();
  });

  it('renders the import button', () => {
    const wrapper = mount(ImportData, { global: { plugins: [pinia] } });
    expect(wrapper.find('[data-test="import-button"]').text()).toContain('Import');
  });

  it('shows a change preview for a valid file', async () => {
    const store = useHabitStore(pinia);
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');

    const csv = encodeSnapshot({
      habits: { [h1]: { id: h1, name: 'Run', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { [h1]: { '2026-06-01': { status: false, note: 'imported' }, '2026-06-02': { status: true } } },
    });

    const wrapper = mount(ImportData, { global: { plugins: [pinia] } });
    await (wrapper.vm as any).loadFile(file(csv));
    await wrapper.vm.$nextTick();

    const preview = wrapper.find('[data-test="preview"]').text();
    expect(preview).toContain('1'); // at least one overwritten/added count shown
    expect(wrapper.find('[data-test="apply"]').exists()).toBe(true);
  });

  it('applies the import on confirm', async () => {
    const store = useHabitStore(pinia);
    const h1 = store.createHabit('Run');
    store.setActiveHabit(h1);
    store.upsertLog('2026-06-01', true, 'local');

    const csv = encodeSnapshot({
      habits: { [h1]: { id: h1, name: 'Run', createdAt: '2026-01-01T00:00:00.000Z' } },
      logs: { [h1]: { '2026-06-01': { status: false, note: 'imported' } } },
    });

    const wrapper = mount(ImportData, { global: { plugins: [pinia] } });
    await (wrapper.vm as any).loadFile(file(csv));
    await wrapper.vm.$nextTick();
    await wrapper.find('[data-test="apply"]').trigger('click');

    expect(store.getFullSnapshot().logs[h1]!['2026-06-01']).toEqual({ status: false, note: 'imported' });
  });

  it('shows an error message for an unrecognized file and offers no apply', async () => {
    const wrapper = mount(ImportData, { global: { plugins: [pinia] } });
    await (wrapper.vm as any).loadFile(file('foo,bar\n1,2'));
    await wrapper.vm.$nextTick();

    expect(wrapper.find('[data-test="error"]').exists()).toBe(true);
    expect(wrapper.find('[data-test="apply"]').exists()).toBe(false);
  });

  it('mirror checkbox forces imported-wins', async () => {
    const wrapper = mount(ImportData, { global: { plugins: [pinia] } });
    const vm = wrapper.vm as any;
    vm.options.mirror = true;
    await wrapper.vm.$nextTick();
    expect(vm.options.conflictWinner).toBe('imported');
  });
});
