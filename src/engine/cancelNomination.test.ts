import { asEventId, asSeatId, reduce } from './index'
import type { Event, Payload } from './index'

test('cancelling removes only the nominated record and its votes; replay restores it', () => {
  const alice = asSeatId('alice')
  const bob = asSeatId('bob')
  const payloads: Payload[] = [
    { kind: 'phase', to: 'day' },
    { kind: 'nominate', by: alice, of: bob },
    { kind: 'vote', nomination: asEventId(1), seat: alice, weight: 1, free: true },
    { kind: 'nominate', by: bob, of: alice },
    { kind: 'cancelNomination', nomination: asEventId(1) },
  ]
  const log: Event[] = payloads.map((p, i) => ({ ...p, id: asEventId(i), audience: 'storyteller', manual: true }))
  const before = reduce('tb', log.slice(0, -1))
  const after = reduce('tb', log)
  expect(after.days[0]!.nominations).toEqual([before.days[0]!.nominations[1]])
  expect(before.days[0]!.nominations[0]!.votes).toEqual([alice])
  expect(before.days[0]!.nominations[0]!.weight).toBe(1)
})
