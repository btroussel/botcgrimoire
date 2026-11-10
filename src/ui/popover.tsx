// The app's menus, the board's More, Start day and seat menu and the script sheet's More on a
// phone, share one look: an ink card with the brass hairline of the board's compartments, a cloth
// shadow that reads on velvet and on paper, and compact rows that grow to a touch target on touch
// screens.
import type { CSSProperties } from 'react'
import { Pressable, StyleSheet, Text } from 'react-native'

import { focusStyle, isFocused, isHovered } from './Button'
import { useFocusVisible } from './focus'
import { Icon } from './icons'
import type { IconName } from './icons'
import { durationFor } from './motion'
import { boardBlock, hoverWash, motion, palette, radius, shadows, space, touch, type } from './theme'

export const menuFrame: CSSProperties = { boxSizing: 'border-box', padding: space.xs, border: `1px solid ${String(boardBlock.borderColor)}`,
  borderRadius: radius.control, background: palette.ink, color: palette.text, boxShadow: shadows.lifted }

// A toolbar menu grows to its longest label rather than wrap one, growing away from its anchored edge.
export const menuSurface = (minWidth: number): CSSProperties => ({ ...menuFrame, position: 'fixed', margin: 0, left: 'auto',
  width: 'max-content', minWidth, maxWidth: 'calc(100vw - 16px)', overflowY: 'auto' })

// A button shrink-wraps in a block, so rows are stretched to take a tap across the whole menu. They
// reach the touch target on a phone, a small tablet or a finger-driven screen, decided in CSS so the
// first render and the seat menu's measurement of itself already agree on it.
export const menuClass = 'board-menu'
const rowCss = `.${menuClass} > [role="button"], .${menuClass} > input { width: 100%; min-height: 32px; }
@media (max-width: 599.98px), (max-height: 599.98px), (pointer: coarse) {
  .${menuClass} > [role="button"], .${menuClass} > input { min-height: ${touch}px; }
}`

export const menuStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingHorizontal: space.xs, paddingVertical: space.xxs, borderRadius: radius.control },
  label: { ...type.text.body, fontSize: 14, lineHeight: 20, color: palette.text, flexShrink: 1 },
  rule: { height: 1, marginHorizontal: space.xs, marginVertical: space.xxs, backgroundColor: palette.inkMuted },
})

export const MenuItem = ({ icon, label, onPress, disabled = false, armed = false }: {
  readonly icon: IconName
  readonly label: string
  readonly onPress: () => void
  readonly disabled?: boolean | undefined
  readonly armed?: boolean // its mode is on, as Arrange the seats while arranging
}) => {
  const focusVisible = useFocusVisible()
  return <><style href="grimoire-menu-row" precedence="default">{rowCss}</style>
  <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} accessibilityState={{ disabled }} onPress={onPress}
    style={state => [menuStyles.row,
      isHovered(state) && !disabled ? { backgroundColor: hoverWash.felt } : null,
      focusStyle(palette, isFocused(state) && focusVisible),
      { opacity: disabled ? motion.disabledOpacity : state.pressed ? motion.pressedOpacity : 1 }]}>
    <Icon name={icon} size={16} color={armed ? palette.accent : palette.text} />
    <Text style={menuStyles.label}>{label}</Text>
  </Pressable></>
}

// Opens a menu against the edge of its control nearest the board's centre: below a
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
