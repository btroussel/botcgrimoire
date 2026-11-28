import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native'

import type { Alignment, Translate } from '../../content'
import { focusStyle, isFocused, isHovered } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import type { IconName } from '../../ui/icons'
import { durationFor, useReducedMotion } from '../../ui/motion'
import { hoverWash, motion, palette, space, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { useViewport } from '../../ui/Viewport'
import { MenuItem, menuClass, menuFrame, menuStyles } from '../../ui/popover'
import type { Point, SeatMenuPlace, SeatMenuRoom } from './seatMenu'
import type { SeatCard } from './show'

export const SeatContextMenu = ({ seatId, name, alignment, dead, ghostVote, anchor, place, width, t, onClose, onShowCard, onReminder, onCharacter, onAlignment, onNominate, onCallExile, onRemove, onRename, onLife, onGhostVote }: {
  readonly seatId: string // the seat whose token takes focus back when the menu closes
  readonly name: string
  readonly alignment: Alignment
  readonly dead: boolean
  readonly ghostVote: boolean
  readonly anchor: Point // the token's centre, where the menu grows from
  readonly place: (menu: Size, room: SeatMenuRoom) => SeatMenuPlace // where the menu goes, given its measured size
  readonly width: number
  readonly t: Translate
  readonly onClose: () => void
  readonly onShowCard?: (kind: SeatCard) => void // set on a seat with a token, which a card about its player starts from
  readonly onReminder?: () => void
  readonly onCharacter: () => void
  readonly onAlignment: () => void
  readonly onNominate?: () => void
  readonly onCallExile?: () => void
  readonly onRemove: () => void
  readonly onRename: (name: string) => void
  readonly onLife: () => void
  readonly onGhostVote: () => void
}) => {
  const menu = useRef<HTMLDivElement>(null)
  const viewport = useViewport()
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(name)
  const editing = useRef(false)
  // Show a card turns the menu in place to the cards about this player, and focus follows.
  const [cards, setCards] = useState(false)
  const turned = useRef(false)
  const showLabel = useRef('')
  useLayoutEffect(() => { showLabel.current = t('board.show') })
  const saveName = () => {
    if (!editing.current) return
    editing.current = false
    setRenaming(false)
    const next = draft.trim()
    if (next && next !== name) onRename(next)
  }
  const focusVisible = useFocusVisible()
  const reduced = useReducedMotion()
  useLayoutEffect(() => {
    if (!turned.current) { turned.current = true; return }
    // Turned, the focus goes to Back; turned back, to Show a card, where the user came from.
    const show = cards ? undefined : menu.current?.querySelector<HTMLElement>(`[role="button"][aria-label="${CSS.escape(showLabel.current)}"]`)
    ;(show ?? menu.current?.querySelector<HTMLElement>('[role="button"]'))?.focus({ preventScroll: true })
  }, [cards])
  // Placed from its measured size on every render, since renaming, a death or a wrapped
  // translation changes it, within the part of the band the screen shows, which a scrolled
  // ring or a software keyboard cuts short. The cards turn it in place: shorter, it still fits
  // where it was, so it does not jump away from the thumb.
  useLayoutEffect(() => {
    if (cards) return
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
      // A tap on another token moves the menu there, so that token handles it.
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
  const actions: readonly { label: string; icon: IconName; run: () => void }[] = [
    // First: You are, the card shown to every player on the first night, is then three taps.
    ...(onShowCard ? [{ label: t('board.show'), icon: 'show' as const, run: () => setCards(true) }] : []),
    // The action a Storyteller repeats most, and the only way to it on touch.
    ...(onReminder ? [{ label: t('board.addReminder'), icon: 'add' as const, run: onReminder }] : []),
    // By day the next most repeated, and the only way to a nomination.
    ...(onNominate ? [{ label: t('board.nominate'), icon: 'nominate' as const, run: onNominate }] : []),
    { label: t('board.changeCharacter'), icon: 'character', run: onCharacter },
    { label: t(alignment === 'good' ? 'board.makeEvil' : 'board.makeGood'), icon: 'shuffle', run: onAlignment },
    { label: t(dead ? 'board.markAlive' : 'board.markDead'), icon: dead ? 'sun' : 'skull', run: onLife },
    ...(dead ? [{ label: t(ghostVote ? 'board.spendGhostVote' : 'board.restoreGhostVote'), icon: 'vote' as const, run: onGhostVote }] : []),
    ...(onCallExile ? [{ label: t('board.callExile'), icon: 'nominate' as const, run: onCallExile }] : []),
  ]
  const row = (item: { label: string; icon: IconName; run: () => void }) =>
    <MenuItem key={item.label} icon={item.icon} label={item.label} onPress={item.run} />

  return <div ref={menu} role="group" aria-label={name} data-layer className={menuClass} style={{ ...menuFrame, position: 'absolute', width,
    maxHeight: Math.max(0, viewport.height - space.sm * 2), overflowY: 'auto', zIndex: 30 }}>
    {cards && onShowCard ? <>
      {row({ label: t('common.back'), icon: 'back', run: () => setCards(false) })}
      {row({ label: t('board.youAre'), icon: 'show', run: () => onShowCard('youAre') })}
      {row({ label: t('board.cardThisPlayerIs'), icon: 'show', run: () => onShowCard('thisPlayerIs') })}
    </> : <>
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
        style={[type.text.strong, styles.nameInput]} />
        : <Pressable accessibilityRole="button" accessibilityLabel={t('board.renamePlayer')}
          onPress={() => { setDraft(name); editing.current = true; setRenaming(true) }}
          style={state => [menuStyles.row, isHovered(state) ? { backgroundColor: hoverWash.felt } : null,
            focusStyle(palette, isFocused(state) && focusVisible)]}>
          <Text numberOfLines={1} style={[type.text.strong, styles.heading]}>{name}</Text>
          <Icon name="edit" size={16} color={palette.parchmentShade} />
        </Pressable>}
      {actions.map(item => row(item))}
      {/* Removal sits apart from the toggles above it, since it asks before it acts. */}
      <View style={menuStyles.rule} />
      {row({ label: t('board.removeSeat'), icon: 'trash', run: onRemove })}
    </>}
  </div>
}

const styles = StyleSheet.create({
  heading: { color: palette.parchmentShade, flexShrink: 1, fontSize: 14, lineHeight: 20 },
  nameInput: { color: palette.text, minWidth: 0, paddingHorizontal: space.xs, paddingVertical: space.xxs,
    borderBottomWidth: 1, borderBottomColor: palette.accent },
})
