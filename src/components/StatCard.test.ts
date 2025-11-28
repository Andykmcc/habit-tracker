import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StatCard from './StatCard.vue';

describe('StatCard', () => {
    it('should render the name and value props', () => {
        // Arrange: Set up test data
        const testName = 'Current Streak';
        const testValue = 5;

        // Act: Mount the component with test props
        const wrapper = mount(StatCard, {
            props: {
                name: testName,
                value: testValue
            }
        });

        // Assert: Check that both props are rendered
        const valueElement = wrapper.find('.stat-card-value');
        const nameElement = wrapper.find('.stat-card-name');

        expect(valueElement.text()).toBe('5');
        expect(nameElement.text()).toBe('Current Streak');
    });

    it('should render string values correctly', () => {
        // Test with a string value (like "95%")
        const wrapper = mount(StatCard, {
            props: {
                name: 'Success Rate',
                value: '95%'
            }
        });

        const valueElement = wrapper.find('.stat-card-value');
        const nameElement = wrapper.find('.stat-card-name');

        expect(valueElement.text()).toBe('95%');
        expect(nameElement.text()).toBe('Success Rate');
    });

    it('should render zero values correctly', () => {
        // Test with zero to ensure it displays properly
        const wrapper = mount(StatCard, {
            props: {
                name: 'Best Streak',
                value: 0
            }
        });

        const valueElement = wrapper.find('.stat-card-value');
        expect(valueElement.text()).toBe('0');
    });
});
