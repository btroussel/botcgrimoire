import { t } from '../content'
import { elapsedClockStart, elapsedPlayTime, gameClock, gameTiming, recordPlayTime } from './gameTiming'
import { deserialize, newGame, serialize } from './saved'
import { append, appendAll, openSession, redo, undo } from './session'

const en = (key: string, values?: Parameters<typeof t>[2]) => t('en', key, values)
const fr = (key: string, values?: Parameters<typeof t>[2]) => t('fr', key, values)
const createdAt = Date.UTC(2026, 8, 5, 12)
const start = () => append(openSession(newGame('tb', createdAt, 'storyteller')), { kind: 'phase', to: 'night', night: 1 }, createdAt + 600_000)

test('free boards count active intervals without phase events and resume their saved total', () => {
  let game = newGame('tb', createdAt, 'free')
  expect(elapsedPlayTime(game)).toBe(0)
  expect(elapsedClockStart(game, createdAt + 1000)).toBe(createdAt + 1000)
  game = recordPlayTime(game, createdAt + 1000, createdAt + 61_000)
  game = deserialize(serialize(game))
  expect(elapsedPlayTime(game)).toBe(60_000)
  expect(elapsedClockStart(game, undefined)).toBeUndefined()
  expect(elapsedClockStart(game, createdAt + 180_000)).toBe(createdAt + 120_000)
  game = recordPlayTime(game, createdAt + 180_000, createdAt + 210_000)
  expect(elapsedPlayTime(game)).toBe(90_000)
  expect(elapsedPlayTime(game, game.log, createdAt + 195_000)).toBe(75_000)
})

test('legacy guided records retain their first-night timing origin and exclude time away', () => {
  expect(gameTiming(newGame('tb', createdAt), en, 'en').duration).toBe('0 min')
  const s = start()
  let game = recordPlayTime(s.game, createdAt, createdAt + 661_000)
  expect(gameTiming(game, en, 'en').duration).toBe('1 min')
  game = recordPlayTime(game, createdAt + 800_000, createdAt + 802_000)
  expect(gameTiming(game, en, 'en').duration).toBe('1 min')
  expect(elapsedPlayTime(game)).toBe(63_000)
})

test('history and reloads cannot advance a paused saved clock', () => {
  const game = recordPlayTime(start().game, createdAt + 600_000, createdAt + 661_000)
  vi.useFakeTimers()
  try {
    vi.setSystemTime(createdAt + 700_000)
    const before = gameTiming(game, en, 'en')
    vi.advanceTimersByTime(86_400_000)
    expect(gameTiming(deserialize(serialize(game)), en, 'en')).toEqual(before)
  } finally {
    vi.useRealTimers()
  }
})

test('checkpoints merge without double counting and replay stops at its event', () => {
  let game = recordPlayTime(start().game, createdAt + 600_000, createdAt + 661_000)
  game = recordPlayTime(game, createdAt + 600_000, createdAt + 662_000)
  expect(game.playTime).toHaveLength(1)
  expect(recordPlayTime(game, createdAt + 600_000, createdAt + 650_000)).toBe(game)
  expect(elapsedPlayTime(game, game.log, createdAt + 601_500)).toBe(1500)
  expect(elapsedPlayTime(game, [])).toBe(0)
})

test('game over freezes duration and displays whole minutes in both locales', () => {
  let s = append(start(), { kind: 'phase', to: 'over' }, createdAt + 600_000 + 5_707_000)
  s = append(s, { kind: 'override', note: 'A correction after the game' }, createdAt + 10_000_000)
  const restored = deserialize(serialize(recordPlayTime(s.game, createdAt + 600_000, createdAt + 10_000_000)))
  expect(gameTiming(restored, en, 'en').duration).toBe('1 h 35 min')
  expect(gameTiming(restored, fr, 'fr').duration).toBe('1 h 35 min')
  expect(elapsedPlayTime(restored)).toBe(5_707_000)
})

