import { asCharacterId } from '../content'
import { asSeatId } from '../engine'
import { changeDayTimer, defaultDayTimer, remainingDayTime } from './dayTimer'
import { deserialize, newGame, serialize } from './saved'
import { append, appendAll, dayTimerOf, lookAt, openSession, redo, undo, updateDayTimer } from './session'

// Ten living players, so the day's timer is five minutes.
const seats = Array.from({ length: 10 }, (_, at) => ({ kind: 'addSeat' as const, seat: asSeatId(`s${at}`), name: `Seat ${at + 1}`, at,
  character: asCharacterId('_empty'), alignment: 'good' as const }))
const day = () => appendAll(appendAll(openSession(newGame('tb', 0)), seats, 500), [
  { kind: 'phase', to: 'night', night: 1 }, { kind: 'phase', to: 'day' },
], 1000)
const running = () => updateDayTimer(day(), 'start', 2000)
// No control turns nomination pausing off, but a saved timer may hold it off.
const optedOut = () => {
  const s = running()
  return { ...s, game: { ...s.game, dayTimer: { ...s.game.dayTimer!, pauseOnNomination: false } } }
}
const nominate = { kind: 'nominate' as const, by: asSeatId('a'), of: asSeatId('b') }

test('a day has a timer of 30 seconds per living player before anyone touches it', () => {
  const untouched = day()
  expect(untouched.game.dayTimer).toBeUndefined()
  expect(dayTimerOf(untouched)).toEqual({ durationMs: 300_000, remainingMs: 300_000, pauseOnNomination: true, nominationPaused: false })
  // It follows the count of the living until it is started or adjusted, then holds.
  const died = append(untouched, { kind: 'kill', seat: asSeatId('s0'), cause: 'storyteller' }, 1500)
  expect(dayTimerOf(died).durationMs).toBe(270_000)
  const started = updateDayTimer(untouched, 'start', 2000)
  expect(dayTimerOf(append(started, { kind: 'kill', seat: asSeatId('s0'), cause: 'storyteller' }, 2500)).durationMs).toBe(300_000)
  expect(defaultDayTimer(1).durationMs).toBe(30_000)
  expect(defaultDayTimer(200).durationMs).toBe(3_600_000)
  // Pausing or resetting an untouched timer saves nothing.
  expect(updateDayTimer(untouched, 'pause', 2000)).toBe(untouched)
  expect(updateDayTimer(untouched, 'reset', 2000)).toBe(untouched)
})

test('starting the timer does not record a game action or clear redo', () => {
  const before = undo(append(day(), { kind: 'override', note: 'correction' }, 1001), 1002)
  const after = updateDayTimer(before, 'start', 1003)
  expect(after.game.dayTimer).toEqual({ durationMs: 300_000, remainingMs: 300_000, deadline: 301_003, pauseOnNomination: true, nominationPaused: false })
  expect(after.game.log).toBe(before.game.log)
  expect(after.game.updatedAt).toBe(before.game.updatedAt)
  expect(after.redo).toBe(before.redo)
})

test('a running timer survives save and reload and accounts for time away', () => {
  const saved = running()
  const reopened = openSession(deserialize(serialize(saved.game)))
  expect(remainingDayTime(reopened.game.dayTimer!, 92_000)).toBe(210_000)
  expect(remainingDayTime(reopened.game.dayTimer!, 602_000)).toBe(0)
  expect(reopened.game.log).toEqual(saved.game.log)
})

test('pause freezes the remainder and resume uses a new deadline', () => {
  const paused = updateDayTimer(running(), 'pause', 62_000)
  expect(remainingDayTime(paused.game.dayTimer!, 500_000)).toBe(240_000)
  const resumed = updateDayTimer(paused, 'start', 500_000)
  expect(remainingDayTime(resumed.game.dayTimer!, 530_000)).toBe(210_000)
})

test('nominations pause by default, and votes do not pause manual resumption', () => {
  const nominated = append(running(), nominate, 32_000)
  expect(nominated.game.dayTimer?.nominationPaused).toBe(true)
  expect(nominated.game.dayTimer?.deadline).toBeUndefined()
  expect(nominated.game.dayTimer?.remainingMs).toBe(270_000)
  const resumed = updateDayTimer(nominated, 'start', 40_000)
  const voted = append(resumed, { kind: 'vote', nomination: nominated.game.log.at(-1)!.id, seat: asSeatId('a'), weight: 1 }, 50_000)
  expect(remainingDayTime(voted.game.dayTimer!, 50_000)).toBe(260_000)
  const another = append(voted, nominate, 60_000)
  expect(another.game.dayTimer?.remainingMs).toBe(250_000)
  expect(another.game.dayTimer?.deadline).toBeUndefined()
})

