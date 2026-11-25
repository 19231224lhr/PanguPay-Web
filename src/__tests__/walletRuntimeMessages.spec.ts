import { afterEach, expect, it } from 'vitest'
import { computed } from 'vue'

import i18n from '@/i18n'
import { localeNames } from '@/composables/usePreferences'
import { addressLabel, organizationLabel, wl, wt } from '@/i18n/walletText'

const initialLocale = i18n.global.locale.value
afterEach(() => {
  i18n.global.locale.value = initialLocale
})

it('updates existing wallet labels in every language and keeps custom names intact', () => {
  const org = { id: '10000000', name: '担保组织 10000000' }
  const name = computed(() => organizationLabel(org))
  const address = computed(() => addressLabel('地址 12', 12))
  for (const locale of Object.keys(localeNames) as Array<keyof typeof localeNames>) {
    i18n.global.locale.value = locale
    expect(name.value).toBe(wt('w148', [org.id]))
    expect(address.value).toBe(wt('w516', [12]))
    expect(addressLabel('地址 12 · 储蓄', 12)).toBe('地址 12 · 储蓄')
    expect(addressLabel('地址 1234', 12)).toBe('地址 1234')
    expect(organizationLabel({ ...org, name: '北京担保组织' })).toBe('北京担保组织')
  }
})

it('localizes stored service messages while preserving diagnostic data', () => {
  i18n.global.locale.value = 'fr-FR'
  const stored = wt('organizationRegistrationFailed')
  i18n.global.locale.value = 'es-ES'
  expect(wl(stored)).toBe(wt('organizationRegistrationFailed'))
  expect(wl('胶囊地址校验和无效。')).toBe(wt('capsuleChecksumInvalid'))
  expect(wl('wallet unlock failed')).toBe(wt('w288'))
  expect(wl('Gateway request failed with status 503')).toBe(wt('gatewayStatusError', [503]))
  expect(wl('地址 abc012 与 RootSeed 不匹配。')).toBe(wt('addressSeedInvalid', ['abc012']))
  expect(wl('external-service: unexpected response 123')).toBe('external-service: unexpected response 123')
})
