import type { InjectionKey, Ref } from 'vue'
import type { EntryShape } from '@/graphics/entryParticles'

export const entryFigureKey: InjectionKey<Ref<EntryShape | undefined>> = Symbol('entry-figure')