test('turning off pause on nomination leaves the countdown running', () => {
  const nominated = append(optedOut(), nominate, 32_000)
  expect(nominated.game.dayTimer?.deadline).toBe(302_000)
  expect(nominated.game.dayTimer?.nominationPaused).toBe(false)
})

test('reset uses the adjusted duration and adjustments respect bounds', () => {
  const longer = updateDayTimer(running(), 'addTime', 62_000)
  expect(longer.game.dayTimer?.durationMs).toBe(330_000)
  expect(remainingDayTime(longer.game.dayTimer!, 62_000)).toBe(270_000)
  const shorter = updateDayTimer(longer, 'subtractTime', 62_000)
  expect(shorter.game.dayTimer?.durationMs).toBe(300_000)
  expect(remainingDayTime(shorter.game.dayTimer!, 62_000)).toBe(240_000)
  const reset = updateDayTimer(longer, 'reset', 70_000)
  expect(reset.game.dayTimer?.remainingMs).toBe(330_000)
  expect(reset.game.dayTimer?.deadline).toBeUndefined()
  let timer = reset.game.dayTimer!
  for (let i = 0; i < 70; i++) timer = changeDayTimer(timer, 'subtractTime', 70_000)
  expect(timer.durationMs).toBe(15_000)
  expect(timer.remainingMs).toBe(15_000)
  for (let i = 0; i < 140; i++) timer = changeDayTimer(timer, 'addTime', 70_000)
  expect(timer.durationMs).toBe(3_600_000)
  expect(timer.remainingMs).toBe(3_600_000)
})

test('under a minute the steps are 15 seconds, and from a minute up they are 30', () => {
  const readings = (action: 'addTime' | 'subtractTime', from: number, taps: number) => {
    let timer = { ...defaultDayTimer(0), durationMs: from, remainingMs: from }
    return Array.from({ length: taps }, () => (timer = changeDayTimer(timer, action, 0)).remainingMs / 1000)
  }
  expect(readings('subtractTime', 120_000, 6)).toEqual([90, 60, 45, 30, 15, 15])
  expect(readings('addTime', 15_000, 5)).toEqual([30, 45, 60, 90, 120])
  // The step follows the time left, not the length the timer was set to: when time is up on a
  // running timer, one tap gives a last 15 seconds and it counts again.
  const expired = running()
  const lastCall = updateDayTimer(expired, 'addTime', 400_000)
  expect(remainingDayTime(lastCall.game.dayTimer!, 400_000)).toBe(15_000)
  expect(remainingDayTime(lastCall.game.dayTimer!, 410_000)).toBe(5_000)
})

test('expiry cannot become negative or alter the log and reset makes it usable again', () => {
  const session = running()
  expect(remainingDayTime(session.game.dayTimer!, 400_000)).toBe(0)
  const attempted = updateDayTimer(session, 'start', 400_000)
  expect(attempted.game.log).toBe(session.game.log)
  expect(remainingDayTime(attempted.game.dayTimer!, 400_000)).toBe(0)
  expect(updateDayTimer(attempted, 'reset', 400_000).game.dayTimer?.remainingMs).toBe(300_000)
})

test('execution pauses even with nomination pausing disabled, and phase changes remove the timer', () => {
  const ended = append(optedOut(), { kind: 'execute', cause: 'vote' }, 62_000)
  expect(ended.game.dayTimer?.remainingMs).toBe(240_000)
  expect(ended.game.dayTimer?.deadline).toBeUndefined()
  expect(append(ended, { kind: 'phase', to: 'night', night: 2 }, 70_000).game.dayTimer).toBeUndefined()
  expect(append(running(), { kind: 'phase', to: 'over' }, 70_000).game.dayTimer).toBeUndefined()
})

test('replay refuses timer changes, ordinary undo preserves it, phase undo and redo remove it', () => {
  const session = running()
  const replay = lookAt(session, 1)
  expect(updateDayTimer(replay, 'start', 4000)).toBe(replay)
  const edit = append(session, { kind: 'override', note: 'note' }, 4000)
  expect(undo(edit, 5000).game.dayTimer).toEqual(session.game.dayTimer)
  const beforeDay = undo(session, 5000)
  expect(beforeDay.game.dayTimer).toBeUndefined()
  expect(redo(beforeDay, 6000).game.dayTimer).toBeUndefined()
  expect(updateDayTimer(beforeDay, 'start', 6000)).toBe(beforeDay)
})

test('legacy games need no timer metadata, malformed imports are rejected', () => {
  expect(deserialize(serialize(day().game)).dayTimer).toBeUndefined()
  const game = running().game
  for (const bad of [{ deadline: -1 }, { durationMs: 0 }, { remainingMs: -1 }, { pauseOnNomination: 'yes' }]) {
    expect(() => deserialize(JSON.stringify({ ...game, dayTimer: { ...game.dayTimer, ...bad } }))).toThrow('day timer')
  }
})
