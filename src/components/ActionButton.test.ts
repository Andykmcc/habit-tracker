import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import ActionButton from './ActionButton.vue';

describe('ActionButton', () => {
  it('renders slot content inside a button', () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'blue' },
      slots: { default: 'Export Data' },
    });
    const button = wrapper.find('button');
    expect(button.exists()).toBe(true);
    expect(button.text()).toBe('Export Data');
  });

  it('applies the color classes for its variant on top of the shared base', () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'green' },
      slots: { default: 'Import' },
    });
    const cls = wrapper.find('button').classes();
    expect(cls).toContain('border-green-300');
    expect(cls).toContain('text-green-600');
    expect(cls).toContain('border-2'); // shared base always present
  });

  it('passes attributes and extra classes through to the button (merging with the base)', () => {
    const wrapper = mount(ActionButton, {
      props: { variant: 'red' },
      attrs: { 'data-test': 'clear-btn', class: 'overflow-hidden' },
      slots: { default: 'Clear' },
    });
    const button = wrapper.find('button');
    expect(button.attributes('data-test')).toBe('clear-btn');
    expect(button.classes()).toContain('overflow-hidden');
    expect(button.classes()).toContain('border-red-300');
  });

  it('forwards native listeners to the button', async () => {
    const onClick = vi.fn();
    const wrapper = mount(ActionButton, {
      props: { variant: 'blue' },
      attrs: { onClick },
      slots: { default: 'Export' },
    });
    await wrapper.find('button').trigger('click');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
