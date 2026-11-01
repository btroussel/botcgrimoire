// The phone layout by window width, never by device (docs/ui.md): a phone turned sideways and a
// narrow browser window get the same answer. Pieces and features read it through the hook.
import { useSyncExternalStore } from 'react'

import { breakpoint } from './theme'

const subscribe = (change: () => void) => {
  window.addEventListener('resize', change)
  return () => window.removeEventListener('resize', change)
}

// The static export is drawn at width 0. Hydration must match it, or React keeps the export's
// phone styles while believing it drew the wide ones, so the real width arrives one render later.
// Pages opened inside the app read the real width at once.
export const useWindowWidth = (): number => useSyncExternalStore(subscribe, () => window.innerWidth, () => 0)

export const usePhone = (): boolean => useWindowWidth() < breakpoint.tablet
