import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native'

import type { Alignment, Translate } from '../../content'
import { focusStyle, isFocused, isHovered } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import type { IconName } from '../../ui/icons'
import { durationFor, useReducedMotion } from '../../ui/motion'
import { hoverWash, motion, palette, space, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { useViewport } from '../../ui/Viewport'
import { MenuItem, menuFrame, menuRowHeight, menuStyles } from './popover'
import type { Point, SeatMenuPlace, SeatMenuRoom } from './seatMenu'

export const SeatContextMenu = ({ seatId, name, alignment, dead, ghostVote, anchor, place, width, t, nominateSelfDisabled, onClose, onReminder, onCharacter, onAlignment, onNominateSelf, onEmpty, onRename, onLife, onGhostVote }: {
  readonly seatId: string // the seat whose token takes focus back when the menu closes
  readonly name: string
  readonly alignment: Alignment
  readonly dead: boolean
  readonly ghostVote: boolean
  readonly anchor: Point // the token's centre, where the menu grows from
  readonly place: (menu: Size, room: SeatMenuRoom) => SeatMenuPlace // where the menu goes, given its measured size
  readonly width: number
  readonly t: Translate
  readonly nominateSelfDisabled: boolean
  readonly onClose: () => void
  readonly onReminder?: () => void
  readonly onCharacter: () => void
  readonly onAlignment: () => void
  readonly onNominateSelf?: () => void
  readonly onEmpty: () => void
  readonly onRename: (name: string) => void
  readonly onLife: () => void
  readonly onGhostVote: () => void
}) => {
  const menu = useRef<HTMLDivElement>(null)
  const viewport = useViewport()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(name)
  const editing = useRef(false)
  const saveName = () => {
    if (!editing.current) return
    editing.current = false
    setRenaming(false)
    const next = draft.trim()
    if (next && next !== name) onRename(next)
  }
  const focusVisible = useFocusVisible()
  const reduced = useReducedMotion()
  const screen = useWindowDimensions()
  const rowHeight = menuRowHeight(screen.width, screen.height)
  // Placed from its measured size on every render, since renaming, a death or a wrapped
  // translation changes it, within the part of the band the screen shows, which a scrolled
  // ring or a software keyboard cuts short.
  useLayoutEffect(() => {
    const element = menu.current
    const parent = element?.offsetParent
    if (!element || !(parent instanceof HTMLElement)) return
    const size = { width: element.offsetWidth, height: element.offsetHeight }
    const band = parent.getBoundingClientRect()
    const { left, top } = place(size, {
      left: Math.max(0, viewport.left - band.left), top: Math.max(0, viewport.top - band.top),
      right: Math.min(band.width, viewport.left + viewport.width - band.left),
      bottom: Math.min(band.height, viewport.top + viewport.height - band.top),
    })
    element.style.left = `${left}px`
    element.style.top = `${top}px`
    const inside = (value: number, length: number) => Math.max(0, Math.min(length, value))
    element.style.transformOrigin = `${inside(anchor.x - left, size.width)}px ${inside(anchor.y - top, size.height)}px`
  })
  useLayoutEffect(() => {
    const element = menu.current
    element?.animate?.(reduced ? [{ opacity: 0 }, { opacity: 1 }]
      : [{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'none' }],
    { duration: durationFor(motion.duration.mark, reduced, true), easing: motion.css.ease })
    // Keyboard focus moves into the menu and back to its seat when the menu closes from within.
    element?.querySelector<HTMLElement>('[role="button"]:not([aria-disabled="true"])')?.focus({ preventScroll: true })
    return () => {
      if (element?.contains(document.activeElement)) {
        document.querySelector<HTMLElement>(`[data-seat-context-target="${seatId}"] [role="button"]`)?.focus({ preventScroll: true })
      }
    }
    // Only the first paint arrives; later renders keep the menu still.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    const outside = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element) || menu.current?.contains(target)) return
      // Another token must receive its click before the nominator is cleared.
      if (target.closest('[data-seat-context-target]')) return
      onClose()
    }
    const escape = (event: KeyboardEvent) => {
      // Marked as handled, since the menu may be gone before a later listener checks for it.
      if (event.key === 'Escape' && !event.defaultPrevented) { event.preventDefault(); event.stopPropagation(); onClose() }
    }
    document.addEventListener('click', outside)
    document.addEventListener('keydown', escape)
    return () => {
      document.removeEventListener('click', outside)
      document.removeEventListener('keydown', escape)
    }
  }, [onClose])
  const actions: readonly { label: string; icon: IconName; run: () => void; disabled?: boolean }[] = [
    // First, as the action a Storyteller repeats most, and the only way to it on touch.
    ...(onReminder ? [{ label: t('board.addReminder'), icon: 'add' as const, run: onReminder }] : []),
    { label: t('board.changeCharacter'), icon: 'character', run: onCharacter },
    { label: t(alignment === 'good' ? 'board.makeEvil' : 'board.makeGood'), icon: 'shuffle', run: onAlignment },
    { label: t(dead ? 'board.markAlive' : 'board.markDead'), icon: dead ? 'sun' : 'skull', run: onLife },
    ...(dead ? [{ label: t(ghostVote ? 'board.spendGhostVote' : 'board.restoreGhostVote'), icon: 'vote' as const, run: onGhostVote }] : []),
    ...(onNominateSelf ? [{ label: t('board.nominateSelf'), icon: 'player' as const, run: onNominateSelf, disabled: nominateSelfDisabled }] : []),
  ]
  const row = (item: { label: string; icon: IconName; run: () => void; disabled?: boolean }) =>
    <MenuItem key={item.label} icon={item.icon} label={item.label} onPress={item.run} disabled={item.disabled} />
  return <div ref={menu} role="group" aria-label={name} data-layer style={{ ...menuFrame, position: 'absolute', width,
    maxHeight: Math.max(0, viewport.height - space.sm * 2), overflowY: 'auto', zIndex: 30 }}>
    {renaming ? <TextInput autoFocus selectTextOnFocus value={draft} onChangeText={setDraft}
      maxLength={80} accessibilityLabel={t('board.playerName')} returnKeyType="done"
      onBlur={saveName} onSubmitEditing={saveName}
      onKeyPress={event => {
        if (event.nativeEvent.key === 'Escape') {
          event.preventDefault()
          event.stopPropagation()
          editing.current = false
          setRenaming(false)
        }
      }}
      style={[type.text.strong, styles.nameInput, { minHeight: rowHeight }]} />
      : <Pressable accessibilityRole="button" accessibilityLabel={t('board.renamePlayer')}
        onPress={() => { setDraft(name); editing.current = true; setRenaming(true) }}
        style={state => [menuStyles.row, { minHeight: rowHeight }, isHovered(state) ? { backgroundColor: hoverWash.felt } : null,
          focusStyle(palette, isFocused(state) && focusVisible)]}>
        <Text numberOfLines={1} style={[type.text.strong, styles.heading]}>{name}</Text>
        <Icon name="edit" size={16} color={palette.parchmentShade} />
      </Pressable>}
    {actions.map(item => row(item))}
    {/* Removal sits apart from the toggles above it, since it asks before it acts. */}
    <View style={styles.rule} />
    {row({ label: t('board.emptySeat'), icon: 'trash', run: onEmpty })}
  </div>
}

const styles = StyleSheet.create({
  heading: { color: palette.parchmentShade, flexShrink: 1, fontSize: 14, lineHeight: 20 },
  nameInput: { color: palette.text, minWidth: 0, paddingHorizontal: space.xs, paddingVertical: space.xxs,
    borderBottomWidth: 1, borderBottomColor: palette.accent },
  rule: { height: 1, marginHorizontal: space.xs, marginVertical: space.xxs, backgroundColor: palette.inkMuted },
})
