<script setup lang="ts">
import {
  PhDownloadSimple as DownloadSimple,
  PhUploadSimple as UploadSimple,
} from '@phosphor-icons/vue'
import { computed, ref, shallowRef } from 'vue'
import { useRouter } from 'vue-router'

import AppButton from '@/components/AppButton.vue'
import FormField from '@/components/FormField.vue'
import SegmentedControl from '@/components/SegmentedControl.vue'
import WalletAccessFrame from '@/components/WalletAccessFrame.vue'
import { useWalletStore } from '@/stores/wallet'

const router = useRouter()
const wallet = useWalletStore()
const mode = ref('create')
const password = ref('')
const passwordConfirm = ref('')
const fileName = ref('')
const importValue = shallowRef<unknown>()
const backupDownloaded = ref(false)
const backupConfirmed = ref(false)
const localError = ref('')
const legacyScalar = ref('')
const legacyRootSeed = ref('')
const legacyMode = ref(false)

const passwordError = computed(() => {
  if (password.value && new TextEncoder().encode(password.value).length < 12)
    return '密码至少需要 12 个字符。'
  if (passwordConfirm.value && password.value !== passwordConfirm.value) return '两次密码不一致。'
  return ''
})

function downloadEnvelope(value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'wallet.json'
  anchor.click()
  URL.revokeObjectURL(url)
  backupDownloaded.value = true
}

async function createWallet(): Promise<void> {
  localError.value = ''
  if (passwordError.value || !passwordConfirm.value) return
  try {
    downloadEnvelope(await wallet.create(password.value))
  } catch (cause) {
    localError.value = cause instanceof Error ? cause.message : '创建钱包失败'
  }
}

async function enterCreatedWallet(): Promise<void> {
  localError.value = ''
  try {
    await wallet.confirmCreatedWallet()
    password.value = ''
    passwordConfirm.value = ''
    await router.replace('/wallet')
  } catch (cause) {
    localError.value = cause instanceof Error ? cause.message : '保存钱包失败'
  }
}

async function readFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = file.name
  try {
    importValue.value = JSON.parse(await file.text())
    localError.value = ''
  } catch {
    importValue.value = undefined
    localError.value = '无法读取 wallet.json。'
  }
}

async function importWallet(): Promise<void> {
  localError.value = ''
  try {
    if (legacyMode.value) {
      await wallet.importLegacy(
        legacyScalar.value,
        [{ type: 0, rootSeedHex: legacyRootSeed.value }],
        password.value,
      )
    } else {
      if (!importValue.value) throw new Error('请先选择 wallet.json')
      await wallet.importEnvelope(importValue.value, password.value)
    }
    await router.replace('/wallet')
  } catch (cause) {
    localError.value = cause instanceof Error ? cause.message : '导入钱包失败'
  }
}
</script>

<template>
  <WalletAccessFrame>
    <section class="access-panel">
      <h1>{{ mode === 'create' ? '建立你的钱包' : '恢复你的钱包' }}</h1>
      <p>
        {{
          mode === 'create'
            ? '密钥只在本机生成并加密，PanguPay 不会保存你的密码。'
            : '导入正式 wallet.json，或使用完整的旧账户私钥与地址 RootSeed。'
        }}
      </p>

      <SegmentedControl
        v-model="mode"
        label="钱包设置方式"
        :options="[
          { label: '创建', value: 'create' },
          { label: '导入', value: 'import' },
        ]"
      />

      <form v-if="mode === 'create'" class="access-form" @submit.prevent="createWallet">
        <FormField
          id="create-password"
          v-model="password"
          label="钱包密码"
          type="password"
          autocomplete="new-password"
          help="至少 12 个字符，仅用于解锁本机加密钱包。"
          :error="passwordError"
        />
        <FormField
          id="create-password-confirm"
          v-model="passwordConfirm"
          label="确认密码"
          type="password"
          autocomplete="new-password"
          :error="passwordError"
        />
        <AppButton type="submit" size="large" :loading="wallet.busy" :disabled="!!passwordError">
          创建并下载备份
          <template #icon><DownloadSimple :size="18" /></template>
        </AppButton>
        <label v-if="backupDownloaded" class="backup-confirm">
          <input v-model="backupConfirmed" type="checkbox" />
          <span>我已将 wallet.json 安全保存；丢失 RootSeed 将无法恢复地址。</span>
        </label>
        <AppButton
          v-if="backupDownloaded"
          size="large"
          variant="secondary"
          :disabled="!backupConfirmed"
          :loading="wallet.busy"
          @click="enterCreatedWallet"
        >
          进入钱包
        </AppButton>
      </form>

      <form v-else class="access-form" @submit.prevent="importWallet">
        <label class="file-picker">
          <input type="file" accept=".json,application/json" @change="readFile" />
          <UploadSimple :size="20" />
          <span>{{ fileName || '选择 wallet.json' }}</span>
        </label>
        <button type="button" class="legacy-toggle" @click="legacyMode = !legacyMode">
          {{ legacyMode ? '改用 wallet.json' : '迁移旧钱包' }}
        </button>
        <template v-if="legacyMode">
          <FormField
            id="legacy-scalar"
            v-model="legacyScalar"
            label="账户私钥（64 位十六进制）"
            autocomplete="off"
          />
          <FormField
            id="legacy-root"
            v-model="legacyRootSeed"
            label="PGC 地址 RootSeed（64 位十六进制）"
            autocomplete="off"
            help="只有账户私钥、没有 RootSeed 时不能恢复旧地址。"
          />
        </template>
        <FormField
          id="import-password"
          v-model="password"
          label="钱包密码"
          type="password"
          autocomplete="current-password"
        />
        <AppButton type="submit" size="large" :loading="wallet.busy">验证并导入</AppButton>
      </form>

      <p v-if="localError || wallet.error" class="access-error" role="alert">
        {{ localError || wallet.error }}
      </p>
    </section>
  </WalletAccessFrame>
</template>

<style scoped>
.access-panel {
  display: grid;
  gap: 1rem;
}

.segmented-control {
  width: 100%;
}

.file-picker {
  display: flex;
  min-height: 84px;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  cursor: pointer;
  color: var(--text-muted);
}

.file-picker input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.legacy-toggle {
  min-height: 44px;
  background: transparent;
  color: var(--accent);
  cursor: pointer;
  text-align: left;
}

.backup-confirm {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.backup-confirm input {
  width: 18px;
  height: 18px;
}

.access-error {
  margin: 0 !important;
  color: var(--danger) !important;
  font-size: 0.82rem;
}
</style>
