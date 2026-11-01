import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import type { CustomScript, Homebrew } from '../content'
import { asCharacterId, character, demonNight, nightMarkers } from '../content'
import type { SavedScript, SavedScriptId } from './customScripts'
import { closeDb, deleteCharacter, getSettings, listCharacters, listScripts, putCharacter, putScript, putSettings } from './db'
import { mintCharacterId, registryOf, withHomebrew } from './homebrew'
import type { SavedGame } from './saved'
import { newGame } from './saved'

const baker: Homebrew = { id: 'bakerab12', name: 'Baker', team: 'outsider', ability: 'You bake.' }
const script = (name: string, ...items: CustomScript['items']): CustomScript => ({ kind: 'custom', name, items: [{ id: '_meta', name }, ...items] })

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

  test('a character from the first editor, at the start of other nights, wakes before the Demon now', async () => {
    const start = nightMarkers.other.dusk + 0.5
    const monkish: Homebrew = { ...baker, firstNight: start, otherNight: start }
    const demon: Homebrew = { ...baker, id: 'demonab12', team: 'demon', otherNight: start }
    const placed: Homebrew = { ...baker, id: 'placedab12', otherNight: 20.5 }
    await putCharacter({ character: monkish, updatedAt: 3 })
    await putCharacter({ character: demon, updatedAt: 2 })
    await putCharacter({ character: placed, updatedAt: 1 })
    await putScript({ id: 's1' as SavedScriptId, script: script('Home', 'imp', monkish), updatedAt: 1 })
    const [moved, movedDemon, kept] = (await listCharacters()).map((c) => c.character)
    expect(moved).toEqual({ ...monkish, otherNight: demonNight.first - 0.5 })
    expect(movedDemon?.otherNight).toBe(character(asCharacterId('imp')).ordinals.other! + 0.5)
    expect(kept?.otherNight).toBe(20.5)
    expect((await listScripts())[0]!.script.items[2]).toEqual(moved)
  })
})
