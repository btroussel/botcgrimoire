// Where a homebrew character wakes on one night, beneath the editor's heading for that night.
// Most characters wake at one of a few moments, so those come first as cards. Any other place
// is chosen on the night itself: the official order as a column of tokens with the character's
// own token standing in its place, where tapping a step wakes it just after that step and the
// arrows move it one step at a time. A character placed elsewhere opens on that column.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import type { ViewInstance } from 'react-native'

import type { Team } from '../../content'
import { editions, gameText } from '../../content'
import { useStore } from '../../store'
import { Button, focusStyle, IconButton, isFocused, isHovered } from '../../ui/Button'
import { CharacterIcon } from '../../ui/CharacterIcon'
import { domElement, useFocusVisible } from '../../ui/focus'
import { useReducedMotion } from '../../ui/motion'
import { nightMarkerArt } from '../../ui/scriptSheet/Reference'
import { border, hoverWash, motion, palette, radius, space, touch, type } from '../../ui/theme'
import type { NightStep } from './character'
import { after, anchorOf, momentOf, moveBy, nightMoments } from './character'

const icon = 32

export interface NightPlacementProps {
  readonly label: string
  readonly night: 'first' | 'other'
  readonly steps: readonly NightStep[]
  readonly position: number | undefined // undefined when it does not wake
  readonly name: string
  readonly team: Team
  readonly token: ReactNode // the character's own art at `icon` size
  readonly onPosition: (position: number | undefined) => void
  readonly children?: ReactNode // the instruction field, shown while it wakes
}

export const NightPlacement = ({ label, night, steps, position, name, team, token, onPosition, children }: NightPlacementProps) => {
  const { t } = useStore()
  const moments = useMemo(() => nightMoments(steps, night, team), [steps, night, team])
  const moment = momentOf(moments, position)
  const [exact, setExact] = useState(false)
  const elsewhere = position !== undefined && moment === undefined
  const pick = (next: number | undefined) => { setExact(false); onPosition(next) }
  return (
    <View style={styles.group}>
      <View role="radiogroup" aria-label={label} style={styles.cards}>
        <Choice selected={position === undefined} title={t('scripts.doesNotWake')} onPress={() => pick(undefined)} />
        {moments.map((m) => (
          <Choice key={m.key} selected={m === moment} title={t(`scripts.moment_${m.key}`)} onPress={() => pick(m.position)} />
        ))}
      </View>
      {position !== undefined && (exact || elsewhere) ? (
        <NightOrder label={label} steps={steps} position={position} name={name} team={team} token={token} onPosition={onPosition} />
      ) : position !== undefined ? (
        <Button label={t('scripts.exactPlace')} icon="order" onPress={() => setExact(true)} variant="text" surface="paper" style={styles.start} />
      ) : null}
      {position !== undefined ? children : null}
    </View>
  )
}

const Choice = ({ selected, title, onPress }: { readonly selected: boolean; readonly title: string; readonly onPress: () => void }) => {
  const focusVisible = useFocusVisible()
  return (
    <Pressable accessibilityRole="radio" aria-checked={selected} accessibilityLabel={title} onPress={onPress}
      style={(state) => [styles.card, selected ? styles.chosen : null, focusStyle(palette, isFocused(state) && focusVisible, 'paper'),
        !selected && isHovered(state) ? { backgroundColor: hoverWash.paper } : null, { opacity: state.pressed ? motion.pressedOpacity : 1 }]}>
      <View style={[styles.dot, { borderColor: selected ? palette.ink : palette.inkMuted }]}>
        {selected ? <View style={[styles.dotFill, { backgroundColor: palette.ink }]} /> : null}
      </View>
      <Text style={[type.text.strong, styles.grow, { color: palette.ink }]}>{title}</Text>
    </Pressable>
  )
}

