import { afterEach, expect, test, vi } from 'vitest'

vi.mock('react', () => ({ useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() }))
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules() })

const browser = (saved?: string) => {
  const worker = { postMessage: vi.fn() }
  const registration = Object.assign(new EventTarget(), { waiting: worker, active: {}, installing: undefined, update: vi.fn(async () => {}) })
  const serviceWorker = Object.assign(new EventTarget(), { controller: {}, register: vi.fn(async () => registration) })
  const storage = { getItem: vi.fn(() => saved ?? null), setItem: vi.fn() }
  vi.stubGlobal('__DEV__', false)
  vi.stubGlobal('navigator', { serviceWorker })
  vi.stubGlobal('document', Object.assign(new EventTarget(), { visibilityState: 'visible' }))
  vi.stubGlobal('window', Object.assign(new EventTarget(), { location: { reload: vi.fn() }, setInterval: vi.fn(() => 1), clearInterval: vi.fn() }))
  vi.stubGlobal('localStorage', storage)
  const message = (data: unknown, source: unknown = worker) => {
    serviceWorker.dispatchEvent(Object.assign(new Event('message'), { data, source }))
  }
  return { worker, registration, serviceWorker, storage, message }
}

test('a waiting update applies automatically and controller changes reload the app', async () => {
  const b = browser()
  const pwa = await import('./pwa')
  const stop = pwa.registerPwa()
  await Promise.resolve()
  expect(b.worker.postMessage).toHaveBeenCalledWith('APPLY_UPDATE')
  b.serviceWorker.dispatchEvent(new Event('controllerchange'))
  expect(window.location.reload).toHaveBeenCalledOnce()
  stop?.()
  expect(window.clearInterval).toHaveBeenCalledWith(1)
})

test('visible pages check periodically, hidden pages wait until visible', async () => {
  const b = browser()
  const pwa = await import('./pwa')
  const stop = pwa.registerPwa()
  await Promise.resolve()
  const [check, delay] = vi.mocked(window.setInterval).mock.calls[0]!
  expect(delay).toBe(60_000)
  const tick = check as () => void
  tick()
  expect(b.registration.update).toHaveBeenCalledOnce()
  Object.assign(document, { visibilityState: 'hidden' })
  tick()
  expect(b.registration.update).toHaveBeenCalledOnce()
  Object.assign(document, { visibilityState: 'visible' })
  document.dispatchEvent(new Event('visibilitychange'))
  expect(b.registration.update).toHaveBeenCalledTimes(2)
  stop?.()
})

test('first installation and an up-to-date build do not show an update notice', async () => {
  const b = browser()
  Object.assign(b.registration, { waiting: undefined })
  const pwa = await import('./pwa')
  const stop = pwa.registerPwa()
  await Promise.resolve()
  expect(pwa.usePwa()).toBe('ready')
  stop?.()
})

test('a failed update keeps the current app and is not reported ready', async () => {
  const b = browser()
  const installing = Object.assign(new EventTarget(), { state: 'installing' })
  Object.assign(b.registration, { waiting: undefined, installing })
  const pwa = await import('./pwa')
  const stop = pwa.registerPwa()
  await Promise.resolve()
  installing.state = 'redundant'
  Object.assign(b.registration, { installing: undefined })
  installing.dispatchEvent(new Event('statechange'))
  expect(pwa.usePwa()).toBe('updateError')
  expect(window.location.reload).not.toHaveBeenCalled()
  stop?.()
})

test('a failed first installation remains an error', async () => {
  const b = browser()
  const installing = Object.assign(new EventTarget(), { state: 'installing' })
  Object.assign(b.registration, { waiting: undefined, active: undefined, installing })
  const pwa = await import('./pwa')
  const stop = pwa.registerPwa()
  await Promise.resolve()
  installing.state = 'redundant'
  installing.dispatchEvent(new Event('statechange'))
  expect(pwa.usePwa()).toBe('error')
  expect(window.location.reload).not.toHaveBeenCalled()
  stop?.()
})
