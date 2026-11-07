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
  putGameOver,
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
  test('a stale window cannot write its older copy back, and gets the stored one instead', async () => {
    const start = newGame('tb', 1)
    await putGame(start)
    // Window A marks something; window B, still on the start, then saves a play-time checkpoint.
    const a = edited(start, ['chef', 'monk', 'saint'], 2)
    expect(await putGameOver(a, start)).toBeUndefined()
    const checkpoint = { ...start, playTime: [{ start: 1, end: 3 }] }
    expect(await putGameOver(checkpoint, start)).toEqual(a)
    expect(await getGame(start.id)).toEqual(a)
  })

  test('a window\'s own writes in a row, and a write that adds to the stored copy, go through', async () => {
    const start = newGame('tb', 1)
    await putGame(start)
    const first = edited(start, ['chef', 'monk', 'saint'], 2)
    const second = edited(first, ['chef', 'monk', 'soldier'], 3)
    expect(await putGameOver(first, start)).toBeUndefined()
    // Written before the first write was known to have landed: it still adds to it.
    expect(await putGameOver(second, start)).toBeUndefined()
    expect(await getGame(start.id)).toEqual(second)
    // A play-time checkpoint on the same log is not stale either.
    const checkpoint = { ...second, playTime: [{ start: 1, end: 4 }] }
    expect(await putGameOver(checkpoint, first)).toBeUndefined()
    expect(await getGame(start.id)).toEqual(checkpoint)
  })

  test('a game deleted in another window is not written back', async () => {
    const start = newGame('tb', 1)
    await putGame(start)
    await deleteGame(start.id)
    expect(await putGameOver(edited(start, ['chef', 'monk', 'saint'], 2), start)).toBeNull()
    expect(await getGame(start.id)).toBeUndefined()
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
