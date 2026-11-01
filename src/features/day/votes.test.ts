import { asCharacterId } from '../../content'
import { asEventId, asSeatId, reduce } from '../../engine'
import type { Payload } from '../../engine'
import { furthestHand, recordedVoteWeight } from './votes'

const seat = asSeatId('player')
const nomination = asEventId(2)
const vote = (weight: number): Payload => ({ kind: 'vote', nomination, seat, weight })
const unvote = (weight: number): Payload => ({ kind: 'unvote', nomination, seat, weight })

test.each([2, 3, -1, 0])('a legacy hand retains its recorded weight %s through correction', weight => {
  const log = [vote(weight)]
  expect(recordedVoteWeight(log, nomination, seat)).toBe(weight)
  expect(recordedVoteWeight([...log, unvote(weight)], nomination, seat)).toBeUndefined()
  expect(recordedVoteWeight([...log, unvote(weight), vote(1)], nomination, seat)).toBe(1)
  expect(recordedVoteWeight([...log, unvote(weight), vote(1), unvote(1)], nomination, seat)).toBeUndefined()
})

test.each([2, 3, -1])('correcting weight %s adjusts an explicit total without reconstructing it from hands', weight => {
  const payloads: Payload[] = [
    { kind: 'addSeat', seat, name: 'Player', at: 0, character: asCharacterId('imp'), alignment: 'evil' },
    { kind: 'phase', to: 'day' },
    { kind: 'nominate', by: seat, of: seat },
    vote(weight),
    { kind: 'setVoteTotal', nomination, total: 8 },
  ]
  const removed = recordedVoteWeight(payloads, nomination, seat)!
  const board = reduce('tb', [...payloads, unvote(removed)].map((event, i) => ({ ...event, id: asEventId(i), audience: 'storyteller', manual: true })))
  expect(board.days.at(-1)?.nominations[0]?.weight).toBe(8 - weight)
  expect(board.days.at(-1)?.nominations[0]?.votes).toEqual([])
})

test('another nomination and another player do not replace the selected recorded weight', () => {
  expect(recordedVoteWeight([
    vote(3),
    { kind: 'vote', nomination: asEventId(20), seat, weight: 2 },
    { kind: 'vote', nomination, seat: asSeatId('other'), weight: -1 },
  ], nomination, seat)).toBe(3)
})

test('the count reaches the recorded hand furthest clockwise from the nominee', () => {
  const seats = ['a', 'b', 'c', 'd', 'e']
  expect(furthestHand(seats, 'c', [])).toBeUndefined()
  expect(furthestHand(seats, 'c', ['d'])).toBe('d')
  // Round past the top: after the nominee come d, e, a, b, and the nominee last.
  expect(furthestHand(seats, 'c', ['d', 'a', 'e'])).toBe('a')
  expect(furthestHand(seats, 'c', ['b', 'c'])).toBe('c')
  expect(furthestHand(seats, 'storyteller', ['a'])).toBeUndefined()
  expect(furthestHand(seats, 'c', ['gone'])).toBeUndefined()
})
