import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import {
  closeDb,
  deleteGame,
  getGame,
  getSettings,
  putSettings,
  importGame,
  listGames,
  PURGE_AFTER_MS,
  purgeDeleted,
  putGame,
  putGameOn,
} from './db'
import { asCharacterId } from '../content'
import { InvalidSavedGame, newGame, serialize } from './saved'
import type { SavedGame } from './saved'
import { append, openSession } from './session'

beforeEach(async () => {
  await closeDb()
  indexedDB = new IDBFactory()
})

// One more bluff choice on a game: a board edit that grows the log by one event.
const edited = (game: SavedGame, characters: readonly string[], now: number): SavedGame =>
  append(openSession(game), { kind: 'setBluffs', characters: characters.map(asCharacterId) }, now).game

describe('two windows writing one game', () => {
  test('a write lands while the stored copy is the one the window built on, and each landing moves that on', async () => {
    const start = newGame('tb', 1)
    await putGame(start)
    const first = edited(start, ['chef', 'monk', 'saint'], 2)
    expect(await putGameOn(first, start)).toEqual({ written: true })
    const second = edited(first, ['chef', 'monk', 'soldier'], 3)
    expect(await putGameOn(second, first)).toEqual({ written: true })
    expect(await getGame(start.id)).toEqual(second)
  })

  test('a window that built on an older copy writes nothing and gets the stored copy back', async () => {
    const start = newGame('tb', 1)
    await putGame(start)
    // Window A records bluffs and a timer; window B, still on the start, records others.
    const timer = { durationMs: 120_000, remainingMs: 90_000, pauseOnNomination: true, nominationPaused: false }
    const a = { ...edited(start, ['chef', 'monk', 'saint'], 2), dayTimer: timer }
    expect(await putGameOn(a, start)).toEqual({ written: true })
    const b = edited(start, ['chef', 'monk', 'soldier'], 3)
    expect(await putGameOn(b, start)).toEqual({ written: false, stored: a })
    expect(await getGame(start.id)).toEqual(a)
  })

  test('a game deleted in another window, or one this version cannot read, is left alone', async () => {
    const start = newGame('tb', 1)
    await putGame(start)
    await deleteGame(start.id)
    expect(await putGameOn(edited(start, ['chef', 'monk', 'saint'], 2), start)).toEqual({ written: false })
    expect(await getGame(start.id)).toBeUndefined()

    const newer = { ...newGame('tb', 1), version: start.version + 1 }
    await putGame(newer)
    expect(await putGameOn(edited({ ...newer, version: start.version }, ['chef', 'monk', 'saint'], 2), newer)).toEqual({ written: false })
    await expect(getGame(newer.id)).rejects.toThrow()
  })
})

describe('games', () => {
  test('a game is written whole and read back', async () => {
    const game = newGame('tb', 1)
    await putGame(game)
    expect(await getGame(game.id)).toEqual(game)
  })

  test('the list is newest first and hides deleted games', async () => {
    const a = newGame('tb', 1)
    const b = { ...newGame('bmr', 2), updatedAt: 5 }
    await putGame(a)
    await putGame(b)
    expect((await listGames()).map((g) => g.id)).toEqual([b.id, a.id])
    await deleteGame(a.id)
    expect((await listGames()).map((g) => g.id)).toEqual([b.id])
    expect(await getGame(a.id)).toBeUndefined()
  })

  test('deletion removes the stored record', async () => {
    const a = newGame('tb', 1)
    await putGame(a)
    await deleteGame(a.id)
    await closeDb()
    expect(await getGame(a.id)).toBeUndefined()
    expect(await listGames()).toEqual([])
    await expect(deleteGame(a.id)).resolves.toBeUndefined()
  })

  test('legacy deleted records stay hidden and are purged after their original grace period', async () => {
    const a = newGame('tb', 1)
    await putGame(a)
    await putGame({ ...a, deletedAt: 100 })
    expect(await listGames()).toEqual([])
    expect(await purgeDeleted(100 + PURGE_AFTER_MS)).toBe(0)
    expect(await purgeDeleted(101 + PURGE_AFTER_MS)).toBe(1)
    expect(await getGame(a.id)).toBeUndefined()
  })
})

describe('import', () => {
  test('a saved game file imports as the same game, once', async () => {
    const a = newGame('tb', 1)
    await putGame(a)
    const file = serialize(a)
    expect(await importGame(file)).toBe(a.id)
    expect(await importGame(file)).toBe(a.id)
    expect((await listGames()).length).toBe(1)
  })

  test('importing a game the database lacks writes it under its own id', async () => {
    const a = newGame('snv', 1)
    expect(await importGame(serialize(a))).toBe(a.id)
    expect(await getGame(a.id)).toEqual(a)
  })

  test('an exported backup can be imported after permanent deletion', async () => {
    const a = newGame('tb', 1)
    await putGame(a)
    const file = serialize(a)
    await deleteGame(a.id)
    expect(await importGame(file)).toBe(a.id)
    expect((await listGames()).map((g) => g.id)).toEqual([a.id])
  })

  test('a different game under a known id is kept beside it under a new id', async () => {
    const a = newGame('tb', 1)
    await putGame(a)
    const other = { ...a, updatedAt: 9, log: [{ id: 0, audience: 'storyteller', kind: 'phase', to: 'night', night: 1 }] }
    const id = await importGame(JSON.stringify(other))
    expect(id).not.toBe(a.id)
    expect(await getGame(a.id)).toEqual(a)
    expect(await getGame(id)).toEqual({ ...other, id })
  })

  test('a bad file is refused and writes nothing', async () => {
    await expect(importGame('nonsense')).rejects.toThrow(InvalidSavedGame)
    expect(await listGames()).toEqual([])
  })
})

test('the velvet preference survives closing and reopening the database', async () => {
  const settings = { locale: 'fr', boardColour: 'plum' } as const
  await putSettings(settings)
  await closeDb()
  expect(await getSettings()).toEqual(settings)
})
