import type { InjectionKey, Ref } from 'vue'
import type { EntryShape } from '@/graphics/entryParticles'

export const waitForEntryBrandKey: InjectionKey<() => Promise<void> | undefined> = Symbol('wait-for-entry-brand')
export const entryFigureKey: InjectionKey<Ref<EntryShape | undefined>> = Symbol('entry-figure')
