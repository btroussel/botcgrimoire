import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'
import vm from 'node:vm'
import { test } from 'node:test'
import { createHash, webcrypto } from 'node:crypto'
import { createServer } from 'node:http'
import { once } from 'node:events'
import sharp from 'sharp'

const root = new URL('../dist/', import.meta.url)
const script = await readFile(new URL('sw.js', root), 'utf8')
const origin = 'https://botcgrimoire.test'
const template = await readFile(new URL('./service-worker.js', import.meta.url), 'utf8')
const bytesOf = async (response) => Buffer.from(await response.arrayBuffer())
const responseOf = (value) => value instanceof Response ? value.clone() : new Response(value)

function worker({ windows = [], failDownload = false, failCacheRead = false, source = script, files, browserCache = new Map(),
  storage = new Map([['unrelated', new Map()], ['botc-grimoire-old', new Map()]]) } = {}) {
  const handlers = {}
  const network = []
  let offline = false
  let inFlight = 0
  let peak = 0
  let skipped = false
  let claimed = false
  const key = (request) => new URL(typeof request === 'string' ? request : request.url, origin).pathname
  const caches = {
    keys: async () => [...storage.keys()],
    delete: async (name) => storage.delete(name),
    open: async (name) => {
      if (!storage.has(name)) storage.set(name, new Map())
      const cache = storage.get(name)
      return {
        put: async (request, response) => { cache.set(key(request), response.clone()) },
        match: async (request) => {
          if (failCacheRead) throw new Error('cache unavailable')
          return cache.has(key(request)) ? responseOf(cache.get(key(request))) : undefined
        },
      }
    },
  }
  vm.runInNewContext(source, {
    URL, Response, caches, crypto: webcrypto,
    Request: class extends Request { constructor(url, options) { super(new URL(url, origin), options) } },
    fetch: async (request) => {
      network.push(request)
      if (failDownload || offline) throw new Error('network unavailable')
      peak = Math.max(peak, ++inFlight)
      try {
        const url = key(request)
        await new Promise((resolve) => setTimeout(resolve, 0))
        // The browser's HTTP cache answers unless a request asks for a fresh copy.
        if (request.cache !== 'reload' && browserCache.has(url)) return responseOf(browserCache.get(url))
        return files ? files.has(url) ? responseOf(files.get(url)) : new Response('missing', { status: 404 })
          : new Response(await readFile(new URL(decodeURI(url).slice(1), root)))
      } finally { inFlight-- }
    },
    self: {
      location: { origin },
      addEventListener: (name, handler) => { handlers[name] = handler },
      clients: { matchAll: async () => windows, claim: async () => { claimed = true } },
      skipWaiting: async () => { skipped = true },
    },
  })
  const dispatch = async (name, event = {}) => {
    let result
    handlers[name]({ ...event, waitUntil: (promise) => { result = promise }, respondWith: (promise) => { result = promise } })
    const response = await result
    // Browsers reject redirected cached responses for navigation's manual redirect mode.
    if (name === 'fetch' && event.request.redirect === 'manual' && response?.redirected) {
      throw new TypeError('A redirected response was used for a request whose redirect mode is not follow')
    }
    return response
  }
  const navigate = (pathname) => dispatch('fetch', { request: { url: origin + pathname, method: 'GET', mode: 'navigate', redirect: 'manual' } })
  return { dispatch, navigate, storage, network, peak: () => peak,
    goOffline: () => { offline = true; network.length = 0 }, skipped: () => skipped, claimed: () => claimed }
}

test('manifest and every static page carry installation metadata', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root)))
  assert.equal(manifest.display, 'standalone')
  assert.equal(manifest.launch_handler.client_mode, 'navigate-existing')
  for (const icon of manifest.icons) {
    const png = await readFile(new URL(icon.src.slice(1), root))
    const size = Number(icon.sizes.split('x')[0])
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }
  for (const file of await readdir(root, { recursive: true })) {
    if (!file.endsWith('.html')) continue
    assert.match(await readFile(new URL(file.replaceAll('\\', '/'), root), 'utf8'), /rel="manifest"/)
  }
})

