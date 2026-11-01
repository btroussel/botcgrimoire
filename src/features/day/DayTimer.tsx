import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useStore } from '../../store'
import { remainingDayTime } from '../../store/dayTimer'
import type { DayTimer } from '../../store/dayTimer'
import { Button, IconButton } from '../../ui/Button'
import { formatElapsed } from '../../ui/elapsed'
import { Icon } from '../../ui/icons'
import { boardBlock, palette, radius, space, tabular, type } from '../../ui/theme'

// The reading shows whole seconds, so it wakes only when the shown second changes, and last at
// zero, when the finished state takes over.
const useRemaining = (timer: DayTimer | undefined) => {
  const [now, setNow] = useState(Date.now)
  const deadline = timer?.deadline
  useEffect(() => {
    if (deadline === undefined) return
    let wake: ReturnType<typeof setTimeout> | undefined
    const tick = () => {
      const at = Date.now()
      setNow(at)
      const left = deadline - at
      if (left > 0) wake = setTimeout(tick, left % 1000 || 1000)
    }
    tick()
    return () => clearTimeout(wake)
  }, [deadline])
  return timer ? remainingDayTime(timer, now) : 0
}

export const DayTimerSummary = () => {
  const { board, session, t } = useStore()
  const timer = session?.game.dayTimer
  const remaining = useRemaining(timer)
  if (!timer || board?.clock.phase !== 'day' || session?.lookingAt !== undefined) return null
  const time = formatElapsed(Math.ceil(remaining / 1000) * 1000)
  const paused = timer.deadline === undefined && remaining > 0
  const status = remaining === 0 ? t('day.timerFinished') : undefined
  return <View style={styles.summary}>
    <View style={styles.summaryReading}>
      <Icon name={paused ? 'pause' : 'history'} size={14} color={palette.text} />
      <Text accessibilityRole="timer" accessibilityLabel={t('day.timerSummary', { time })}
        style={[type.text.small, tabular, styles.countdown]}>{time}</Text>
    </View>
    {status ? <Text style={[type.text.small, styles.summaryStatus]}>{status}</Text> : null}
  </View>
}

export const DayTimerControls = () => {
  const { session, t, updateDayTimer } = useStore()
  const timer = session?.game.dayTimer
  const remaining = useRemaining(timer)
  if (session?.lookingAt !== undefined) return null
  if (!timer) return <Button surface="paper" icon="history" label={t('day.timerAdd')} onPress={() => updateDayTimer('add')} />
  const running = timer.deadline !== undefined && remaining > 0
  const time = formatElapsed(Math.ceil(remaining / 1000) * 1000)
  return <View style={styles.timer}>
    <View style={styles.controls}>
      <View style={styles.row}>
        <IconButton surface="paper" icon="minus" label={t('day.timerSubtractThirtySeconds')} disabled={timer.durationMs <= 60_000} onPress={() => updateDayTimer('subtractThirtySeconds')} />
        <Text accessibilityRole="timer" accessibilityLabel={t('day.timerSummary', { time })}
          style={[type.text.tally, tabular, styles.reading, { color: remaining === 0 ? palette.danger : palette.ink }]}>
          {time}
        </Text>
        <IconButton surface="paper" icon="add" label={t('day.timerAddThirtySeconds')} disabled={timer.durationMs >= 3_600_000} onPress={() => updateDayTimer('addThirtySeconds')} />
      </View>
      <View style={styles.row}>
      <IconButton surface="paper" icon={running ? 'pause' : 'play'} label={t(running ? 'day.timerPause' : remaining === timer.durationMs ? 'day.timerStart' : 'day.timerResume')} disabled={remaining === 0}
        onPress={() => updateDayTimer(running ? 'pause' : 'start')} />
      <IconButton surface="paper" icon="reset" label={t('day.timerReset')} onPress={() => updateDayTimer('reset')} />
      <IconButton surface="paper" icon="close" label={t('day.timerRemove')} onPress={() => updateDayTimer('remove')} />
      </View>
    </View>
    {remaining === 0 ? <Text accessibilityRole="alert" style={[type.text.strong, { color: palette.danger }]}>{t('day.timerFinished')}</Text>
      : null}
  </View>
}

const styles = StyleSheet.create({
  summary: { borderTopWidth: 1, borderTopColor: boardBlock.borderColor, paddingTop: space.xs, marginTop: space.xs },
  summaryReading: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  countdown: { color: palette.text, fontSize: 12 },
  summaryStatus: { color: palette.parchment, fontSize: 12 },
  timer: { backgroundColor: palette.paperInset, borderRadius: radius.tile, padding: space.xs },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: space.xs },
  row: { flexDirection: 'row', alignItems: 'center' },
  reading: { minWidth: 76, textAlign: 'center' },
})
