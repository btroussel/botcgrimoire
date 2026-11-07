import { useEffect, useState } from 'react'
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native'
import type { Translate } from '../../content'
import { focusStyle, isFocused } from '../../ui/Button'
import { layerAbove, useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import type { IconName } from '../../ui/icons'
import { usePresence } from '../../ui/motion'
import { motion, palette, radius, space, touch, type, voteDock } from '../../ui/theme'

export const NominationControls = ({ by, of, count, thresholds, canReset, canMark, onReset, onMark, onDone, t }: {
  readonly by: string
  readonly of: string
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
  // Brass once the hands reach the count that executes, a reference like the threshold beside it:
  // the Storyteller still marks or ends the vote.
  const reached = count >= thresholds.execute
  const threshold = thresholds.tie === undefined
    ? t('day.votesToExecute', { count: thresholds.execute })
    : t('day.votesToTieExecute', { count: thresholds.tie, execute: thresholds.execute })
  return <Animated.View role="region" accessibilityLabel={t('day.nominationArrow', { by, of })}
    onLayout={event => setOneRow(event.nativeEvent.layout.width >= 300)}
    style={[styles.card, { opacity, transform: [{ scale }] }]}>
    {/* Docked, the names and the threshold share a line so the card stays inside the status band. */}
    <View style={oneRow ? styles.heading : undefined}>
      <Text style={[type.text.strong, styles.who]}>{t('day.nominationArrow', { by, of })}</Text>
      <Text style={[type.text.small, styles.threshold]}>{threshold}</Text>
    </View>
    <View style={styles.actions}>
      <View accessibilityLiveRegion="polite" style={[styles.action, oneRow && styles.oneRow, styles.tally, reached && styles.reached]}>
        {/* One text, so the count and its word are read, and announced, as one phrase. */}
        <Text style={styles.tallyText}>
          <Text style={[styles.count, reached && styles.countReached]}>{count}</Text>
          {'\n'}
          <Text style={[type.text.small, styles.stackedLabel, styles.countLabel]}>{t('day.votesLabel', { count })}</Text>
        </Text>
      </View>
      <VoteButton label={t('day.voteReset')} icon="reset" oneRow={oneRow} disabled={!canReset} onPress={onReset} />
      <VoteButton label={t('day.mark')} icon="skull" colour={palette.accent} ink={palette.onAccent} oneRow={oneRow} disabled={!canMark} onPress={onMark} />
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
  heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'baseline', columnGap: space.sm },
  who: { color: palette.text, textAlign: 'center', paddingTop: 2 },
  threshold: { color: palette.muted, textAlign: 'center', paddingBottom: 2 },
  // The tally is the number the table watches, so it is the largest thing in the dock; 24 on 26
  // with its label keeps the docked row at the touch height.
  count: { ...type.text.tally, fontSize: 24, lineHeight: 26, color: palette.text, textAlign: 'center' },
  countReached: { color: palette.accent },
  countLabel: { color: palette.muted },
  tallyText: { textAlign: 'center' },
  tally: { minHeight: touch, justifyContent: 'center', borderRadius: radius.control, borderWidth: 1, borderColor: 'transparent' },
  reached: { borderColor: palette.accent },
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