test('exported HTML exposes every language\'s Home to search and excludes working screens', async () => {
  const site = 'https://botcgrimoire.com'
  // English is the root; every other locale folder has its Home at its tag in lower case.
  const languages = await readdir(new URL('../src/content/locales/', import.meta.url))
  const homeFiles = languages.map((l) => (l === 'en' ? 'index.html' : `${l.toLowerCase()}.html`))
  const homes = new Map()
  for (const file of await readdir(root, { recursive: true })) {
    if (!file.endsWith('.html')) continue
    const html = await readFile(new URL(file.replaceAll('\\', '/'), root), 'utf8')
    const head = html.match(/<head>([\s\S]*?)<\/head>/)?.[1] ?? ''
    if (['404.html', '_sitemap.html'].includes(file)) {
      assert.match(head, /name="robots" content="noindex, follow"/, file)
      continue
    }
    assert.match(head, /<title[^>]*>[^<]+<\/title>/, file)
    assert.match(head, /name="description" content="[^"]+"/, file)
    const home = homeFiles.includes(file)
    assert.match(head, new RegExp(`name="robots" content="${home ? 'index' : 'noindex'}, follow"`), file)
    assert.match(head, /property="og:image" content="https:\/\/botcgrimoire.com\/share.jpg"/, file)
    assert.match(head, /name="twitter:card" content="summary_large_image"/, file)
    if (!home) {
      assert.doesNotMatch(head, /rel="canonical"|hrefLang/, file)
      assert.match(html, /<html lang="en"/, file)
      assert.doesNotMatch(html, /src="\/share\.jpg"/, file)
      continue
    }
    const url = `${site}/${file === 'index.html' ? '' : file.replace(/\.html$/, '')}`
    assert.match(head, new RegExp(`rel="canonical" href="${url}"`), file)
    assert.match(head, new RegExp(`property="og:url" content="${url}"`), file)
    assert.match(head, /<title[^>]*>[^<|]+ \| [^<]*Blood on the Clocktower[^<]*<\/title>/, file)
    homes.set(url, {
      lang: html.match(/<html lang="([^"]+)"/)?.[1],
      alternates: [...head.matchAll(/rel="alternate" hrefLang="([^"]+)" href="([^"]+)"/g)].map(([, hreflang, href]) => `${hreflang} ${href}`).sort(),
      siteName: /"@type":"WebSite","name":"BotC Grimoire","alternateName":\["Grimoire BotC"\]/.test(head),
      thumbnail: head.includes(`"@type":"WebPage","url":"${url}","primaryImageOfPage":"${site}/search.jpg"`),
      // The window a first visit opens: closed, its text stays in the page for search engines.
      reading: html.match(/<dialog(?![^>]*\bopen\b)[^>]*>[\s\S]*?<h2[^>]*>([^<]+)<\/h2>/)?.[1],
      board: /<img(?=[^>]*src="\/share\.jpg")(?=[^>]*alt="[^"]+")[^>]*>/.test(html),
    })
  }
  // Every Home lists the same alternates, one per Home plus the root as the default, and each
  // code is a language with an optional country, as search engines take them.
  const alternates = homes.get(`${site}/`).alternates
  assert.equal(homes.size, languages.length)
  assert.deepEqual(alternates.filter(a => !a.startsWith('x-default ')).map(a => a.split(' ')[1]).sort(), [...homes.keys()].sort())
  assert.ok(alternates.includes(`x-default ${site}/`))
  for (const [url, page] of homes) {
    assert.deepEqual(page.alternates, alternates, url)
    assert.ok(page.alternates.some(a => a.endsWith(` ${url}`)), url)
    assert.equal(page.siteName, url === `${site}/`, url)
    assert.ok(page.thumbnail, url)
    assert.ok(page.reading && page.board, url)
  }
  // Each Home reads in its own language, Spain's Spanish and the Latin American one included.
  assert.equal(new Set([...homes.values()].map(page => page.reading)).size, homes.size)
  // Home's window shows the board capture, so the offline download carries it. Only crawlers
  // fetch the search thumbnail.
  assert.match(script, /"url":"\/share\.jpg"/)
  assert.doesNotMatch(script, /"url":"\/search\.jpg"/)
  for (const a of alternates) assert.match(a.split(' ')[0], /^([a-z]{2}(-[A-Z]{2})?|x-default)$/)
  assert.equal(homes.get(`${site}/`).lang, 'en')
  assert.equal(homes.get(`${site}/fr`).lang, 'fr')
  const robots = await readFile(new URL('robots.txt', root), 'utf8')
  assert.match(robots, /Allow: \//)
  assert.doesNotMatch(robots, /Disallow: \//)
  assert.match(robots, /Sitemap: https:\/\/botcgrimoire.com\/sitemap.xml/)
  const sitemap = await readFile(new URL('sitemap.xml', root), 'utf8')
  assert.deepEqual([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => match[1]).sort(), [...homes.keys()].sort())
  const { width, height } = await sharp(await readFile(new URL('share.jpg', root))).metadata()
  assert.deepEqual([width, height], [1200, 630])
  // A result thumbnail is square, so a square image keeps the whole ring.
  const thumbnail = await sharp(await readFile(new URL('search.jpg', root))).metadata()
  assert.deepEqual([thumbnail.width, thumbnail.height], [1200, 1200])
})

test('font preloads name the exported files their font faces load, as the host spells them', async () => {
  // The host redirects any other spelling, which costs every font a round trip.
  const canonical = (url) => url.split('/').map((part) => encodeURIComponent(decodeURIComponent(part))).join('/')
  let pages = 0
  for (const file of await readdir(root, { recursive: true })) {
    if (!file.endsWith('.html')) continue
    const html = await readFile(new URL(file.replaceAll('\\', '/'), root), 'utf8')
    const preloads = [...html.matchAll(/<link rel="preload" href="([^"]+)" as="font"/g)].map(match => match[1])
    const faces = [...html.matchAll(/@font-face\{[^}]*src:url\("([^"]+)"\)/g)].map(match => match[1])
    assert.deepEqual(preloads.toSorted(), faces.toSorted(), file)
    if (preloads.length) pages++
    for (const url of preloads) {
      assert.equal(url, canonical(url), file)
      await readFile(new URL(url.slice(1), root))
    }
  }
  assert.ok(pages > 0)
})

test('offline navigation includes unvisited game IDs, history and query strings', async () => {
  const w = worker()
  await w.dispatch('install')
  w.goOffline()
  for (const [route, file] of [
    ['/', 'index.html'], ['/index.html', 'index.html'], ['/settings.html', 'settings.html'],
    ['/settings?test=1', 'settings.html'], ['/scripts', 'scripts.html'],
    ['/new', 'new.html'], ['/history', 'history.html'], ['/fr', 'fr.html'], ['/nb-no/', 'nb-no.html'],
    ['/history/local-123/?test=1', 'history/_.html'],
    ['/game/local-123', 'game/_.html'], ['/game/local-123/history/', 'game/_/history.html'],
    ['/nowhere', '404.html'],
  ]) {
    assert.deepEqual(await bytesOf(await w.navigate(route)), await readFile(new URL(file, root)))
  }
  assert.equal(w.network.length, 0)
  assert.equal(w.skipped(), true)
})

test('missing cached pages and failed cache reads fall back to the requested network URL', async () => {
  for (const failCacheRead of [false, true]) {
    const files = new Map([['/index.html', 'old homepage'], ['/settings.html', 'old settings']])
    const w = worker({ source: build('recovery', files), files, failCacheRead, storage: new Map() })
    await w.dispatch('install')
    w.storage.get('botc-grimoire-recovery').delete('/settings.html')
    files.set('/settings', 'new settings from network')
    assert.equal(await (await w.navigate('/settings?source=bookmark')).text(), 'new settings from network')
    assert.equal(w.network.at(-1).url, origin + '/settings?source=bookmark')
    assert.equal(w.storage.get('botc-grimoire-recovery').has('/settings.html'), false)
  }
})

test('unknown offline routes keep their 404 status instead of serving the homepage', async () => {
  const files = new Map([['/index.html', 'homepage'], ['/404.html', 'not found']])
  const w = worker({ source: build('missing', files), files })
  await w.dispatch('install')
  w.goOffline()
  const response = await w.navigate('/not-a-route')
  assert.equal(response.status, 404)
  assert.equal(await response.text(), 'not found')
})

test('every exported asset is cached before installation succeeds', async () => {
  const w = worker()
  await w.dispatch('install')
  w.goOffline()
  const cache = [...w.storage.values()].at(-1)
  assert.ok([...cache.keys()].some((key) => key.endsWith('.ttf')))
  assert.ok([...cache.keys()].some((key) => key.endsWith('.webp')))
  for (const [url, response] of cache) {
    assert.deepEqual(await bytesOf(await w.dispatch('fetch', { request: { url: origin + url, method: 'GET', mode: 'cors' } })), await bytesOf(response.clone()))
  }
  assert.equal(w.network.length, 0)
  assert.ok(w.peak() <= 4)
})

test('a failed installation preserves the previous offline build', async () => {
  const w = worker({ failDownload: true })
  await assert.rejects(w.dispatch('install'))
  assert.ok(w.storage.has('botc-grimoire-old'))
  assert.equal(w.storage.size, 2)
  assert.equal(w.skipped(), false)
})

const build = (version, files) => template.replace('__VERSION__', version).replace('/* __PRECACHE__ */ []',
  JSON.stringify([...files].map(([url, bytes]) => ({ url, hash: createHash('sha256').update(bytes).digest('hex') }))))

test('redirected HTML remains navigable after download or reuse from a legacy cache', async (t) => {
  const html = '<!doctype html><title>Grimoire</title><p>Prêt à jouer</p>'
  const server = createServer((request, response) => {
    if (request.url === '/index.html') {
      response.writeHead(307, { Location: '/' }).end()
    } else {
      response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' }).end(html)
    }
  })
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())))
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const redirected = await fetch(`http://127.0.0.1:${server.address().port}/index.html`)
  assert.equal(redirected.redirected, true)
  const routes = new Map([
    ['/', '/index.html'], ['/settings?test=1', '/settings.html'],
    ['/game/local-123', '/game/_.html'], ['/game/local-123/history/', '/game/_/history.html'],
    ['/history/local-123', '/history/_.html'],
  ])
  const files = new Map([...routes.values()].map(url => [url, html]))
  for (const reuse of [false, true]) {
    await t.test(reuse ? 'legacy cache' : 'fresh download', async () => {
      const w = worker({ source: build('redirect-fix', files), failDownload: reuse,
        files: new Map([...files.keys()].map(url => [url, redirected])) })
      if (reuse) {
        for (const url of files.keys()) w.storage.get('botc-grimoire-old').set(url, redirected.clone())
      }
      await w.dispatch('install')
      assert.equal(w.network.length, reuse ? 0 : files.size)
      w.goOffline()
      for (const route of routes.keys()) {
        const response = await w.navigate(route)
        assert.equal(response.redirected, false, route)
        assert.equal(response.status, redirected.status)
        assert.equal(response.statusText, redirected.statusText)
        assert.deepEqual([...response.headers], [...redirected.headers])
        assert.equal(await response.text(), html)
      }
      assert.equal(w.network.length, 0)
      if (reuse) assert.equal(w.storage.get('botc-grimoire-old').get('/index.html').redirected, true)
    })
  }
})

