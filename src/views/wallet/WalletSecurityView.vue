<script setup lang="ts">
import CredentialTrustPath from '@/components/CredentialTrustPath.vue'
import ExposureShareBar from '@/components/ExposureShareBar.vue'
import StatusLabel from '@/components/StatusLabel.vue'
import WalletPageHeader from '@/components/WalletPageHeader.vue'
import { useDashboardStore } from '@/stores/dashboard'
import { isActiveCredentialFailure } from '@/wallet/credentials'

const dashboard = useDashboardStore()
</script>

<template>
  <div class="wallet-page">
    <WalletPageHeader
      title="凭证与安全"
      description="面向日常使用的状态保持简洁；需要审计时，可在这里查看 TXCer、证据和责任份额。"
    />
    <section class="wallet-section">
      <div class="wallet-section__heading">
        <h2>安全摘要</h2>
        <StatusLabel :tone="dashboard.current.security.isolatedCount ? 'danger' : 'success'">
          {{ dashboard.current.security.isolatedCount ? '存在隔离项' : '正常' }}
        </StatusLabel>
      </div>
      <dl class="wallet-detail-list">
        <div>
          <dt>可立即支付</dt>
          <dd>{{ dashboard.current.security.spendReady }} PGC</dd>
        </div>
        <div>
          <dt>安全凭证</dt>
          <dd>
            {{ dashboard.current.security.isolatedCount ? '存在需要处理的异常' : '状态正常' }}
          </dd>
        </div>
        <div>
          <dt>后台审计</dt>
          <dd>{{ dashboard.current.security.pendingAudits }} 项处理中；不阻塞快速可用</dd>
        </div>
        <div>
          <dt>暂停支付</dt>
          <dd>{{ dashboard.current.security.isolatedCount }} 项</dd>
        </div>
      </dl>
      <details class="protocol-summary">
        <summary>查看协议验证说明</summary>
        <dl class="wallet-detail-list">
          <div>
            <dt>FastEvidence / AssignAck</dt>
            <dd>随权威签发记录验证；缺失时不伪造 Verified</dd>
          </div>
          <div>
            <dt>LiabilityReceipt</dt>
            <dd>使用权威 signer-set 独立验签</dd>
          </div>
          <div>
            <dt>CFAA</dt>
            <dd>只承担后台审计，不阻塞 TXCer 快速可用</dd>
          </div>
        </dl>
      </details>
    </section>
    <section class="wallet-section">
      <div class="wallet-section__heading"><h2>TXCer 凭证</h2></div>
      <div v-if="!dashboard.current.credentials.length" class="wallet-empty">
        当前没有可展示的权威签发记录。证据接口不可用时不会伪造已验证状态。
      </div>
      <article
        v-for="credential in dashboard.current.credentials"
        v-else
        :key="credential.recordId || credential.txCerId"
        class="credential"
      >
        <header>
          <span>
            <small>TXCer</small>
            <b>{{ credential.amount }} PGC</b>
          </span>
          <StatusLabel
            :tone="
              isActiveCredentialFailure(credential)
                ? 'danger'
                : credential.lifecycle === 'Active'
                  ? 'success'
                  : 'neutral'
            "
          >
            {{ credential.lifecycle }}
          </StatusLabel>
        </header>
        <CredentialTrustPath :credential="credential" />
        <ExposureShareBar :shares="credential.exposureShares" />
        <p v-if="credential.error" class="credential__error">
          {{
            credential.lifecycle === 'Active'
              ? credential.error
              : `历史凭证验证记录：${credential.error}`
          }}
        </p>
        <details>
          <summary>凭证与技术字段</summary>
          <dl class="wallet-detail-list">
            <div>
              <dt>FastEvidence</dt>
              <dd>{{ credential.fastEvidenceStatus }}</dd>
            </div>
            <div>
              <dt>AssignAck / LiabilityReceipt</dt>
              <dd>
                {{ credential.hasAssignAck ? '已取得' : '等待中' }} /
                {{ credential.hasLiabilityReceipt ? '已取得' : '等待中' }}
              </dd>
            </div>
            <div>
              <dt>CFAA 后台审计</dt>
              <dd>{{ credential.cfaaAuditStatus }}</dd>
            </div>
            <div>
              <dt>ExposureShares</dt>
              <dd>
                {{ credential.exposureShares.length }} 份 · {{ credential.rootIds.length }} 个 Root
              </dd>
            </div>
            <div>
              <dt>TXCerID</dt>
              <dd>{{ credential.txCerId }}</dd>
            </div>
            <div>
              <dt>RecordID</dt>
              <dd>{{ credential.recordId }}</dd>
            </div>
            <div v-for="share in credential.exposureShares" :key="share.leafId">
              <dt>{{ share.rootId }}</dt>
              <dd>{{ share.amount }} PGC · {{ share.leafId }}</dd>
            </div>
          </dl>
        </details>
      </article>
    </section>
    <section class="wallet-section">
      <div class="wallet-section__heading"><h2>地址与责任视图</h2></div>
      <details v-for="address in dashboard.current.addresses" :key="address.address">
        <summary>{{ address.address }}</summary>
        <dl class="wallet-detail-list">
          <div>
            <dt>资产类型</dt>
            <dd>{{ address.type }}</dd>
          </div>
          <div>
            <dt>UTXO 可用</dt>
            <dd>{{ address.balance }}</dd>
          </div>
          <div>
            <dt>TXCer 可支付</dt>
            <dd>{{ address.txCerBalance }}</dd>
          </div>
          <div>
            <dt>ExposureShares / RootID</dt>
            <dd>完整签发记录同步后在此展开</dd>
          </div>
        </dl>
      </details>
    </section>
  </div>
</template>

<style scoped>
details {
  border-top: 1px solid var(--hairline);
}

summary {
  min-height: 52px;
  align-content: center;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 0.78rem;
  overflow-wrap: anywhere;
}

.protocol-summary {
  margin-top: 0.25rem;
}

.credential {
  display: grid;
  gap: 0.75rem;
  padding-block: 1rem;
  border-top: 1px solid var(--hairline);
}

.credential:first-of-type {
  border-top: 0;
}

.credential header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.credential header > span {
  display: grid;
  gap: 0.18rem;
}

.credential header small,
.credential__error,
.credential__summary {
  color: var(--text-muted);
  font-size: 0.72rem;
}

.credential__error {
  margin: 0;
  color: var(--warning);
}
</style>
