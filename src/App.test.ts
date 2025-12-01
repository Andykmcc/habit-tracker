import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { format, subDays } from 'date-fns';
import App from './App.vue';
import { useHabitStore } from './store';

describe('App', () => {
    beforeEach(() => {
        setActivePinia(createPinia());
    });

    it('should render without error', () => {
        const wrapper = mount(App, {
            global: {
                plugins: [createPinia()]
            }
        });
        expect(wrapper.exists()).toBe(true);
    });

    describe('stats computed - todayStatus scenarios', () => {
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
        const twoDaysAgoStr = format(subDays(today, 2), 'yyyy-MM-dd');
        const threeDaysAgoStr = format(subDays(today, 3), 'yyyy-MM-dd');

        afterEach(() => {
            localStorage.clear();
        });

        it('should calculate currentStreak when todayStatus is true', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            // Set up logs: today = true, yesterday = true, two days ago = true
            store.upsertLog(todayStr, true);
            store.upsertLog(yesterdayStr, true);
            store.upsertLog(twoDaysAgoStr, true);

            const wrapper = mount(App, {
                global: {
                    plugins: [pinia]
                }
            });

            const vm = wrapper.vm as any;
            const stats = vm.stats;

            expect(stats.currentStreak).toBe(3);
            expect(stats.totalDays).toBe(3);
            expect(stats.successRate).toBe(100);
        });

        it('should set currentStreak to 0 when todayStatus is false', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            // Set up logs: today = false, yesterday = true, two days ago = true
            store.upsertLog(todayStr, false);
            store.upsertLog(yesterdayStr, true);
            store.upsertLog(twoDaysAgoStr, true);

            const wrapper = mount(App, {
                global: {
                    plugins: [pinia]
                }
            });

            const vm = wrapper.vm as any;
            const stats = vm.stats;

            // When today is false, current streak should be 0
            expect(stats.currentStreak).toBe(0);
            expect(stats.totalDays).toBe(3);
            expect(stats.successRate).toBe(67); // 2 out of 3 = 66.67% rounded to 67%
        });

        it('should check yesterday when todayStatus is null', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            // Set up logs: today = null, yesterday = true, two days ago = true
            // Today is null (no entry), yesterday and two days ago are true
            store.upsertLog(yesterdayStr, true);
            store.upsertLog(twoDaysAgoStr, true);

            const wrapper = mount(App, {
                global: {
                    plugins: [pinia]
                }
            });

            const vm = wrapper.vm as any;
            const stats = vm.stats;

            // When today is null, it should count yesterday's streak
            expect(stats.currentStreak).toBe(2);
            expect(stats.totalDays).toBe(2); // Only tracked days count
            expect(stats.successRate).toBe(100);
        });

        it('should handle todayStatus null with no previous streak', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            // Set up logs: today = null, yesterday = false
            store.upsertLog(yesterdayStr, false);

            const wrapper = mount(App, {
                global: {
                    plugins: [pinia]
                }
            });

            const vm = wrapper.vm as any;
            const stats = vm.stats;

            // When today is null and yesterday is false, streak should be 0
            expect(stats.currentStreak).toBe(0);
            expect(stats.totalDays).toBe(1);
            expect(stats.successRate).toBe(0);
        });

        it('should handle mixed streak with todayStatus null', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            // Set up logs: today = null, yesterday = true, two days ago = false, three days ago = true
            store.upsertLog(yesterdayStr, true);
            store.upsertLog(twoDaysAgoStr, false);
            store.upsertLog(threeDaysAgoStr, true);

            const wrapper = mount(App, {
                global: {
                    plugins: [pinia]
                }
            });

            const vm = wrapper.vm as any;
            const stats = vm.stats;

            // When today is null, check yesterday (true), but two days ago breaks it
            expect(stats.currentStreak).toBe(1);
            expect(stats.totalDays).toBe(3);
            expect(stats.successRate).toBe(67); // 2 out of 3
        });
    });
});
