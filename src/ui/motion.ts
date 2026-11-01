// Reduced motion, read from the browser once and watched. Under it every duration becomes 0
// except a fade, which becomes 120 ms so a change is still seen to happen. Web only, so the
// media query is the source; the RN accessibility API answers nothing useful on the web.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Animated } from 'react-native'

import { motion } from './theme'

// One media query for the page, asked for on first use: every token and sheet reads it, and
// each would otherwise build its own. The prerendered page assumed no preference, so hydration
// starts there and React then moves to the browser's answer.
let query: MediaQueryList | undefined
const media = (): MediaQueryList | undefined => {
  if (!query && typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    query = window.matchMedia('(prefers-reduced-motion: reduce)')
  }
  return query
}
const subscribe = (onChange: () => void) => {
  const q = media()
  q?.addEventListener('change', onChange)
  return () => q?.removeEventListener('change', onChange)
}
const reducedNow = () => media()?.matches ?? false

export const useReducedMotion = (): boolean => useSyncExternalStore(subscribe, reducedNow, () => false)

// The duration a piece should actually run: `fade` marks an opacity-only change.
export const durationFor = (ms: number, reduced: boolean, fade = false): number =>
  reduced ? (fade ? motion.duration.fade : 0) : ms

// Every floating window (sheet, panel, dialog) arrives the same way: it fades in while settling
// from a touch smaller, and leaves by the same path, so it arrives rather than appears. `mounted`
// follows `visible` up at once and down only once the way out has finished, so the window is still
// there to fade. Reduced motion keeps the fade and drops the scale.
const restingScale = 0.96

export const usePresence = (visible: boolean) => {
  const reduced = useReducedMotion()
  const [mounted, setMounted] = useState(visible)
  if (visible && !mounted) setMounted(true)
  const [shown] = useState(() => new Animated.Value(0))
  useEffect(() => {
    const animation = Animated.timing(shown, {
      toValue: visible ? 1 : 0,
      duration: durationFor(motion.duration.mark, reduced, true),
      easing: visible ? motion.ease : motion.easeIn,
      useNativeDriver: false,
    })
    animation.start(({ finished }) => {
      if (finished && !visible) setMounted(false)
    })
    return () => animation.stop()
  }, [visible, shown, reduced])
  const scale = shown.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 1 : restingScale, 1] })
  return { mounted, opacity: shown, scale }
}
