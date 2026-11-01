// When a saved script was last edited, in words: relative while the gap still means something to
// a Storyteller, the locale's date past a week, when the gap is what matters and not its exact
// size.
import type { Locale, Translate } from '../../content'


const minute = 60_000
const hour = 60 * minute
const dayMs = 24 * hour

// The time rows are described at, ticking on the minute so "3 minutes ago" stays true while the
// screen is open, and shaped for useSyncExternalStore so no render reads the clock itself.
export const minuteClock = {
  now: (): number => Math.floor(Date.now() / minute) * minute,
  subscribe: (onTick: () => void): (() => void) => {
    const id = setInterval(onTick, minute)
    return () => clearInterval(id)
  },
}

export const relativeTime = (then: number, now: number, t: Translate, locale: Locale): string => {
  const gap = Math.max(0, now - then)
  if (gap < minute) return t('common.justNow')
  if (gap < hour) return t('common.minutesAgo', { count: Math.floor(gap / minute) })
  if (gap < dayMs) return t('common.hoursAgo', { count: Math.floor(gap / hour) })
  if (gap < 7 * dayMs) return t('common.daysAgo', { count: Math.floor(gap / dayMs) })
  const date = new Date(then)
  const sameYear = date.getFullYear() === new Date(now).getFullYear()
  return date.toLocaleDateString(locale, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' })
}
