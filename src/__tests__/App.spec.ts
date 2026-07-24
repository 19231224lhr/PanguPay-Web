import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'
import App from '../App.vue'

describe('App', () => {
  it('renders the active route outlet', () => {
    const wrapper = mount(App, {
      global: {
        stubs: {
          RouterView: { template: '<main data-router-view />' },
        },
      },
    })
    expect(wrapper.find('[data-router-view]').exists()).toBe(true)
  })
})
