import { memo, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { Translate } from '../../content'
import { EdgeButton } from '../../ui/EdgeButton'
import type { IconName } from '../../ui/icons'
import { useReducedMotion } from '../../ui/motion'
import { font, hairline, palette, radius, shadows, space, touch, type } from '../../ui/theme'
import { MenuItem, menuClass, menuStyles, menuSurface, togglePopover } from '../../ui/popover'
import { slack, widthAtOnePoint } from './textWidth'

// The card a pick waits for, named in Undo's corner: nothing is recorded during a pick, so Undo
// has no use there, and beside the eye the words lay over the top seat of a phone's ring. They
// take no taps, so a seat they reach is still picked through them.
export const PickWords = ({ title, hint, room }: {
  readonly title: string
  readonly hint: string
  readonly room: number // the width the seats beside the corner leave
}) => {
  // The name wraps where the seats leave it little width; the line under it drops when it cannot
  // fit whole, since half a hint says nothing.
  const hintFits = widthAtOnePoint(hint, font.body.bold) * Number(type.text.label.fontSize) * slack <= room - 2 * space.sm
  return <View pointerEvents="none" aria-hidden style={[styles.pick, { maxWidth: room }]}>
    <Text style={styles.title} numberOfLines={2}>{title}</Text>
    {hintFits ? <Text style={styles.hint} numberOfLines={1}>{hint}</Text> : null}
  </View>
}

export const BoardToolbar = memo(function BoardToolbar({ t, arranging, arrangeDisabled, onShow, onArrange,
  onLoose, looseDisabled, onHistory, historyDisabled, onEnd, onHome, picking, onCancelPick }: {
  readonly t: Translate
  readonly picking?: string | undefined // the card a seat pick is for, while it waits
  readonly onCancelPick: () => void
  readonly arranging: boolean
  readonly arrangeDisabled: boolean
  readonly onShow: () => void
  readonly onArrange: () => void
  readonly onLoose: () => void
  readonly looseDisabled: boolean
  readonly onHistory: () => void
  readonly historyDisabled: boolean // nothing is recorded yet
  readonly onEnd: () => void
  readonly onHome: () => void
}) {
  const trigger = useRef<HTMLDivElement>(null)
  const eye = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const reduced = useReducedMotion()
  const choose = (action: () => void) => {
    menu.current?.hidePopover()
    trigger.current?.querySelector<HTMLButtonElement>('[role="button"]')?.focus()
    action()
  }
  const item = ({ icon, label, action, disabled = false, armed = false }: {
    icon: IconName; label: string; action: () => void; disabled?: boolean; armed?: boolean }) =>
    <MenuItem icon={icon} label={label} onPress={() => choose(action)} disabled={disabled} armed={armed} />
  return <>
    <View style={styles.edge}>
      {/* Always mounted, so a screen reader hears the pick begin: a live region inserted already
          filled is often not read. The words drawn in Undo's corner are hidden from it. */}
      <Text accessibilityLiveRegion="polite" style={styles.spoken}>{picking !== undefined ? `${picking}. ${t('board.cardTapPlayer')}` : ''}</Text>
      {/* The cross goes with the pick, so the focus moves on to the eye rather than fall to the page. */}
      {picking !== undefined ? <div data-pick-cancel style={{ display: 'contents' }}>
        <EdgeButton icon="close" label={t('common.cancel')} onPress={() => {
          eye.current?.querySelector<HTMLElement>('[role="button"]')?.focus({ preventScroll: true })
          onCancelPick()
        }} />
      </div> : null}
      {/* Brass while a card waits for its player, as More is while the seats are arranged. */}
      <div ref={eye} style={{ display: 'contents' }}>
        <EdgeButton icon="show" label={t('board.show')} onPress={onShow} armed={picking !== undefined} />
      </div>
      <div ref={trigger}>
        <EdgeButton icon="more" label={t('common.more')} onPress={() => togglePopover(menu.current, trigger.current, { reduced })} expanded={menuOpen} armed={arranging} />
      </div>
    </View>
    <div ref={menu} popover="auto" aria-label={t('common.more')}
      onToggle={(event) => setMenuOpen(event.newState === 'open')} className={menuClass} style={menuSurface(176)}>
      {item({ icon: 'addSeat', label: t('board.arrangeSeats'), action: onArrange, disabled: arrangeDisabled, armed: arranging })}
      {item({ icon: 'add', label: t('board.looseTitle'), action: onLoose, disabled: looseDisabled })}
      {item({ icon: 'history', label: t('common.history'), action: onHistory, disabled: historyDisabled })}
      {/* Leaving the game sits apart from the tools for the board. */}
      <View style={menuStyles.rule} />
      {/* The pennant that marks a game's end on the replay's timeline. */}
      {item({ icon: 'flag', label: t('board.endGame'), action: onEnd })}
      {item({ icon: 'home', label: t('common.home'), action: onHome })}
    </div>
  </>
})
const styles = StyleSheet.create({
  // Read, not drawn: the pick's words for a screen reader.
  spoken: { position: 'absolute', width: 1, height: 1, overflow: 'hidden', opacity: 0 },
  edge: { flexDirection: 'row', alignItems: 'center', padding: space.xxs, borderRadius: radius.control,
    backgroundColor: palette.ink, borderWidth: hairline, borderColor: palette.inkMuted, boxShadow: shadows.lifted },
  // As tall as Undo, whose frame it stands in.
  pick: { minHeight: touch, justifyContent: 'center', paddingHorizontal: space.sm },
  title: { ...type.text.seatName, color: palette.text },
  hint: { ...type.text.label, color: palette.muted },
})
