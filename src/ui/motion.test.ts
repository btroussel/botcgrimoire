import { afterEach, expect, test, vi } from 'vitest'

// Each hook call hands its store to React; here it is kept so the test can subscribe like React.
const stores: { subscribe: (onChange: () => void) => () => void; read: () => boolean }[] = []
vi.mock('react', () => ({
  useEffect: () => {},
  useState: (value: unknown) => [value, () => {}],
  useSyncExternalStore: (subscribe: (onChange: () => void) => () => void, read: () => boolean) => {
    stores.push({ subscribe, read })
    return read()
  },
}))
vi.mock('react-native', () => ({ Animated: {} }))
vi.mock('./theme', () => ({ motion: { duration: { fade: 120 } } }))
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); stores.length = 0 })

test('every reader shares one media query and follows its changes', async () => {
  const query = Object.assign(new EventTarget(), { matches: false })
  const matchMedia = vi.fn(() => query)
  vi.stubGlobal('window', { matchMedia })
  const { useReducedMotion } = await import('./motion')

  expect([useReducedMotion(), useReducedMotion(), useReducedMotion()]).toEqual([false, false, false])
  const heard = stores.map(() => vi.fn())
  const stops = stores.map((store, i) => store.subscribe(heard[i]!))
  expect(matchMedia).toHaveBeenCalledOnce()
  expect(matchMedia).toHaveBeenCalledWith('(prefers-reduced-motion: reduce)')

  query.matches = true
  query.dispatchEvent(new Event('change'))
  for (const listener of heard) expect(listener).toHaveBeenCalledOnce()
  expect(stores.map(store => store.read())).toEqual([true, true, true])

  stops.forEach(stop => stop())
  query.dispatchEvent(new Event('change'))
  for (const listener of heard) expect(listener).toHaveBeenCalledOnce()
})

test('without a browser, motion is not reduced', async () => {
  const { useReducedMotion } = await import('./motion')
  expect(useReducedMotion()).toBe(false)
  expect(() => stores[0]!.subscribe(() => {})()).not.toThrow()
})
