import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import { useStore } from '../../store'
import { dayTimerBounds, dayTimerStep, remainingDayTime } from '../../store/dayTimer'
import type { DayTimer } from '../../store/dayTimer'
import { dayTimerOf } from '../../store/session'
import { IconButton } from '../../ui/Button'
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
  // Ready from the day's first moment, with no step to add it.
  const timer = session ? dayTimerOf(session) : undefined
  const remaining = useRemaining(timer)
  if (!timer || session?.lookingAt !== undefined) return null
  const running = timer.deadline !== undefined && remaining > 0
  const time = formatElapsed(Math.ceil(remaining / 1000) * 1000)
  return <View style={styles.timer}>
    <View style={styles.controls}>
      <View style={styles.row}>
        <IconButton surface="paper" icon="minus" label={t('day.timerSubtractSeconds', { seconds: dayTimerStep(remaining, 'subtract') / 1000 })} disabled={timer.durationMs <= dayTimerBounds.shortest} onPress={() => updateDayTimer('subtractTime')} />
        <Text accessibilityRole="timer" accessibilityLabel={t('day.timerSummary', { time })}
          style={[type.text.tally, tabular, styles.reading, { color: remaining === 0 ? palette.danger : palette.ink }]}>
          {time}
        </Text>
        <IconButton surface="paper" icon="add" label={t('day.timerAddSeconds', { seconds: dayTimerStep(remaining, 'add') / 1000 })} disabled={timer.durationMs >= dayTimerBounds.longest} onPress={() => updateDayTimer('addTime')} />
      </View>
      {/* Reset has nothing to do on a full timer, so it shows once the time has moved, and on the
          inner side, so the start and pause control never shifts under the thumb. */}
      <View style={styles.row}>
        {running || remaining !== timer.durationMs
          ? <IconButton surface="paper" icon="reset" label={t('day.timerReset')} onPress={() => updateDayTimer('reset')} /> : null}
        <IconButton surface="paper" icon={running ? 'pause' : 'play'} label={t(running ? 'day.timerPause' : remaining === timer.durationMs ? 'day.timerStart' : 'day.timerResume')} disabled={remaining === 0}
          onPress={() => updateDayTimer(running ? 'pause' : 'start')} />
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
