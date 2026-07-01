import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import StatFigure from './StatFigure.vue';

describe('StatFigure', () => {
  it('renders the value and label', () => {
    const wrapper = mount(StatFigure, { props: { value: '72%', label: 'All-Time' } });
    expect(wrapper.text()).toContain('72%');
    expect(wrapper.text()).toContain('All-Time');
  });

  it('renders zero and other non-string values', () => {
    const wrapper = mount(StatFigure, { props: { value: 0, label: 'Streak' } });
    expect(wrapper.text()).toContain('0');
  });

  it('applies valueClass and labelClass hooks to the right elements', () => {
    const wrapper = mount(StatFigure, {
      props: { value: 5, label: 'Streak', valueClass: 'the-value', labelClass: 'the-label' },
    });
    expect(wrapper.find('.the-value').text()).toBe('5');
    expect(wrapper.find('.the-label').text()).toBe('Streak');
  });
});
