import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import type { CustomScript, Homebrew } from '../content'
import { asCharacterId, character, nightMarkers } from '../content'
import type { SavedScript, SavedScriptId } from './customScripts'
import { closeDb, deleteCharacter, getSettings, listCharacters, listScripts, putCharacter, putScript, putSettings } from './db'
import { mintCharacterId, registryOf, withHomebrew } from './homebrew'
import type { SavedGame } from './saved'
import { newGame } from './saved'

const baker: Homebrew = { id: 'bakerab12', name: 'Baker', team: 'outsider', ability: 'You bake.' }
const script = (name: string, ...items: CustomScript['items']): CustomScript => ({ kind: 'custom', name, items: [{ id: '_meta', name }, ...items] })

// A list as the database holds it, without the reading this module does.
const stored = async (key: string): Promise<unknown> => {
  const request = <T>(r: IDBRequest<T>) => new Promise<T>((resolve, reject) => { r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error) })
  const db = await request(indexedDB.open('botcgrimoire'))
  try {
    return await request(db.transaction('settings').objectStore('settings').get(key))
  } finally {
    db.close()
  }
}

beforeEach(async () => {
  await closeDb()
  indexedDB = new IDBFactory()
})

describe('mintCharacterId', () => {
  test('starts from the name in the schema\'s letters and ends in four random ones', () => {
    expect(mintCharacterId('Épée Noire!')).toMatch(/^epeenoire[a-z0-9]{4}$/)
    expect(mintCharacterId('  ')).toMatch(/^homebrew[a-z0-9]{4}$/)
    expect(mintCharacterId('x'.repeat(80))).toHaveLength(44)
  })

  test('never returns a taken id', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 50; i++) seen.add(mintCharacterId('Baker', (id) => seen.has(id)))
    expect(seen.size).toBe(50)
  })
})

describe('withHomebrew', () => {
  test('replaces the copy a script carries and leaves any other script as it was', () => {
    const edited = { ...baker, ability: 'You bake bread.' }
    const carrying = script('Home', 'imp', baker)
    expect(withHomebrew(carrying, edited).items).toEqual([{ id: '_meta', name: 'Home' }, 'imp', edited])
    const other = script('Other', 'imp')
    expect(withHomebrew(other, edited)).toBe(other)
  })
})

describe('registryOf', () => {
  test('lists games, then scripts, then the Storyteller\'s own, then the open game, so the open game\'s copy wins', () => {
    const played = { ...baker, ability: 'Played.' }
    const inScript = { ...baker, ability: 'Scripted.' }
    const own = { ...baker, ability: 'Own.' }
    const game: SavedGame = newGame(script('Game', played), 1)
    const saved: SavedScript = { id: 's1' as SavedScriptId, script: script('Saved', inScript), updatedAt: 1 }
    const list = registryOf([game], [saved], [{ character: own, updatedAt: 1 }])
    expect(list.map((h) => h.ability)).toEqual(['Played.', 'Scripted.', 'Own.'])
    expect(registryOf([game], [saved], [{ character: own, updatedAt: 1 }], game.script).at(-1)).toBe(played)
  })
})

describe('characters in the database', () => {
  test('come back newest edit first, replace by id, delete by id, beside the settings and scripts', async () => {
    const settings = { locale: 'fr', boardColour: 'burgundy' } as const
    await putSettings(settings)
    const saved: SavedScript = { id: 's1' as SavedScriptId, script: script('Home', 'imp'), updatedAt: 1 }
    await putScript(saved)
    await putCharacter({ character: baker, updatedAt: 1 })
    await putCharacter({ character: { ...baker, id: 'other1234', name: 'Other' }, updatedAt: 3 })
    await putCharacter({ character: { ...baker, name: 'Renamed' }, updatedAt: 2 })
    expect((await listCharacters()).map((c) => c.character.name)).toEqual(['Other', 'Renamed'])
    await deleteCharacter('other1234')
    expect((await listCharacters()).map((c) => c.character.id)).toEqual(['bakerab12'])
    expect(await getSettings()).toEqual(settings)
    expect(await listScripts()).toEqual([saved])
  })

  test('an empty database has none', async () => {
    expect(await listCharacters()).toEqual([])
  })

  test('saving a character replaces its copy in every script carrying it, in the same write', async () => {
    const carrying: SavedScript = { id: 's1' as SavedScriptId, script: script('Home', 'imp', baker), updatedAt: 1 }
    const other: SavedScript = { id: 's2' as SavedScriptId, script: script('Away', 'imp'), updatedAt: 2 }
    await putScript(carrying)
    await putScript(other)
    const edited = { ...baker, ability: 'You bake bread.' }
    await Promise.all([putCharacter({ character: edited, updatedAt: 3 }), putScript({ ...other, updatedAt: 4 })])
    const scripts = await listScripts()
    expect(scripts.map((s) => s.id)).toEqual(['s2', 's1'])
    expect(scripts[1]!.script.items[2]).toEqual(edited)
    expect(scripts[0]!.updatedAt).toBe(4)
  })

  test('a record saved before wakes named their step is pinned to one once, and written back', async () => {
    const start = nightMarkers.other.dusk + 0.5
    const imp = character(asCharacterId('imp')).ordinals.other!
    const early: Homebrew = { ...baker, firstNight: 20.5, otherNight: start }
    const demon: Homebrew = { ...baker, id: 'demonab12', team: 'demon', otherNight: start }
    const pinned: Homebrew = { ...baker, id: 'pinnedab12', otherNight: 3, otherNightAfter: 'dusk' }
    await putCharacter({ character: early, updatedAt: 3 })
    await putCharacter({ character: demon, updatedAt: 2 })
    await putCharacter({ character: pinned, updatedAt: 1 })
    await putScript({ id: 's1' as SavedScriptId, script: script('Home', 'imp', early), updatedAt: 1 })
    const [stays, movedDemon, kept] = (await listCharacters()).map((c) => c.character)
    // Placed just after dusk, a character stays at the start of the night.
    expect(stays).toEqual({ ...early, firstNightAfter: 'snitch', otherNightAfter: 'dusk' })
    // The first editor gave a Demon nothing but that start, so it wakes with the Demons.
    expect(movedDemon).toMatchObject({ otherNight: imp + 0.5, otherNightAfter: 'imp' })
    expect(kept).toEqual(pinned)
    expect((await listScripts())[0]!.script.items[2]).toEqual(stays)
    // Written back on that read: what is stored already names the steps.
    expect(await stored('characters')).toContainEqual(expect.objectContaining({ character: stays }))
  })
})
