// Phase controls float over the board only while the Storyteller needs them, and step aside
// entirely while the ring answers a pick or holds the voting controls.
import { createContext, useContext, useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { Animated, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import type { ViewInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { IconButton } from './Button'
import { domElement, layerAbove } from './focus'
import { usePresence } from './motion'
import { PaperTexture } from './PaperTexture'
import { hairline, headerSurface, palette, radius, scrim, shadows, space, type } from './theme'

export interface BoardPanels {
  readonly setup: ReactNode
  readonly night: ReactNode
  readonly day: ReactNode
  readonly over: ReactNode
}

export interface PanelProps {
  readonly title: string
  readonly status?: string
  readonly footer?: ReactNode
  readonly children: ReactNode
}

export const PanelVisibilityContext = createContext<{
  readonly open: boolean
  readonly onClose: () => void
  readonly closeLabel: string
} | null>(null)

export const Panel = ({ title, status, children, footer }: PanelProps) => {
  const visibility = useContext(PanelVisibilityContext)
  const { width, height } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const open = visibility?.open ?? true
  const margin = width < 600 ? space.md : space.xl
  const { mounted, opacity, scale } = usePresence(open)
  const windowRef = useRef<ViewInstance>(null)
  useEffect(() => {
    if (!open) return
    const element = domElement(windowRef.current)
    if (!element) return
    const previous = document.activeElement
    const controls = () => Array.from(element.querySelectorAll<HTMLElement>('button, input, textarea, select, [tabindex]'))
      .filter(control => control.tabIndex >= 0 && !control.hasAttribute('disabled') && control.getClientRects().length > 0)
    controls()[0]?.focus()
    const containTab = (event: KeyboardEvent) => {
      if (event.key !== 'Tab' || Array.from(document.querySelectorAll('[aria-modal="true"]')).some(modal => modal !== element)) return
      const choices = controls()
      const first = choices[0]
      const last = choices.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', containTab)
    return () => {
      document.removeEventListener('keydown', containTab)
      if (previous instanceof HTMLElement && element.contains(document.activeElement)) previous.focus()
    }
  }, [open])
  useEffect(() => {
    if (!open || !visibility) return
    const closeOnEscape = (event: KeyboardEvent) => {
      // A picker or confirmation above this window owns its own Escape handling.
      if (event.key === 'Escape' && !event.defaultPrevented && !layerAbove(domElement(windowRef.current))) visibility.onClose()
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open, visibility])
  return (
    <View style={[open ? styles.passThrough : styles.inert,
      styles.layer,
      { paddingLeft: insets.left + margin, paddingRight: insets.right + margin,
        paddingTop: insets.top + margin, paddingBottom: insets.bottom + margin },
      !mounted && styles.hidden,
    ]}>
      <Animated.View style={[styles.fill, { backgroundColor: scrim.sheet, opacity }]}>
        <Pressable accessible={false} focusable={false} style={styles.fill} onPress={visibility?.onClose} />
      </Animated.View>
    <Animated.View ref={windowRef} role={open ? 'dialog' : undefined} accessibilityLabel={title} accessibilityViewIsModal={open} style={[
      styles.panel,
      { width: Math.max(0, Math.min(440, width - insets.left - insets.right - margin * 2)),
        maxHeight: Math.max(120, height - insets.top - insets.bottom - margin * 2), opacity,
        transform: [{ scale }] },
    ]}>
      <PaperTexture radius={radius.sheet} />
      <View style={[styles.header, headerSurface]}>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[type.display.title, styles.light]}>{title}</Text>
          {status ? <Text style={[type.text.small, styles.muted]}>{status}</Text> : null}
        </View>
        {visibility ? (
          <IconButton icon="close" label={visibility.closeLabel} onPress={visibility.onClose} />
        ) : null}
      </View>
      {/* Keep timers and transient feature state mounted when the controls are closed. */}
      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}
        contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
      {footer ? <View style={styles.footer}><PaperTexture />{footer}</View> : null}
    </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 30, alignItems: 'center', justifyContent: 'center' },
  panel: {
    flexShrink: 1,
    backgroundColor: palette.parchment, borderRadius: radius.sheet,
    borderWidth: hairline, borderColor: palette.accent, boxShadow: shadows.sheet,
    overflow: 'hidden',
  },
  hidden: { display: 'none' },
  // box-none needs a child rule, which only a compiled style carries; inline it becomes none.
  passThrough: { pointerEvents: 'box-none' },
  inert: { pointerEvents: 'none' },
  // The sheets' header inset, corner and gutters, since both are windows over the same board.
  header: { flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: space.xs,
    paddingLeft: space.lg, paddingRight: space.sm, paddingVertical: space.sm },
  heading: { flex: 1, minWidth: 0, gap: space.xxs },
  light: { color: palette.text },
  muted: { color: palette.parchmentShade },
  scroll: { flexGrow: 0, flexShrink: 1, minHeight: 0 },
  body: { padding: space.lg, gap: space.md },
  footer: { flexShrink: 0, padding: space.lg, backgroundColor: palette.parchment, borderTopWidth: hairline, borderTopColor: palette.parchmentShade },
})
