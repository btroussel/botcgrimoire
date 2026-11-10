// A control at least the touch target tall. Its fill depends on the surface it
// sits on: primary on felt is parchment, primary on paper is ink filled with cream.
// A leading icon gets its own compartment. Disabled takes the
// explanation line its feature supplies, so a control that refuses says why.
import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native'

import { useFocusVisible } from './focus'
import { Icon } from './icons'
import type { IconName } from './icons'
import { PaperTexture } from './PaperTexture'
import type { Palette } from './theme'
import { border, focusRing, hoverWash, motion, palette, radius, shadows, space, touch, type } from './theme'

export type ButtonVariant = 'primary' | 'secondary' | 'text' | 'danger' | 'dangerText'
export type Surface = 'felt' | 'paper'

export interface ButtonProps {
  readonly label: string
  readonly onPress: () => void

  readonly variant?: ButtonVariant // secondary when omitted
  readonly tone?: 'good' | 'evil' // alignment colour on a primary button
  readonly surface?: Surface // felt when omitted
  readonly disabled?: boolean
  readonly explanation?: string // the line under a disabled control that says why
  readonly hintOnPress?: string // a brief floating reason when a blocked action is attempted
  readonly icon?: IconName // a leading glyph, coloured like the label
  readonly accessibilityLabel?: string
  readonly style?: StyleProp<ViewStyle>
}

interface Look {
  readonly background: string
  readonly color: string
  readonly borderColor: string
}

const lookOf = (p: Palette, variant: ButtonVariant, surface: Surface, tone?: 'good' | 'evil'): Look => {
  const paper = surface === 'paper'
  switch (variant) {
    case 'primary':
      if (tone) {
        const background = tone === 'good' ? p.goodOnPaper : p.evilOnPaper
        return { background, color: p.text, borderColor: background }
      }
      return paper
        ? { background: p.ink, color: p.parchment, borderColor: p.ink }
        : { background: p.parchment, color: p.ink, borderColor: p.parchment }
    case 'danger':
      return { background: p.danger, color: p.onDanger, borderColor: p.danger }
    case 'secondary':
      return paper
        ? { background: 'transparent', color: p.ink, borderColor: p.parchmentShade }
        : { background: 'transparent', color: p.text, borderColor: p.muted }
    case 'text':
      return { background: 'transparent', color: paper ? p.ink : p.text, borderColor: 'transparent' }
    case 'dangerText':
      return { background: 'transparent', color: p.danger, borderColor: 'transparent' }
  }
}

// react-native-web hands the style callback `focused` beside `pressed`; the React Native types
// stop at `pressed`, so the extra is read off the state without a cast at every control.
export const isFocused = (state: PressableStateCallbackType): boolean =>
  (state as { readonly focused?: boolean }).focused === true

export const isHovered = (state: PressableStateCallbackType): boolean =>
  (state as { readonly hovered?: boolean }).hovered === true

// The outline a keyboard user sees, and nothing under a thumb. Brass is too faint on vellum,
// so paper takes an ink one.
export const focusStyle = (p: Palette, visible: boolean, surface: Surface = 'felt'): ViewStyle =>
  visible
    ? { outlineStyle: 'solid', outlineWidth: focusRing.width, outlineColor: surface === 'paper' ? p.ink : p.accent, outlineOffset: focusRing.offset }
    : { outlineWidth: 0 }

