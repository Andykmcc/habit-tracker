import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import ClearButton from './ClearButton.vue';

describe('ClearButton', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should render with initial state', () => {
        const wrapper = mount(ClearButton);

        const button = wrapper.find('button');
        expect(button.exists()).toBe(true);
        expect(button.text()).toContain('Clear All History');
    });

    it('should show "Hold to Clear..." when mouse is held down', async () => {
        const wrapper = mount(ClearButton);
        const button = wrapper.find('button');

        // Trigger mousedown
        await button.trigger('mousedown');

        // Check that text changes
        expect(button.text()).toContain('Hold to Clear...');
    });

    it('should emit clear event after holding for 3 seconds', async () => {
        const wrapper = mount(ClearButton);
        const button = wrapper.find('button');

        // Trigger mousedown to start the hold
        await button.trigger('mousedown');

        // Fast-forward time by 3 seconds
        vi.advanceTimersByTime(3000);
        await wrapper.vm.$nextTick();

        // Assert: clear event should be emitted
        expect(wrapper.emitted('clear')).toBeTruthy();
        expect(wrapper.emitted('clear')).toHaveLength(1);
    });

    it('should not emit clear event if released before 3 seconds', async () => {
        const wrapper = mount(ClearButton);
        const button = wrapper.find('button');

        // Start the hold
        await button.trigger('mousedown');

        // Release after 1 second (before 3 seconds)
        vi.advanceTimersByTime(1000);
        await button.trigger('mouseup');

        // Fast-forward the rest of the time
        vi.advanceTimersByTime(2000);
        await wrapper.vm.$nextTick();

        // Assert: clear event should NOT be emitted
        expect(wrapper.emitted('clear')).toBeFalsy();
    });

    it('should reset when mouse leaves the button', async () => {
        const wrapper = mount(ClearButton);
        const button = wrapper.find('button');

        // Start the hold
        await button.trigger('mousedown');
        expect(button.text()).toContain('Hold to Clear...');

        // Mouse leaves the button
        await button.trigger('mouseleave');

        // Text should reset
        expect(button.text()).toContain('Clear All History');

        // Fast-forward time
        vi.advanceTimersByTime(3000);
        await wrapper.vm.$nextTick();

        // Clear event should NOT be emitted
        expect(wrapper.emitted('clear')).toBeFalsy();
    });

    it('should work with touch events', async () => {
        const wrapper = mount(ClearButton);
        const button = wrapper.find('button');

        // Trigger touchstart
        await button.trigger('touchstart');
        expect(button.text()).toContain('Hold to Clear...');

        // Fast-forward time by 3 seconds
        vi.advanceTimersByTime(3000);
        await wrapper.vm.$nextTick();

        // Assert: clear event should be emitted
        expect(wrapper.emitted('clear')).toBeTruthy();
    });

    it('should cancel on touchend before completion', async () => {
        const wrapper = mount(ClearButton);
        const button = wrapper.find('button');

        // Start touch hold
        await button.trigger('touchstart');

        // End touch after 1 second
        vi.advanceTimersByTime(1000);
        await button.trigger('touchend');

        // Fast-forward remaining time
        vi.advanceTimersByTime(2000);
        await wrapper.vm.$nextTick();

        // Clear event should NOT be emitted
        expect(wrapper.emitted('clear')).toBeFalsy();
    });

    it('should show progress animation when holding', async () => {
        const wrapper = mount(ClearButton);
        const button = wrapper.find('button');

        // Check initial state - progress bar should be inactive
        const progressBar = wrapper.find('.clear-progress-inactive');
        expect(progressBar.exists()).toBe(true);

        // Start holding
        await button.trigger('mousedown');

        // Progress bar should now be active
        const activeProgressBar = wrapper.find('.clear-progress-active');
        expect(activeProgressBar.exists()).toBe(true);
    });
});
