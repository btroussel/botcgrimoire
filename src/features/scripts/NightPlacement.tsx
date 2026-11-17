// Where a homebrew character wakes on one night, beneath the editor's heading for that night.
// Most characters wake at one of a few moments, so those come first, each saying which two steps
// it falls between. Any other place is chosen on the night itself: the night order as a column of
// tokens with the character's own token standing in its place, where tapping a step wakes it just
// after that step and the arrows move it one step at a time. Opened from a script, both read the
// script's own order, the one the Storyteller will run, and the column also holds the script's
// other homebrew characters at their places, so one can wake just after another. A character
// placed elsewhere opens on that column.
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import type { ViewInstance } from 'react-native'

import type { Homebrew, Team } from '../../content'
import { editions, gameText } from '../../content'
import { useStore } from '../../store'
import { Button, focusStyle, IconButton, isFocused, isHovered } from '../../ui/Button'
import { CharacterIcon } from '../../ui/CharacterIcon'
import { domElement, useFocusVisible } from '../../ui/focus'
import { useReducedMotion } from '../../ui/motion'
import { nightMarkerArt } from '../../ui/scriptSheet/Reference'
import { border, focusRing, hoverWash, motion, palette, radius, space, touch, type } from '../../ui/theme'
import type { NightStep } from './character'
import { momentOf, momentPlace, moveBy, neighbours, nightMoments, placeOf, scriptSteps, wakeOrdinal, withHomebrew } from './character'

const icon = 32

export interface NightPlacementProps {
  readonly label: string
  readonly night: 'first' | 'other'
  readonly steps: readonly NightStep[] // the whole night order
  readonly script?: ReadonlySet<string> // the ids on the script the character is written for
  readonly homebrew?: readonly Homebrew[] // that script's homebrew characters, in its order
  readonly self?: string // the character's id, once it has one
  readonly position: string | undefined // the step or homebrew character it wakes after, undefined when it does not wake
  readonly name: string
  readonly team: Team
  readonly token: ReactNode // the character's own art at `icon` size
  readonly onPosition: (position: string | undefined) => void
  readonly children?: ReactNode // the instruction field, shown while it wakes
}

export const NightPlacement = ({ label, night, steps, script, homebrew, self, position, name, team, token, onPosition, children }: NightPlacementProps) => {
  const { t } = useStore()
  const moments = useMemo(() => nightMoments(steps, night, team), [steps, night, team])
  const own = useMemo(() => (script ? scriptSteps(steps, script) : undefined), [steps, script])
  const order = useMemo(() => withHomebrew(steps, night, homebrew ?? [], self), [steps, night, homebrew, self])
  const ownOrder = useMemo(() => (script ? scriptSteps(order, script) : undefined), [order, script])
  const moment = momentOf(moments, position, order)
  const [exact, setExact] = useState(false)
  const elsewhere = position !== undefined && moment === undefined
  const group = useId()
  const pick = (next: string | undefined) => { setExact(false); onPosition(next) }
  // The two steps a moment falls between, among the script's when there is one.
  const between = (after: string) => {
    const { before, next } = neighbours(own ?? steps, wakeOrdinal(steps, after))
    if (!before) return undefined
    return next ? t('scripts.momentBetween', { after: before.label, before: next.label }) : t('scripts.momentAfter', { after: before.label })
  }
  return (
    <View style={styles.group}>
      <MomentStyles />
      <div role="radiogroup" aria-label={label} className="night-moments">
        <Moment group={group} checked={position === undefined} title={t('scripts.doesNotWake')} onPick={() => pick(undefined)} />
        {moments.map((m) => (
          <Moment key={m.key} group={group} checked={m === moment} title={t(`scripts.moment_${m.key}`)} detail={between(m.after)} onPick={() => pick(momentPlace(order, m.after))} />
        ))}
      </div>
      {position !== undefined && (exact || elsewhere) ? (
        <NightOrder label={label} steps={order} own={ownOrder} position={position} name={name} team={team} token={token}
          reveal={exact} onPosition={onPosition} />
      ) : position !== undefined ? (
        <Button label={t('scripts.exactPlace')} icon="order" onPress={() => setExact(true)} variant="text" surface="paper" style={styles.start} />
      ) : null}
      {position !== undefined ? children : null}
    </View>
  )
}

// A native radio over the whole card, as the editor's team tiles are: one tab stop for the
// group, arrow keys to choose, and the label's own text as its description.
const Moment = ({ group, checked, title, detail, onPick }: {
  readonly group: string
  readonly checked: boolean
  readonly title: string
  readonly detail?: string | undefined
  readonly onPick: () => void
}) => {
  const id = useId()
  return (
    <label className="night-moment">
      <input type="radio" name={group} checked={checked} aria-label={title} {...(detail ? { 'aria-describedby': id } : {})} onChange={onPick} />
      <span className="night-moment-dot" />
      <span className="night-moment-text">
        <span style={titleStyle}>{title}</span>
        {detail ? <span id={id} style={detailStyle}>{detail}</span> : null}
      </span>
    </label>
  )
}

