<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import EntryExperience from '@/layouts/EntryExperience.vue'
import { unlockPhase } from '@/composables/useEntryUnlock'
const route = useRoute()
const isEntry = computed(() =>
  ['landing', 'wallet-setup', 'wallet-unlock', 'wallet-recover', 'wallet-entry'].includes(
    String(route.name),
  ),
)
</script>
<template>
  <EntryExperience :active="isEntry || unlockPhase !== 'idle'"><RouterView /></EntryExperience>
</template>
