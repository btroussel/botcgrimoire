import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { Translate } from '../../content'
import { Clock } from './Clock'
import type { ClockProps } from './Clock'
import { useReducedMotion } from '../../ui/motion'
import { MenuItem, menuClass, menuStyles, menuSurface, togglePopover } from '../../ui/popover'
import { palette, space, type } from '../../ui/theme'

// The status plaque is the phase control: the reading of where the game stands is what the
// Storyteller taps, at the thumb end of a phone. Night still takes two taps to reach day, so a
// stray tap on the plaque never ends a night. That second tap is also where the Storyteller reads
// out the night's deaths, so the menu lists them above Start the day.
export const PhasePlaque = ({ t, clock, onPhase, onStartDay, diedTonight = [], windowOpen }: {
  readonly t: Translate
  readonly clock: ClockProps
  readonly onPhase?: (() => void) | undefined // opens or closes the setup and day window
  readonly onStartDay?: (() => void) | undefined // night only, offered from a menu above the plaque
  readonly diedTonight?: readonly { readonly name: string; readonly character: string }[]
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
      {onStartDay ? <>
        <View style={styles.deaths}>
          <Text style={styles.heading}>{t(diedTonight.length ? 'night.diedTonight' : 'night.nobodyDied')}</Text>
          {diedTonight.map((death, i) => <Text key={i} style={styles.death}>
            <Text style={styles.name}>{death.name}</Text>{death.character ? <Text style={styles.character}>{`  ${death.character}`}</Text> : null}
          </Text>)}
        </View>
        <View style={menuStyles.rule} />
        <MenuItem icon="sun" label={t('night.startDay')} onPress={startDay} />
      </> : null}
    </div>
  </>
}

const styles = StyleSheet.create({
  deaths: { paddingHorizontal: space.xs, paddingVertical: space.xxs, gap: space.xxs },
  heading: { ...type.text.small, color: palette.muted },
  death: { ...type.text.body, fontSize: 14, lineHeight: 20 },
  name: { ...type.text.strong, fontSize: 14, lineHeight: 20, color: palette.text },
  character: { color: palette.muted },
})
