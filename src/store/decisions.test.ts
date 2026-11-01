import { asEventId } from '../engine'
import { game, kill } from '../engine/testing/board'
import { deserialize, migrate, newGame, SAVED_VERSION, serialize } from './saved'

test('version 6 preserves the legacy decision metadata and event identities', () => {
  const b = game('snv').seat('Demon', 'fanggu').seat('Sweet', 'sweetheart').seat('Other', 'clockmaker').night(2, [kill('Sweet')]).build()
  const migrated = migrate({ ...newGame('snv', 1), version: 6, log: b.log })
  expect(migrated.version).toBe(SAVED_VERSION)
  expect(migrated.log.map((e) => e.id)).toEqual(b.log.map((e) => e.id))
  expect(migrated.log.slice(0, -1).every((e) => e.decisionsHandled)).toBe(true)
  expect(migrated.log.at(-1)?.decisionsHandled).toBeUndefined()
  expect(deserialize(serialize(migrated))).toEqual(migrated)
})

test('completed decisions round-trip and malformed decision events are rejected', () => {
  const game = newGame('tb', 1)
  const event = { kind: 'resolveDecision' as const, key: 'reaction:5:seat:0', id: asEventId(0), audience: 'storyteller' as const }
  expect(deserialize(serialize({ ...game, log: [event] })).log[0]).toEqual(event)
  expect(() => migrate({ ...game, log: [{ ...event, key: '' }] })).toThrow()
  expect(() => migrate({ ...game, log: [{ ...event, note: 1 }] })).toThrow()
})
