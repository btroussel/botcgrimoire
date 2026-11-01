import { characters, teamSide } from '../content'
import type { CharacterId, Team } from '../content'
import { characterArt } from '../content/generated/art'

// Retain recent image objects as well as their URLs, without keeping the whole catalogue
// decoded for the lifetime of a phone tab. Concurrent callers share the same download.
const warmed = new Map<string, HTMLImageElement>()
const warming = new Map<string, { image: HTMLImageElement; done: Promise<void> }>()
const retainedImages = 128

// A revealed token can need a recorded tint different from the character's usual side.
export const preloadImage = (uri: string): Promise<void> =>
  typeof window === 'undefined' ? Promise.resolve() : warm(uri, 'auto')

const warm = (uri: string, priority: 'auto' | 'low'): Promise<void> => {
  const cached = warmed.get(uri)
  if (cached) {
    warmed.delete(uri)
    warmed.set(uri, cached)
    return Promise.resolve()
  }
  const pending = warming.get(uri)
  if (pending) {
    if (priority === 'auto') pending.image.fetchPriority = priority
    return pending.done
  }
  const image = new window.Image()
  image.decoding = 'async'
  image.fetchPriority = priority
  image.src = uri
  const done = image.decode().then(() => {
    warmed.set(uri, image)
    if (warmed.size > retainedImages) warmed.delete(warmed.keys().next().value!)
  }).catch(() => {
    // A failed warm-up must not block a screen or prevent a later retry.
  }).finally(() => { warming.delete(uri) })
  warming.set(uri, { image, done })
  return done
}

// Upcoming screens get four immediate loads. The rest of the catalogue uses idle time
// after the offline download, and never holds up rendering or navigation.
export const preloadArt = (priority: readonly CharacterId[], catalogue = false): (() => void) => {
  if (typeof window === 'undefined') return () => {}
  let stopped = false
  const sources = (ids: readonly string[]) => [...new Set(ids.flatMap((id) => {
    const art = characterArt[id]
    if (!art) return []
    const c = characters.get(id as CharacterId)
    // A homebrew character warms its team's generic icon, which has no character record and is
    // keyed by the team's name.
    const side = teamSide(c?.team ?? id as Team)
    const source = side === 'evil' ? art.evil ?? art.single ?? art.good : art.good ?? art.single ?? art.evil
    return source ? [source.uri] : []
  }))]
  const urgent = sources(priority)
  const background = catalogue ? sources(Object.keys(characterArt)).filter(uri => !urgent.includes(uri) && !warmed.has(uri)) : []
  let next = 0, nextBackground = 0, active = 0
  let pending: number | undefined
  const idle = typeof window.requestIdleCallback === 'function'
  const schedule = () => {
    if (stopped || document.visibilityState !== 'visible') return
    while (active < 4 && next < urgent.length) {
      active++
      void warm(urgent[next++]!, 'auto').finally(() => { active--; schedule() })
    }
    if (active || pending !== undefined || nextBackground >= background.length || document.readyState !== 'complete') return
    pending = idle ? window.requestIdleCallback(() => { void warmBackground() }, { timeout: 1000 })
      : window.setTimeout(() => { void warmBackground() }, 50)
  }
  const warmBackground = async () => {
    pending = undefined
    if (stopped || document.visibilityState !== 'visible') return
    active++
    await warm(background[nextBackground++]!, 'low')
    active--
    schedule()
  }
  window.addEventListener('load', schedule)
  document.addEventListener('visibilitychange', schedule)
  schedule()
  return () => {
    stopped = true
    if (pending !== undefined) {
      if (idle) window.cancelIdleCallback(pending)
      else window.clearTimeout(pending)
    }
    window.removeEventListener('load', schedule)
    document.removeEventListener('visibilitychange', schedule)
  }
}
