/* global release */
// The production build prepends the exact shell URL, static asset list and release ID.
const scope = new URL(self.registration.scope)
const cachePrefix = `pangupay-shell:${scope.pathname}:`
const cacheName = cachePrefix + release.id
const shell = new URL(release.shell, scope).href
const assets = new Set(release.assets.map((file) => new URL(file, scope).href))

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(cacheName)
      await cache.addAll([shell, ...assets])
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter((name) => name.startsWith(cachePrefix) && name !== cacheName)
          .map((name) => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== scope.origin) return

  const path = url.pathname.slice(scope.pathname.length)
  const walletPage =
    request.mode === 'navigate' &&
    url.pathname.startsWith(scope.pathname) &&
    (path === '' || path === 'wallet' || path.startsWith('wallet/'))
  const staticFile = assets.has(url.href)
  if (!walletPage && !staticFile) return

  // Gateway traffic continues through the browser's ordinary network path.
  event.respondWith(
    (async () => {
      const cache = await caches.open(cacheName)
      // A module request can send a different Origin header from the precache request.
      const saved = await cache.match(walletPage ? shell : url.href, { ignoreVary: true })
      return saved ?? fetch(request)
    })(),
  )
})
