import { canNominate, nominationThresholds, onTheBlock } from './block'
import type { Event, Payload } from './events'
import { today } from './grimoire'
import { asEventId, asSeatId } from './ids'
import { reduce } from './reduce'
import { game } from './testing/board'

const table = game().seat('A', 'imp').seat('B', 'chef').seat('C', 'monk')
  .seat('D', 'soldier').seat('E', 'slayer').seat('F', 'empath').seat('G', 'beggar').night(1).day().build()
const nominee = table.id('B')
const other = table.id('C')
const first = asEventId(table.log.length)
const second = asEventId(table.log.length + 2)
const nomination: Payload = { kind: 'nominate', by: table.id('A'), of: nominee }
const total = (value: number): Payload => ({ kind: 'setVoteTotal', nomination: first, total: value })
const logWith = (...payloads: Payload[]): Event[] => [...table.log, ...payloads.map((payload, i): Event => ({
  ...payload, id: asEventId(table.log.length + i), audience: 'storyteller', manual: true,
}))]
const boardWith = (...payloads: Payload[]) => reduce('tb', logWith(...payloads))

test('requires half the living players rounded up, including living Travellers', () => {
  expect(onTheBlock(boardWith())).toBeUndefined()
  expect(onTheBlock(boardWith(nomination, total(3)))).toBeUndefined()
  expect(onTheBlock(boardWith(nomination, total(4)))).toBe(nominee)
  expect(onTheBlock(boardWith(nomination, total(3), { kind: 'kill', seat: table.id('G'), cause: 'storyteller' }))).toBe(nominee)
})

test('zero votes never put anyone on the block, even with no living players', () => {
  const board = boardWith(nomination, total(0))
  expect(onTheBlock({ ...board, seats: board.seats.map(seat => ({ ...seat, alive: false })) })).toBeUndefined()
})

test('ties clear the block and only a strictly higher total takes it', () => {
  const tied: Payload[] = [nomination, total(4), { kind: 'nominate', by: table.id('D'), of: other },
    { kind: 'setVoteTotal', nomination: second, total: 4 }]
  expect(onTheBlock(boardWith(...tied))).toBeUndefined()
  expect(onTheBlock(boardWith(...tied, { kind: 'setVoteTotal', nomination: second, total: 5 }))).toBe(other)
  expect(onTheBlock(boardWith(...tied, { kind: 'cancelNomination', nomination: second }))).toBe(nominee)
})

test('vote edits and replay prefixes derive the marker without changing life state', () => {
  const log = logWith(nomination, total(3), { kind: 'vote', nomination: first, seat: table.id('A'), weight: 1 })
  const board = reduce('tb', log)
  expect(onTheBlock(board)).toBe(nominee)
  expect(onTheBlock(reduce('tb', log.slice(0, -1)))).toBeUndefined()
  expect(board.seats.every(seat => seat.alive)).toBe(true)
  expect(onTheBlock(boardWith(nomination, total(3),
    { kind: 'vote', nomination: first, seat: table.id('A'), weight: 1 },
    { kind: 'unvote', nomination: first, seat: table.id('A'), weight: 1 }))).toBeUndefined()
})

test('clears after leaving day, closing nominations or removing the nominee', () => {
  for (const event of [
    { kind: 'phase', to: 'night' }, { kind: 'endGame', winner: 'good' },
    { kind: 'execute', seat: nominee, cause: 'vote' }, { kind: 'removeSeat', seat: nominee },
  ] as const) expect(onTheBlock(boardWith(nomination, total(4), event))).toBeUndefined()
  expect(onTheBlock(boardWith(nomination, total(4), { kind: 'phase', to: 'night' }, { kind: 'phase', to: 'day' }))).toBeUndefined()
})

test('does not move the marker to a lower total when the leader has no seat', () => {
  expect(onTheBlock(boardWith(nomination, total(4), { kind: 'nominate', by: 'storyteller', of: 'storyteller' },
    { kind: 'setVoteTotal', nomination: second, total: 5 }))).toBeUndefined()
  expect(onTheBlock(boardWith({ ...nomination, kind: 'nominate', by: 'storyteller', of: asSeatId('missing') }, total(4)))).toBeUndefined()
})

test('thresholds follow living players and the previous best total, excluding the active tally', () => {
  expect(nominationThresholds(boardWith())).toEqual({ execute: 4 })
  expect(nominationThresholds(boardWith(nomination, total(3)))).toEqual({ execute: 4 })
  expect(nominationThresholds(boardWith(nomination, total(4)))).toEqual({ execute: 5, tie: 4 })
  const voting = boardWith(nomination, total(6), { kind: 'nominate', by: table.id('D'), of: other },
    { kind: 'setVoteTotal', nomination: second, total: 9 })
  expect(nominationThresholds(voting, second)).toEqual({ execute: 7, tie: 6 })
  expect(nominationThresholds(boardWith(nomination, total(3), { kind: 'kill', seat: table.id('G'), cause: 'storyteller' }))).toEqual({ execute: 4, tie: 3 })
  expect(nominationThresholds(boardWith(nomination, total(6), { kind: 'cancelNomination', nomination: first }))).toEqual({ execute: 4 })
})

test('an explicit marker overrides voting and clearing it does not restore automatic marking', () => {
  const marked = boardWith(nomination, total(4), { kind: 'markForExecution', seat: other }, total(8))
  expect(onTheBlock(marked)).toBe(other)
  expect(marked.seats.every(seat => seat.alive)).toBe(true)
  expect(marked.days[0]?.closed).toBe(false)
  expect(onTheBlock(boardWith(nomination, total(8), { kind: 'markForExecution', seat: null }))).toBeUndefined()
  expect(onTheBlock(boardWith({ kind: 'markForExecution', seat: other }, { kind: 'removeSeat', seat: other }))).toBeUndefined()
})

test('execution markers reset on a new day and replay restores the earlier reference', () => {
  const log = logWith(nomination, total(4), { kind: 'markForExecution', seat: other })
  expect(onTheBlock(reduce('tb', log))).toBe(other)
  expect(onTheBlock(reduce('tb', log.slice(0, -1)))).toBe(nominee)
  const nextDay = boardWith({ kind: 'markForExecution', seat: other }, { kind: 'phase', to: 'night' }, { kind: 'phase', to: 'day' })
  expect(nextDay.days.at(-1)?.markedForExecution).toBeUndefined()
  expect(onTheBlock(nextDay)).toBeUndefined()
})

test('each seat nominates once a day and is nominated once a day, the two limits apart', () => {
  const day = today(boardWith(nomination))
  expect(canNominate(day, table.id('A'), other)).toBe(false)
  expect(canNominate(day, other, nominee)).toBe(false)
  expect(canNominate(day, nominee, table.id('A'))).toBe(true)
  expect(canNominate(day, other, table.id('D'))).toBe(true)
  // Cancelling the nomination, or a new day, frees both seats again.
  expect(canNominate(today(boardWith(nomination, { kind: 'cancelNomination', nomination: first })), table.id('A'), nominee)).toBe(true)
  expect(canNominate(today(boardWith(nomination, { kind: 'phase', to: 'night' }, { kind: 'phase', to: 'day' })), table.id('A'), nominee)).toBe(true)
  expect(canNominate(undefined, table.id('A'), nominee)).toBe(true)
})
