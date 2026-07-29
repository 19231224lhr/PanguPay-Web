import { createHash } from 'node:crypto'

import { expect, test, type Download, type Page, type Route } from '@playwright/test'
import elliptic from 'elliptic'

const { ec: EC } = elliptic
const capsuleEC = new EC('p256')
const capsuleAuthority = capsuleEC.keyFromPrivate('1'.padStart(64, '0'), 'hex')
const base58Alphabet = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

function sha256(value: Uint8Array): Buffer {
  return createHash('sha256').update(value).digest()
}

function base58Check(value: Uint8Array): string {
  const checksum = sha256(sha256(value)).subarray(0, 4)
  const bytes = Buffer.concat([Buffer.from(value), checksum])
  let number = BigInt(`0x${bytes.toString('hex')}`)
  let encoded = ''
  while (number > 0n) {
    const remainder = Number(number % 58n)
    encoded = base58Alphabet[remainder] + encoded
    number /= 58n
  }
  for (const byte of bytes) {
    if (byte !== 0) break
    encoded = `1${encoded}`
  }
  return encoded
}

function capsuleForAddress(address: string): string {
  const publicKey = capsuleAuthority.getPublic()
  const x = Buffer.from(publicKey.getX().toArray('be', 32))
  const y = Buffer.from(publicKey.getY().toArray('be', 32))
  const mask = sha256(Buffer.concat([x, y, Buffer.from('PANGU_CAPSULE_V1')])).subarray(0, 20)
  const raw = Buffer.from(address, 'hex')
  const masked = Buffer.from(raw.map((byte, index) => byte ^ mask[index]!))
  const signature = capsuleAuthority.sign(sha256(masked))
  const r = Buffer.from(signature.r.toArray('be', 32))
  const s = Buffer.from(signature.s.toArray('be', 32))
  return `00000000@${base58Check(Buffer.concat([masked, r, s]))}`
}

interface EntryBackendState {
  member: boolean
  retail: boolean
}

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
}

async function mockEntryBackend(
  page: Page,
  initial: Partial<EntryBackendState> = {},
): Promise<EntryBackendState> {
  const state: EntryBackendState = { member: false, retail: false, ...initial }
  await page.route('**/health', (route) => json(route, { ok: true }))
  await page.route('**/api/v1/groups/group-a', (route) =>
    json(route, {
      PeerGroupID: 'group-topic-a',
      AssiID: 'assign-a',
      AssiPeerID: 'assign-peer-a',
      AggrID: 'aggregation-a',
      AggrPeerID: 'aggregation-peer-a',
      PledgeAddress: 'pledge-address-a',
      PledgeAmount: '1250.00000000',
      GuarTable: { guarantorA: 'peer-a', guarantorB: 'peer-b' },
      Certifiers: {
        certifierA: {
          certifierID: 'txcer-a',
          peerID: 'txcer-peer-a',
          apiEndpoint: 'http://txcer-a.test',
          status: 'active',
        },
        certifierB: { peerID: 'txcer-peer-b', status: 'active' },
        certifierC: { peerID: 'txcer-peer-c', status: 'standby' },
      },
      AssignAPIEndpoint: 'http://assign.test',
      AggrAPIEndpoint: 'http://aggr.test',
    }),
  )
  await page.route('**/api/v1/groups', (route) =>
    json(route, { groups: [{ group_id: 'group-a', group_name: '星河担保组织' }] }),
  )
  await page.route('**/api/v1/re-online', async (route) => {
    const request = route.request().postDataJSON() as { UserID?: string }
    await json(route, {
      UserID: request.UserID ?? '',
      IsInGroup: state.member,
      GuarantorGroupID: state.member ? 'group-a' : '',
    })
  })
  await page.route('**/api/v1/com/query-address-group', async (route) => {
    const request = route.request().postDataJSON() as { address?: string[] }
    const groupID = state.member ? 'group-a' : state.retail ? '1' : '0'
    await json(route, {
      Addresstogroup: Object.fromEntries(
        (request.address ?? []).map((address) => [address, { GroupID: groupID }]),
      ),
    })
  })
  await page.route('**/api/v1/com/register-address', async (route) => {
    state.retail = true
    await json(route, { success: true })
  })
  await page.route('**/api/v1/com/public-key', (route) => {
    const publicKey = capsuleAuthority.getPublic()
    return json(route, {
      org_id: '00000000',
      public_key: {
        CurveName: 'P256',
        X: publicKey.getX().toString(10),
        Y: publicKey.getY().toString(10),
      },
    })
  })
  await page.route('**/api/v1/com/capsule/generate', async (route) => {
    const request = route.request().postDataJSON() as { Address?: string }
    await json(route, {
      Success: true,
      CapsuleAddr: capsuleForAddress(request.Address ?? ''),
      OrgID: '00000000',
    })
  })
  await page.route('**/api/v1/group-a/assign/flow-apply', async (route) => {
    state.member = true
    state.retail = false
    await json(route, { result: true })
  })
  await page.route('**/api/v1/com/query-address', async (route) => {
    const request = route.request().postDataJSON() as { address?: string[] }
    await json(route, {
      AddressData: Object.fromEntries(
        (request.address ?? []).map((address) => [address, { Value: '0', UTXO: {} }]),
      ),
    })
  })
  await page.route('**/api/v1/group-a/assign/txcer-statuses?*', (route) =>
    json(route, { statuses: [] }),
  )
  await page.route('**/api/v1/group-a/assign/account-update?*', (route) => json(route, []))
  await page.route('**/api/v1/group-a/aggr/txcer-issuance-records?*', (route) =>
    json(route, { records: [] }),
  )
  return state
}

