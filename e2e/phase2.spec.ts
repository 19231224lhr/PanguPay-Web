import { expect, test, type Download, type Page, type Route } from '@playwright/test'

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

async function createWalletToEntry(page: Page, password: string): Promise<void> {
  await page.goto('/wallet/setup')
  await page.getByLabel('钱包密码').fill(password)
  await page.getByLabel('确认密码').fill(password)
  const downloads: Download[] = []
  page.on('download', (download) => downloads.push(download))
  await page.getByRole('button', { name: '创建钱包并下载两份备份' }).click()
  await expect.poll(() => downloads.length).toBe(2)
  await page.getByText('我已分别安全保存').click()
  await page.getByRole('button', { name: '进入钱包' }).click()
  await expect(page).toHaveURL(/\/wallet\/entry$/)
}

test.describe('Phase 2 organization entry and transfer availability', () => {
  test('a new user can stay retail and join later', async ({ page }) => {
    const state = await mockEntryBackend(page)
    await createWalletToEntry(page, 'phase-two-retail-password')

    await expect(page.getByRole('heading', { name: '选择你的使用方式' })).toBeVisible()
    await expect(page.getByText('星河担保组织')).toBeVisible()
    await page.getByRole('button', { name: '暂不加入，独立使用' }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    expect(state.retail).toBe(true)

    await page.getByRole('complementary').getByRole('link', { name: '发送', exact: true }).click()
    await expect(page.getByRole('radio', { name: '快速' })).toBeDisabled()
    await expect(page.getByRole('radio', { name: '普通' })).toBeChecked()
    await expect(page.getByRole('radio', { name: '跨链' })).toBeDisabled()
    await expect(page.getByText('当前为独立账户')).toBeVisible()
  })

  test('joining a guarantor organization unlocks quick and cross-chain modes', async ({ page }) => {
    const state = await mockEntryBackend(page)
    await createWalletToEntry(page, 'phase-two-member-password')

    await page.getByRole('radio', { name: '星河担保组织' }).click()
    await page.getByRole('button', { name: '加入担保组织' }).click()
    await expect(page).toHaveURL(/\/wallet$/)
    expect(state.member).toBe(true)

    await page.getByRole('complementary').getByRole('link', { name: '发送', exact: true }).click()
    await expect(page.getByRole('radio', { name: '快速' })).toBeEnabled()
    await expect(page.getByRole('radio', { name: '跨链' })).toBeEnabled()
  })

  test('a returning member skips the organization chooser', async ({ page }) => {
    await mockEntryBackend(page, { member: true })
    await createWalletToEntry(page, 'phase-two-returning-password')

    await expect(page).toHaveURL(/\/wallet$/)
    await expect(page.getByRole('heading', { name: '选择你的使用方式' })).toHaveCount(0)
  })
})
