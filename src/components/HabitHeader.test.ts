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

    const mountHeader = (modelValue: string) =>
        mount(HabitHeader, {
            props: {
                currentDate: new Date('2025-11-28T10:00:00'),
                modelValue
            },
            global: {
                plugins: [createPinia()]
            }
        });

    it('should emit an empty name while the user is clearing the field', async () => {
        const wrapper = mountHeader('Meditation');
        const input = wrapper.find('.habit-header-name');

        await input.trigger('focus');
        await input.setValue('');

        // Mid-edit the field stays empty — backspacing to empty is how mobile
        // users start a rename.
        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['']);
        expect((input.element as HTMLInputElement).value).toBe('');
    });

    it('should restore the previous name when the field is left empty on blur', async () => {
        const wrapper = mountHeader('Meditation');
        const input = wrapper.find('.habit-header-name');

        await input.trigger('focus');
        await input.setValue('   ');
        await input.trigger('blur');

        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Meditation']);
    });

    it('should keep a newly typed name on blur', async () => {
        const wrapper = mountHeader('Meditation');
        const input = wrapper.find('.habit-header-name');

        await input.trigger('focus');
        await input.setValue('');
        await input.setValue('Gym');
        await input.trigger('blur');

        expect(wrapper.emitted('update:modelValue')?.at(-1)).toEqual(['Gym']);
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