// The night order with the character standing in it. A filter shortens the column to the script,
// or to the characters of one edition the Storyteller knows best, without changing the order. The
// script's homebrew characters stay under every filter, since the character is placed among them.
const NightOrder = ({ label, steps, own, position, name, team, token, reveal, onPosition }: {
  readonly label: string
  readonly steps: readonly NightStep[]
  readonly own: readonly NightStep[] | undefined
  readonly position: string
  readonly name: string
  readonly team: Team
  readonly token: ReactNode
  readonly reveal: boolean // opened by the Storyteller rather than by a placed character
  readonly onPosition: (position: string) => void
}) => {
  const { t, settings } = useStore()
  const reduced = useReducedMotion()
  const [edition, setEdition] = useState(own ? 'script' : 'all')
  const shown = useMemo(() => (edition === 'script' && own ? own
    : steps.filter((step) => step.marker !== undefined || step.homebrew || edition === 'all' || step.edition === edition)), [steps, own, edition])
  const wake = wakeOrdinal(steps, position)
  const anchor = placeOf(shown, wake, position)
  const frame = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const here = useRef<ViewInstance>(null)

  // Opened by its button, the column comes into view: it opens under the Save bar.
  useEffect(() => {
    if (reveal) frame.current?.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' })
    // Only when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the character's row in the middle of the column whenever it moves or the filter changes.
  useEffect(() => {
    const row = domElement(here.current)
    const list = box.current
    if (!row || !list) return
    // Measured against the list itself: every view in between is positioned, so offsets stop short.
    const shift = row.getBoundingClientRect().top - list.getBoundingClientRect().top
    list.scrollTo({ top: list.scrollTop + shift - list.clientHeight / 2 + row.offsetHeight / 2, behavior: reduced ? 'auto' : 'smooth' })
  }, [position, edition, reduced])

  // The column is one tab stop, its step at the character's place; the arrow keys walk the rest.
  const walk = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
    const from = document.activeElement
    if (!from) return
    const rows = [...event.currentTarget.querySelectorAll<HTMLElement>(':scope > [role="listitem"] > [role="button"]')]
    const next = event.key === 'ArrowDown'
      ? rows.find((row) => from.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING)
      : rows.reverse().find((row) => from.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_PRECEDING)
    event.preventDefault()
    next?.focus()
  }

  return (
    <div ref={frame} style={frameStyle}>
      <View style={styles.head}>
        <Text style={[type.text.small, styles.grow, { color: palette.inkMuted }]}>{t('scripts.wakeHint')}</Text>
        <select aria-label={t('scripts.filterEdition')} value={edition} onChange={(event) => setEdition(event.target.value)} style={selectStyle}>
          {own ? <option value="script">{t('scripts.thisScript')}</option> : null}
          <option value="all">{t('scripts.allEditions')}</option>
          {editions.map((e) => <option key={e.id} value={e.id}>{gameText(settings.locale).edition(e.id).name}</option>)}
          <option value="carousel">{t('scripts.experimental')}</option>
        </select>
      </View>
      <div ref={box} role="list" aria-label={label} style={listStyle} onKeyDown={walk}>
        {shown.map((step) => (
          <View key={step.key} role="listitem">
            <StepRow step={step} label={t('scripts.wakeAfter', { name: step.label })} tabbable={step === anchor} onPress={() => onPosition(step.key)} />
            {step === anchor ? (
              <View ref={here} style={[styles.here, { borderColor: palette.accent, backgroundColor: palette.paperPressed }]}>
                <View style={styles.icon}>{token}</View>
                <View style={styles.grow}>
                  <Text style={[type.text.strong, { color: palette.teamOnPaper[team] }]} numberOfLines={1}>{name.trim() || t('scripts.newCharacter')}</Text>
                  <Text style={[type.text.small, { color: palette.inkMuted }]}>{t('scripts.wakesHere')}</Text>
                </View>
                <IconButton icon="chevronUp" label={t('scripts.wakeEarlier')} surface="paper" disabled={anchor === shown[0] && anchor.key === position}
                  onPress={() => onPosition(moveBy(shown, wake, position, -1))} />
                <IconButton icon="chevronDown" label={t('scripts.wakeLater')} surface="paper" disabled={anchor === shown.at(-1)}
                  onPress={() => onPosition(moveBy(shown, wake, position, 1))} />
              </View>
            ) : null}
          </View>
        ))}
      </div>
    </div>
  )
}

const StepRow = ({ step, label, tabbable, onPress }: {
  readonly step: NightStep
  readonly label: string
  readonly tabbable: boolean
  readonly onPress: () => void
}) => {
  const focusVisible = useFocusVisible()
  const art = step.marker ? <Image source={nightMarkerArt[step.marker]} style={styles.markerArt} resizeMode="contain" accessible={false} />
    : step.id ? <CharacterIcon id={step.id} {...(step.team ? { team: step.team } : {})} size={icon} lazy /> : null
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} tabIndex={tabbable ? 0 : -1}
      style={(state) => [styles.step, focusStyle(palette, isFocused(state) && focusVisible, 'paper'), isHovered(state) ? { backgroundColor: hoverWash.paper } : null,
        { opacity: state.pressed ? motion.pressedOpacity : 1 }]}>
      <View style={styles.icon}>{art}</View>
      <Text style={[step.marker ? type.text.small : type.text.body, { color: step.marker ? palette.inkMuted : palette.ink }]} numberOfLines={1}>{step.label}</Text>
    </Pressable>
  )
}

