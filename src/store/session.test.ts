import { asSeatId, reduce } from '../engine'
import { asCharacterId } from '../content'
import { game, kill, nominate, token, vote } from '../engine/testing/board'
import { deserialize, newGame, serialize } from './saved'
import type { Session } from './session'
import { append, appendAll, boardOf, canUndo, inLocale, lookAt, openSession, redo, returnToPresent, undo } from './session'

const start = () => openSession(newGame('tb', 1000))

test('unchanged bluffs preserve redo while changes and showings remain recorded', () => {
  const characters = ['chef', 'monk', 'saint'].map(asCharacterId)
  const first = append(start(), { kind: 'setBluffs', characters }, 1001)
  const changed = append(first, { kind: 'setBluffs', characters: ['chef', 'monk', 'soldier'].map(asCharacterId) }, 1002)
  const restored = undo(changed, 1003)
  expect(append(restored, { kind: 'setBluffs', characters: [...characters].reverse() }, 1004)).toBe(restored)
  expect(redo(restored, 1005).game.log).toEqual(changed.game.log)
  const told = { kind: 'characters' as const, characters }
  const shown = appendAll(first, [
    { kind: 'setBluffs', characters },
    { kind: 'info', to: [], told, truth: told, malfunctioned: false },
  ], 1006)
  expect(shown.game.log.map(e => e.kind)).toEqual(['setBluffs', 'info'])
  expect(appendAll(start(), [
    { kind: 'setBluffs', characters },
    { kind: 'setBluffs', characters: [...characters].reverse() },
  ], 1007).game.log).toHaveLength(1)
})

describe('the initial table is the undo boundary', () => {
  const seats = ['Alice', 'Bob'].map((name, at) => ({ kind: 'addSeat' as const, seat: asSeatId(name), name, at, character: asCharacterId('chef'), alignment: 'good' as const }))

  test('repeated returns preserve the opening deal, including after saving and reopening', () => {
    const initial = appendAll(start(), [...seats, { kind: 'setCharacter', seat: asSeatId('Bob'), to: asCharacterId('imp') }], 1001)
    let current = append(initial, { kind: 'renameSeat', seat: asSeatId('Alice'), name: 'Ann' }, 1002)
    current = append(current, { kind: 'phase', to: 'night', night: 1 }, 1003)
    expect(canUndo(current)).toBe(true)
    current = undo(undo(current, 1004), 1005)
    expect(current.game.log).toEqual(initial.game.log)
    expect(canUndo(current)).toBe(false)
    for (let i = 0; i < 10; i++) expect(undo(current, 1006 + i)).toBe(current)
    const reopened = openSession(deserialize(serialize(current.game)))
    expect(canUndo(reopened)).toBe(false)
    expect(boardOf(reopened).seats).toHaveLength(2)
    expect(boardOf(reopened).seats[1]?.character).toBe('imp')
    expect(boardOf(redo(current, 1020)).seats[0]?.name).toBe('Ann')
  })

  test('a table opened with one seat keeps that seat, and a seat added right after can be undone', () => {
    const initial = append(start(), seats[0]!, 1001)
    expect(canUndo(initial)).toBe(false)
    const added = append(initial, seats[1]!, 1002)
    expect(canUndo(openSession(deserialize(serialize(added.game))))).toBe(true)
    expect(undo(added, 1003).game.log).toEqual(initial.game.log)
    expect(canUndo(undo(added, 1003))).toBe(false)
  })

  test('legacy opening seats are protected while a later added seat can be undone', () => {
    const unbatched = append(append(start(), seats[0]!, 1001), seats[1]!, 1002)
    const initial = openSession({ ...unbatched.game, log: unbatched.game.log.map(({ batch: _batch, ...event }) => event) })
    expect(canUndo(initial)).toBe(false)
    const renamed = append(initial, { kind: 'renameSeat', seat: asSeatId('Alice'), name: 'Ann' }, 1003)
    const added = append(renamed, { ...seats[0]!, seat: asSeatId('Charlie'), name: 'Charlie', at: 2 }, 1004)
    expect(canUndo(added)).toBe(true)
    expect(undo(added, 1005).game.log).toEqual(renamed.game.log)
    expect(undo(undo(added, 1005), 1006).game.log).toEqual(initial.game.log)
  })
})

