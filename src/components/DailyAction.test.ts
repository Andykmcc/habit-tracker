import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import DailyAction from './DailyAction.vue';

describe('DailyAction', () => {
    describe('UI state rendering', () => {
        it('should render completed state when status is true', () => {
            // Arrange & Act
            const wrapper = mount(DailyAction, {
                props: {
                    status: true,
                    note: '',
                    selectedDate: new Date()
                }
            });

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
                    status: false,
                    note: '',
                    selectedDate: new Date()
                }
            });

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
                    status: null,
                    note: '',
                    selectedDate: new Date()
                }
            });

            // Assert: Both buttons should be inactive (gray background)
            const positiveBtn = wrapper.find('.daily-action-positive-btn');
            expect(positiveBtn.classes()).toContain('bg-gray-100');
            expect(positiveBtn.classes()).toContain('text-gray-400');

            const negativeBtn = wrapper.find('.daily-action-negative-btn');
            expect(negativeBtn.classes()).toContain('bg-gray-100');
            expect(negativeBtn.classes()).toContain('text-gray-400');
        });

        it('should render note textarea', () => {
            // Arrange & Act
            const wrapper = mount(DailyAction, {
                props: {
                    status: null,
                    note: '',
                    selectedDate: new Date()
                }
            });

            // Assert: Check note textarea exists
            const noteTextarea = wrapper.find('.daily-action-note');
            expect(noteTextarea.exists()).toBe(true);
            expect(noteTextarea.attributes('placeholder')).toBe('Add a note for today (optional)');
        });

        it('should display note content when provided', () => {
            // Arrange & Act
            const wrapper = mount(DailyAction, {
                props: {
                    status: true,
                    note: 'Test note content',
                    selectedDate: new Date()
                }
            });

            // Assert: Check note textarea has the content
            const noteTextarea = wrapper.find('.daily-action-note');
            expect((noteTextarea.element as HTMLTextAreaElement).value).toBe('Test note content');
        });
    });

    describe('User interactions', () => {
        it('should emit update when positive button is clicked from null state', async () => {
            // Arrange
            const wrapper = mount(DailyAction, {
                props: {
                    status: null,
                    note: '',
                    selectedDate: new Date()
                }
            });

            // Act: Click the positive button
            const positiveBtn = wrapper.find('.daily-action-positive-btn');
            await positiveBtn.trigger('click');

            // Assert: Check that update:status event was emitted with true
            expect(wrapper.emitted('update:status')).toBeTruthy();
            expect(wrapper.emitted('update:status')?.[0]).toEqual([true]);
        });

        it('should emit update when negative button is clicked from null state', async () => {
            // Arrange
            const wrapper = mount(DailyAction, {
                props: {
                    status: null,
                    note: '',
                    selectedDate: new Date()
                }
            });

            // Act: Click the negative button
            const negativeBtn = wrapper.find('.daily-action-negative-btn');
            await negativeBtn.trigger('click');

            // Assert: Check that update:status event was emitted with false
            expect(wrapper.emitted('update:status')).toBeTruthy();
            expect(wrapper.emitted('update:status')?.[0]).toEqual([false]);
        });

        it('should toggle to null when clicking active positive button', async () => {
            // Arrange: Start with completed state
            const wrapper = mount(DailyAction, {
                props: {
                    status: true,
                    note: '',
                    selectedDate: new Date()
                }
            });

            // Act: Click the positive button again
            const positiveBtn = wrapper.find('.daily-action-positive-btn');
            await positiveBtn.trigger('click');

            // Assert: Should emit null to clear the status
            expect(wrapper.emitted('update:status')?.[0]).toEqual([null]);
        });

        it('should toggle to null when clicking active negative button', async () => {
            // Arrange: Start with missed state
            const wrapper = mount(DailyAction, {
                props: {
                    status: false,
                    note: '',
                    selectedDate: new Date()
                }
            });

            // Act: Click the negative button again
            const negativeBtn = wrapper.find('.daily-action-negative-btn');
            await negativeBtn.trigger('click');

            // Assert: Should emit null to clear the status
            expect(wrapper.emitted('update:status')?.[0]).toEqual([null]);
        });

        it('should emit update:note when note is typed', async () => {
            // Arrange
            const wrapper = mount(DailyAction, {
                props: {
                    status: true,
                    note: '',
                    selectedDate: new Date()
                }
            });

            // Act: Type in the note textarea
            const noteTextarea = wrapper.find('.daily-action-note');
            await noteTextarea.setValue('New note');

            // Assert: Check that update:note event was emitted
            expect(wrapper.emitted('update:note')).toBeTruthy();
            expect(wrapper.emitted('update:note')?.[0]).toEqual(['New note']);
        });

        it('should allow clearing the note', async () => {
            // Arrange: Start with a note
            const wrapper = mount(DailyAction, {
                props: {
                    status: true,
                    note: 'Existing note',
                    selectedDate: new Date()
                }
            });

            // Act: Clear the note
            const noteTextarea = wrapper.find('.daily-action-note');
            await noteTextarea.setValue('');

            // Assert: Check that update:note event was emitted with empty string
            expect(wrapper.emitted('update:note')?.[0]).toEqual(['']);
        });
    });
});
