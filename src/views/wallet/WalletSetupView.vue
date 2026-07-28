<script setup lang="ts">
import {
  PhCheckCircle as CheckCircle,
  PhDownloadSimple as DownloadSimple,
  PhKey as Key,
  PhLockKey as LockKey,
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
const mode = ref<'create' | 'import'>('create')
const importMethod = ref<'backup' | 'keys'>('backup')
const createPassword = ref('')
const createPasswordConfirm = ref('')
const backupPassword = ref('')
const recoveryPassword = ref('')
const recoveryPasswordConfirm = ref('')
const fileName = ref('')
const importValue = shallowRef<unknown>()
const backupDownloaded = ref(false)
const recoveryDownloaded = ref(false)
const backupConfirmed = ref(false)
const localError = ref('')
const legacyScalar = ref('')
const legacyRootSeed = ref('')

function newPasswordError(password: string, confirmation: string): string {
  if (password && new TextEncoder().encode(password).length < 12) return '密码至少需要 12 个字符。'
  if (confirmation && password !== confirmation) return '两次密码不一致。'
  return ''
}

const createPasswordError = computed(() =>
  newPasswordError(createPassword.value, createPasswordConfirm.value),
)
const recoveryPasswordError = computed(() =>
  newPasswordError(recoveryPassword.value, recoveryPasswordConfirm.value),
)
const setupTitle = computed(() => {
  if (mode.value === 'create') return '建立你的钱包'
  return importMethod.value === 'backup' ? '导入加密备份' : '使用密钥恢复'
})
const setupDescription = computed(() => {
  if (mode.value === 'create') return '密钥只在本机生成并加密，PanguPay 不会保存你的密码。'
  if (importMethod.value === 'backup')
    return '选择已有的 wallet.json，并使用这份备份原来的密码解锁。'
  return '使用完整的账户私钥与地址 RootSeed，建立一个新的本地加密钱包。'
})

function downloadJSON(value: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

async function createWallet(): Promise<void> {
  localError.value = ''
  if (createPasswordError.value || !createPasswordConfirm.value) return
  try {
    const envelope = await wallet.create(createPassword.value)
    const recoveryKit = wallet.exportRecoveryKit()
    downloadJSON(envelope, 'wallet.json')
    downloadJSON(recoveryKit, 'PanguPay-recovery.json')
    backupDownloaded.value = true
    recoveryDownloaded.value = true
  } catch (cause) {
    localError.value = cause instanceof Error ? cause.message : '创建钱包失败'
  }
}

async function enterCreatedWallet(): Promise<void> {
  localError.value = ''
  try {
    await wallet.confirmCreatedWallet()
    createPassword.value = ''
    createPasswordConfirm.value = ''
    await router.replace('/wallet/entry')
  } catch (cause) {
    localError.value = cause instanceof Error ? cause.message : '保存钱包失败'
  }
}

async function readFile(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  fileName.value = ''
  importValue.value = undefined
  try {
    importValue.value = JSON.parse(await file.text())
    fileName.value = file.name
    localError.value = ''
  } catch {
    importValue.value = undefined
    localError.value = '无法读取 wallet.json。'
  }
}

async function importWallet(): Promise<void> {
  localError.value = ''
  try {
    if (importMethod.value === 'keys') {
      if (recoveryPasswordError.value || !recoveryPasswordConfirm.value) return
      await wallet.importLegacy(
        legacyScalar.value,
        [{ type: 0, rootSeedHex: legacyRootSeed.value }],
        recoveryPassword.value,
      )
    } else {
      if (!importValue.value) throw new Error('请先选择 wallet.json')
      await wallet.importEnvelope(importValue.value, backupPassword.value)
    }
    await router.replace('/wallet/entry')
  } catch (cause) {
    localError.value = cause instanceof Error ? cause.message : '导入钱包失败'
  }
}
</script>

<template>
  <WalletAccessFrame>
    <section class="access-panel">
      <h1>{{ setupTitle }}</h1>
      <p>{{ setupDescription }}</p>

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
          v-model="createPassword"
          label="钱包密码"
          type="password"
          autocomplete="new-password"
          help="至少 12 个字符，仅用于解锁本机加密钱包。"
          :error="createPasswordError"
        />
        <FormField
          id="create-password-confirm"
          v-model="createPasswordConfirm"
          label="确认密码"
          type="password"
          autocomplete="new-password"
          :error="createPasswordError"
        />
        <AppButton
          v-if="!backupDownloaded"
          type="submit"
          size="large"
          :loading="wallet.busy"
          :disabled="!!createPasswordError || !createPasswordConfirm"
        >
          创建钱包并下载两份备份
          <template #icon><DownloadSimple :size="18" /></template>
        </AppButton>
        <section v-if="backupDownloaded" class="backup-files" aria-label="钱包备份说明">
          <header>
            <strong>两份备份已下载</strong>
            <span>用途不同，请分别保存。</span>
          </header>
          <div>
            <LockKey :size="19" weight="regular" />
            <span>
              <b>wallet.json</b>
              <small>加密备份；日常导入使用，仍需要当前密码。</small>
            </span>
          </div>
          <div>
            <Key :size="19" weight="regular" />
            <span>
              <b>PanguPay-recovery.json</b>
              <small>紧急恢复材料；无需原密码，必须离线保密。</small>
            </span>
          </div>
        </section>
        <label v-if="recoveryDownloaded" class="backup-confirm">
          <input v-model="backupConfirmed" type="checkbox" />
          <span>我已分别安全保存加密 wallet.json 与独立恢复材料，并理解恢复材料必须保密。</span>
        </label>
        <AppButton
          v-if="backupDownloaded"
          size="large"
          variant="secondary"
          :disabled="!recoveryDownloaded || !backupConfirmed"
          :loading="wallet.busy"
          @click="enterCreatedWallet"
        >
          进入钱包
        </AppButton>
      </form>

      <form v-else class="access-form import-form" @submit.prevent="importWallet">
        <SegmentedControl
          v-model="importMethod"
          label="导入来源"
          :options="[
            { label: 'wallet.json', value: 'backup' },
            { label: '私钥与 RootSeed', value: 'keys' },
          ]"
        />

        <template v-if="importMethod === 'backup'">
          <label class="file-picker" :class="{ 'file-picker--selected': importValue }">
            <input
              type="file"
              accept=".json,application/json"
              aria-label="选择 wallet.json"
              @change="readFile"
            />
            <CheckCircle v-if="importValue" :size="21" weight="fill" />
            <UploadSimple v-else :size="20" />
            <span class="file-picker__copy">
              <strong>{{ fileName || '选择 wallet.json' }}</strong>
              <small>
                {{
                  importValue
                    ? '文件已读取，输入备份原密码即可验证。'
                    : '选择由 PanguPay 导出的加密备份。'
                }}
              </small>
            </span>
          </label>
          <FormField
            id="import-password"
            v-model="backupPassword"
            label="wallet.json 原密码"
            type="password"
            autocomplete="current-password"
            help="这是已有备份的密码，不是在设置新密码。"
          />
          <AppButton
            type="submit"
            size="large"
            :loading="wallet.busy"
            :disabled="!importValue || !backupPassword"
          >
            验证并导入
          </AppButton>
        </template>

        <template v-else>
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
          <FormField
            id="recovery-new-password"
            v-model="recoveryPassword"
            label="设置新钱包密码"
            type="password"
            autocomplete="new-password"
            help="至少 12 个字符，用于加密新建的本地 keystore。"
            :error="recoveryPasswordError"
          />
          <FormField
            id="recovery-new-password-confirm"
            v-model="recoveryPasswordConfirm"
            label="确认新密码"
            type="password"
            autocomplete="new-password"
            :error="recoveryPasswordError"
          />
          <AppButton
            type="submit"
            size="large"
            :loading="wallet.busy"
            :disabled="
              !legacyScalar ||
              !legacyRootSeed ||
              !recoveryPasswordConfirm ||
              !!recoveryPasswordError
            "
          >
            恢复并进入钱包
          </AppButton>
        </template>
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

.access-panel > p {
  min-block-size: 3.1em;
}

.segmented-control {
  width: 100%;
}

.file-picker {
  display: flex;
  min-height: 82px;
  align-items: center;
  justify-content: flex-start;
  gap: 0.65rem;
  padding-inline: 1rem;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-md);
  background: var(--surface-subtle);
  cursor: pointer;
  color: var(--text-muted);
  transition:
    border-color var(--duration-state) var(--ease-standard),
    background var(--duration-state) var(--ease-standard),
    color var(--duration-state) var(--ease-standard);
}