test('an update downloads only changed and missing files, including stable URLs', async () => {
  const oldFiles = new Map([['/index.html', 'old page'], ['/unchanged.webp', 'same art'], ['/missing.ttf', 'font']])
  const previous = worker({ source: build('v1', oldFiles), files: oldFiles })
  await previous.dispatch('install')
  previous.storage.get('botc-grimoire-v1').delete('/missing.ttf')
  const files = new Map([...oldFiles, ['/index.html', 'new page'], ['/new.js', 'new code']])
  const next = worker({ source: build('v2', files), files, storage: previous.storage })
  await next.dispatch('install')
  assert.deepEqual(next.network.map((request) => new URL(request.url).pathname).sort(), ['/index.html', '/missing.ttf', '/new.js'])
  assert.ok(next.network.every((request) => request.cache === 'reload'))
  assert.equal(await previous.storage.get('botc-grimoire-v1').get('/index.html').clone().text(), 'old page')
  for (const [url, bytes] of files) assert.equal(await next.storage.get('botc-grimoire-v2').get(url).clone().text(), bytes)
})

test('hashed files reuse the browser cache and download a wrong copy again', async () => {
  const files = new Map([['/index.html', 'page'], ['/assets/icon.1a2b.webp', 'art'], ['/_expo/static/js/web/entry-1a2b.js', 'code']])
  const browserCache = new Map([['/index.html', 'stale page'], ['/assets/icon.1a2b.webp', 'damaged art'], ['/_expo/static/js/web/entry-1a2b.js', 'code']])
  const w = worker({ source: build('v2', files), files, browserCache })
  await w.dispatch('install')
  assert.deepEqual(w.network.map((request) => `${new URL(request.url).pathname} ${request.cache}`).sort(), [
    '/_expo/static/js/web/entry-1a2b.js default',
    '/assets/icon.1a2b.webp default',
    '/assets/icon.1a2b.webp reload',
    '/index.html reload',
  ])
  for (const [url, bytes] of files) assert.equal(await w.storage.get('botc-grimoire-v2').get(url).clone().text(), bytes)
})

