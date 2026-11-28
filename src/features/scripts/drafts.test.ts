import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import { asCharacterId } from '../../content'
import { closeDb, getDraft, putDraft } from '../../store/db'
import { characterOf, draftOfCharacter } from './character'
import type { Draft } from './compose'
import { emptyDraft } from './compose'
import { readKept } from './drafts'

const draft: Draft = { name: 'Late Night', author: 'Camille', ids: [asCharacterId('imp'), asCharacterId('chef')] }
const character = { ...draftOfCharacter(), name: 'Baker', ability: 'You bake.', image: 'data:image/webp;base64,AAAA', firstNight: 'snitch' }

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

  test('a character draft kept by an older version, with a position for its wake, opens on that step', async () => {
    await putDraft('character', { draft: { ...character, firstNight: 20.5, otherNight: 0 } })
    expect((await readKept()).character).toEqual({ draft: { ...character, otherNight: undefined } })
  })

  test('a character draft kept before jinxes could be written opens on the jinx its record has', async () => {
    const { jinxWith: _with, jinxReason: _reason, ...older } = character
    await putDraft('character', { draft: older })
    expect((await readKept()).character).toEqual({ draft: { ...character, jinxReason: '' } })
    // A draft with no jinx saves its record without the first one, so an older draft opens on it.
    const initial = { id: 'bakerab12', name: 'Baker', team: 'townsfolk', ability: 'You bake.', jinxes: [{ id: 'spy', reason: 'Seen.' }, { id: 'imp', reason: 'Fed.' }] }
    await putDraft('character', { draft: older, initial })
    const reopened = (await readKept()).character!
    expect(reopened.draft).toMatchObject({ jinxWith: 'spy', jinxReason: 'Seen.' })
    expect(characterOf(reopened.draft, initial.id, reopened.initial).jinxes).toEqual(initial.jinxes)
    // A newer draft holds what its form did, a cleared jinx included.
    await putDraft('character', { draft: character, initial })
    const cleared = (await readKept()).character!
    expect(cleared.draft.jinxWith).toBeUndefined()
    expect(characterOf(cleared.draft, initial.id, cleared.initial).jinxes).toEqual([{ id: 'imp', reason: 'Fed.' }])
    await putDraft('character', { draft: { ...character, jinxWith: 'spy', jinxReason: 'Seen.' } })
    expect((await readKept()).character?.draft).toMatchObject({ jinxWith: 'spy', jinxReason: 'Seen.' })
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
