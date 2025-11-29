import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import HabitHeader from './HabitHeader.vue';

describe('HabitHeader', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('should render the date in the correct format', () => {
        // Arrange: Create a specific date for testing
        const testDate = new Date('2025-11-28T10:00:00');

        // Act: Mount the component with the test date
        const wrapper = mount(HabitHeader, {
            props: {
                currentDate: testDate,
                modelValue: 'Test Habit'
            },
            global: {
                plugins: [createPinia()]
            }
        });

        // Assert: Check that the date is formatted as "EEEE, MMMM do, yyyy"
        // Expected format: "Friday, November 28th, 2025"
        const dateText = wrapper.find('.habit-header-date').text();
        expect(dateText).toBe('Friday, November 28th, 2025');
    });

    it('should render different dates correctly', () => {
        // Test with a different date to ensure formatting works for various inputs
        const testDate = new Date('2024-01-01T10:00:00');

        const wrapper = mount(HabitHeader, {
            props: {
                currentDate: testDate,
                modelValue: 'Daily Exercise'
            },
            global: {
                plugins: [createPinia()]
            }
        });

        const dateText = wrapper.find('.habit-header-date').text();
        expect(dateText).toBe('Monday, January 1st, 2024');
    });
});