.file-picker input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.file-picker:hover {
  border-color: var(--accent);
  color: var(--text);
}

.file-picker--selected {
  border-style: solid;
  border-color: color-mix(in srgb, var(--accent) 42%, var(--border-strong));
  background: color-mix(in srgb, var(--accent) 6%, var(--surface-subtle));
}

.file-picker--selected > svg {
  color: var(--accent);
}

.file-picker__copy {
  display: grid;
  min-width: 0;
  gap: 0.2rem;
}

.file-picker__copy strong {
  overflow: hidden;
  color: var(--text);
  font-size: 0.86rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-picker__copy small {
  color: var(--text-muted);
  font-size: 0.74rem;
  line-height: 1.4;
}

.backup-confirm {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  color: var(--text-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.backup-files {
  display: grid;
  border-block: 1px solid var(--hairline);
}

.backup-files > header,
.backup-files > div {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  gap: 0.72rem;
  padding: 0.78rem 0.1rem;
}

.backup-files > header {
  grid-template-columns: 1fr auto;
  border-bottom: 1px solid var(--hairline);
}

.backup-files > header > span,
.backup-files small {
  color: var(--text-muted);
  font-size: 0.75rem;
}

.backup-files > div + div {
  border-top: 1px solid var(--hairline);
}

.backup-files > div > svg {
  color: var(--accent);
}

.backup-files > div > span {
  display: grid;
  gap: 0.12rem;
}

.backup-files b {
  font-size: 0.8rem;
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
