import { useEffect, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Translate } from '../../content'
import { focusStyle, isFocused } from '../../ui/Button'
import { layerAbove, useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import type { IconName } from '../../ui/icons'
import { usePresence } from '../../ui/motion'
import { motion, palette, radius, space, tabular, touch, type, voteDock } from '../../ui/theme'

export const NominationControls = ({ title, by, of, exile, count, thresholds, canReset, canMark, onReset, onMark, onDone, t }: {
  readonly title: string // the sentence a screen reader names the vote by
  readonly by: string
  readonly of: string
  readonly exile: boolean // an exile has no Mark, since it never touches the execution
  readonly count: number
  readonly thresholds: { readonly execute: number; readonly tie?: number }
  readonly canReset: boolean
  readonly canMark: boolean
  readonly onReset: () => void
  readonly onMark: () => void
  readonly onDone: () => void
  readonly t: Translate
}) => {
  const { opacity, scale } = usePresence(true)
  // Two per row in the ring's centre; one row of four when docked across a narrow board.
  const [oneRow, setOneRow] = useState(false)
  // Escape ends the vote as Done does, keeping its hands; it never removes the nomination.
  useEffect(() => {
    const done = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented && !layerAbove()) {
        event.preventDefault()
        onDone()
      }
    }
    document.addEventListener('keydown', done)
    return () => document.removeEventListener('keydown', done)
  }, [onDone])
  // The number turns brass once the hands reach the count that executes, a reference like the
  // pips beside it, drawn on the number alone so it never looks like a control: the Storyteller
  // still marks or ends the vote.
  const reached = count >= thresholds.execute
  const threshold = exile ? t('day.votesToExile', { count: thresholds.execute })
    : thresholds.tie === undefined ? t('day.votesToExecute', { count: thresholds.execute })
    : t('day.votesToTieExecute', { count: thresholds.tie, execute: thresholds.execute })
  // One pip per hand the threshold needs, filled as hands are recorded, so the distance left
  // reads at a glance; hands past it add pips. The last needed one is ringed, the tie's in grey.
  const pips = Array.from({ length: Math.max(thresholds.execute, count) }, (_, i) => i + 1)
  return <Animated.View role="region" accessibilityLabel={title}
    onLayout={event => setOneRow(event.nativeEvent.layout.width >= 300)}
    style={[styles.card, { opacity, transform: [{ scale }] }]}>
    {/* Docked, the names and the pips share a line so the card stays inside the status band. */}
    <View style={[styles.heading, !oneRow && styles.stackedHeading]}>
      <Text style={[type.text.strong, styles.who]}>
        {exile ? t('day.exileOf', { of }) : <>{by}<Text style={styles.arrow}>{' → '}</Text>{of}</>}
      </Text>
      <View role="img" accessibilityLabel={threshold} style={styles.pips}>
        {pips.map(pip => <View key={pip} style={[styles.pip, pip <= count && styles.pipOn,
          pip === thresholds.tie && styles.pipTie, pip === thresholds.execute && styles.pipGoal]} />)}
        {thresholds.tie === undefined ? null : <Text style={[type.text.small, tabular, styles.tie]}>{t('day.tieAt', { count: thresholds.tie })}</Text>}
      </View>
    </View>
    <View style={styles.actions}>
      {/* Atomic, so a new count is announced with its threshold, "3 of 5", not as a bare number. */}
      <View accessibilityLiveRegion="polite" aria-atomic style={[styles.action, oneRow && styles.oneRow, styles.tally]}>
        {/* One text, so the count and its word read as one phrase. */}
        <Text style={styles.tallyText}>
          <Text style={[styles.count, reached && styles.countReached]}>{count}</Text>
          {'\n'}
          <Text style={[type.text.small, tabular, styles.stackedLabel, styles.countLabel]}>{t('day.outOf', { count: thresholds.execute })}</Text>
        </Text>
      </View>
      <VoteButton label={t('day.voteReset')} icon="reset" oneRow={oneRow} disabled={!canReset} onPress={onReset} />
      {exile ? null : <VoteButton label={t('day.mark')} icon="skull" colour={palette.accent} ink={palette.onAccent} oneRow={oneRow} disabled={!canMark} onPress={onMark} />}
      <VoteButton label={t('common.done')} icon="check" oneRow={oneRow} onPress={onDone} />
    </View>
  </Animated.View>
}

