// A card of paper centred over a darker scrim, the cancel as plain
// text and the confirm as a filled button whose label says the thing that will happen, never OK.
// The rule it keeps: the scrim, Escape and the cancel all cancel, and nothing here decides what
// confirming does.
import { Animated, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'

import { Button } from './Button'
import { usePresence } from './motion'
import { PaperTexture } from './PaperTexture'
import { hairline, layout, palette, radius, scrim, shadows, space, type } from './theme'

export interface ConfirmProps {
  readonly visible: boolean

  readonly title: string
  readonly message: string
  readonly confirmLabel: string // what happens: "Delete this game", "Go home"
  readonly cancelLabel: string
  readonly onConfirm: () => void
  readonly onCancel: () => void
  readonly danger?: boolean // wax on the confirm; ink when the thing is merely final, not destructive
}

export const Confirm = ({ visible, title, message, confirmLabel, cancelLabel, onConfirm, onCancel, danger }: ConfirmProps) => {
  const p = palette
  const { width } = useWindowDimensions()
  const { mounted, opacity, scale } = usePresence(visible)

  if (!mounted) return null

  return (
    <Modal visible transparent animationType="none" onRequestClose={onCancel} aria-label={title}>
      <Animated.View style={[styles.fill, { backgroundColor: scrim.dialog, opacity }]}>
        <Pressable accessible={false} focusable={false} onPress={onCancel} style={styles.fill} />
      </Animated.View>
      {/* Once confirmed or cancelled, the card fades without taking a second press. */}
      <View style={[styles.centre, visible ? styles.passThrough : styles.inert]}>
        <Animated.View
          role="alertdialog"
          aria-label={title}
          accessibilityViewIsModal
          style={[styles.card, { width: Math.min(layout.dialogWidth, width - 2 * space.lg), backgroundColor: p.parchment, opacity, transform: [{ scale }] }]}
        >
          <PaperTexture radius={radius.dialog} />
          <Text style={[type.display.title, { color: p.ink }]}>{title}</Text>
          <Text style={[type.text.body, { color: p.ink }]}>{message}</Text>
          <View style={styles.actions}>
            <Button label={cancelLabel} onPress={onCancel} variant="text" surface="paper" />
            <Button label={confirmLabel} onPress={onConfirm} variant={danger ? 'danger' : 'primary'} surface="paper" />
          </View>
        </Animated.View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // box-none needs a child rule, which only a compiled style carries; inline it becomes none.
  passThrough: { pointerEvents: 'box-none' },
  inert: { pointerEvents: 'none' },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: { borderRadius: radius.dialog, padding: space.xl, gap: space.md, borderWidth: hairline, borderColor: palette.accent, boxShadow: shadows.sheet },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: space.sm, marginTop: space.sm, flexWrap: 'wrap' },
})
