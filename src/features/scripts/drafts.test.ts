import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import { asCharacterId } from '../../content'
import { closeDb, getDraft, putDraft } from '../../store/db'
import { draftOfCharacter } from './character'
import type { Draft } from './compose'
import { emptyDraft } from './compose'
import { readKept } from './drafts'

const draft: Draft = { name: 'Late Night', author: 'Camille', ids: [asCharacterId('imp'), asCharacterId('chef')] }
const character = { ...draftOfCharacter(), name: 'Baker', ability: 'You bake.', image: 'data:image/webp;base64,AAAA', firstNight: 20.5 }

beforeEach(async () => {
  await closeDb()
  indexedDB = new IDBFactory()
})

describe('kept drafts', () => {
  test('nothing kept reads as nothing', async () => {
    expect(await readKept()).toEqual({})
  })

  test('a script and a character draft come back as they were kept, and clearing one leaves the other', async () => {
    await putDraft('script', { draft, initial: emptyDraft })
    await putDraft('character', { draft: character })
    expect(await readKept()).toEqual({ script: { draft, initial: emptyDraft }, character: { draft: character } })
    await putDraft('script', undefined)
    expect(await getDraft('script')).toBeUndefined()
    expect(await readKept()).toEqual({ character: { draft: character } })
  })

  test('a script draft keeps its homebrew rules, blanks included, and what other apps read', async () => {
    const ruled: Draft = { ...draft, rules: ['One rule.', ''], kept: { almanac: 'https://example.invalid/a', hideTitle: true } }
    await putDraft('script', { draft: ruled, initial: emptyDraft })
    expect((await readKept()).script).toEqual({ draft: ruled, initial: emptyDraft })
  })

  test('a character being edited keeps the saved record it started from', async () => {
    const initial = { id: 'bakerab12', name: 'Baker', team: 'townsfolk', ability: 'You bake.' }
    await putDraft('character', { draft: character, initial })
    expect((await readKept()).character).toEqual({ draft: character, initial })
  })

  test('a record of another shape is left out rather than opened', async () => {
    await putDraft('script', { draft: { name: 'No ids', author: '' }, initial: emptyDraft })
    expect(await readKept()).toEqual({})
    await putDraft('script', { draft: { ...draft, rules: [1] }, initial: emptyDraft })
    await putDraft('character', { draft: { ...character, reminders: 'one' } })
    expect(await readKept()).toEqual({})
    await putDraft('script', 'text')
    await putDraft('character', null)
    expect(await readKept()).toEqual({})
  })
})
