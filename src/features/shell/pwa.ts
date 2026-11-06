import { useSyncExternalStore } from 'react'

type Status = 'unavailable' | 'downloading' | 'ready' | 'update' | 'error' | 'updateError'
let status: Status = 'unavailable'
let registration: ServiceWorkerRegistration | undefined
const listeners = new Set<() => void>()
const publish = (next: Status) => { status = next; listeners.forEach((listener) => listener()) }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => status
const serverSnapshot = (): Status => 'unavailable'

export const usePwa = () => useSyncExternalStore(subscribe, snapshot, serverSnapshot)
// A new build reloads every window it takes over. A game in view keeps the build it has until the
// Storyteller leaves it or the page is hidden: a reload there would close a card being shown to a
// player, drop an open sheet and empty the redo history. Nothing saved is at risk either way.
let route = ''
const quiet = () => document.visibilityState === 'hidden' || !route.startsWith('/game/')
const askForUpdate = () => { if (quiet()) registration?.waiting?.postMessage('APPLY_UPDATE') }
// Chromium can stall a takeover asked for while the screen is still loading its images, then
// force it minutes later, perhaps in the next game. A page in view asks once its screen settles.
let settling: ReturnType<typeof setTimeout> | undefined
const applyPwaUpdate = () => {
  clearTimeout(settling)
  if (document.visibilityState === 'hidden') askForUpdate()
  else settling = setTimeout(askForUpdate, 2_000)
}
export const followPwaRoute = (pathname: string) => { route = pathname; applyPwaUpdate() }
export function registerPwa() {
  if (__DEV__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  route = window.location.pathname
  let disposed = false
  let hadController = !!navigator.serviceWorker.controller
  const changed = () => {
    if (hadController) window.location.reload()
    else { hadController = true; publish('ready') }
  }
  const check = () => { if (document.visibilityState === 'visible') void registration?.update().catch(() => {}) }
  const visibility = () => { applyPwaUpdate(); check() }
  navigator.serviceWorker.addEventListener('controllerchange', changed)
  document.addEventListener('visibilitychange', visibility)
  const interval = window.setInterval(check, 60_000)
  publish('downloading')
  void navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).then((result) => {
    if (disposed) return
    registration = result
    const observe = () => {
      const worker = result.installing
      if (!worker) return
      worker.addEventListener('statechange', () => {
        if (disposed) return
        if (worker.state === 'installed') {
          publish(result.waiting ? 'update' : 'ready')
          applyPwaUpdate()
        }
        if (worker.state === 'redundant' && (!result.installing || result.installing === worker)) {
          publish(result.waiting ? 'update' : result.active ? 'updateError' : 'error')
        }
      })
    }
    result.addEventListener('updatefound', observe)
    observe()
    publish(result.waiting ? 'update' : result.active ? 'ready' : 'downloading')
    applyPwaUpdate()
  }).catch(() => { if (!disposed) publish('error') })
  return () => {
    disposed = true
    clearTimeout(settling)
    navigator.serviceWorker.removeEventListener('controllerchange', changed)
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', visibility)
  }
}
