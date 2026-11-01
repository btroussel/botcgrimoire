// The board's three menus, More, Start day and the seat menu, share one look: an ink card with
// the brass hairline of the board's compartments, a cloth shadow that reads on velvet, and
// compact rows that grow to a touch target on small screens.
import type { CSSProperties } from 'react'
import { Pressable, StyleSheet, Text, useWindowDimensions } from 'react-native'

import { focusStyle, isFocused, isHovered } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import type { IconName } from '../../ui/icons'
import { durationFor } from '../../ui/motion'
import { boardBlock, hoverWash, motion, palette, radius, shadows, space, touch, type } from '../../ui/theme'

export const menuFrame: CSSProperties = { boxSizing: 'border-box', padding: space.xs, border: `1px solid ${String(boardBlock.borderColor)}`,
  borderRadius: radius.control, background: palette.ink, color: palette.text, boxShadow: shadows.lifted }

export const menuSurface = (width: number): CSSProperties => ({ ...menuFrame, position: 'fixed', margin: 0, left: 'auto', width,
  maxWidth: 'calc(100vw - 16px)', overflowY: 'auto' })

// A phone or a small tablet is used by touch, so its rows reach the touch target.
export const menuRowHeight = (width: number, height: number) => Math.min(width, height) < 600 ? touch : 32

export const menuStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs, paddingVertical: space.xxs, borderRadius: radius.control },
  label: { ...type.text.body, fontSize: 14, lineHeight: 20, color: palette.text, flexShrink: 1 },
})

export const MenuItem = ({ icon, label, onPress, disabled = false, armed = false }: {
  readonly icon: IconName
  readonly label: string
  readonly onPress: () => void
  readonly disabled?: boolean | undefined
  readonly armed?: boolean // its mode is on, as Arrange the seats while arranging
}) => {
  const { width, height } = useWindowDimensions()
  const focusVisible = useFocusVisible()
  return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    style={state => [menuStyles.row, { minHeight: menuRowHeight(width, height) },
      isHovered(state) && !disabled ? { backgroundColor: hoverWash.felt } : null,
      focusStyle(palette, isFocused(state) && focusVisible),
      { opacity: disabled ? motion.disabledOpacity : state.pressed ? motion.pressedOpacity : 1 }]}>
    <Icon name={icon} size={16} color={armed ? palette.accent : palette.text} />
    <Text style={menuStyles.label}>{label}</Text>
  </Pressable>
}

// Opens a board menu against the edge of its control nearest the board's centre: below a
// toolbar button, above the status plaque. Both align to the control's right edge.
export const togglePopover = (popup: HTMLDivElement | null, anchorElement: HTMLDivElement | null,
  { above = false, reduced }: { readonly above?: boolean; readonly reduced: boolean }) => {
  const anchor = anchorElement?.getBoundingClientRect()
  if (!popup || !anchor) return
  if (popup.matches(':popover-open')) { popup.hidePopover(); return }
  popup.style.right = `${Math.max(space.xs, window.innerWidth - anchor.right)}px`
  popup.style.top = above ? 'auto' : `${anchor.bottom + space.xs}px`
  popup.style.bottom = above ? `${window.innerHeight - anchor.top + space.xs}px` : 'auto'
  popup.style.maxHeight = `${Math.max(touch, (above ? anchor.top : window.innerHeight - anchor.bottom) - 2 * space.xs)}px`
  popup.showPopover()
  const offset = above ? 'translateY(4px)' : 'translateY(-4px)'
  popup.animate?.(reduced ? [{ opacity: 0 }, { opacity: 1 }] : [{ opacity: 0, transform: offset }, { opacity: 1, transform: 'none' }],
    { duration: durationFor(motion.duration.mark, reduced, true), easing: motion.css.ease })
  popup.querySelector<HTMLButtonElement>('[role="button"]:not([aria-disabled="true"])')?.focus()
}
