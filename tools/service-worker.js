const CACHE_PREFIX = 'botc-grimoire-'
const CACHE = `${CACHE_PREFIX}__VERSION__`
const PRECACHE = /* __PRECACHE__ */ []

// A navigation cannot use a response that carries redirect history.
const navigable = (response) => response.redirected ? new Response(response.body, {
  status: response.status, statusText: response.statusText, headers: response.headers,
}) : response

const matchesHash = async (response, hash) => {
  if (!response?.ok || response.status === 206) return false
  const digest = await crypto.subtle.digest('SHA-256', await response.clone().arrayBuffer())
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('') === hash
}

// Code and art carry a content hash in their file name, so the browser's HTTP cache may supply
// them: on a first visit it already holds what the page has just loaded, and fetching it again
// would compete with the screen being opened. Pages and other stable URLs come from the host.
const hashedName = (url) => url.startsWith('/assets/') || url.startsWith('/_expo/static/')

const download = async (url, hash) => {
  if (hashedName(url)) {
    const cached = await fetch(new Request(url))
    if (await matchesHash(cached, hash)) return cached
  }
  const response = await fetch(new Request(url, { cache: 'reload' }))
  if (!await matchesHash(response, hash)) throw new Error(`Incomplete build: ${url}`)
  return response
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE)
    const previous = await Promise.all((await caches.keys())
      .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE)
      .reverse().map((name) => caches.open(name)))
    let next = 0
    const copy = async () => {
      while (next < PRECACHE.length) {
        const { url, hash } = PRECACHE[next++]
        let response
        // Verify bytes, even for stable URLs and builds made before hashes were recorded.
        for (const old of previous) {
          const candidate = await old.match(url)
          if (await matchesHash(candidate, hash)) { response = candidate; break }
        }
        if (!response) response = await download(url, hash)
        // The host redirects .html URLs. Navigation rejects their redirect history, even
        // when the bytes are correct, including responses reused from an older cache.
        await cache.put(url, navigable(response))
      }
    }
    // Bound downloads so installation leaves room for the screen the user is opening.
    const results = await Promise.allSettled(Array.from({ length: 4 }, copy))
    const failed = results.find((result) => result.status === 'rejected')
    if (failed) {
      // Wait for every writer before removing a partial cache. The active build stays intact.
      await caches.delete(CACHE)
      throw failed.reason
    }
    await self.skipWaiting()
  })())
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE) await caches.delete(name)
    }
    await self.clients.claim()
  })())
})

self.addEventListener('message', (event) => {
  if (event.data === 'GET_UPDATE_VERSION') {
    event.source?.postMessage({ type: 'UPDATE_VERSION', version: CACHE })
    return
  }
  if (event.data !== 'APPLY_UPDATE') return
  event.waitUntil(self.skipWaiting())
})

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  event.respondWith((async () => {
    // Storage can be evicted or unavailable. That must not break an online launch.
    const cache = await caches.open(CACHE).catch(() => undefined)
    const cached = (key, options) => cache?.match(key, options).catch(() => undefined)
    if (event.request.mode === 'navigate') {
      const pathname = url.pathname.replace(/\/$/, '').replace(/\.html$/, '')
      // Game IDs exist only on this device, so their HTML is the exported route template,
      // named `_` by tools/build-pwa.mjs.
      const route = /^\/game\/[^/]+\/history$/.test(pathname) ? '/game/_/history.html'
        : /^\/game\/[^/]+$/.test(pathname) ? '/game/_.html'
        : /^\/history\/[^/]+$/.test(pathname) ? '/history/_.html'
        : `${pathname || '/index'}.html`
      const response = await cached(route)
      if (response?.ok) return navigable(response)
      if (!PRECACHE.some((entry) => entry.url === route)) {
        const missing = await cached('/404.html')
        if (missing) return new Response(missing.body, { status: 404, headers: missing.headers })
      }
      // A missing route must reach the host, not silently become the cached homepage.
      // Do not cache fresh HTML beside code from an older build.
      return fetch(event.request)
    }
    return await cached(event.request, { ignoreSearch: true }) ?? fetch(event.request)
  })())
})
