import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  applyResolvedTheme,
  getInitialLocale,
  getInitialThemePreference,
  resolveTheme,
} from '@/composables/usePreferences'

describe('preferences', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.removeAttribute('data-theme')
    vi.restoreAllMocks()
  })

  it('defaults to system theme and resolves the media preference', () => {
    expect(getInitialThemePreference()).toBe('system')
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })

  it('persists and applies an explicit theme without changing page content', () => {
    localStorage.setItem('pangupay.theme', 'dark')
    expect(getInitialThemePreference()).toBe('dark')
    applyResolvedTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(document.documentElement.style.colorScheme).toBe('light')
  })

  it('accepts only supported locales', () => {
    localStorage.setItem('pangupay.locale', 'en-US')
    expect(getInitialLocale()).toBe('en-US')
    localStorage.setItem('pangupay.locale', 'unsupported')
    expect(getInitialLocale()).toBe('zh-CN')
  })
})