test('legacy caches can supply verified bytes without a network connection', async () => {
  const files = new Map([['/icon.webp', 'art']])
  const w = worker({ source: build('v2', files), files, failDownload: true })
  w.storage.get('botc-grimoire-old').set('/icon.webp', Buffer.from('art'))
  await w.dispatch('install')
  assert.equal(w.network.length, 0)
})

test('unrelated caches and corrupt cached bytes cannot supply an update', async () => {
  const files = new Map([['/icon.webp', 'correct art']])
  const w = worker({ source: build('v2', files), files })
  w.storage.get('botc-grimoire-old').set('/icon.webp', Buffer.from('corrupt'))
  w.storage.get('unrelated').set('/icon.webp', Buffer.from('correct art'))
  await w.dispatch('install')
  assert.equal(w.network.length, 1)
  assert.equal(await w.storage.get('botc-grimoire-v2').get('/icon.webp').clone().text(), 'correct art')
})

test('failed or mismatched downloads discard the partial build after all writes finish', async () => {
  const files = new Map(Array.from({ length: 8 }, (_, n) => [`/${n}.js`, `code ${n}`]))
  for (const kind of ['offline', 'mismatch', 'missing']) {
    const downloads = new Map(files)
    if (kind === 'mismatch') downloads.set('/0.js', 'wrong release')
    if (kind === 'missing') downloads.delete('/0.js')
    const w = worker({ source: build('failed', files), files: downloads, failDownload: kind === 'offline' })
    w.storage.get('botc-grimoire-old').set('/old.js', Buffer.from('working build'))
    await assert.rejects(w.dispatch('install'))
    assert.equal(w.storage.has('botc-grimoire-failed'), false)
    assert.equal(w.storage.get('botc-grimoire-old').get('/old.js').toString(), 'working build')
    assert.equal(w.skipped(), false)
    assert.ok(w.peak() <= 4)
  }
})

test('activation removes only this app’s old caches', async () => {
  const w = worker()
  await w.dispatch('install')
  await w.dispatch('activate')
  assert.ok(w.storage.has('unrelated'))
  assert.equal(w.storage.has('botc-grimoire-old'), false)
  assert.equal(w.claimed(), true)
})

test('verified updates activate automatically on any screen with multiple windows', async () => {
  for (const paths of [['/game/local-123'], ['/scripts'], ['/new'], ['/', '/game/local-123']]) {
    const windows = paths.map((path, index) => ({ id: String(index), url: origin + path }))
    const w = worker({ source: build('automatic', new Map()), windows })
    await w.dispatch('install')
    assert.equal(w.skipped(), true)
  }
})

test('reports the build identity without activating the update', async () => {
  const w = worker({ source: build('next-version', new Map()) })
  let response
  await w.dispatch('message', { data: 'GET_UPDATE_VERSION', source: { postMessage: value => { response = value } } })
  assert.equal(response.type, 'UPDATE_VERSION')
  assert.equal(response.version, 'botc-grimoire-next-version')
  assert.equal(w.skipped(), false)
})
