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

    describe('stats computed - new metrics', () => {
        const today = new Date();
        const todayStr = format(today, 'yyyy-MM-dd');
        const yesterdayStr = format(subDays(today, 1), 'yyyy-MM-dd');
        const twoDaysAgoStr = format(subDays(today, 2), 'yyyy-MM-dd');
        const threeDaysAgoStr = format(subDays(today, 3), 'yyyy-MM-dd');
        const fourDaysAgoStr = format(subDays(today, 4), 'yyyy-MM-dd');

        afterEach(() => {
            localStorage.clear();
        });

        it('should calculate avgPositiveStreak correctly', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            // Streak 1: 2 days (true, true)
            store.upsertLog(fourDaysAgoStr, true);
            store.upsertLog(threeDaysAgoStr, true);

            // Break: false
            store.upsertLog(twoDaysAgoStr, false);

            // Streak 2: 1 day (true)
            store.upsertLog(yesterdayStr, true);

            // Today: false
            store.upsertLog(todayStr, false);

            const wrapper = mount(App, {
                global: {
                    plugins: [pinia]
                }
            });

            const vm = wrapper.vm as any;
            const stats = vm.stats;

            // Streaks are [2, 1]. Average is 1.5
            expect(stats.avgPositiveStreak).toBe(1.5);
            expect(stats.avgNegativeStreak).toBe(1); // 2 failures, each length 1
        });

        it('should calculate avgNegativeStreak correctly', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            // Negative Streak 1: 2 days (false, false)
            store.upsertLog(fourDaysAgoStr, false);
            store.upsertLog(threeDaysAgoStr, false);

            // Break: true
            store.upsertLog(twoDaysAgoStr, true);

            // Negative Streak 2: 1 day (false)
            store.upsertLog(yesterdayStr, false);

            const wrapper = mount(App, {
                global: {
                    plugins: [pinia]
                }
            });

            const vm = wrapper.vm as any;
            const stats = vm.stats;

            expect(stats.avgNegativeStreak).toBe(1.5);
            // Positive streaks: [1] (from twoDaysAgoStr)
            expect(stats.avgPositiveStreak).toBe(1);
        });

        it('should handle zero streaks', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            const wrapper = mount(App, {
                global: {
                    plugins: [pinia]
                }
            });

            const vm = wrapper.vm as any;
            const stats = vm.stats;

            expect(stats.avgPositiveStreak).toBe(0);
            expect(stats.avgNegativeStreak).toBe(0);
            expect(stats.successRate).toBe(0);
        });

        it('should calculate successRate and currentStreak correctly', () => {
            const pinia = createPinia();
            setActivePinia(pinia);
            const store = useHabitStore();
            store.createHabit('Test Habit');

            // 3 days tracked, 2 success, 1 fail
            store.upsertLog(twoDaysAgoStr, true);
            store.upsertLog(yesterdayStr, true);
            store.upsertLog(todayStr, false);

            const wrapper = mount(App, {
                global: {
                    plugins: [pinia]
                }
            });

            const vm = wrapper.vm as any;
            const stats = vm.stats;

            expect(stats.successRate).toBe(67); // 2/3 * 100 rounded
            expect(stats.currentStreak).toBe(0); // broken by today's failure
        });
    });
});
