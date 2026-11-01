import { afterEach, expect, test, vi } from 'vitest'
import type { CharacterId } from '../content'

vi.mock('../content', async () => ({ characters: new Map([
  ['imp', { team: 'demon' }], ['washerwoman', { team: 'townsfolk' }],
]), teamSide: (await vi.importActual<typeof import('../content/types')>('../content/types')).teamSide }))
vi.mock('../content/generated/art', () => ({ characterArt: {
  washerwoman: { good: { uri: '/washerwoman.webp' } },
  imp: { evil: { uri: '/imp.webp' }, good: { uri: '/imp-good.webp' } },
  demon: { good: { uri: '/demon-good.webp' }, evil: { uri: '/demon-evil.webp' } },
  minion: { good: { uri: '/minion-good.webp' }, evil: { uri: '/minion-evil.webp' } },
  ...Object.fromEntries(Array.from({ length: 130 }, (_, i) => [`role${i}`, { single: { uri: `/role${i}.webp` } }])),
} }))

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

const browser = (idle = true) => {
  const queued = new Map<number, () => void>()
  const images: string[] = []
  const instances: { src: string; fetchPriority: string }[] = []
  const page = Object.assign(new EventTarget(), { readyState: 'complete', visibilityState: 'visible' })
  let id = 0
  const enqueue = (callback: () => void) => { queued.set(++id, callback); return id }
  const decode = vi.fn(async () => {})
  const surface = Object.assign(new EventTarget(), {
    Image: class { src = ''; fetchPriority = ''; decode() { images.push(this.src); instances.push(this); return decode() } },
    setTimeout: vi.fn(enqueue),
    clearTimeout: (id: number) => queued.delete(id),
    ...(idle ? { requestIdleCallback: vi.fn(enqueue), cancelIdleCallback: (id: number) => queued.delete(id) } : {}),
  })
  vi.stubGlobal('window', surface)
  vi.stubGlobal('document', page)
  const step = async () => {
    const entry = queued.entries().next().value
    if (!entry) throw new Error('No scheduled warm-up')
    queued.delete(entry[0])
    entry[1]()
    await flush()
  }
  return { images, instances, page, surface, queued, step, decode }
}

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }

test('starts the selected script immediately, even before page load or without idle callbacks', async () => {
  const b = browser(false)
  b.page.readyState = 'loading'
  const { preloadArt } = await import('./preloadArt')
  const stop = preloadArt(['imp' as CharacterId])
  expect(b.images).toEqual(['/imp.webp'])
  expect(b.instances[0]?.fetchPriority).toBe('auto')
  expect(b.queued.size).toBe(0)
  stop()
})

test('bounds immediate work and cancels remaining images when the screen changes', async () => {
  const b = browser()
  const pending = Promise.withResolvers<void>()
  b.decode.mockReturnValue(pending.promise)
  const { preloadArt } = await import('./preloadArt')
  const stop = preloadArt(Array.from({ length: 6 }, (_, i) => `role${i}` as CharacterId))
  expect(b.images).toHaveLength(4)
  stop()
  pending.resolve()
  await flush()
  expect(b.images).toHaveLength(4)
})

test('warms the displayed evil tint for homebrew team fallbacks', async () => {
  const b = browser()
  const { preloadArt } = await import('./preloadArt')
  const stop = preloadArt(['demon', 'minion'] as CharacterId[])
  expect(b.images).toEqual(['/demon-evil.webp', '/minion-evil.webp'])
  stop()
})

test('prioritizes the script, yields between images and skips already warmed art', async () => {
  const b = browser()
  const { preloadArt } = await import('./preloadArt')
  const stop = preloadArt(['imp' as CharacterId], true)
  expect(b.images).toEqual(['/imp.webp'])
  await flush()
  await b.step()
  expect(b.images).toEqual(['/imp.webp', '/washerwoman.webp'])
  expect(b.instances[1]?.fetchPriority).toBe('low')
  stop()
  const stopAgain = preloadArt(['imp', 'washerwoman'] as CharacterId[])
  await flush()
  expect(b.queued.size).toBe(0)
  expect(b.images).toHaveLength(2)
  stopAgain()
})

