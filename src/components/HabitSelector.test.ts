import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import HabitSelector from './HabitSelector.vue';
import { useHabitStore } from '../store';

describe('HabitSelector', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
        localStorage.clear();
    });

    describe('Rendering and dropdown', () => {
        it('should render the trigger button', () => {
            const wrapper = mount(HabitSelector, {
                global: {
                    plugins: [createPinia()]
                }
            });

            const trigger = wrapper.find('.habit-selector-trigger');
            expect(trigger.exists()).toBe(true);
        });

        it('should show dropdown when trigger is clicked', async () => {
            const wrapper = mount(HabitSelector, {
                global: {
                    plugins: [createPinia()]
                }
            });

            const trigger = wrapper.find('.habit-selector-trigger');

            // Initially dropdown should not be visible
            expect(wrapper.find('.habit-selector-item').exists()).toBe(false);

            // Click to open dropdown
            await trigger.trigger('click');

            // Dropdown should be visible (if there are habits)
            // The dropdown structure should exist
            expect(wrapper.html()).toContain('Create New Habit');
        });
    });

    describe('selectHabit', () => {
        it('should switch to selected habit', async () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();

            // Create two habits
            const habit1 = store.createHabit('Morning Routine');
            const habit2 = store.createHabit('Evening Meditation');

            store.setActiveHabit(habit1);

            const wrapper = mount(HabitSelector, {
                global: {
                    plugins: [pinia]
                }
            });

            // Open dropdown
            await wrapper.find('.habit-selector-trigger').trigger('click');

            // Find all habit items
            const habitItems = wrapper.findAll('.habit-selector-item');
            expect(habitItems.length).toBe(2);

            // Click the second habit
            await habitItems[1]!.trigger('click');

            // Active habit should now be habit2
            expect(store.activeHabitId).toBe(habit2);
            expect(store.activityName).toBe('Evening Meditation');
        });

        it('should close dropdown after selecting a habit', async () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();

            store.createHabit('Habit 1');
            store.createHabit('Habit 2');

            const wrapper = mount(HabitSelector, {
                global: {
                    plugins: [pinia]
                }
            });

            // Open dropdown
            await wrapper.find('.habit-selector-trigger').trigger('click');

            // Select a habit
            const habitItems = wrapper.findAll('.habit-selector-item');
            await habitItems[0]!.trigger('click');

            // Wait for next tick
            await wrapper.vm.$nextTick();


            // Dropdown should be closed (check that items are not in DOM)
            expect(wrapper.findAll('.habit-selector-item').length).toBe(0);
        });
    });

    describe('createNewHabit', () => {
        it('should create a new habit when name is entered', async () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();

            const wrapper = mount(HabitSelector, {
                global: {
                    plugins: [pinia]
                }
            });

            // Open dropdown
            await wrapper.find('.habit-selector-trigger').trigger('click');

            // Click "Create New Habit" button
            const newHabitBtn = wrapper.find('.habit-selector-new-btn');
            await newHabitBtn.trigger('click');

            // Input field should appear
            const input = wrapper.find('.habit-selector-new-input');
            expect(input.exists()).toBe(true);

            // Enter habit name
            await input.setValue('Drinking Water');

            // Submit by pressing enter
            await input.trigger('keyup.enter');

            // Wait for updates
            await wrapper.vm.$nextTick();

            // Check that habit was created in store
            const habits = Object.values(store.habits);
            const waterHabit = habits.find(h => h.name === 'Drinking Water');
            expect(waterHabit).toBeDefined();
        });

        it('should not create habit with empty name', async () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();

            const initialHabitCount = Object.keys(store.habits).length;

            const wrapper = mount(HabitSelector, {
                global: {
                    plugins: [pinia]
                }
            });

            // Open dropdown
            await wrapper.find('.habit-selector-trigger').trigger('click');

            // Click "Create New Habit" button
            await wrapper.find('.habit-selector-new-btn').trigger('click');

            // Try to submit without entering a name
            const input = wrapper.find('.habit-selector-new-input');
            await input.trigger('keyup.enter');

            await wrapper.vm.$nextTick();

            // Habit count should not have changed
            expect(Object.keys(store.habits).length).toBe(initialHabitCount);
        });

        it('should set newly created habit as active', async () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();

            // Create an initial habit
            const habit1 = store.createHabit('Existing Habit');
            store.setActiveHabit(habit1);

            const wrapper = mount(HabitSelector, {
                global: {
                    plugins: [pinia]
                }
            });

            // Open dropdown and create new habit
            await wrapper.find('.habit-selector-trigger').trigger('click');
            await wrapper.find('.habit-selector-new-btn').trigger('click');

            const input = wrapper.find('.habit-selector-new-input');
            await input.setValue('New Habit');
            await input.trigger('keyup.enter');

            await wrapper.vm.$nextTick();

            // The new habit should be active
            expect(store.activityName).toBe('New Habit');
        });
    });

    describe('deleteHabit', () => {
        it('should delete a habit when confirmed', async () => {
            // Mock window.confirm
            const originalConfirm = window.confirm;
            window.confirm = vi.fn(() => true);

            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();

            // Create two habits
            const habit1 = store.createHabit('Habit 1');
            const habit2 = store.createHabit('Habit 2');

            const wrapper = mount(HabitSelector, {
                global: {
                    plugins: [pinia]
                }
            });

            // Open dropdown
            await wrapper.find('.habit-selector-trigger').trigger('click');

            // Find delete buttons
            const deleteButtons = wrapper.findAll('.habit-selector-delete');
            expect(deleteButtons.length).toBe(2);

            // Click delete on first habit
            await deleteButtons[0]!.trigger('click');

            await wrapper.vm.$nextTick();

            // Habit 1 should be deleted
            expect(store.habits[habit1]).toBeUndefined();
            expect(store.habits[habit2]).toBeDefined();

            // Restore
            window.confirm = originalConfirm;
        });

        it('should not delete habit when cancelled', async () => {
            // Mock window.confirm to return false
            const originalConfirm = window.confirm;
            window.confirm = vi.fn(() => false);

            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();

            const habit1 = store.createHabit('Habit 1');
            const habit2 = store.createHabit('Habit 2');

            const wrapper = mount(HabitSelector, {
                global: {
                    plugins: [pinia]
                }
            });

            // Open dropdown
            await wrapper.find('.habit-selector-trigger').trigger('click');

            // Click delete
            const deleteButtons = wrapper.findAll('.habit-selector-delete');
            await deleteButtons[0]!.trigger('click');

            await wrapper.vm.$nextTick();

            // Both habits should still exist
            expect(store.habits[habit1]).toBeDefined();
            expect(store.habits[habit2]).toBeDefined();

            // Restore
            window.confirm = originalConfirm;
        });

        it('should prevent deleting the last habit', async () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();

            // Create only one habit
            const habit1 = store.createHabit('Only Habit');

            const wrapper = mount(HabitSelector, {
                global: {
                    plugins: [pinia]
                }
            });

            // Open dropdown
            await wrapper.find('.habit-selector-trigger').trigger('click');

            // Try to find delete button (should not exist for single habit)
            const deleteButtons = wrapper.findAll('.habit-selector-delete');

            // With only one habit, delete button should not be visible
            // The v-if condition in template prevents it
            expect(deleteButtons.length).toBe(0);

            // Habit should still exist
            expect(store.habits[habit1]).toBeDefined();
        });
    });
});
