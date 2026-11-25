import { computed, nextTick, readonly, ref } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'
export type ResolvedTheme = 'light' | 'dark'
export const localeNames = {
  'zh-CN': '简体中文',
  'en-US': 'English',
  'ja-JP': '日本語',
  'es-ES': 'Español',
  'fr-FR': 'Français',
} as const
export type SupportedLocale = keyof typeof localeNames

export function isSupportedLocale(value: string | null): value is SupportedLocale {
  return value !== null && Object.prototype.hasOwnProperty.call(localeNames, value)
}

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
  const stored = storageValue(LOCALE_KEY)
  return isSupportedLocale(stored) ? stored : 'zh-CN'
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

let reveal: ViewTransition | undefined
let fadeTimer: number | undefined

function transitionTheme(origin?: Element | null): void {
  const root = document.documentElement
  const next = resolveTheme(themePreference.value, systemPrefersDark.value)
  reveal?.skipTransition()
  if (root.dataset.theme === next || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    syncTheme()
    return
  }
  if (!document.startViewTransition || !CSS.supports('mask-image', 'radial-gradient(black, transparent)')) {
    window.clearTimeout(fadeTimer)
    root.classList.add('theme-crossfade')
    syncTheme()
    fadeTimer = window.setTimeout(() => root.classList.remove('theme-crossfade'), 330)
    return
  }
  const bounds = origin?.getBoundingClientRect()
  const x = bounds ? bounds.left + bounds.width / 2 : innerWidth / 2
  const y = bounds ? bounds.top + bounds.height / 2 : innerHeight / 2
  const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
  root.style.setProperty('--theme-origin', x + 'px ' + y + 'px')
  root.style.setProperty('--theme-radius', Math.ceil(radius) + 'px')
  root.classList.add('theme-reveal')
  const transition = document.startViewTransition(async () => {
    syncTheme()
    await nextTick()
  })
  reveal = transition
  void transition.ready.catch(() => {}) // A subsequent click can supersede this snapshot.
  void transition.finished.finally(() => {
    if (reveal !== transition) return
    reveal = undefined
    root.classList.remove('theme-reveal')
    root.style.removeProperty('--theme-origin')
    root.style.removeProperty('--theme-radius')
  })
}

export function usePreferences() {
  const resolvedTheme = computed(() => resolveTheme(themePreference.value, systemPrefersDark.value))

  function setTheme(preference: ThemePreference, origin: Element | null = document.activeElement): void {
    themePreference.value = preference
    localStorage.setItem(THEME_KEY, preference)
    transitionTheme(origin?.closest('label') ?? origin)
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
