// Temporary editing and reading windows share a centered parchment surface. The feature owns
// its contents and dismissal; the window owns its arrival, viewport bounds and scrolling.
import type { ReactNode } from 'react'
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconButton } from './Button'
import { usePresence } from './motion'
import { PaperTexture } from './PaperTexture'
import { useViewport } from './Viewport'
import { hairline, headerSurface, layout, palette, radius, scrim, shadows, space, type } from './theme'

export interface SheetProps {
  readonly visible: boolean
  readonly title: string
  readonly onClose: () => void
  readonly closeLabel: string
  readonly children: ReactNode
  readonly width?: number
  readonly onBack?: () => void
  readonly backLabel?: string
  readonly footer?: ReactNode
  readonly right?: ReactNode
  readonly contentPaddingHorizontal?: number
}

export const Sheet = ({ visible, title, onClose, closeLabel, children, width = 440, onBack, backLabel, footer, right, contentPaddingHorizontal = space.lg }: SheetProps) => {
  const insets = useSafeAreaInsets()
  const viewport = useViewport()
  const { height: windowHeight, width: windowWidth } = viewport
  const margin = windowWidth < 600 ? space.md : space.xl
  const windowBounds = {
    width: Math.max(0, Math.min(width, windowWidth - insets.left - insets.right - margin * 2)),
    maxHeight: Math.max(0, windowHeight - insets.top - insets.bottom - margin * 2),
  }
  const { mounted, opacity, scale } = usePresence(visible)

  if (!mounted) return null

  return (
    // The Modal is the one dialog node, so it carries the window's name.
    <Modal visible transparent animationType="none" onRequestClose={onClose} aria-label={title}>
      {/* A closing window fades without taking a second tap on its rows or buttons. */}
      <View style={[styles.centre, viewport, { pointerEvents: visible ? 'auto' : 'none',
        paddingTop: insets.top + margin, paddingBottom: insets.bottom + margin,
        paddingLeft: insets.left + margin, paddingRight: insets.right + margin,
      }]}>
        <Animated.View style={[styles.fill, { backgroundColor: scrim.sheet, opacity }]}>
          <Pressable accessible={false} focusable={false} onPress={onClose} style={styles.fill} />
        </Animated.View>
        <Animated.View style={[styles.paper, windowBounds, { opacity, transform: [{ scale }] }]}>
          <PaperTexture radius={radius.sheet} />
          <View style={headerSurface}>
            <View style={styles.header}>
              {onBack ? <IconButton icon="back" label={backLabel ?? title} onPress={onBack} surface="felt" /> : null}
              {/* A title never breaks inside a word: it keeps its longest word's width and the
                  header's action wraps first. */}
              <div style={{ flex: 1, minWidth: 'min-content', display: 'flex' }}>
                <Text accessibilityRole="header" style={[type.display.title, { color: palette.text, flexShrink: 1 }]} numberOfLines={2}>
                  {title}
                </Text>
              </div>
              {right ? <View style={styles.right}>{right}</View> : null}
              <IconButton icon="close" label={closeLabel} onPress={onClose} surface="felt" />
            </View>
          </View>
          <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={[styles.content, { paddingHorizontal: contentPaddingHorizontal, paddingVertical: space.lg }]}>{children}</View>
          </ScrollView>
          {footer ? <View style={styles.footer}><View style={styles.content}>{footer}</View></View> : null}
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  centre: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  paper: {
    flexShrink: 1, overflow: 'hidden', backgroundColor: palette.parchment,
    borderRadius: radius.sheet, borderWidth: hairline, borderColor: palette.accent, boxShadow: shadows.sheet,
  },
  header: {
    flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: space.xs,
    paddingLeft: space.lg, paddingRight: space.sm, paddingVertical: space.sm,
  },
  right: { flexDirection: 'row', alignItems: 'center', gap: space.xs, flexShrink: 1, minWidth: 0 },
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  content: { paddingHorizontal: space.lg, gap: space.md, width: '100%', maxWidth: layout.contentMax, alignSelf: 'center' },
  footer: { flexShrink: 0, borderTopWidth: hairline, borderTopColor: palette.parchmentShade, paddingVertical: space.lg },
})
