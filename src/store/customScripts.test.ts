import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import type { SavedScript, SavedScriptId } from './customScripts'
import { closeDb, deleteScript, getSettings, listScripts, putScript, putSettings } from './db'
import type { Settings } from './settings'

const settings: Settings = { locale: 'fr', boardColour: 'burgundy' }

const saved = (id: string, updatedAt: number): SavedScript => ({
  id: id as SavedScriptId,
  script: { kind: 'custom', name: id, items: [{ id: '_meta', name: id }, 'imp', 'chef', 'spy', 'butler', 'empath'] },
  updatedAt,
})

beforeEach(async () => {
  await closeDb()
  indexedDB = new IDBFactory()
})

describe('custom scripts in the store', () => {
  test('saved scripts come back newest edit first', async () => {
    await putScript(saved('a', 1))
    await putScript(saved('b', 3))
    await putScript(saved('c', 2))
    expect((await listScripts()).map((s) => s.id)).toEqual(['b', 'c', 'a'])
  })

  test('saving under the same id replaces, deleting removes, and settings sit beside them untouched', async () => {
    await putSettings(settings)
    await putScript(saved('a', 1))
    await putScript({ ...saved('a', 5), script: { ...saved('a', 5).script, name: 'renamed' } })
    const list = await listScripts()
    expect(list).toHaveLength(1)
    expect(list[0]?.script.name).toBe('renamed')
    await deleteScript('a' as SavedScriptId)
    expect(await listScripts()).toEqual([])
    expect(await getSettings()).toEqual(settings)
  })

  test('an empty database has no scripts', async () => {
    expect(await listScripts()).toEqual([])
  })
})

describe('saving scripts at the same time', () => {
  test('two saves that overlap both land', async () => {
    await Promise.all([putScript(saved('a', 1)), putScript(saved('b', 2)), putScript(saved('c', 3))])
    expect((await listScripts()).map((s) => s.id)).toEqual(['c', 'b', 'a'])
  })
})