export const Button = ({
  label,
  onPress,
  variant = 'secondary',
  tone,
  surface = 'felt',
  disabled,
  explanation,
  hintOnPress,
  icon,
  accessibilityLabel,
  style,
}: ButtonProps) => {
  const p = palette
  const look = lookOf(p, variant, surface, tone)
  const ticket = variant !== 'text' && variant !== 'dangerText'
  const filled = variant === 'primary' || variant === 'danger'
  const focusVisible = useFocusVisible()
  const [hintAttempt, setHintAttempt] = useState(0)
  useEffect(() => {
    if (!hintAttempt) return
    const timer = setTimeout(() => setHintAttempt(0), 2500)
    return () => clearTimeout(timer)
  }, [hintAttempt])
  return (
    <View style={style}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        disabled={disabled && !hintOnPress}
        aria-disabled={disabled}
        onPress={() => {
          if (disabled) {
            if (hintOnPress) setHintAttempt((attempt) => attempt + 1)
            return
          }
          onPress()
        }}
        style={(state) => [
          styles.base,
          { backgroundColor: look.background, borderColor: look.borderColor },
          ticket ? styles.ticket : null,
          ticket && icon ? styles.withIcon : null,
          filled ? { boxShadow: state.pressed ? shadows.ticketPressed : shadows.ticket } : null,
          isHovered(state) && !disabled ? ticket ? { outlineStyle: 'solid', outlineWidth: 2, outlineColor: p.accent, outlineOffset: 1 } : { backgroundColor: hoverWash[surface] } : null,
          isFocused(state) && focusVisible ? focusStyle(p, true, surface) : null,
          { opacity: disabled ? motion.disabledOpacity : state.pressed ? motion.pressedOpacity : 1 },
        ]}
      >
        {variant === 'primary' ? <PaperTexture radius={radius.control} opacity={surface === 'paper' ? 0.07 : 1} /> : null}
        {icon ? <View style={ticket ? [styles.iconCompartment, { borderRightColor: look.color + '40' }] : null}><Icon name={icon} color={look.color} /></View> : null}
        <Text style={[type.text.strong, { color: look.color, flexShrink: 1 }, ticket && icon ? styles.ticketLabel : { textAlign: 'center' }]}>
          {label}
        </Text>
      </Pressable>
      {hintAttempt > 0 && disabled && hintOnPress ? (
        <View pointerEvents="none" style={{ position: 'absolute', bottom: '100%', right: 0, minWidth: 200, maxWidth: 280, padding: space.sm, marginBottom: space.sm, borderRadius: radius.control, backgroundColor: p.ink, zIndex: 10 }}>
          <Text accessibilityRole="alert" style={[type.text.small, { color: p.parchment }]}>{hintOnPress}</Text>
        </View>
      ) : null}
      {disabled && explanation ? (
        <Text style={[type.text.small, styles.explanation, { color: surface === 'paper' ? p.inkMuted : p.muted }]}>{explanation}</Text>
      ) : null}
    </View>
  )
}

export interface IconButtonProps {
  readonly icon: IconName
  readonly label: string // what a screen reader says; the glyph has no text of its own
  readonly onPress: () => void

  readonly surface?: Surface
  readonly disabled?: boolean
  readonly style?: StyleProp<ViewStyle>
}

// A 44 square with a 24 glyph, for the board's edge, the corners and every sheet header. The
// label is also the mouse's tooltip. react-native-web drops `title` from a Pressable, so it sits
// on a wrapper that takes no box.
export const IconButton = ({ icon, label, onPress, surface = 'felt', disabled, style }: IconButtonProps) => {
  const p = palette
  const focusVisible = useFocusVisible()
  const color = surface === 'paper' ? p.ink : p.text
  return (
    <div title={label} style={{ display: 'contents' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        disabled={disabled}
        onPress={onPress}
        style={(state) => [
          styles.icon,
          isHovered(state) && !disabled ? { backgroundColor: hoverWash[surface] } : null,
          focusStyle(p, isFocused(state) && focusVisible, surface),
          { opacity: disabled ? motion.disabledOpacity : state.pressed ? motion.pressedOpacity : 1 },
          style,
        ]}
      >
        <Icon name={icon} color={color} />
      </Pressable>
    </div>
  )
}

const styles = StyleSheet.create({
  ticket: { borderRadius: radius.control, borderWidth: 1, overflow: 'hidden' },
  withIcon: { paddingVertical: 0, paddingLeft: 0, paddingRight: space.md, justifyContent: 'flex-start', gap: space.md },
  iconCompartment: { width: touch, alignSelf: 'stretch', minHeight: touch, borderRightWidth: 1, alignItems: 'center', justifyContent: 'center' },
  // A stretched button centres its label in the space beside the icon, as it does without one.
  ticketLabel: { paddingVertical: space.sm, flexGrow: 1, textAlign: 'center' },
  base: {
    outlineWidth: 0,
    minHeight: touch,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderRadius: radius.control,
    borderWidth: border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  explanation: { marginTop: space.xs, textAlign: 'center' },
  icon: {
    width: touch,
    height: touch,
    borderRadius: radius.control,
    borderWidth: border,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
  },
})