// Brass marks the one action that records the count; the rest share the dark fitting.
const VoteButton = ({ label, icon, colour = voteDock.fitting, ink = palette.text, oneRow, disabled, onPress }: {
  readonly label: string
  readonly oneRow: boolean
  readonly icon: IconName
  readonly colour?: string
  readonly ink?: string
  readonly disabled?: boolean
  readonly onPress: () => void
}) => {
  const focusVisible = useFocusVisible()
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={state => [styles.action, oneRow && styles.oneRow, styles.button, oneRow && styles.stacked, { backgroundColor: colour,
      opacity: disabled ? motion.disabledOpacity : state.pressed ? motion.pressedOpacity : 1 },
      focusStyle(palette, focusVisible && isFocused(state))]}>
    <View style={styles.icon}><Icon name={icon} size={18} color={ink} /></View>
    <Text style={[type.text.strong, styles.buttonLabel, { color: ink }, oneRow && styles.stackedLabel]}>{label}</Text>
  </Pressable>
}

const styles = StyleSheet.create({
  card: { width: '100%', padding: space.xs, gap: space.xs, backgroundColor: voteDock.surface,
    borderColor: voteDock.edge, borderWidth: 1, borderRadius: radius.control },
  heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', columnGap: space.sm, rowGap: space.xxs },
  stackedHeading: { flexDirection: 'column', alignItems: 'center' },
  who: { color: palette.text, textAlign: 'center', paddingTop: 2 },
  arrow: { color: palette.accent },
  pips: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3, flexShrink: 1, minWidth: 0, paddingBottom: 2 },
  // A twentieth hand still fits a 320-point phone: pips narrow before the row wraps.
  pip: { width: 14, flexShrink: 1, minWidth: 4, height: 6, borderRadius: 3, backgroundColor: voteDock.fitting },
  pipOn: { backgroundColor: palette.accent },
  pipGoal: { outlineWidth: 1.5, outlineStyle: 'solid', outlineColor: palette.accent, outlineOffset: 1 },
  pipTie: { outlineWidth: 1.5, outlineStyle: 'solid', outlineColor: palette.muted, outlineOffset: 1 },
  tie: { color: palette.muted, marginLeft: space.xxs },
  // The tally is the number the table watches, so it is the largest thing in the dock. Its 26
  // point line and the label's 16 fill the docked row's 44 without growing it; the outer text
  // takes the label's line too, or the browser's default line would add its own height.
  count: { ...type.text.tally, fontSize: 24, lineHeight: 26, color: palette.text, textAlign: 'center' },
  countReached: { color: palette.accent },
  countLabel: { color: palette.muted },
  tallyText: { textAlign: 'center', fontSize: 13, lineHeight: 16 },
  tally: { minHeight: touch, justifyContent: 'center' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  oneRow: { flexBasis: 0 },
  action: { flexGrow: 1, flexBasis: '40%', minWidth: 0 },
  button: { minHeight: touch, paddingHorizontal: space.xs, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: space.xs, borderRadius: radius.control, boxShadow: 'inset 0 1px 0 #ffffff30, inset 0 -2px 3px #00000055' },
  icon: { flexShrink: 0 },
  buttonLabel: { color: palette.text, fontSize: 14, minWidth: 0, flexShrink: 1 },
  // Four across a 320-point phone leave a label about 60 points, so the icon sits above it and a
  // French word such as Repartir keeps one line. 4 + 18 + 2 + 16 + 4 keeps the 44-point row.
  stacked: { flexDirection: 'column', gap: 2, paddingVertical: space.xs },
  stackedLabel: { fontSize: 13, lineHeight: 16, textAlign: 'center', flexShrink: 0 },
})
