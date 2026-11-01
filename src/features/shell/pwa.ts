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
const applyPwaUpdate = () => registration?.waiting?.postMessage('APPLY_UPDATE')
export function registerPwa() {
  if (__DEV__ || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
  let disposed = false
  let hadController = !!navigator.serviceWorker.controller
  const changed = () => {
    if (hadController) window.location.reload()
    else { hadController = true; publish('ready') }
  }
  const check = () => { if (document.visibilityState === 'visible') void registration?.update().catch(() => {}) }
  navigator.serviceWorker.addEventListener('controllerchange', changed)
  document.addEventListener('visibilitychange', check)
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
    navigator.serviceWorker.removeEventListener('controllerchange', changed)
    window.clearInterval(interval)
    document.removeEventListener('visibilitychange', check)
  }
}
