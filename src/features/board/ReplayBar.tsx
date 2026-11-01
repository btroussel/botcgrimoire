import { useMemo } from 'react'
import { StyleSheet, View } from 'react-native'
import { useStore } from '../../store'
import { phaseAt, phaseMarks } from '../../store/replay'
import type { PhaseMark } from '../../store/replay'
import { HistorySlider } from './HistorySlider'
import { palette, space } from '../../ui/theme'
import { replayStops } from './replay'

export const replayBarHeight = 100

export const ReplayBar = ({ bottom }: { readonly bottom: number }) => {
  const { session, settings, t, lookAt } = useStore()
  const log = session?.game.log
  const script = session?.game.script
  const marks = useMemo(() => log ? phaseMarks(log) : [], [log])
  const total = log?.length ?? 0
  const cursor = session?.lookingAt ?? total
  const stops = useMemo(() => log && script ? replayStops(log, script, settings.locale) : [0], [log, script, settings.locale])
  const position = Math.max(0, stops.findLastIndex(stop => stop <= cursor))
  const previous = stops.findLast(stop => stop < cursor)
  const next = stops.find(stop => stop > cursor)
  const at = phaseAt(marks, cursor)
  const label = (mark: PhaseMark) => mark.phase === 'over' ? t('history.tickOver') : t(`history.phase${mark.phase === 'setup' ? 'Setup' : mark.phase === 'night' ? 'Night' : 'Day'}`, { n: mark.night })
  const p = palette
  return <View style={[styles.bar, { height: replayBarHeight + bottom, paddingBottom: bottom, backgroundColor: p.felt, borderTopColor: p.line }]}>
    <HistorySlider value={position} min={0} max={stops.length - 1} ticks={marks.map(mark => ({ cursor: stops.indexOf(mark.cursor), label: label(mark) })).filter(mark => mark.cursor >= 0)}
      onChange={index => lookAt(stops[index] ?? cursor)} label={t('history.slider')} valueText={label(at)}
      onPrevious={previous !== undefined ? () => lookAt(previous) : undefined}
      onNext={next !== undefined ? () => lookAt(next) : undefined}
      previousLabel={t('history.previous')} nextLabel={t('history.next')} />
  </View>
}

const styles = StyleSheet.create({
  bar: { borderTopWidth: 1, paddingTop: space.sm, paddingHorizontal: space.md },
})