test('undo and redo restore original event times, including start and finish', () => {
  const initial = start()
  const s = { ...initial, game: recordPlayTime(initial.game, createdAt + 600_000, createdAt + 700_000) }
  const unstarted = undo(s, createdAt + 700_000)
  expect(gameClock(unstarted.game.log).state).toBe('setup')
  expect(elapsedPlayTime(unstarted.game)).toBe(0)
  const restarted = redo(unstarted, createdAt + 800_000)
  expect(gameClock(restarted.game.log).startedAt).toBe(createdAt + 600_000)
  const ended = append(restarted, { kind: 'phase', to: 'over' }, createdAt + 900_000)
  const resumed = undo(ended, createdAt + 1_000_000)
  const playing = { ...resumed, game: recordPlayTime(resumed.game, createdAt + 1_000_000, createdAt + 1_100_000) }
  expect(gameTiming(playing.game, en, 'en').duration).toBe('3 min')
  expect(gameTiming(redo(playing, createdAt + 1_100_000).game, en, 'en').duration).toBe('1 min')
})

test('batches share a timestamp and the recorder tolerates a backwards clock', () => {
  const s = start()
  const next = appendAll(s, [{ kind: 'phase', to: 'day' }, { kind: 'phase', to: 'over' }], createdAt)
  expect(next.game.log.map((e) => e.recordedAt)).toEqual([createdAt + 600_000, createdAt + 600_000, createdAt + 600_000])
  expect(gameTiming(next.game, en, 'en').duration).toBe('0 min')
})

test('missing legacy timestamps remain unknown rather than becoming estimates', () => {
  const s = start()
  const old = { ...s.game, log: s.game.log.map(({ recordedAt: _time, ...e }) => e) }
  expect(gameTiming(old, en, 'en').duration).toBe('Not recorded')
  const finished = append(openSession(old), { kind: 'phase', to: 'over' }, createdAt + 900_000)
  expect(gameClock(finished.game.log).state).toBe('unknown')
})

test('returning to setup clears timing and the next first night starts a new clock', () => {
  const setup = append(start(), { kind: 'phase', to: 'setup' }, createdAt + 700_000)
  expect(gameClock(setup.game.log).state).toBe('setup')
  const restarted = append(setup, { kind: 'phase', to: 'night', night: 1 }, createdAt + 800_000)
  expect(gameClock(restarted.game.log).startedAt).toBe(createdAt + 800_000)
  const game = recordPlayTime(recordPlayTime(restarted.game, createdAt + 600_000, createdAt + 700_000), createdAt + 800_000, createdAt + 801_234)
  expect(elapsedPlayTime(game)).toBe(1234)
})

test('the live clock advances between checkpoints without changing the saved game', () => {
  const game = start().game
  const activeStart = createdAt + 600_000
  const origin = elapsedClockStart(game, activeStart)!
  expect(activeStart + 25_000 - origin).toBe(25_000)
  expect(game.playTime).toEqual([])
  expect(elapsedPlayTime(game)).toBe(0)
  const checkpoint = recordPlayTime(game, activeStart, activeStart + 30_000)
  expect(elapsedClockStart(checkpoint, activeStart)).toBe(origin)
  expect(activeStart + 45_000 - elapsedClockStart(checkpoint, activeStart)!).toBe(45_000)
})

test('resuming a clock excludes time away and never double counts a checkpoint', () => {
  const paused = recordPlayTime(start().game, createdAt + 600_000, createdAt + 625_000)
  expect(elapsedClockStart(paused, undefined)).toBeUndefined()
  const resumedAt = createdAt + 900_000
  const origin = elapsedClockStart(paused, resumedAt)!
  expect(resumedAt - origin).toBe(25_000)
  expect(resumedAt + 35_000 - origin).toBe(60_000)
  const saved = recordPlayTime(paused, resumedAt, resumedAt + 30_000)
  expect(elapsedClockStart(saved, resumedAt)).toBe(origin)
  expect(elapsedPlayTime(deserialize(serialize(saved)))).toBe(55_000)
})

test('setup, game over and unknown legacy times have no running display clock', () => {
  expect(elapsedClockStart(newGame('tb', createdAt, 'storyteller'), createdAt)).toBeUndefined()
  const finished = append(start(), { kind: 'phase', to: 'over' }, createdAt + 650_000)
  expect(elapsedClockStart(finished.game, createdAt + 600_000)).toBeUndefined()
  const game = start().game
  const legacy = { ...game, log: game.log.map(({ recordedAt: _time, ...event }) => event) }
  expect(elapsedClockStart(legacy, createdAt + 600_000)).toBeUndefined()
})
