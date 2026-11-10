import { memo, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import type { Translate } from '../../content'
import { EdgeButton } from '../../ui/EdgeButton'
import type { IconName } from '../../ui/icons'
import { useReducedMotion } from '../../ui/motion'
import { hairline, palette, radius, shadows, space } from '../../ui/theme'
import { MenuItem, menuClass, menuStyles, menuSurface, togglePopover } from '../../ui/popover'

export const BoardToolbar = memo(function BoardToolbar({ t, arranging, arrangeDisabled, onShow, onArrange,
  onLoose, looseDisabled, onEnd, endDisabled, onReplay, onHome }: {
  readonly t: Translate
  readonly arranging: boolean
  readonly arrangeDisabled: boolean
  readonly onShow: () => void
  readonly onArrange: () => void
  readonly onLoose: () => void
  readonly looseDisabled: boolean
  readonly onEnd: () => void
  readonly endDisabled: boolean
  readonly onReplay?: (() => void) | undefined // once the game has ended
  readonly onHome: () => void
}) {
  const trigger = useRef<HTMLDivElement>(null)
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
      <EdgeButton icon="show" label={t('board.show')} onPress={onShow} />
      <div ref={trigger}>
        <EdgeButton icon="more" label={t('common.more')} onPress={() => togglePopover(menu.current, trigger.current, { reduced })} expanded={menuOpen} armed={arranging} />
      </div>
    </View>
    <div ref={menu} popover="auto" aria-label={t('common.more')}
      onToggle={(event) => setMenuOpen(event.newState === 'open')} className={menuClass} style={menuSurface(176)}>
      {item({ icon: 'addSeat', label: t('board.arrangeSeats'), action: onArrange, disabled: arrangeDisabled, armed: arranging })}
      {item({ icon: 'add', label: t('board.looseTitle'), action: onLoose, disabled: looseDisabled })}
      {/* Leaving the game sits apart from the tools for the board. */}
      <View style={menuStyles.rule} />
      {item({ icon: 'check', label: t('board.endGame'), action: onEnd, disabled: endDisabled })}
      {onReplay ? item({ icon: 'history', label: t('history.replay'), action: onReplay }) : null}
      {item({ icon: 'home', label: t('common.home'), action: onHome })}
    </div>
  </>
})
const styles = StyleSheet.create({
  edge: { flexDirection: 'row', alignItems: 'center', padding: space.xxs, borderRadius: radius.control,
    backgroundColor: palette.ink, borderWidth: hairline, borderColor: palette.inkMuted, boxShadow: shadows.lifted },
})
