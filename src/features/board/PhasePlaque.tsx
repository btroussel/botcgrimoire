import { useEffect, useRef, useState } from 'react'
import type { Translate } from '../../content'
import { Clock } from './Clock'
import type { ClockProps } from './Clock'
import { useReducedMotion } from '../../ui/motion'
import { MenuItem, menuClass, menuSurface, togglePopover } from './popover'

// The status plaque is the phase control: the reading of where the game stands is what the
// Storyteller taps, at the thumb end of a phone. Night still takes two taps to reach day,
// since a phase change has no undo.
export const PhasePlaque = ({ t, clock, onPhase, onStartDay, windowOpen }: {
  readonly t: Translate
  readonly clock: ClockProps
  readonly onPhase?: (() => void) | undefined // opens or closes the setup and day window
  readonly onStartDay?: (() => void) | undefined // night only, offered from a menu above the plaque
  readonly windowOpen: boolean
}) => {
  const anchor = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const reduced = useReducedMotion()
  useEffect(() => { menu.current?.hidePopover() }, [clock.phase])
  const startDay = () => {
    menu.current?.hidePopover()
    anchor.current?.querySelector<HTMLButtonElement>('[role="button"]')?.focus()
    onStartDay?.()
  }
  return <>
    <div ref={anchor}>
      <Clock {...clock} {...(onStartDay || onPhase ? {
        onPress: () => onStartDay ? togglePopover(menu.current, anchor.current, { above: true, reduced }) : onPhase?.(),
        expanded: onStartDay ? menuOpen : windowOpen } : {})} />
    </div>
    <div ref={menu} popover="auto" aria-label={clock.phase} className={menuClass}
      onToggle={event => setMenuOpen(event.newState === 'open')} style={menuSurface(176)}>
      {onStartDay ? <MenuItem icon="sun" label={t('night.startDay')} onPress={startDay} /> : null}
    </div>
  </>
}
