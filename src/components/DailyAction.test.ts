import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DailyAction from './DailyAction.vue';

describe('DailyAction', () => {
    describe('UI state rendering', () => {
        it('should render completed state when status is true', () => {
            // Arrange & Act
            const wrapper = mount(DailyAction, {
                props: {
                    modelValue: true
                }
            });

            // Assert: Check status text
            const statusText = wrapper.find('.daily-action-status');
            expect(statusText.text()).toBe('Completed!');

            // Assert: Check positive button is active (has cyan background)
            const positiveBtn = wrapper.find('.daily-action-positive-btn');
            expect(positiveBtn.classes()).toContain('bg-cyan-500');
            expect(positiveBtn.classes()).toContain('text-white');

            // Assert: Check negative button is inactive (has gray background)
            const negativeBtn = wrapper.find('.daily-action-negative-btn');
            expect(negativeBtn.classes()).toContain('bg-gray-100');
            expect(negativeBtn.classes()).toContain('text-gray-400');
        });

        it('should render missed state when status is false', () => {
            // Arrange & Act
            const wrapper = mount(DailyAction, {
                props: {
                    modelValue: false
                }
            });

            // Assert: Check status text
            const statusText = wrapper.find('.daily-action-status');
            expect(statusText.text()).toBe('Missed');

            // Assert: Check negative button is active (has red background)
            const negativeBtn = wrapper.find('.daily-action-negative-btn');
            expect(negativeBtn.classes()).toContain('bg-red-500');
            expect(negativeBtn.classes()).toContain('text-white');

            // Assert: Check positive button is inactive (has gray background)
            const positiveBtn = wrapper.find('.daily-action-positive-btn');
            expect(positiveBtn.classes()).toContain('bg-gray-100');
            expect(positiveBtn.classes()).toContain('text-gray-400');
        });

        it('should render neutral state when status is null', () => {
            // Arrange & Act
            const wrapper = mount(DailyAction, {
                props: {
                    modelValue: null
                }
            });

            // Assert: Check status text
            const statusText = wrapper.find('.daily-action-status');
            expect(statusText.text()).toBe('Mark today');

            // Assert: Both buttons should be inactive (gray background)
            const positiveBtn = wrapper.find('.daily-action-positive-btn');
            expect(positiveBtn.classes()).toContain('bg-gray-100');
            expect(positiveBtn.classes()).toContain('text-gray-400');

            const negativeBtn = wrapper.find('.daily-action-negative-btn');
            expect(negativeBtn.classes()).toContain('bg-gray-100');
            expect(negativeBtn.classes()).toContain('text-gray-400');
        });
    });

    describe('User interactions', () => {
        it('should emit update when positive button is clicked from null state', async () => {
            // Arrange
            const wrapper = mount(DailyAction, {
                props: {
                    modelValue: null
                }
            });

            // Act: Click the positive button
            const positiveBtn = wrapper.find('.daily-action-positive-btn');
            await positiveBtn.trigger('click');

            // Assert: Check that update:modelValue event was emitted with true
            expect(wrapper.emitted('update:modelValue')).toBeTruthy();
            expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([true]);
        });

        it('should emit update when negative button is clicked from null state', async () => {
            // Arrange
            const wrapper = mount(DailyAction, {
                props: {
                    modelValue: null
                }
            });

            // Act: Click the negative button
            const negativeBtn = wrapper.find('.daily-action-negative-btn');
            await negativeBtn.trigger('click');

            // Assert: Check that update:modelValue event was emitted with false
            expect(wrapper.emitted('update:modelValue')).toBeTruthy();
            expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([false]);
        });

        it('should toggle to null when clicking active positive button', async () => {
            // Arrange: Start with completed state
            const wrapper = mount(DailyAction, {
                props: {
                    modelValue: true
                }
            });

            // Act: Click the positive button again
            const positiveBtn = wrapper.find('.daily-action-positive-btn');
            await positiveBtn.trigger('click');

            // Assert: Should emit null to clear the status
            expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null]);
        });

        it('should toggle to null when clicking active negative button', async () => {
            // Arrange: Start with missed state
            const wrapper = mount(DailyAction, {
                props: {
                    modelValue: false
                }
            });

            // Act: Click the negative button again
            const negativeBtn = wrapper.find('.daily-action-negative-btn');
            await negativeBtn.trigger('click');

            // Assert: Should emit null to clear the status
            expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([null]);
        });
    });
});
