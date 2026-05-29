import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SuccessRateWidget from './SuccessRateWidget.vue';

describe('SuccessRateWidget', () => {
    it('renders all-time and recent rates as percentages', () => {
        const wrapper = mount(SuccessRateWidget, {
            props: { allTimeRate: 72, recentRate: 68 }
        });
        expect(wrapper.find('.all-time-rate').text()).toBe('72%');
        expect(wrapper.find('.recent-rate').text()).toBe('68%');
    });

    it('shows an up delta when recent beats all-time', () => {
        const wrapper = mount(SuccessRateWidget, {
            props: { allTimeRate: 60, recentRate: 75 }
        });
        const delta = wrapper.find('.rate-delta');
        expect(delta.exists()).toBe(true);
        expect(delta.text()).toContain('▲');
        expect(delta.text()).toContain('15');
        expect(delta.classes()).toContain('text-green-600');
    });

    it('shows a down delta when recent trails all-time', () => {
        const wrapper = mount(SuccessRateWidget, {
            props: { allTimeRate: 80, recentRate: 65 }
        });
        const delta = wrapper.find('.rate-delta');
        expect(delta.text()).toContain('▼');
        expect(delta.text()).toContain('15');
        expect(delta.classes()).toContain('text-red-600');
    });

    it('shows a neutral delta with no arrow when rates are equal', () => {
        const wrapper = mount(SuccessRateWidget, {
            props: { allTimeRate: 70, recentRate: 70 }
        });
        const delta = wrapper.find('.rate-delta');
        expect(delta.text()).toContain('±0');
        expect(delta.text()).not.toContain('▲');
        expect(delta.text()).not.toContain('▼');
    });

    it('renders an em dash and no delta when recentRate is null', () => {
        const wrapper = mount(SuccessRateWidget, {
            props: { allTimeRate: 50, recentRate: null }
        });
        expect(wrapper.find('.recent-rate').text()).toBe('—');
        expect(wrapper.find('.rate-delta').exists()).toBe(false);
    });
});
