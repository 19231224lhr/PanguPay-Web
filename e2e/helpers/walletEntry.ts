import type { Page, Route } from '@playwright/test'

async function json(route: Route, body: unknown): Promise<void> {
  await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
}

/** Keep visual/foundation tests independent from a live backend while exercising the real entry route. */
export async function mockReturningRetailEntry(page: Page): Promise<void> {
  await page.route('**/api/v1/re-online', (route) =>
    json(route, { IsInGroup: false, GuarantorGroupID: '' }),
  )
  await page.route('**/api/v1/com/query-address-group', async (route) => {
    const request = route.request().postDataJSON() as { address?: string[] }
    await json(route, {
      Addresstogroup: Object.fromEntries(
        (request.address ?? []).map((address) => [address, { GroupID: '1' }]),
      ),
    })
  })
}
