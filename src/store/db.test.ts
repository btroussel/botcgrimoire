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
} from './db'
import { InvalidSavedGame, newGame, serialize } from './saved'

beforeEach(async () => {
  await closeDb()
  indexedDB = new IDBFactory()
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
