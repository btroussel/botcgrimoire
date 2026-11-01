// A view rises a little as it replaces the last one, so moving forward reads as a step rather
// than a cut. Reduced motion keeps only the fade. Nothing waits on it: the view is interactive
// from its first frame. The transform is dropped once settled: it would otherwise become the
// containing block for the print stylesheet's absolutely placed sheet.
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { Animated, StyleSheet } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import { durationFor, useReducedMotion } from './motion'
import { motion, space } from './theme'

export const Enter = ({ children, style }: { readonly children: ReactNode; readonly style?: StyleProp<ViewStyle> }) => {
  const reduced = useReducedMotion()
  const [shown] = useState(() => new Animated.Value(0))
  const [settled, setSettled] = useState(false)
  useEffect(() => {
    const run = Animated.timing(shown, {
      toValue: 1,
      duration: durationFor(motion.duration.sheetIn, reduced, true),
      easing: motion.ease,
      useNativeDriver: false,
    })
    run.start(({ finished }) => { if (finished) setSettled(true) })
    return () => run.stop()
  }, [shown, reduced])
  const rise = shown.interpolate({ inputRange: [0, 1], outputRange: [reduced ? 0 : space.lg, 0] })
  return <Animated.View style={[styles.fill, style, settled ? null : { opacity: shown, transform: [{ translateY: rise }] }]}>{children}</Animated.View>
}

const styles = StyleSheet.create({ fill: { flex: 1, minHeight: 0 } })