// The cards stack in night order, so they read as the night does. Every element is positioned
// like the views around it, or the paper texture paints over it.
const MomentStyles = () => <style href="grimoire-night-moments" precedence="default">{`
  .night-moments { position: relative; display: flex; flex-direction: column; gap: ${space.sm}px; }
  .night-moment {
    position: relative; display: flex; align-items: center; gap: ${space.md}px; min-height: ${touch + space.sm}px;
    padding: ${space.xs}px ${space.md}px; cursor: pointer; border-radius: ${radius.control}px; border: 1px solid ${palette.parchmentShade};
    -webkit-tap-highlight-color: transparent;
    transition: border-color ${motion.duration.mark}ms ${motion.css.ease}, background-color ${motion.duration.mark}ms ${motion.css.ease};
  }
  .night-moment input { position: absolute; inset: 0; z-index: 1; width: 100%; height: 100%; opacity: 0; margin: 0; cursor: pointer; }
  .night-moment:hover { background-color: ${hoverWash.paper}; }
  .night-moment:active { opacity: ${motion.pressedOpacity}; }
  .night-moment:has(input:focus-visible) { outline: ${focusRing.width}px solid ${palette.ink}; outline-offset: ${focusRing.offset}px; }
  .night-moment:has(input:checked) { border-color: ${palette.accent}; background-color: ${palette.paperPressed}; box-shadow: inset 0 0 0 1px ${palette.accent}; }
  /* A radio's own mark, in ink: brass alone is too faint on vellum to say which card is chosen. */
  .night-moment-dot {
    position: relative; flex: none; width: 20px; height: 20px; box-sizing: border-box; border-radius: 10px;
    border: ${border}px solid ${palette.inkMuted};
  }
  .night-moment:has(input:checked) .night-moment-dot { border-color: ${palette.ink}; }
  .night-moment:has(input:checked) .night-moment-dot::after {
    content: ''; position: absolute; top: 50%; left: 50%; width: 10px; height: 10px; margin: -5px 0 0 -5px; border-radius: 5px; background-color: ${palette.ink};
  }
  .night-moment-text { position: relative; display: flex; flex-direction: column; min-width: 0; }
  @media (prefers-reduced-motion: reduce) { .night-moment { transition: none; } }
`}</style>

// A DOM span reads a bare line height as a multiple of the font size, so each measure gets its unit.
const titleStyle: CSSProperties = {
  fontFamily: type.text.strong.fontFamily, fontSize: type.text.strong.fontSize, lineHeight: `${type.text.strong.lineHeight}px`, color: palette.ink,
}
const detailStyle: CSSProperties = {
  fontFamily: type.text.small.fontFamily, fontSize: type.text.small.fontSize, lineHeight: `${type.text.small.lineHeight}px`, color: palette.inkMuted,
}
// Clear of the sticky Save bar when it scrolls into view.
const frameStyle: CSSProperties = { position: 'relative', display: 'flex', flexDirection: 'column', gap: space.sm, scrollMarginBottom: touch * 2 + space.lg }
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
  start: { alignSelf: 'flex-start' },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  grow: { flex: 1, minWidth: 0 },
  step: { flexDirection: 'row', alignItems: 'center', gap: space.sm, minHeight: 40, paddingHorizontal: space.sm, borderRadius: radius.control },
  icon: { width: icon, height: icon, alignItems: 'center', justifyContent: 'center' },
  markerArt: { width: icon * 0.8, height: icon * 0.8 },
  here: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginVertical: space.xs, paddingLeft: space.sm, borderWidth: 2, borderRadius: radius.control },
})
