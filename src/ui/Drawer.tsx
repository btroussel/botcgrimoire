// The drawer a board sheet that chooses a token comes up in: paper from the foot, so the seats it
// fills stay in view above it, where a centred window would cover them. The feature owns its
// contents and dismissal; the drawer owns its edge, its arrival and its scrolling.
import type { ReactNode } from 'react'
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconButton } from './Button'
import { usePresence, useReducedMotion } from './motion'
import { PaperTexture } from './PaperTexture'
import { useViewport } from './Viewport'
import { drawer, hairline, headerSurface, palette, radius, scrim, shadows, space, type } from './theme'

export interface DrawerProps {
  readonly visible: boolean
  readonly title: string
  readonly onClose: () => void
  readonly closeLabel: string
  readonly children: ReactNode
  readonly right?: ReactNode // an action in the top row, beside Close
  readonly dock?: ReactNode // held at the drawer's foot under the scrolling body
  // What the drawer changes, in window coordinates. When the drawer would cover it, it takes the
  // edge with more room and stops short of it, down to a least height that still lists a few keys.
  readonly avoid?: { readonly top: number; readonly bottom: number; readonly left: number; readonly right: number }
}

export const Drawer = ({ visible, title, onClose, closeLabel, children, right, dock, avoid }: DrawerProps) => {
  const insets = useSafeAreaInsets()
  const viewport = useViewport()
  const { mounted, opacity } = usePresence(visible)
  const reduced = useReducedMotion()
  if (!mounted) return null

  const width = Math.min(drawer.maximum, viewport.width)
  const left = (viewport.width - width) / 2
  const clear = !avoid || avoid.right <= left || avoid.left >= left + width
  const above = avoid ? avoid.top : 0
  const below = avoid ? viewport.height - avoid.bottom : viewport.height
  const top = !clear && above > below
  const room = clear ? Infinity : Math.max(above, below) - space.sm
  const maxHeight = Math.min(viewport.height * drawer.heightShare, Math.max(viewport.height * drawer.leastShare, room))
  // It comes from its own edge; reduced motion leaves only the fade.
  const reach = reduced ? 0 : space.xxxl
  const travel = opacity.interpolate({ inputRange: [0, 1], outputRange: [top ? -reach : reach, 0] })
  return (
    // The Modal is the one dialog node, so it carries the drawer's name.
    <Modal visible transparent animationType="none" onRequestClose={onClose} aria-label={title}>
      <View style={[styles.frame, viewport, { pointerEvents: visible ? 'auto' : 'none', justifyContent: top ? 'flex-start' : 'flex-end' }]}>
        <Animated.View style={[styles.fill, { backgroundColor: scrim.drawer, opacity }]}>
          <Pressable accessible={false} focusable={false} onPress={onClose} style={styles.fill} />
        </Animated.View>
        <Animated.View style={[styles.paper, top ? styles.top : styles.bottom, {
            width, maxHeight,
            paddingTop: top ? insets.top : 0, paddingBottom: top ? 0 : insets.bottom,
            opacity, transform: [{ translateY: travel }],
          }]}>
          <PaperTexture />
          <View style={[headerSurface, styles.header]}>
            <Text accessibilityRole="header" numberOfLines={2} style={[type.display.title, styles.title, { color: palette.text }]}>{title}</Text>
            {right ? <View style={styles.right}>{right}</View> : null}
            <IconButton icon="close" label={closeLabel} onPress={onClose} surface="felt" />
          </View>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>{children}</ScrollView>
          {dock ? <View style={[styles.dock, { borderTopColor: palette.parchmentShade }]}>{dock}</View> : null}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  frame: { position: 'absolute', alignItems: 'center' },
  paper: { overflow: 'hidden', backgroundColor: palette.parchment, borderColor: palette.accent, borderWidth: hairline, boxShadow: shadows.sheet },
  // The sheet's corners on the side away from its edge, and the brass edge along it.
  bottom: { borderTopLeftRadius: radius.sheet, borderTopRightRadius: radius.sheet, borderBottomWidth: 0 },
  top: { borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, borderTopWidth: 0 },
  header: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingLeft: space.lg, paddingRight: space.sm, paddingVertical: space.xs },
  title: { flex: 1, minWidth: 0 },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1, minWidth: 0 },
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  body: { paddingHorizontal: space.sm, paddingVertical: space.md },
  dock: { flexShrink: 0, borderTopWidth: hairline, paddingHorizontal: space.lg, paddingVertical: space.md },
})