async function createWalletToEntry(
  page: Page,
  password: string,
  expectedDestination: RegExp = /\/wallet\/entry$/,
): Promise<void> {
  await page.goto('/wallet/setup')
  await page.getByLabel('钱包密码').fill(password)
  await page.getByLabel('确认密码').fill(password)
  const downloads: Download[] = []
  page.on('download', (download) => downloads.push(download))
  await page.getByRole('button', { name: '创建钱包并下载备份', exact: true }).click()
  await expect.poll(() => downloads.length).toBe(2)
  await page.getByText('我已分别安全保存').click()
  await page.getByRole('button', { name: '进入钱包' }).click()
  await expect(page).toHaveURL(expectedDestination)
}

test.describe('Phase 2 organization entry and transfer availability', () => {
  test('a new user can stay retail and join later', async ({ page }) => {
    const state = await mockEntryBackend(page)
    await createWalletToEntry(page, 'phase-two-retail-password')

    await expect(page.getByRole('heading', { name: '选择你的使用方式' })).toBeVisible()
    await expect(page.getByText('星河担保组织')).toBeVisible()
    await page.getByRole('button', { name: '暂不加入' }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    expect(state.retail).toBe(true)

    await page.getByRole('complementary').getByRole('link', { name: '发送', exact: true }).click()
    await expect(page.getByRole('radio', { name: '快速' })).toBeDisabled()
    await expect(page.getByRole('radio', { name: '普通' })).toBeChecked()
    await expect(page.getByRole('radio', { name: '跨链' })).toBeDisabled()
    await expect(page.getByText('当前为独立账户')).toBeVisible()
    await expect(page.locator('[data-route-node]')).toHaveCount(0)

    await page.getByRole('complementary').getByRole('link', { name: '总览', exact: true }).click()
    await page.getByRole('link', { name: '收款', exact: true }).click()
    const receiveAddress = await page.locator('output.receive-address').textContent()
    await expect(
      page.getByRole('img', { name: `收款地址 ${receiveAddress} 的二维码` }),
    ).toBeVisible()
    await expect(page.locator('[data-qr-modules]')).toHaveAttribute('d', /M\d+ \d+h\d+v1h-\d+z/)
  })

  test('joining a guarantor organization unlocks quick and cross-chain modes', async ({ page }) => {
    const state = await mockEntryBackend(page)
    await createWalletToEntry(page, 'phase-two-member-password')

    await page.getByRole('button', { name: '查看星河担保组织详情' }).click()
    await expect(page.getByRole('dialog', { name: '星河担保组织' })).toBeVisible()
    await expect(page.getByText('1,250.00000000 PGC')).toBeVisible()
    await expect(page.getByText('2 个担保节点')).toBeVisible()
    await expect(page.getByText('3 个审计节点')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Assign 节点' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Aggregation 节点' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'TXCer 审计节点' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'GuarNode' })).toBeVisible()
    await expect(page.getByText('assign-a', { exact: true })).toBeVisible()
    await expect(page.getByText('aggregation-a', { exact: true })).toBeVisible()
    await expect(page.getByText('txcer-a', { exact: true })).toBeVisible()
    await expect(page.getByText('guarantorA', { exact: true })).toBeVisible()
    const scrollStyles = await page
      .getByRole('dialog', { name: '星河担保组织' })
      .evaluate((node) => {
        const surface = node.querySelector<HTMLElement>('.organization-dialog__surface')
        return {
          dialogOverflow: getComputedStyle(node).overflowY,
          surfaceOverflow: surface ? getComputedStyle(surface).overflowY : '',
          scrollbarWidth: surface ? getComputedStyle(surface).scrollbarWidth : '',
        }
      })
    expect(scrollStyles).toEqual({
      dialogOverflow: 'hidden',
      surfaceOverflow: 'auto',
      scrollbarWidth: 'none',
    })
    const nodeUnitStyles = await page
      .locator('.organization-node-group li')
      .first()
      .evaluate((node) => {
        const style = getComputedStyle(node)
        return {
          background: style.backgroundColor,
          borderRadius: Number.parseFloat(style.borderRadius),
          rowGap: Number.parseFloat(style.paddingTop) + Number.parseFloat(style.paddingBottom),
        }
      })
    expect(nodeUnitStyles.background).not.toBe('rgba(0, 0, 0, 0)')
    expect(nodeUnitStyles.borderRadius).toBeGreaterThanOrEqual(10)
    expect(nodeUnitStyles.rowGap).toBeGreaterThanOrEqual(20)
    await expect(page.getByRole('radio', { name: '星河担保组织' })).not.toBeChecked()
    await page.getByRole('button', { name: '关闭组织详情' }).click()

    await page.setViewportSize({ width: 390, height: 844 })
    const choice = page.locator('.organization-choice').first()
    const detailButton = page.getByRole('button', { name: '查看星河担保组织详情' })
    const [choiceBox, detailBox, detailJustify] = await Promise.all([
      choice.boundingBox(),
      detailButton.boundingBox(),
      detailButton.evaluate((node) => getComputedStyle(node).justifySelf),
    ])
    expect(choiceBox).not.toBeNull()
    expect(detailBox).not.toBeNull()
    expect(detailJustify).toBe('stretch')
    expect(detailBox!.width).toBeGreaterThan(choiceBox!.width * 0.8)

    await page.setViewportSize({ width: 1440, height: 900 })

    const [organizationBox, actionsBox, noteBox] = await Promise.all([
      page.locator('.organization-list').boundingBox(),
      page.locator('.entry-actions').boundingBox(),
      page.locator('.entry-note').boundingBox(),
    ])
    expect(organizationBox).not.toBeNull()
    expect(actionsBox).not.toBeNull()
    expect(noteBox).not.toBeNull()
    expect(actionsBox!.y - (organizationBox!.y + organizationBox!.height)).toBeGreaterThanOrEqual(
      14,
    )
    expect(noteBox!.y - (actionsBox!.y + actionsBox!.height)).toBeGreaterThanOrEqual(8)

    await page.locator('label').filter({ hasText: '星河担保组织' }).click()
    await page.getByRole('button', { name: '加入所选组织' }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    await expect(page.locator('.wallet-entry-arrival')).toHaveCount(0)
    expect(state.member).toBe(true)

    const primaryActionContent = page
      .locator('.wallet-balance-field__actions .app-button__content')
      .first()
    await expect(primaryActionContent).toHaveCSS('flex-direction', 'row')
    await expect(primaryActionContent).toHaveCSS('white-space', 'nowrap')
    await expect(
      page.getByRole('complementary').getByRole('link', { name: '总览', exact: true }),
    ).toHaveCSS('box-shadow', 'none')
    const settleMotion = await page.locator('.wallet-balance-field__settle').evaluate((node) => {
      node.parentElement?.classList.add('wallet-balance-field--settle')
      const style = getComputedStyle(node)
      return {
        duration: style.animationDuration,
        name: style.animationName,
      }
    })
    expect(settleMotion.duration).toBe('1.55s')
    expect(settleMotion.name).toMatch(/^wallet-balance-settle(?:-[a-f0-9]+)?$/)

    await page.getByRole('complementary').getByRole('link', { name: '设置', exact: true }).click()
    const settingsActionContent = page.locator('.settings-actions .app-button__content')
    await expect(settingsActionContent.first()).toHaveCSS('flex-direction', 'row')
    await expect(settingsActionContent.first()).toHaveCSS('white-space', 'nowrap')

    await page.getByRole('complementary').getByRole('link', { name: '发送', exact: true }).click()
    await expect(page.getByRole('radio', { name: '快速' })).toBeEnabled()
    await expect(page.getByRole('radio', { name: '跨链' })).toBeEnabled()
    await page.getByRole('radio', { name: '普通' }).click()
    await page.getByRole('radio', { name: '跨链' }).click()
    await expect(page.locator('[data-route-node]')).toHaveCount(0)
  })

  test('a returning member skips the organization chooser', async ({ page }) => {
    await mockEntryBackend(page, { member: true })
    await createWalletToEntry(page, 'phase-two-returning-password', /\/wallet$/)

    await expect(page).toHaveURL(/\/wallet$/)
    await expect(page.getByRole('heading', { name: '选择你的使用方式' })).toHaveCount(0)
  })

  test('a retail wallet generates and displays a verified reusable capsule', async ({ page }) => {
    await mockEntryBackend(page)
    await createWalletToEntry(page, 'phase-two-capsule-password')
    await page.getByRole('button', { name: '暂不加入' }).click()
    await page.getByRole('link', { name: '收款', exact: true }).click()
    await expect(page).toHaveURL(/\/wallet\/receive$/)

    const rawAddress = (await page.locator('output.receive-address').textContent())?.trim()
    expect(rawAddress).toMatch(/^[0-9a-f]{40}$/)

    await page.getByRole('radio', { name: '胶囊地址' }).click()
    await page.getByRole('button', { name: '生成胶囊地址' }).click()

    const capsule = (await page.locator('output.receive-address').textContent())?.trim()
    expect(capsule).toMatch(/^00000000@[1-9A-HJ-NP-Za-km-z]+$/)
    await expect(page.getByText('委员会签名')).toBeVisible()
    await expect(page.getByText('组织签名的隐私别名，可重复使用；原始地址仍然有效。')).toBeVisible()
    await expect(page.getByRole('img', { name: `收款地址 ${capsule} 的二维码` })).toBeVisible()

    await page.getByRole('radio', { name: '原始地址' }).click()
    await expect(page.locator('output.receive-address')).toHaveText(rawAddress!)
  })
})
