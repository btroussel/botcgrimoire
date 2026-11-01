import { asCharacterId } from '../content'
import type { Event, Payload } from '../engine'
import { asEventId, reduce } from '../engine'
import { game, info } from '../engine/testing/board'
import { bluffsOf } from './bluffs'
import { deserialize, newGame, serialize, SAVED_VERSION } from './saved'

const ids = ['chef', 'soldier', 'saint'].map(asCharacterId)
const seated = () => game().seat('Demon', 'imp').seat('Minion', 'scarletwoman')
const table = () => seated().build()

it('keeps selected bluffs when the Demon changes seats, and does not record a showing', () => {
  const b = table()
  const more: Payload[] = [{ kind: 'setBluffs', characters: ids }, { kind: 'setCharacter', seat: b.id('Demon'), to: asCharacterId('scarletwoman') }, { kind: 'setCharacter', seat: b.id('Minion'), to: asCharacterId('imp') }]
  const log: Event[] = [...b.log, ...more.map((p, i) => ({ ...p, id: asEventId(b.log.length + i), audience: 'storyteller' as const }))]
  expect(bluffsOf(reduce('tb', log), log)).toEqual(ids)
  expect(log.some((e) => e.kind === 'info')).toBe(false)
})

it('preserves legacy bluff showings while explicit selection takes precedence', () => {
  const b = table()
  const log: Event[] = [...b.log, { kind: 'info', id: asEventId(b.log.length), audience: 'storyteller', to: [b.id('Demon')], told: { kind: 'characters', characters: ids }, truth: { kind: 'characters', characters: ids }, malfunctioned: false }]
  expect(bluffsOf(b.g, log)).toEqual(ids)
  const next = [asCharacterId('washerwoman'), asCharacterId('monk'), asCharacterId('librarian')]
  log.push({ kind: 'setBluffs', characters: next, id: asEventId(log.length), audience: 'storyteller' })
  expect(bluffsOf(b.g, log)).toEqual(next)
})

it('round trips preparation separately from shown information in format 6', () => {
  const b = table()
  const payloads: Payload[] = [...b.log, { kind: 'setBluffs', characters: ids }, { kind: 'prepareInfo', seat: b.id('Minion'), of: asCharacterId('librarian'), value: { kind: 'number', value: 0 } }]
  const legacy = { ...newGame('tb', 1), version: 6, log: payloads.map((event, i) => ({ ...event, id: asEventId(i), audience: 'storyteller' as const })) }
  const restored = deserialize(serialize(legacy))
  expect(restored.version).toBe(SAVED_VERSION)
  expect(restored.log.map(({ decisionsHandled: _done, ...event }) => event)).toEqual(legacy.log)
  expect(restored.log.at(-1)?.kind).toBe('prepareInfo')
  expect(bluffsOf(reduce(restored.script, restored.log), restored.log)).toEqual(ids)
})

it('the bluffs are the latest characters shown to the Demon alone', () => {
  const first = seated().night(1, [info('Demon', { kind: 'characters', characters: ['librarian', 'monk', 'slayer'] })]).build()
  expect(bluffsOf(first.g, first.log)).toEqual(['librarian', 'monk', 'slayer'])
  const later = seated()
    .night(1, [
      info('Demon', { kind: 'characters', characters: ['librarian', 'monk', 'slayer'] }),
      info('Demon', { kind: 'characters', characters: ['librarian', 'monk', 'soldier'] }),
      // Shown to the Minion, not the Demon: not a bluff.
      info('Minion', { kind: 'characters', characters: ['chef'] }),
    ])
    .build()
  expect(bluffsOf(later.g, later.log)).toEqual(['librarian', 'monk', 'soldier'])
})

it('with no Demon seated there are no bluffs', () => {
  const { g, log } = game().seat('Dan', 'chef').seat('Eve', 'monk').build()
  expect(bluffsOf(g, log)).toEqual([])
})