describe('reminders persist until explicitly removed', () => {
  const poisoned = () => {
    const table = game().seat('Ann', 'poisoner').seat('Bob', 'monk')
      .night(1, [token('Ann', 'poisoner/Poisoned', 'Bob'), token('Bob', 'monk/Safe', 'Ann')]).build()
    return openSession({ ...newGame('tb', 1000), log: table.log })
  }

  test('dawn and dusk preserve reminders, and undo and redo restore the whole boundary', () => {
    const night = poisoned()
    const day = append(night, { kind: 'phase', to: 'day' }, 1001)
    expect(boardOf(day).seats.flatMap(s => s.tokens)).toEqual(boardOf(night).seats.flatMap(s => s.tokens))
    const next = append(day, { kind: 'phase', to: 'night', night: 2 }, 1002)
    expect(boardOf(next).seats.flatMap(s => s.tokens)).toEqual(boardOf(night).seats.flatMap(s => s.tokens))
    expect(next.game.log.slice(day.game.log.length).map(e => e.kind)).toEqual(['phase'])
    expect(undo(next, 1003).game.log).toEqual(day.game.log)
    expect(redo(undo(next, 1003), 1004).game.log).toEqual(next.game.log)
    expect(boardOf(openSession(deserialize(serialize(next.game))))).toEqual(boardOf(next))
  })

  test('a new reminder after dusk leaves earlier reminders in place', () => {
    const day = append(poisoned(), { kind: 'phase', to: 'day' }, 1001)
    const bob = boardOf(day).seats[1]!.id
    const next = appendAll(day, [
      { kind: 'phase', to: 'night', night: 2 },
      { kind: 'placeToken', seat: bob, token: [asCharacterId('poisoner'), 'Poisoned'] },
    ], 1002)
    expect(boardOf(next).seats[1]?.tokens).toHaveLength(2)
    expect(boardOf(next).seats[1]?.tokens[1]?.placedBy).toBe(next.game.log.at(-1)?.id)
  })

  test('old saves retain every reminder on the next manual action', () => {
    const table = game().seat('Ann', 'poisoner').seat('Bob', 'washerwoman')
      .night(1, [token('Ann', 'poisoner/Poisoned', 'Bob'), token('Bob', 'washerwoman/Townsfolk', 'Bob')]).day().night(2).build()
    const old = openSession({ ...newGame('tb', 1000), log: table.log })
    const next = append(old, { kind: 'renameSeat', seat: table.g.seats[1]!.id, name: 'Bela' }, 1001)
    expect(boardOf(next).seats[1]?.tokens.map(t => t.def)).toEqual([['poisoner', 'Poisoned'], ['washerwoman', 'Townsfolk']])
    expect(undo(next, 1002).game.log).toEqual(old.game.log)
  })
})

