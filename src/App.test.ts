import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import App from './App.vue';

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
});
