import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import OnboardingToast from './OnboardingToast.vue';

describe('OnboardingToast.vue', () => {
    it('renders correctly when show is true', () => {
        const wrapper = mount(OnboardingToast, {
            props: {
                show: true,
            },
        });

        expect(wrapper.text()).toContain('Welcome to Habit Tracker');
        expect(wrapper.text()).toContain('This app runs entirely on your device');
        expect(wrapper.text()).toContain('Add to Home Screen');
    });

    it('does not render when show is false', () => {
        const wrapper = mount(OnboardingToast, {
            props: {
                show: false,
            },
        });

        expect(wrapper.text()).toBe('');
    });

    it('emits dismiss event when close button is clicked', async () => {
        const wrapper = mount(OnboardingToast, {
            props: {
                show: true,
            },
        });

        // Find the close button (the one with the SVG)
        const closeButton = wrapper.find('button.text-gray-400');
        await closeButton.trigger('click');

        expect(wrapper.emitted('dismiss')).toBeTruthy();
        expect(wrapper.emitted('dismiss')?.length).toBe(1);
    });

    it('emits dismiss event when "Got it" button is clicked', async () => {
        const wrapper = mount(OnboardingToast, {
            props: {
                show: true,
            },
        });

        // Find the "Got it" button
        const gotItButton = wrapper.find('button.bg-blue-600');
        await gotItButton.trigger('click');

        expect(wrapper.emitted('dismiss')).toBeTruthy();
        expect(wrapper.emitted('dismiss')?.length).toBe(1);
    });
});
