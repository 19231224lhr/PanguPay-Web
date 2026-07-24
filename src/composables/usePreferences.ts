import { computed, readonly, ref } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export type SupportedLocale = 'zh-CN' | 'en-US'

const THEME_KEY = 'pangupay.theme'
const LOCALE_KEY = 'pangupay.locale'
const themePreference = ref<ThemePreference>('system')
const locale = ref<SupportedLocale>('zh-CN')
const systemPrefersDark = ref(false)
let initialized = false

function storageValue(key: string): string | null {
  return typeof localStorage === 'undefined' ? null : localStorage.getItem(key)
}

export function getInitialThemePreference(): ThemePreference {
  const stored = storageValue(THEME_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
}

export function getInitialLocale(): SupportedLocale {
  return storageValue(LOCALE_KEY) === 'en-US' ? 'en-US' : 'zh-CN'
}

export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return prefersDark ? 'dark' : 'light'
  return preference
}

export function applyResolvedTheme(theme: ResolvedTheme): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = theme
  document.documentElement.style.colorScheme = theme
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#08080A' : '#F2F3F5')
}

function syncTheme(): void {
  applyResolvedTheme(resolveTheme(themePreference.value, systemPrefersDark.value))
}

export function initializePreferences(): void {
  if (initialized || typeof window === 'undefined') return
  initialized = true
  const media = window.matchMedia('(prefers-color-scheme: dark)')
  themePreference.value = getInitialThemePreference()
  locale.value = getInitialLocale()
  document.documentElement.lang = locale.value
  systemPrefersDark.value = media.matches
  media.addEventListener('change', (event) => {
    systemPrefersDark.value = event.matches
    if (themePreference.value === 'system') syncTheme()
  })
  syncTheme()
}

export function usePreferences() {
  const resolvedTheme = computed(() => resolveTheme(themePreference.value, systemPrefersDark.value))

  function setTheme(preference: ThemePreference): void {
    themePreference.value = preference
    localStorage.setItem(THEME_KEY, preference)
    syncTheme()
  }

  function setLocale(nextLocale: SupportedLocale): void {
    locale.value = nextLocale
    localStorage.setItem(LOCALE_KEY, nextLocale)
    document.documentElement.lang = nextLocale
  }

  return {
    locale: readonly(locale),
    resolvedTheme,
    setLocale,
    setTheme,
    themePreference: readonly(themePreference),
  }
}
