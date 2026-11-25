import { computed, inject, ref, shallowReactive, shallowRef, type InjectionKey } from 'vue'

import { wt } from '@/i18n/walletText'
import { GatewayClient } from '@/services/gatewayClient'
import {
  getWalletEntryService,
  type WalletEntryOrganization,
} from '@/wallet/entryService'
import {
  normalizeGQNCBlock,
  normalizeGQNCStatus,
  recentCertifiedHeights,
  type GQNCBlockView,
  type GQNCStatusView,
} from '@/wallet/gqncExplorer'

export const organizationRefreshInterval = 60_000

export function createWalletNetwork(onCertifiedBlock?: (response: unknown, block: GQNCBlockView) => void) {
  const client = new GatewayClient()
  let disposed = false

  function organizationRead<T>(request: () => Promise<T>, fallback: () => string) {
    const data = shallowRef<T>()
    const loading = ref(false)
    const error = ref('')
    let requestedAt = -Infinity
    let pending: Promise<void> | undefined

    function refresh(interval = 0): Promise<void> | undefined {
      if (disposed || pending || Date.now() - requestedAt < interval) return pending
      requestedAt = Date.now()
      loading.value = true
      pending = Promise.resolve()
        .then(request)
        .then((result) => {
          if (disposed) return
          data.value = result
          error.value = ''
        })
        .catch((cause: unknown) => {
          if (!disposed) error.value = cause instanceof Error ? cause.message : fallback()
        })
        .finally(() => {
          pending = undefined
          if (!disposed) loading.value = false
        })
      return pending
    }

    return { data, loading, error, refresh }
  }

  function entryService() {
    const service = getWalletEntryService()
    if (!service) throw new Error(wt('w79'))
    return service
  }

  const directory = organizationRead(() => entryService().listOrganizations(), () => wt('w80'))
  const readOrganization = ({ id, name }: WalletEntryOrganization) =>
    organizationRead(() => entryService().organization(id, name), () => wt('w82'))
  const organizationDetails = new Map<string, ReturnType<typeof readOrganization>>()

  function organization(organization: WalletEntryOrganization) {
    const existing = organizationDetails.get(organization.id)
    if (existing) return existing
    const detail = readOrganization(organization)
    organizationDetails.set(organization.id, detail)
    return detail
  }

  const chainStatus = shallowRef<GQNCStatusView>()
  const chainLoading = ref(false)
  const chainError = ref('')
  const chainCheckedAt = ref<number>()
  let chainRequestedAt = -Infinity
  const blockCache = shallowReactive(new Map<number, GQNCBlockView>())
  const heights = computed(() => recentCertifiedHeights(chainStatus.value?.certifiedHeight ?? 0))
  const blocks = computed(() =>
    heights.value.flatMap((height) => {
      const block = blockCache.get(height)
      return block ? [block] : []
    }),
  )
  const missingBlocks = computed(() => heights.value.length - blocks.value.length)

  async function loadBlock(height: number): Promise<void> {
    const response = await client.gqncCertifiedBlock(height)
    const block = normalizeGQNCBlock(response)
    if (disposed || block.height !== height) return
    blockCache.set(height, block)
    onCertifiedBlock?.(response, block)
  }

  async function refreshChain(interval = 0): Promise<void> {
    if (disposed || chainLoading.value || Date.now() - chainRequestedAt < interval) return
    chainRequestedAt = Date.now()
    chainLoading.value = true
    try {
      const next = normalizeGQNCStatus(await client.gqncStatus())
      if (disposed) return
      if (!next.protocolVersion || !next.safetyStatus) throw new Error(wt('refinement15'))
      const previous = chainStatus.value
      if (
        previous &&
        (next.certifiedHeight < previous.certifiedHeight ||
          next.protocolVersion !== previous.protocolVersion)
      ) {
        blockCache.clear()
      }
      chainStatus.value = next
      chainCheckedAt.value = Date.now()
      chainError.value = ''
      for (const height of blockCache.keys()) {
        if (!heights.value.includes(height)) blockCache.delete(height)
      }
      const pending = heights.value.filter((height) => !blockCache.has(height))
      for (let index = 0; index < pending.length && !disposed; index += 4) {
        await Promise.allSettled(pending.slice(index, index + 4).map(loadBlock))
      }
    } catch (cause) {
      if (!disposed) chainError.value = cause instanceof Error ? cause.message : wt('w11')
    } finally {
      if (!disposed) chainLoading.value = false
    }
  }

  function dispose(): void {
    disposed = true
  }

  return {
    chainStatus,
    chainLoading,
    chainError,
    chainCheckedAt,
    blocks,
    missingBlocks,
    refreshChain,
    directory,
    organization,
    dispose,
  }
}

export const walletNetworkKey: InjectionKey<ReturnType<typeof createWalletNetwork>> =
  Symbol('walletNetwork')

export function useWalletNetwork() {
  return inject(walletNetworkKey)!
}
