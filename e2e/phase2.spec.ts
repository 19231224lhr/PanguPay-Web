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
  keepGuide = false,
): Promise<void> {
  await page.goto('/wallet/setup')
  await page.getByLabel('钱包密码').fill(password)
  await page.getByLabel('确认密码').fill(password)
  const downloads: Download[] = []
  page.on('download', (download) => downloads.push(download))
  await page.getByRole('button', { name: '创建钱包并下载备份', exact: true }).click()
  await expect.poll(() => downloads.length).toBe(2)
  await page.getByText('我已分别安全保存').click()
  await page.getByRole('button', { name: '下一步：选择组织' }).click()
  await expect(page).toHaveURL(expectedDestination)
  if (!keepGuide && new URL(page.url()).pathname === '/wallet') {
    await page.getByRole('region', { name: '新手引导' }).getByRole('button', { name: '跳过' }).click()
  }
}

test.describe('Phase 2 organization entry and transfer availability', () => {
  test('the welcome guide follows five live targets and only opens once for a new wallet', async ({ page }) => {
    test.setTimeout(60000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockEntryBackend(page, { member: true })
    await createWalletToEntry(page, 'welcome-guide-test-password', /\/wallet$/, true)
    const guide = page.getByRole('region', { name: '新手引导' })
    const titles = ['找到你的收款地址', '发起一笔转账', '查看交易进度', '查看凭证与安全', '按自己的习惯整理总览']
    const targets = ['addresses-preview', 'balance', 'activity', 'security']
    for (const [index, title] of titles.entries()) {
      await expect(guide.getByRole('heading', { name: title })).toBeVisible()
      const target = index < targets.length
        ? page.locator(`[data-card="${targets[index]}"][data-welcome-highlight]`)
        : page.locator('[data-account-trigger][data-welcome-highlight]')
      await expect(target).toBeVisible()
      if (index === 2) {
        await page.setViewportSize({ width: 390, height: 844 })
        await guide.getByRole('button', { name: '上一步' }).click()
        await expect(guide.getByRole('heading', { name: titles[1] })).toBeVisible()
        await guide.getByRole('button', { name: '下一步' }).click()
        await expect(guide.getByRole('heading', { name: title })).toBeVisible()
      }
      await expect.poll(async () => {
        const bubble = (await guide.boundingBox())!
        const anchor = (await target.boundingBox())!
        return Math.round(Math.max(
          anchor.x - (bubble.x + bubble.width),
          bubble.x - (anchor.x + anchor.width),
          anchor.y - (bubble.y + bubble.height),
          bubble.y - (anchor.y + anchor.height),
        ))
      }).toBe(16)
      await expect(guide).toHaveAttribute('data-pointer', /^(top|bottom|left|right)$/)
      const headingOrAction = index === 4 ? target : target.locator(index === 1 ? '[data-send-trigger]' : 'h2').first()
      const aim = (await headingOrAction.boundingBox())!
      const bubble = (await guide.boundingBox())!
      const pointer = await guide.getAttribute('data-pointer')
      const tip = await guide.evaluate((element) => parseFloat(element.style.getPropertyValue('--guide-tip')))
      const vertical = pointer === 'top' || pointer === 'bottom'
      const pointerAxis = (vertical ? bubble.x : bubble.y) + tip
      const aimAxis = vertical ? aim.x + aim.width / 2 : aim.y + aim.height / 2
      expect(Math.abs(pointerAxis - aimAxis)).toBeLessThanOrEqual(2)
      await guide.getByRole('button', { name: index === 4 ? '完成' : '下一步' }).click()
    }
    await expect(guide).toHaveCount(0)
    await expect(page.locator('[data-welcome-highlight]')).toHaveCount(0)

    await page.reload()
    await page.getByLabel('钱包密码').fill('welcome-guide-test-password')
    await page.getByRole('button', { name: '解锁钱包' }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    await expect(guide).toHaveCount(0)
  })
  test('the desktop sidebar folds from the logo and keeps its controls usable', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await mockEntryBackend(page, { member: true })
    await createWalletToEntry(page, 'sidebar-fold-test-password', /\/wallet$/)
    const sidebar = page.locator('.app-shell__sidebar')
    const expand = sidebar.getByRole('button', { name: '展开侧边栏' })
    await expect(expand).toHaveAttribute('aria-expanded', 'false')
    await expect(sidebar).toHaveCSS('width', '58px')
    await expand.click()
    const collapse = sidebar.getByRole('button', { name: '收起侧边栏' })
    await expect(sidebar).toHaveCSS('width', '216px')
    const normalWidth = (await sidebar.boundingBox())!.width
    await collapse.locator('.app-shell__brand-icon').hover()
    await expect(collapse.locator('.app-shell__brand-mark')).toHaveCSS('opacity', '0')
    await expect(collapse.locator('.app-shell__brand-caret')).toHaveCSS('opacity', '1')
    const animation = sidebar.evaluate(async (rail) => {
      const icons = [...rail.querySelectorAll('.app-shell__brand-icon, .app-shell__avatar, nav a > svg')]
      const center = (icon: Element) => {
        const box = icon.getBoundingClientRect()
        return box.left + box.width / 2
      }
      const original = icons.map(center)
      const started = performance.now()
      let maxDrift = 0
      let smallestWidth = rail.getBoundingClientRect().width
      do {
        await new Promise(requestAnimationFrame)
        for (const [index, icon] of icons.entries()) {
          maxDrift = Math.max(maxDrift, Math.abs(center(icon) - original[index]!))
        }
        smallestWidth = Math.min(smallestWidth, rail.getBoundingClientRect().width)
      } while (performance.now() - started < 440)
      return { maxDrift, smallestWidth, centers: icons.map(center) }
    })
    await collapse.click()
    const { maxDrift, smallestWidth, centers } = await animation
    expect(maxDrift).toBeLessThan(1)
    expect(smallestWidth).toBeLessThan(64)
    expect(Math.max(...centers) - Math.min(...centers)).toBeLessThan(1)

    await expect(expand).toHaveAttribute('aria-expanded', 'false')
    expect((await sidebar.boundingBox())!.width).toBeLessThan(normalWidth / 2)
    await expect(sidebar.getByText('PanguPay', { exact: true })).toBeHidden()
    await expect(sidebar.getByText('活动', { exact: true })).toBeHidden()
    await expect(sidebar.getByRole('link', { name: '设置', exact: true })).toHaveCount(0)
    await sidebar.getByRole('link', { name: '活动', exact: true }).click()
    await expect(page).toHaveURL(/\/wallet#activity$/)
    await expect(expand).toBeVisible()

    await sidebar.getByRole('button', { name: '打开账户菜单' }).click()
    await expect(page.getByRole('menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expand.press('Enter')
    await expect(collapse).toHaveAttribute('aria-expanded', 'true')
    await expect(sidebar.getByText('活动', { exact: true })).toBeVisible()
    await expect.poll(async () => (await sidebar.boundingBox())!.width).toBe(normalWidth)
  })

  test('settings opens on its own page and returns to the expanded card', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockEntryBackend(page, { member: true })
    await createWalletToEntry(page, 'standalone-settings-test', /\/wallet$/)
    await page.locator('#wallet-sidebar').getByRole('link', { name: '活动', exact: true }).click()
    await expect(page).toHaveURL(/#activity$/)
    await page.getByRole('button', { name: '打开账户菜单' }).click()
    await page.getByRole('menuitem', { name: '设置', exact: true }).click()
    await expect(page).toHaveURL(/\/wallet\/settings$/)
    await expect(page.getByRole('heading', { name: '设置', exact: true, level: 1 })).toBeVisible()
    await expect(page.locator('.overview, [data-close-panel]')).toHaveCount(0)
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await expect(page.getByRole('heading', { name: '外观与语言' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    }
    await page.getByRole('button', { name: '返回', exact: true }).click()
    await expect(page).toHaveURL(/#activity$/)
    await expect(page.locator('#detail-activity')).toBeVisible()
    await expect(page.locator('#intro-activity').getByRole('button', { name: '收起' })).toBeVisible()
  })

  test('the footer avatar opens settings, locks, and confirms wallet sign-out', async ({ page }) => {
    test.setTimeout(60_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockEntryBackend(page, { member: true })
    const password = 'account-menu-test-password'
    await createWalletToEntry(page, password, /\/wallet$/)
    const sidebar = page.locator('#wallet-sidebar')
    const avatar = sidebar.getByRole('button', { name: '打开账户菜单' })
    const menu = page.getByRole('menu', { name: '账户菜单' })
    const entries = menu.getByRole('menuitem')
    const signOut = menu.getByRole('menuitem', { name: '退出钱包' })
    const dialog = page.getByRole('dialog', { name: '退出并清除本机钱包？' })
    const nav = sidebar.getByRole('navigation', { name: '钱包导航' })

    expect((await avatar.boundingBox())!.y).toBeGreaterThan((await nav.boundingBox())!.y)
    await avatar.click()
    await expect(entries).toHaveText(['设置', '编辑卡片', '锁定钱包', '退出钱包'])
    await expect(menu.getByRole('menuitem', { name: '设置' })).toBeFocused()
    await menu.getByRole('menuitem', { name: '设置' }).press('Enter')
    await expect(page).toHaveURL(/\/wallet\/settings$/)
    await expect(page.locator('.overview')).toHaveCount(0)
    await page.getByRole('button', { name: '返回', exact: true }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    await avatar.click()
    await menu.getByRole('menuitem', { name: '设置' }).click()
    await expect(page.getByTestId('sign-out')).toBeVisible()

    await page.getByTestId('sign-out').click()
    await expect(dialog).toBeVisible()
    await dialog.getByTestId('cancel-sign-out').click()
    await expect(page.getByTestId('sign-out')).toBeFocused()

    await avatar.click()
    await signOut.click()
    await expect(dialog).toBeVisible()
    await dialog.getByTestId('cancel-sign-out').click()
    await expect(avatar).toBeFocused()
    await expect(page).toHaveURL(/\/wallet\/settings$/)

    await avatar.click()
    await menu.getByRole('menuitem', { name: '锁定钱包' }).click()
    await expect(page).toHaveURL(/\/wallet\/unlock$/)
    await page.getByRole('link', { name: '忘记密码？' }).click()
    await expect(page).toHaveURL(/\/wallet\/recover$/)
    await page.getByRole('button', { name: '清除本地钱包并重新开始' }).click()
    await expect(dialog).toBeVisible()
    await dialog.getByTestId('cancel-sign-out').click()
    await expect(dialog).toBeHidden()
    await page.goBack()
    await expect(page).toHaveURL(/\/wallet\/unlock$/)
    await page.getByLabel('钱包密码').fill(password)
    await page.getByRole('button', { name: '解锁钱包' }).click()
    await expect(page).toHaveURL(/\/wallet$/, { timeout: 15_000 })

    await avatar.click()
    await signOut.click()
    let resumeHomepage!: () => void
    const homepagePaused = new Promise<void>((resolve) => {
      resumeHomepage = resolve
    })
    await page.route(
      '**/src/main.ts',
      async (route) => {
        await homepagePaused
        await route.continue()
      },
      { times: 1 },
    )
    const exitProgress = page.locator('#wallet-exit-loading')
    try {
      await dialog.getByTestId('confirm-sign-out').click({ noWaitAfter: true })
      await expect(exitProgress).toBeVisible()
      await expect(exitProgress).toContainText('正在返回首页')
    } finally {
      resumeHomepage()
    }
    await expect(page).toHaveURL('/')
    await expect(page.getByRole('button', { name: '进入钱包' })).toBeVisible()
    await expect(exitProgress).toBeHidden()
    await page.goto('/wallet')
    await expect(page).toHaveURL(/\/wallet\/setup$/)
  })

  test('the sidebar brings an expanded organization into view, including on reselect', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 570 })
    await mockEntryBackend(page, { member: true })
    await createWalletToEntry(page, 'sidebar-organization-test-password', /\/wallet$/)
    const sidebar = page.locator('#wallet-sidebar')
    await expect(sidebar).toHaveCSS('width', '58px')

    const organization = sidebar.getByRole('link', { name: '担保组织', exact: true })
    const card = page.locator('[data-card="organization"]')
    const close = card.getByRole('button', { name: '收起', exact: true })
    const detail = card.locator('#detail-organization')
    await card.evaluate((element) => {
      window.scrollBy({ top: element.getBoundingClientRect().top - innerHeight + 24, behavior: 'instant' })
    })
    await organization.click()
    await expect(page).toHaveURL(/\/wallet#organization$/)
    await expect(close).toBeInViewport({ ratio: 1 })
    await expect(detail).toBeInViewport()

    await card.evaluate((element) => element.scrollIntoView({ block: 'end', behavior: 'instant' }))
    await expect(close).not.toBeInViewport()
    await organization.click()
    await expect(close).toBeInViewport({ ratio: 1 })
    await expect(detail).toBeInViewport()
  })

  test('preloads certified blocks and the member roster before opening their cards', async ({ page }) => {
    await mockEntryBackend(page, { member: true })
    await page.route('**/api/v1/committee/gqnc/status', (route) => json(route, {
      protocolVersion: 'gqnc-master-v2',
      safetyStatus: 'NORMAL',
      enabled: true,
      certifiedHeight: 2,
      quorum: 3,
      validatorCount: 4,
    }))
    const blockRequests: number[] = []
    await page.route('**/api/v1/committee/gqnc/certified-block/*', (route) => {
      const height = Number(new URL(route.request().url()).pathname.split('/').at(-1))
      blockRequests.push(height)
      return json(route, { Block: { BlockHead: { BlockHeight: height, BlockHash: `hash-${height}` } } })
    })
    let rosterReads = 0
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.endsWith('/api/v1/groups/group-a') && response.ok())
        rosterReads += 1
    })

    await createWalletToEntry(page, 'network-preload-test-password', /\/wallet$/)
    const sidebar = page.locator('#wallet-sidebar')
    await expect.poll(() => blockRequests.filter((height) => height === 2)).toHaveLength(1)
    await expect.poll(() => rosterReads).toBeGreaterThan(0)
    const preloadedRosterReads = rosterReads

    await sidebar.getByRole('link', { name: '区块链', exact: true }).click()
    await expect(page.locator('.chain-flow button')).toHaveCount(2)
    await expect(page.locator('.block-detail')).toContainText('hash-2')
    await expect(page.locator('.chain-load-note')).toHaveCount(0)
    expect(blockRequests.filter((height) => height === 2)).toHaveLength(1)

    await sidebar.getByRole('link', { name: '担保组织', exact: true }).click()
    await expect(page.getByRole('heading', { name: '服务与责任节点' })).toBeVisible()
    await expect(page.locator('.organization-roster__groups > details')).toHaveCount(4)
    await expect(page.locator('.organization-loading')).toHaveCount(0)
    expect(rosterReads).toBe(preloadedRosterReads)
  })

  test('the wallet keeps light surfaces neutral and uses blue for actions and selection', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
    await mockEntryBackend(page, { member: true })
    await createWalletToEntry(page, 'theme-controls-test-password', /\/wallet$/)
    const card = page.locator('.overview-send-card')
    await card.getByRole('button', { name: '发送', exact: true }).click()
    const source = card.locator('#send-source')
    const review = card.getByRole('button', { name: '审核交易' })
    await expect(page.locator('.app-shell')).toHaveCSS('background-color', 'rgb(242, 243, 245)')
    await expect(card.locator('.wallet-balance-field')).toHaveCSS('background-image', 'none')
    await expect(card.locator('.wallet-balance-field__amount')).toHaveCSS('color', 'rgb(29, 29, 31)')
    await expect(source).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await expect(review).toHaveCSS('background-color', 'rgb(0, 102, 204)')
    const mode = card.getByRole('button', { name: /转账方式/ })
    await mode.click()
    await expect(card.getByRole('option', { selected: true })).toHaveCSS('background-color', 'rgb(230, 239, 255)')
    await page.keyboard.press('Escape')
    await source.click()
    await expect(card.getByRole('listbox')).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    await page.keyboard.press('Escape')
    await page.emulateMedia({ colorScheme: 'dark' })
    await expect(source).toHaveCSS('background-color', 'rgba(16, 18, 23, 0.96)')
    await page.emulateMedia({ colorScheme: 'light' })
    await expect(source).toHaveCSS('background-color', 'rgb(255, 255, 255)')
  })

  test('wallet illustrations move without hover and respect reduced motion', async ({ page }) => {
    await mockEntryBackend(page, { member: true })
    await createWalletToEntry(page, 'wallet-figure-motion-test-password', /\/wallet$/)
    await page.goto('/wallet#send')
    await page.emulateMedia({ reducedMotion: 'no-preference' })

    const coin = page.locator('.money-top')
    const card = page.locator('.payment-card')
    const lineArt = page.locator('#overview-send [data-figure="settle"] > svg')
    const figures = [coin, card, lineArt]
    for (const figure of figures) {
      await expect(figure).not.toHaveCSS('animation-name', 'none')
      await expect(figure).toHaveCSS('animation-duration', '8.8s')
      await expect(figure).toHaveCSS('animation-delay', '0s')
    }

    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const figure of figures) {
      await expect(figure).toHaveCSS('animation-name', 'none')
    }
  })

  test('customizes overview cards and keeps access to hidden panels', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockEntryBackend(page, { member: true })
    const password = 'overview-layout-test-password'
    await createWalletToEntry(page, password, /\/wallet$/)

    const avatar = page.getByRole('button', { name: '打开账户菜单', exact: true })
    const editor = page.getByRole('region', { name: '编辑卡片' })
    const security = page.locator('[data-card="security"]')
    const visibleOrder = () =>
      page.locator('.overview-card-grid > [data-card]:visible').evaluateAll(
        (cards) => cards.map((card) => card.getAttribute('data-card')),
      )

    const enterEdit = async () => {
      await avatar.click()
      await page.getByRole('menuitem', { name: '编辑卡片', exact: true }).click()
      await expect(editor).toBeVisible()
    }

    await expect(page.getByRole('button', { name: '编辑卡片', exact: true })).toHaveCount(0)
    await page.getByRole('navigation', { name: '钱包导航' }).getByRole('link', { name: '活动' }).click()
    await enterEdit()
    await expect(page).toHaveURL(/\/wallet$/)
    await expect(page.getByRole('dialog', { name: '编辑卡片' })).toHaveCount(0)
    await security.getByRole('button', { name: '移除凭证与安全' }).click()
    await expect(security).toBeHidden()
    await editor.getByRole('button', { name: '取消' }).click()
    await expect(security).toBeVisible()

    await enterEdit()
    await security.getByRole('button', { name: '移除凭证与安全' }).click()
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const grip = page.getByRole('button', { name: '移动最近活动' })
    const handle = (await grip.boundingBox())!
    const destination = (await page.locator('[data-card="balance"]').boundingBox())!
    const beforeDrag = await visibleOrder()
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
    await page.mouse.down()
    await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 12 })
    const reordered = ['activity', 'balance', 'addresses-preview', 'organization', 'blockchain']
    await expect.poll(visibleOrder).toEqual(reordered)
    await expect(page.locator('.overview-card-grid')).toHaveAttribute('data-overview-sorting', '')
    await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2, { steps: 12 })
    await expect.poll(visibleOrder).toEqual(beforeDrag)
    await page.mouse.move(destination.x + destination.width / 2, destination.y + destination.height / 2, { steps: 12 })
    await expect.poll(visibleOrder).toEqual(reordered)
    await page.mouse.up()
    await expect(page.locator('.overview-card-grid')).not.toHaveAttribute('data-overview-sorting', '')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await editor.getByRole('button', { name: '完成' }).click()
    await expect(editor).toBeHidden()
    await expect(avatar).toBeFocused()
    expect(await visibleOrder()).toEqual(reordered)
    await expect(security).toBeHidden()

    const securityLink = page.getByRole('navigation', { name: '钱包导航' })
      .getByRole('link', { name: '凭证与安全' })
    await securityLink.click()
    await expect(security.locator('#detail-security')).toBeVisible()
    await security.getByRole('button', { name: '收起' }).click()
    await expect(security).toBeHidden()
    await expect(securityLink).toBeFocused()

    await page.reload()
    await page.getByLabel('钱包密码', { exact: true }).fill(password)
    await page.getByRole('button', { name: '解锁钱包' }).click()
    await expect(avatar).toBeVisible()
    expect(await visibleOrder()).toEqual(reordered)

    await page.setViewportSize({ width: 390, height: 780 })
    await enterEdit()
    await editor.getByRole('button', { name: '添加卡片', exact: true }).click()
    await editor.getByRole('button', { name: '添加凭证与安全' }).click()
    await expect(security).toBeVisible()
    await security.getByRole('button', { name: '移动凭证与安全' }).press('ArrowUp')
    await editor.getByRole('button', { name: '完成' }).click()
    expect(await visibleOrder()).toEqual(['activity', 'balance', 'addresses-preview', 'organization', 'security', 'blockchain'])
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  })

  test('expanded overview cards share the same first section layout', async ({ page }) => {
    test.setTimeout(60_000)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockEntryBackend(page, { member: true })
    await createWalletToEntry(page, 'overview-titles-test-password', /\/wallet$/)

    const titles = {
      send: '#intro-send h2',
      receive: '#intro-receive h2',
      security: '#overview-security',
      activity: '#activity-heading',
      addresses: '#receive-heading',
      organization: '#overview-organization',
      blockchain: '#overview-chain',
    }
    const readSummary = (heading: ReturnType<Page['locator']>) =>
      heading.evaluate((element) => {
        const { fontSize, fontWeight, lineHeight, letterSpacing } = getComputedStyle(element)
        const summary = element.closest('.overview-summary')!
        const frame = summary.getBoundingClientRect()
        const title = element.getBoundingClientRect()
        const subtitle = element.parentElement!.querySelector('p')!
        const subtitleBounds = subtitle.getBoundingClientRect()
        const { fontSize: subtitleSize, lineHeight: subtitleLineHeight } = getComputedStyle(subtitle)
        const metrics = summary.querySelector('.overview-summary-metrics')!.getBoundingClientRect()
        const figure = summary.querySelector('.overview-panel__body > .wallet-figure')!.getBoundingClientRect()
        const collapse = Array.from(summary.querySelectorAll('.collapse-send'))
          .find((button) => button.getClientRects().length)!
          .getBoundingClientRect()
        return {
          fontSize,
          fontWeight,
          lineHeight,
          letterSpacing,
          titleInset: Math.round(title.left - frame.left),
          titleTop: Math.round(title.top - frame.top),
          subtitleInset: Math.round(subtitleBounds.left - frame.left),
          subtitleTop: Math.round(subtitleBounds.top - title.bottom),
          subtitleSize,
          subtitleLineHeight,
          metricsInset: Math.round(metrics.left - frame.left),
          height: Math.round(frame.height),
          width: Math.round(frame.width),
          figureWidth: Math.round(figure.width),
          figureTop: Math.round(figure.top - frame.top),
          figureInset: Math.round(frame.right - figure.right),
          collapseInset: Math.round(frame.right - collapse.right),
          collapseTop: Math.round(collapse.top - frame.top),
        }
      })
    const primaryNumber = '.overview-summary-metrics__primary :is(dd, strong)'
    const numericPanels = new Set(['send', 'receive', 'security', 'activity', 'addresses', 'blockchain'])
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.goto('/wallet#send')
      const sendHeading = page.locator(titles.send)
      await expect(sendHeading).toBeVisible()
      const reference = await readSummary(sendHeading)
      const sendAmount = page.locator('.overview [data-card].is-expanded').locator(primaryNumber)
      const numberSize = await sendAmount.evaluate((amount) => getComputedStyle(amount).fontSize)
      expect(parseFloat(numberSize)).toBeGreaterThanOrEqual(32)
      for (const [panel, selector] of Object.entries(titles)) {
        if (panel === 'send') continue
        await page.goto('/wallet#' + panel)
        const heading = page.locator(`.overview [data-card].is-expanded ${selector}`)
        await expect(heading).toBeVisible()
        await expect
          .poll(() => readSummary(heading), { message: `${panel} first section at ${width}px` })
          .toEqual(reference)
        if (numericPanels.has(panel)) {
          await expect(page.locator('.overview [data-card].is-expanded').locator(primaryNumber))
            .toHaveCSS('font-size', numberSize)
        }
      }
    }
  })

  test('creates and persists a receiving address in an unlocked wallet', async ({ page }) => {
    test.setTimeout(65_000)
    const password = 'address-session-test-password'
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await mockEntryBackend(page, { retail: true })
    await createWalletToEntry(page, password, /\/wallet$/)
    const ledger = page.locator('#detail-addresses')

    await page.locator('.receive-address-trigger').first().click()
    await expect(ledger.locator('.ledger-record')).toHaveCount(1)
    await ledger.getByRole('button', { name: '新建地址' }).click()
    await expect(ledger.locator('input[type="password"]')).toHaveCount(0)
    const registration = page.waitForRequest('**/api/v1/com/register-address')
    await ledger.getByRole('button', { name: '生成并登记' }).click()
    expect((await registration).postData()).not.toContain(password)
    const created = ledger.locator('.ledger-record').last()
    await expect(ledger.locator('.ledger-record')).toHaveCount(2)
    await expect(created.locator('summary')).toBeFocused()
    await expect(created).toContainText('已登记')
    const address = await created.locator('.address-identifier code').innerText()
    expect(address).toMatch(/^[a-f0-9]{40}$/)

    await page.reload()
    await expect(page).toHaveURL(/\/wallet\/unlock$/)
    await page.getByLabel('钱包密码').fill(password)
    await page.getByRole('button', { name: '解锁钱包' }).click()
    await expect(page).toHaveURL(/\/wallet$/, { timeout: 15_000 })
    await page.locator('.receive-address-trigger').first().click()
    await expect(ledger.locator('.ledger-record')).toHaveCount(2)
    await ledger.locator('.ledger-record').last().locator('summary').click()
    await expect(created.locator('.address-identifier code')).toHaveText(address)
  })

  for (const width of [1440, 390]) {
    test(`overview detail cards expand in place at ${width}px`, async ({ page }) => {
      test.setTimeout(65_000)
      await page.setViewportSize({ width, height: 900 })
      await mockEntryBackend(page, { member: true })
      await createWalletToEntry(page, 'inline-details-test-password', /\/wallet$/)
      const overview = page.locator('.overview')
      await expect(overview.locator('[data-card="settings"]')).toBeHidden()
      const balance = overview.locator('[data-card="balance"]')
      const security = overview.locator('[data-card="security"]')
      await expect(balance).toHaveCSS('border-top-right-radius', '16px')
      await expect(security).toHaveCSS('border-top-left-radius', '16px')
      const balanceBox = (await balance.boundingBox())!
      const securityBox = (await security.boundingBox())!
      const cardGap = width > 1000
        ? securityBox.x - balanceBox.x - balanceBox.width
        : securityBox.y - balanceBox.y - balanceBox.height
      expect(cardGap).toBeGreaterThanOrEqual(12)
      for (const panel of ['receive', 'security', 'activity', 'addresses', 'organization', 'blockchain']) {
        const trigger = panel === 'addresses'
            ? overview.locator('.receive-address-trigger').first()
            : overview.locator(`a[href$="#${panel}"]`).last()
        const cardName = panel === 'receive' ? 'balance' : panel === 'addresses' ? 'addresses-preview' : panel
        const card = overview.locator(`[data-card="${cardName}"]`)
        const summary = card.locator('.overview-summary').first()
        const originalSummary = await summary.elementHandle()
        const originalWidth = (await summary.boundingBox())!.width
        await trigger.click()
        const detail = overview.locator('#detail-' + panel)
        await expect(summary.getByRole('heading').first()).toBeVisible()
        await expect(summary).toBeVisible()
        expect(await originalSummary!.evaluate(element => element.isConnected)).toBe(true)
        await expect(detail).toBeVisible()
        if (panel === 'receive') {
          await expect(card.locator('.wallet-balance-field__actions')).toHaveCount(0)
          await expect(card.locator('.money-figure')).toBeVisible()
        } else if (panel === 'addresses') {
          const selectedAddress = detail.locator('.ledger-record[open]')
          await expect(selectedAddress).toHaveCount(1)
          await expect(selectedAddress.locator('summary')).toBeFocused()
          await expect(selectedAddress.getByRole('button', { name: /^复制 / })).toBeInViewport()
          const newAddress = detail.getByRole('button', { name: '新建地址' })
          await newAddress.click()
          const cancelCreation = detail.getByRole('button', { name: '取消', exact: true })
          await expect(cancelCreation).toHaveAttribute('aria-expanded', 'true')
          await expect(detail.getByLabel('钱包密码')).toHaveCount(0)
          await expect(detail.getByRole('button', { name: '生成并登记' })).toBeEnabled()
          await cancelCreation.click()
          await expect(detail.getByRole('button', { name: '生成并登记' })).toHaveCount(0)
        } else if (panel === 'security') {
          await expect(card.getByRole('button', { name: '收起' })).toHaveCount(1)
          await expect(summary.locator('.overview-summary-metrics__primary')).toContainText('可立即支付')
        } else {
          await expect.poll(async () => (await summary.boundingBox())!.width).toBeGreaterThanOrEqual(originalWidth - 3)
        }
        await expect(page).toHaveURL(new RegExp('/wallet#' + panel + '$'))
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
        await card.locator('[data-close-panel]').click()
        await expect(detail).toHaveCount(0)
        await expect(page).toHaveURL(/\/wallet$/)
      }
      await page.goBack()
      await expect(overview.locator('#detail-blockchain')).toBeVisible()
    })
    test(`overview send expands and restores its draft at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 })
      await mockEntryBackend(page, { member: true })
      await createWalletToEntry(page, 'inline-send-test-password', /\/wallet$/)
      const card = page.locator('.overview-send-card')
      const trigger = card.getByRole('button', { name: '发送', exact: true })
      // The transition interpolates this box; spare column width would stretch the digits.
      const unusedWidth = await card.locator('.wallet-balance-field__amount').evaluate(el => {
        const content = document.createRange()
        content.selectNodeContents(el)
        return el.getBoundingClientRect().width - content.getBoundingClientRect().width
      })
      expect(Math.abs(unusedWidth)).toBeLessThan(2)
      const original = (await card.boundingBox())!
      await trigger.click()
      await expect(page).toHaveURL(/\/wallet#send$/)
      const recipient = card.locator('#send-recipient')
      await expect(card.locator('.send-form')).toHaveCSS('border-top-width', '0px')
      await expect(card.locator('.send-form')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
      await expect(trigger).toHaveCount(0)
      await expect(card.getByRole('link', { name: '收款', exact: true })).toHaveCount(0)
      await expect(card.locator('.wallet-balance-field__amount')).toBeVisible()
      await expect(card.locator('.wallet-balance-field .money-figure')).toBeVisible()
      await recipient.fill('draft-recipient')
      const mode = card.locator('.send-panel-heading').getByRole('button', { name: /转账方式/ })
      await mode.click()
      await card.getByRole('option', { name: '普通转账' }).click()
      await expect(mode).toContainText('普通转账')
      await expect(recipient).toHaveValue('draft-recipient')
      const payment = card.getByRole('region', { name: '支付资产' })
      const review = payment.getByRole('button', { name: '审核交易' })
      await expect(review).toBeVisible()
      const addressesBox = (await card.locator('.send-addresses').boundingBox())!
      const paymentBox = (await payment.boundingBox())!
      expect(Math.abs(addressesBox.width - paymentBox.width)).toBeLessThan(1)
      if (width > 1000) {
        expect(paymentBox.x).toBeGreaterThan(addressesBox.x + addressesBox.width)
        const recipientBox = (await card.locator('.send-addresses .form-field__control').boundingBox())!
        const reviewBox = (await review.boundingBox())!
        expect(Math.abs(recipientBox.y + recipientBox.height - reviewBox.y - reviewBox.height)).toBeLessThan(2)
      } else {
        expect(paymentBox.y).toBeGreaterThanOrEqual(addressesBox.y + addressesBox.height - 1)
      }
      const expanded = (await card.boundingBox())!
      expect(expanded.height).toBeGreaterThan(original.height)
      if (width > 1000) expect(expanded.width).toBeGreaterThan(original.width * 1.8)
      const securityPreview = page.locator('[data-card="security"]')
      expect((await securityPreview.boundingBox())!.y - expanded.y - expanded.height).toBeGreaterThanOrEqual(12)
      const activeSurface = await card.evaluate((element) => getComputedStyle(element).backgroundColor)
      await expect(securityPreview).not.toHaveCSS('background-color', activeSurface)
      await expect(securityPreview.getByRole('link', { name: '查看凭证明细' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await card.getByRole('button', { name: '收起' }).click()
      await expect(trigger).toBeFocused()
      await expect(recipient).toBeHidden()
      await page.goBack()
      await expect(recipient).toBeVisible()
      await expect(recipient).toHaveValue('draft-recipient')
    })
  }
  for (const action of ['join', 'retail'] as const) {
    test(`keeps the chooser usable after rejected ${action} and retries confirmation without resubmitting`, async ({
      page,
    }) => {
      const state = await mockEntryBackend(page)
      const joining = action === 'join'
      const submitPath = joining
        ? '**/api/v1/group-a/assign/flow-apply'
        : '**/api/v1/com/register-address'
      const confirmationPath = joining ? '**/api/v1/re-online' : '**/api/v1/com/query-address-group'
      let submissions = 0
      let rejectConfirmation = true
      let releaseSubmission!: () => void
      const release = new Promise<void>((resolve) => {
        releaseSubmission = resolve
      })

      await page.route(submitPath, async (route) => {
        submissions += 1
        if (submissions === 1) {
          await release
          await route.fulfill({ status: 400, json: { error: 'Registration rejected' } })
          return
        }
        await route.fallback()
      })
      await page.route(confirmationPath, async (route) => {
        if ((state.member || state.retail) && rejectConfirmation) {
          await route.fulfill({ status: 403, json: { error: 'Confirmation unavailable' } })
          return
        }
        await route.fallback()
      })
      await createWalletToEntry(page, 'entry-regression-password')
      if (joining) await page.locator('label').filter({ hasText: '星河担保组织' }).click()
      const submit = page.getByRole('button', { name: joining ? '加入所选组织' : '暂不加入' })
      await submit.click()
      await expect.poll(() => submissions).toBe(1)
      try {
        await expect(page.locator('.entry-experience')).toHaveClass(/entry-experience--idle/)
        await expect(page.getByRole('heading', { name: '选择担保组织' })).toBeVisible()
      } finally {
        releaseSubmission()
      }
      await expect(page.getByRole('alert')).toContainText('Registration rejected')
      await submit.click()
      await expect(page.getByRole('alert')).toContainText('暂未收到申请结果')
      await expect(page).toHaveURL(/\/wallet\/entry$/)
      rejectConfirmation = false
      await page.getByRole('button', { name: '重新确认' }).click()
      await expect(page).toHaveURL(/\/wallet$/)
      await expect(
        page.getByRole('complementary').getByRole('link', { name: '总览' }),
      ).toBeVisible()
      await expect(page.locator('.entry-experience')).toHaveClass(/entry-experience--idle/)
      await expect(page.getByRole('heading', { name: '选择担保组织' })).toHaveCount(0)
      expect(submissions).toBe(2)
    })
  }

  test('a new user can stay retail and join later', async ({ page }) => {
    const state = await mockEntryBackend(page)
    await createWalletToEntry(page, 'phase-two-retail-password')

    await expect(page.getByRole('heading', { name: '选择担保组织' })).toBeVisible()
    await expect(page.getByText('星河担保组织')).toBeVisible()
    await page.getByRole('button', { name: '暂不加入' }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    expect(state.retail).toBe(true)

    await page.getByRole('complementary').getByRole('link', { name: '发送', exact: true }).click()
    await page.getByRole('button', { name: /转账方式/ }).click()
    await expect(page.getByRole('option', { name: '快速转账' })).toBeDisabled()
    await expect(page.getByRole('option', { name: '普通转账', selected: true })).toBeVisible()
    await expect(page.getByRole('option', { name: '跨链转账' })).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(page.locator('#overview-send').getByText(/快速和跨链功能需要先/)).toBeVisible()
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

    const search = page.getByRole('searchbox', { name: '搜索组织 ID' })
    await search.fill('unlisted')
    await expect(page.getByRole('radio', { name: '星河担保组织' })).toHaveCount(0)
    await expect(page.getByRole('status')).toHaveText('没有找到匹配的组织 ID。')
    await search.clear()
    await expect(page.getByRole('radio', { name: '星河担保组织' })).toHaveCount(1)
    await search.fill('ROUP-A')
    const details = page.getByRole('button', { name: '查看星河担保组织详情' })
    await details.click()
    const region = page.getByRole('region', { name: '查看星河担保组织详情' })
    await expect(details).toHaveAttribute('aria-expanded', 'true')
    await expect(region.getByText('1,250.00000000 CAL')).toBeVisible()
    await expect(region.getByText('2 个担保节点')).toBeVisible()
    await expect(region.getByText('3 个审计节点')).toBeVisible()
    for (const [label, id] of [
      ['Assign 节点', 'assign-a'],
      ['Aggregation 节点', 'aggregation-a'],
      ['TXCer 审计节点', 'txcer-a'],
      ['担保节点', 'guarantorA'],
    ] as const) {
      await region.locator('summary').filter({ hasText: label }).click()
      await expect(region.getByText(id, { exact: true })).toBeVisible()
    }
    await expect(page.getByRole('radio', { name: '星河担保组织' })).not.toBeChecked()
    await details.click()
    await expect(region).toHaveCount(0)

    await page.setViewportSize({ width: 390, height: 844 })
    await details.click()
    await expect(region.getByText('1,250.00000000 CAL')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
    await details.click()
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
    const moneyNote = page.locator('[data-figure="money"] .money-note')
    await expect(moneyNote).toBeVisible()
    await expect(moneyNote).toHaveCSS('transition-property', 'transform')

    await page.getByRole('button', { name: '打开账户菜单' }).click()
    await page.getByRole('menuitem', { name: '设置', exact: true }).click()
    const settingsActionContent = page.locator('[aria-labelledby=wallet-controls-heading] .app-button__content')
    await expect(settingsActionContent.first()).toHaveCSS('flex-direction', 'row')
    await expect(settingsActionContent.first()).toHaveCSS('white-space', 'nowrap')

    await page.getByRole('complementary').getByRole('link', { name: '发送', exact: true }).click()
    await expect(page.locator('#intro-send').getByRole('button', { name: '收起' })).toBeVisible()
    const mode = page.getByRole('button', { name: /转账方式/ })
    await mode.click()
    await expect(page.getByRole('option', { name: '快速转账' })).toBeEnabled()
    await expect(page.getByRole('option', { name: '跨链转账' })).toBeEnabled()
    await page.getByRole('option', { name: '普通转账' }).click()
    await mode.press('ArrowDown')
    await page.keyboard.press('End')
    await page.keyboard.press('Enter')
    await expect(mode).toContainText('跨链转账')
    await expect(page.locator('#send-recipient')).toHaveAttribute('placeholder', '0x…')
    await expect(page.locator('[data-route-node]')).toHaveCount(0)
  })

  test('a returning member skips the organization chooser', async ({ page }) => {
    await mockEntryBackend(page, { member: true })
    await createWalletToEntry(page, 'phase-two-returning-password', /\/wallet$/)

    await expect(page).toHaveURL(/\/wallet$/)
    await expect(page.getByRole('heading', { name: '选择担保组织' })).toHaveCount(0)
  })

  test('a retail wallet generates and displays a verified reusable capsule', async ({ page }) => {
    await mockEntryBackend(page)
    await createWalletToEntry(page, 'phase-two-capsule-password')
    await page.getByRole('button', { name: '暂不加入' }).click()
    await page.getByRole('link', { name: '收款', exact: true }).click()
    await expect(page).toHaveURL(/\/wallet#receive$/)

    const rawAddress = (await page.locator('output.receive-address').textContent())?.trim()
    expect(rawAddress).toMatch(/^[0-9a-f]{40}$/)

    await page.getByRole('button', { name: '收款地址形式 原始地址', exact: true }).click()
    await page.getByRole('option', { name: '胶囊地址', exact: true }).click()
    await page.getByRole('button', { name: '生成胶囊地址' }).click()

    const capsule = (await page.locator('output.receive-address').textContent())?.trim()
    expect(capsule).toMatch(/^00000000@[1-9A-HJ-NP-Za-km-z]+$/)
    await expect(page.getByText('委员会签名')).toBeVisible()
    await expect(page.getByText('组织签名的隐私别名，可重复使用；原始地址仍然有效。')).toBeVisible()
    await expect(page.getByRole('img', { name: `收款地址 ${capsule} 的二维码` })).toBeVisible()

    await page.getByRole('button', { name: '收款地址形式 胶囊地址', exact: true }).click()
    await page.getByRole('option', { name: '原始地址', exact: true }).click()
    await expect(page.locator('output.receive-address')).toHaveText(rawAddress!)
  })
})