describe('session', () => {
  test('renaming survives saving, undo and replay without replacing the player', () => {
    const seat = asSeatId('player')
    const original = append(start(), { kind: 'addSeat', seat, name: 'Seat 1', at: 0, character: asCharacterId('imp'), alignment: 'evil' }, 1001)
    const renamed = append(original, { kind: 'renameSeat', seat, name: '  Alice  ' }, 1002)
    expect(boardOf(renamed).seats[0]).toEqual({ ...boardOf(original).seats[0], name: 'Alice' })
    expect(boardOf(openSession(deserialize(serialize(renamed.game)))).seats[0]?.name).toBe('Alice')
    expect(boardOf(undo(renamed, 1003)).seats[0]?.name).toBe('Seat 1')
    expect(boardOf(redo(undo(renamed, 1003), 1004)).seats[0]?.name).toBe('Alice')
    expect(boardOf(lookAt(renamed, 1)).seats[0]?.name).toBe('Seat 1')
    expect(boardOf(append(renamed, { kind: 'renameSeat', seat, name: '   ' }, 1005)).seats[0]?.name).toBe('Alice')
  })

  test('append numbers events by their index and clears redo', () => {
    let s = append(start(), { kind: 'phase', to: 'night', night: 1 }, 1001)
    s = undo(s, 1002)
    expect(s.redo.length).toBe(1)
    s = append(s, { kind: 'phase', to: 'setup' }, 1003)
    expect(s.redo).toEqual([])
    expect(s.game.log.map((e) => e.id)).toEqual([0])
    expect(s.game.updatedAt).toBe(1003)
  })

  test('appendAll commits a batch in sequence and clears redo', () => {
    let s = append(start(), { kind: 'phase', to: 'setup' }, 1001)
    s = undo(s, 1002)
    s = appendAll(s, [{ kind: 'phase', to: 'night', night: 1 }, { kind: 'phase', to: 'day' }], 1003)
    expect(s.redo).toEqual([])
    expect(s.game.log.map((e) => e.id)).toEqual([0, 1])
    expect(boardOf(s).clock.phase).toBe('day')
    expect(s.game.log.map((e) => e.batch)).toEqual([0, 0])
  })

  test('one undo restores a player and removes the accompanying note together', () => {
    const seat = asSeatId('player')
    const before = append(start(), { kind: 'addSeat', seat, name: 'Alice', at: 0, character: asCharacterId('mayor'), alignment: 'good' }, 1001)
    const accepted = appendAll(before, [
      { kind: 'kill', seat, cause: 'demon' },
      { kind: 'override', note: 'mayor-attack' },
    ], 1002)
    expect(boardOf(accepted).seats[0]?.alive).toBe(false)
    const undone = undo(accepted, 1003)
    expect(boardOf(undone).seats[0]?.alive).toBe(true)
    expect(undone.game.log).toEqual(before.game.log)
    const restored = redo(undone, 1004)
    expect(boardOf(restored).seats[0]?.alive).toBe(false)
    expect(restored.game.log).toEqual(accepted.game.log)
    expect(restored.redo).toEqual([])
  })

  test('multiple batches and single events undo and redo in acceptance order', () => {
    const first = append(start(), { kind: 'phase', to: 'night', night: 1 }, 1001)
    const second = appendAll(first, [{ kind: 'override', note: 'effect' }, { kind: 'override', note: 'first' }], 1002)
    const third = append(second, { kind: 'override', note: 'single' }, 1003)
    const fourth = appendAll(third, [{ kind: 'override', note: 'another effect' }, { kind: 'override', note: 'second' }], 1004)
    let session = fourth
    for (const expected of [third, second, first]) {
      session = undo(session, 1005)
      expect(session.game.log).toEqual(expected.game.log)
    }
    for (const expected of [second, third, fourth]) {
      session = redo(session, 1006)
      expect(session.game.log).toEqual(expected.game.log)
    }
    expect(session.redo).toEqual([])
    expect(first.game.log[0]?.batch).toBeUndefined()
    expect(third.game.log.at(-1)?.batch).toBeUndefined()
  })

  test('saving and reopening preserves grouped undo while unbatched legacy events stay separate', () => {
    const accepted = appendAll(start(), [{ kind: 'phase', to: 'night', night: 1 }, { kind: 'override', note: 'ready' }], 1001)
    const reopened = openSession(deserialize(serialize(accepted.game)))
    expect(undo(reopened, 1002).game.log).toEqual([])
    const legacy = openSession({ ...accepted.game, log: accepted.game.log.map(({ batch: _batch, ...event }) => event) })
    expect(undo(legacy, 1003).game.log).toHaveLength(1)
    expect(boardOf(undo(legacy, 1003)).clock.phase).toBe('night')
  })

  test('a new acceptance after grouped undo replaces the redo branch with fresh contiguous ids', () => {
    const accepted = appendAll(start(), [{ kind: 'phase', to: 'night', night: 1 }, { kind: 'override', note: 'ready' }], 1001)
    const replaced = appendAll(undo(accepted, 1002), [{ kind: 'phase', to: 'day' }, { kind: 'override', note: 'changed' }], 1003)
    expect(replaced.redo).toEqual([])
    expect(replaced.game.log.map((event) => event.id)).toEqual([0, 1])
    expect(replaced.game.log.map((event) => event.batch)).toEqual([0, 0])
    expect(boardOf(redo(replaced, 1004)).clock.phase).toBe('day')
  })

  test('undo and redo move one event between the log and the redo stack', () => {
    let s = append(start(), { kind: 'phase', to: 'night', night: 1 }, 1001)
    s = append(s, { kind: 'phase', to: 'day' }, 1002)
    s = undo(s, 1003)
    expect(s.game.log.length).toBe(1)
    expect(boardOf(s).clock.phase).toBe('night')
    s = redo(s, 1004)
    expect(s.game.log.length).toBe(2)
    expect(boardOf(s).clock.phase).toBe('day')
  })

  test('undo on an empty log and redo with nothing to redo change nothing', () => {
    const s = start()
    expect(undo(s, 1)).toBe(s)
    expect(redo(s, 1)).toBe(s)
  })

  test('looking back shows a shorter reduction and refuses to change the log', () => {
    let s = append(start(), { kind: 'phase', to: 'night', night: 1 }, 1001)
    s = append(s, { kind: 'phase', to: 'day' }, 1002)
    const back = lookAt(s, 1)
    expect(boardOf(back).clock.phase).toBe('night')
    expect(undo(back, 1003)).toBe(back)
    expect(() => append(back, { kind: 'phase', to: 'night' }, 1004)).toThrow()
    expect(boardOf(returnToPresent(back)).clock.phase).toBe('day')
  })

  test('the board is memoized on the log', () => {
    const s = append(start(), { kind: 'phase', to: 'night', night: 1 }, 1001)
    expect(boardOf(s)).toBe(boardOf(s))
  })

  describe('a board continued from an earlier one equals a fresh reduction', () => {
    const played = () => {
      const { log } = game().seat('Ann', 'poisoner').seat('Bob', 'monk').seat('Cat', 'imp')
        .night(1, [token('Ann', 'poisoner/Poisoned', 'Bob')]).day([nominate('Ann', 'Bob'), vote('Ann')]).night(2, [kill('Bob')]).build()
      return openSession({ ...newGame('tb', 1000), log })
    }
    const fresh = (s: Session) => reduce(s.game.script, s.game.log.slice(0, s.lookingAt ?? s.game.log.length))

    test('appending, undoing and redoing', () => {
      let s = played()
      expect(boardOf(s)).toEqual(fresh(s))
      s = append(s, { kind: 'renameSeat', seat: boardOf(s).seats[0]!.id, name: 'Ann B' }, 1001)
      expect(boardOf(s)).toEqual(fresh(s))
      s = appendAll(s, [{ kind: 'phase', to: 'day' }, { kind: 'override', note: 'dawn' }], 1002)
      expect(boardOf(s)).toEqual(fresh(s))
      s = undo(s, 1003)
      expect(boardOf(s)).toEqual(fresh(s))
      s = redo(s, 1004)
      expect(boardOf(s)).toEqual(fresh(s))
    })

    test('scrubbing a replay forward and back, then returning', () => {
      const s = played()
      const length = s.game.log.length
      for (const at of [2, 3, 7, length, 5, 1, 0, 6, length - 1]) {
        const back = lookAt(s, at)
        expect(boardOf(back)).toEqual(fresh(back))
      }
      expect(boardOf(returnToPresent(lookAt(s, 3)))).toEqual(fresh(s))
    })

    test('two games read alternately', () => {
      let first = played()
      let second = append(start(), { kind: 'phase', to: 'night', night: 1 }, 1001)
      for (let i = 0; i < 3; i++) {
        first = append(first, { kind: 'override', note: `first ${i}` }, 1002 + i)
        second = append(second, { kind: 'override', note: `second ${i}` }, 1002 + i)
        expect(boardOf(first)).toEqual(fresh(first))
        expect(boardOf(second)).toEqual(fresh(second))
        expect(boardOf(lookAt(first, 4))).toEqual(fresh(lookAt(first, 4)))
      }
    })
  })
})

test('a board in the locale renames default seats only, and keeps an unchanged board as is', () => {
  const { g } = game().seat('Place 1', 'imp').seat('Ann', 'monk').build()
  expect(inLocale(g, 'es-419').seats.map((seat) => seat.name)).toEqual(['Asiento 1', 'Ann'])
  expect(inLocale(g, 'es-419').seats[1]).toBe(g.seats[1])
  expect(inLocale(g, 'fr')).toBe(g)
})