// The official order with the character standing in it. An edition filter shortens the column
// to the characters the Storyteller knows best, without changing the order.
const NightOrder = ({ label, steps, position, name, team, token, onPosition }: {
  readonly label: string
  readonly steps: readonly NightStep[]
  readonly position: number
  readonly name: string
  readonly team: Team
  readonly token: ReactNode
  readonly onPosition: (position: number) => void
}) => {
  const { t, settings } = useStore()
  const reduced = useReducedMotion()
  const [edition, setEdition] = useState('all')
  const shown = useMemo(() => steps.filter((step) => step.marker !== undefined || edition === 'all' || step.edition === edition), [steps, edition])
  const anchor = anchorOf(shown, position)
  const box = useRef<HTMLDivElement>(null)
  const here = useRef<ViewInstance>(null)

  // Keep the character's row in the middle of the column whenever it moves or the filter changes.
  useEffect(() => {
    const row = domElement(here.current)
    const list = box.current
    if (!row || !list) return
    // Measured against the list itself: every view in between is positioned, so offsets stop short.
    const shift = row.getBoundingClientRect().top - list.getBoundingClientRect().top
    list.scrollTo({ top: list.scrollTop + shift - list.clientHeight / 2 + row.offsetHeight / 2, behavior: reduced ? 'auto' : 'smooth' })
  }, [position, edition, reduced])

  return (
    <View style={styles.group}>
      <View style={styles.head}>
        <Text style={[type.text.small, styles.grow, { color: palette.inkMuted }]}>{t('scripts.wakeHint')}</Text>
        <select aria-label={t('scripts.filterEdition')} value={edition} onChange={(event) => setEdition(event.target.value)} style={selectStyle}>
          <option value="all">{t('scripts.allEditions')}</option>
          {editions.map((e) => <option key={e.id} value={e.id}>{gameText(settings.locale).edition(e.id).name}</option>)}
          <option value="carousel">{t('scripts.experimental')}</option>
        </select>
      </View>
      <div ref={box} role="list" aria-label={label} style={listStyle}>
        {shown.map((step) => (
          <View key={`${step.marker ?? step.id}`} role="listitem">
            <StepRow step={step} label={t('scripts.wakeAfter', { name: step.label })} onPress={() => onPosition(after(step))} />
            {step === anchor ? (
              <View ref={here} style={[styles.here, { borderColor: palette.accent, backgroundColor: palette.paperPressed }]}>
                <View style={styles.icon}>{token}</View>
                <View style={styles.grow}>
                  <Text style={[type.text.strong, { color: palette.teamOnPaper[team] }]} numberOfLines={1}>{name.trim() || t('scripts.newCharacter')}</Text>
                  <Text style={[type.text.small, { color: palette.inkMuted }]}>{t('scripts.wakesHere')}</Text>
                </View>
                <IconButton icon="chevronUp" label={t('scripts.wakeEarlier')} surface="paper" disabled={anchor === shown[0]}
                  onPress={() => onPosition(moveBy(shown, position, -1))} />
                <IconButton icon="chevronDown" label={t('scripts.wakeLater')} surface="paper" disabled={anchor === shown.at(-1)}
                  onPress={() => onPosition(moveBy(shown, position, 1))} />
              </View>
            ) : null}
          </View>
        ))}
      </div>
    </View>
  )
}

const StepRow = ({ step, label, onPress }: { readonly step: NightStep; readonly label: string; readonly onPress: () => void }) => {
  const focusVisible = useFocusVisible()
  const art = step.marker ? <Image source={nightMarkerArt[step.marker]} style={styles.markerArt} resizeMode="contain" accessible={false} />
    : step.id ? <CharacterIcon id={step.id} size={icon} lazy /> : null
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={(state) => [styles.step, focusStyle(palette, isFocused(state) && focusVisible, 'paper'), isHovered(state) ? { backgroundColor: hoverWash.paper } : null,
        { opacity: state.pressed ? motion.pressedOpacity : 1 }]}>
      <View style={styles.icon}>{art}</View>
      <Text style={[step.marker ? type.text.small : type.text.body, { color: step.marker ? palette.inkMuted : palette.ink }]} numberOfLines={1}>{step.label}</Text>
    </Pressable>
  )
}

// Positioned like the views around it, or the paper texture paints over it.
const listStyle: CSSProperties = {
  position: 'relative', maxHeight: 280, overflowY: 'auto', overscrollBehavior: 'contain',
  border: `${border}px solid ${palette.parchmentShade}`, borderRadius: radius.control, backgroundColor: palette.paperInset, padding: space.xs,
}
const selectStyle: CSSProperties = {
  position: 'relative', backgroundColor: 'transparent', color: palette.ink, border: `1px solid ${palette.parchmentShade}`,
  borderRadius: radius.control, fontFamily: type.text.small.fontFamily, fontSize: type.text.small.fontSize, minHeight: touch, padding: space.xs, maxWidth: 180,
}

const styles = StyleSheet.create({
  group: { gap: space.sm },
  cards: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  // Two to a row while each keeps room for a long French word, one per row below that.
  card: {
    flexGrow: 1, flexBasis: '40%', minWidth: 128, minHeight: touch + space.sm, flexDirection: 'row', alignItems: 'center', gap: space.sm,
    paddingHorizontal: space.md, paddingVertical: space.xs, borderRadius: radius.control, borderWidth: 1, borderColor: palette.parchmentShade,
  },
  chosen: { borderColor: palette.accent, backgroundColor: palette.paperPressed, boxShadow: `inset 0 0 0 1px ${palette.accent}` },
  // A radio's own mark, in ink: brass alone is too faint on vellum to say which card is chosen.
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: border, alignItems: 'center', justifyContent: 'center' },
  dotFill: { width: 10, height: 10, borderRadius: 5 },
  start: { alignSelf: 'flex-start' },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  grow: { flex: 1, minWidth: 0 },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40, paddingHorizontal: space.sm, borderRadius: radius.control },
  icon: { width: icon, height: icon, alignItems: 'center', justifyContent: 'center' },
  markerArt: { width: icon * 0.8, height: icon * 0.8 },
  here: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.xs, paddingLeft: space.sm, borderWidth: 2, borderRadius: radius.control },
})
