<script setup lang="ts">
import { wt } from '@/i18n/walletText'
import { computed, provide } from 'vue'
import { useRoute } from 'vue-router'
import EntryExperience from '@/layouts/EntryExperience.vue'
import { unlockPhase } from '@/composables/useEntryUnlock'
provide(
  'motionLabels',
  computed(() => ({
    loading: wt('motionLoading'),
    success: wt('motionSuccess'),
    error: wt('motionError'),
  })),
)
const route = useRoute()
const isEntry = computed(() =>
  ['landing', 'wallet-setup', 'wallet-unlock', 'wallet-recover', 'wallet-entry'].includes(
    String(route.name),
  ),
)
const animateAccess = computed(() => isEntry.value && unlockPhase.value === 'idle')
</script>
<template>
  <EntryExperience :active="isEntry || unlockPhase !== 'idle'" :show-brand="isEntry">
    <RouterView v-slot="{ Component }">
      <Transition
        name="entry-route"
        :mode="animateAccess ? 'out-in' : 'default'"
        :css="animateAccess"
      >
        <component :is="Component" />
      </Transition>
    </RouterView>
  </EntryExperience>
</template>