test('shares pending downloads and promotes catalogue art needed by a screen', async () => {
  const b = browser()
  const pending = Promise.withResolvers<void>()
  b.decode.mockReturnValue(pending.promise)
  const { preloadArt } = await import('./preloadArt')
  const stopCatalogue = preloadArt([], true)
  await b.step()
  expect(b.instances[0]?.fetchPriority).toBe('low')
  const stopScript = preloadArt(['washerwoman' as CharacterId])
  expect(b.images).toEqual(['/washerwoman.webp'])
  expect(b.instances[0]?.fetchPriority).toBe('auto')
  stopCatalogue()
  stopScript()
  pending.resolve()
  await flush()
})

test('waits for page load and pauses while the tab is hidden', async () => {
  const b = browser()
  b.page.readyState = 'loading'
  const { preloadArt } = await import('./preloadArt')
  const stop = preloadArt([], true)
  expect(b.queued.size).toBe(0)
  b.page.readyState = 'complete'
  b.surface.dispatchEvent(new Event('load'))
  b.page.visibilityState = 'hidden'
  await b.step()
  expect(b.images).toEqual([])
  expect(b.queued.size).toBe(0)
  b.page.visibilityState = 'visible'
  b.page.dispatchEvent(new Event('visibilitychange'))
  await b.step()
  expect(b.images).toEqual(['/washerwoman.webp'])
  stop()
})

test('cancellation during decoding does not start another image', async () => {
  const b = browser()
  const pending = Promise.withResolvers<void>()
  b.decode.mockReturnValueOnce(pending.promise)
  const { preloadArt } = await import('./preloadArt')
  const stop = preloadArt([], true)
  await b.step()
  expect(b.queued.size).toBe(0)
  stop()
  pending.resolve()
  await Promise.resolve()
  expect(b.queued.size).toBe(0)
  b.page.dispatchEvent(new Event('visibilitychange'))
  expect(b.queued.size).toBe(0)
})

test('cancellation removes a pending callback', async () => {
  const b = browser()
  const { preloadArt } = await import('./preloadArt')
  const stop = preloadArt([], true)
  stop()
  expect(b.queued.size).toBe(0)
  expect(b.images).toEqual([])
})

test('uses a short fallback, continues after failure and allows a later retry', async () => {
  const b = browser(false)
  b.decode.mockRejectedValueOnce(new Error('decode failed'))
  const { preloadArt } = await import('./preloadArt')
  const stop = preloadArt([], true)
  expect(b.surface.setTimeout).toHaveBeenCalledWith(expect.any(Function), 50)
  await b.step()
  await b.step()
  expect(b.images).toEqual(['/washerwoman.webp', '/imp.webp'])
  stop()
  const retry = preloadArt(['washerwoman' as CharacterId])
  expect(b.images).toEqual(['/washerwoman.webp', '/imp.webp', '/washerwoman.webp'])
  retry()
})

test('background work has an idle deadline and pauses without blocking urgent work', async () => {
  const b = browser()
  const { preloadArt } = await import('./preloadArt')
  const stop = preloadArt([], true)
  expect(b.surface.requestIdleCallback).toHaveBeenCalledWith(expect.any(Function), { timeout: 1000 })
  const stopScript = preloadArt(['imp' as CharacterId])
  expect(b.images).toEqual(['/imp.webp'])
  stop()
  stopScript()
})

test('retains only recent images and can warm evicted art again', async () => {
  const b = browser()
  const { preloadArt } = await import('./preloadArt')
  for (let i = 0; i < 130; i++) {
    const stop = preloadArt([`role${i}` as CharacterId])
    await flush()
    stop()
  }
  const recent = preloadArt(['role129' as CharacterId])
  expect(b.images).toHaveLength(130)
  recent()
  const evicted = preloadArt(['role0' as CharacterId])
  expect(b.images).toHaveLength(131)
  evicted()
})
