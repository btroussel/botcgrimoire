import { useMemo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { useStore } from '../../store'
import { phaseAt, phaseMarks } from '../../store/replay'
import type { PhaseMark } from '../../store/replay'
import { HistorySlider } from './HistorySlider'
import { palette, space, type } from '../../ui/theme'
import type { ReplayStep } from './replay'

export const replayBarHeight = 124
// A step that changes many seats, a deal or a dawn, says its first changes and counts the rest.
const shownChanges = 3

export const ReplayBar = ({ steps, at, bottom }: { readonly steps: readonly ReplayStep[]; readonly at: number; readonly bottom: number }) => {
  const { session, t, lookAt } = useStore()
  const log = session?.game.log
  const marks = useMemo(() => log ? phaseMarks(log) : [], [log])
  const step = steps[at]
  const cursor = step?.cursor ?? 0
  const previous = steps[at - 1]
  const next = steps[at + 1]
  const label = (mark: PhaseMark) => mark.phase === 'over' ? t('history.tickOver') : t(`history.phase${mark.phase === 'setup' ? 'Setup' : mark.phase === 'night' ? 'Night' : 'Day'}`, { n: mark.night })
  const phase = label(phaseAt(marks, cursor))
  const changes = step?.changes ?? []
  const caption = [...changes.slice(0, shownChanges).map(change => t(change.key, change.values)),
    ...changes.length > shownChanges ? [t('history.moreChanges', { count: changes.length - shownChanges })] : []].join(' · ')
  const p = palette
  return <View style={[styles.bar, { height: replayBarHeight + bottom, paddingBottom: bottom, backgroundColor: p.felt, borderTopColor: p.line }]}>
    <HistorySlider value={at} min={0} max={steps.length - 1}
      ticks={marks.map(mark => ({ cursor: steps.findIndex(s => s.cursor === mark.cursor), label: label(mark) })).filter(mark => mark.cursor >= 0)}
      onChange={index => lookAt(steps[index]?.cursor ?? cursor)} label={t('history.slider')}
      valueText={t('history.step', { phase, n: at + 1, total: steps.length })}
      onPrevious={previous ? () => lookAt(previous.cursor) : undefined}
      onNext={next ? () => lookAt(next.cursor) : undefined}
      previousLabel={t('history.previous')} nextLabel={t('history.next')} />
    {/* Read out as it changes, so a step is heard as well as seen. */}
    <Text aria-live="polite" numberOfLines={1} style={[type.text.small, styles.caption, { color: p.text }]}>{caption || phase}</Text>
  </View>
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, paddingTop: space.sm, paddingHorizontal: space.md },
  caption: { textAlign: 'center', marginTop: -space.xs },
})
