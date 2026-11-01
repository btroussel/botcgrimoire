import type { CustomScript, Homebrew } from '../../content'
import { asCharacterId, character, parseScript } from '../../content'
import type { SavedScript, SavedScriptId } from '../../store'
import { serializeScript } from '../../store'
import { everyCharacter, listed, unknownIds } from '../../store/scriptSheet'
import { composeRoster, draftIds, draftNeedsBootlegger, draftOf, draftProblem, emptyDraft, fileName, fileOf, importLink, importText, matchesSearch, minCharacters, orderIds, recordsOf, toggleId } from './compose'

const id = asCharacterId
const teensyIds = ['imp', 'poisoner', 'washerwoman', 'librarian', 'chef', 'butler', 'drunk', 'spy', 'empath', 'fortuneteller', 'undertaker'].map(id)

describe('the file a draft saves as', () => {
  test('is the official schema: _meta first, then the ids by team in official ability order', () => {
    const file = fileOf({ name: ' Teensy ', author: 'Ann', ids: teensyIds })
    expect(file.kind).toBe('custom')
    expect(file.name).toBe('Teensy')
    expect(file.items[0]).toEqual({ id: '_meta', name: 'Teensy', author: 'Ann' })
    const ids = file.items.slice(1) as string[]
    expect([...ids].sort()).toEqual([...teensyIds].sort())
    const rank = ['townsfolk', 'outsider', 'minion', 'demon'].map((team) => ids.filter((x) => character(id(x)).team === team))
    expect(rank.flat()).toEqual(ids)
    expect(ids).toEqual(['chef', 'washerwoman', 'librarian', 'empath', 'fortuneteller', 'undertaker', 'butler', 'drunk', 'poisoner', 'spy', 'imp'])
  })

  test.each(['en', 'fr'] as const)('the %s catalogue, draft and saved reader keep the same order', (locale) => {
    const roster = everyCharacter(locale)
    const selected = roster.filter((c) => teensyIds.includes(c.id)).map((c) => c.id)
    const file = fileOf({ name: 'Teensy', author: '', ids: [...teensyIds].reverse() })
    expect(file.items.slice(1)).toEqual(selected)
    expect(listed(file, locale).map((c) => c.id)).toEqual(selected)
    expect(orderIds(roster.map((c) => c.id).reverse())).toEqual(roster.map((c) => c.id))
  })

  test('leaves the author out when blank and lists an id once', () => {
    const file = fileOf({ name: 'X', author: '  ', ids: [id('imp'), id('imp')] })
    expect(file.items[0]).toEqual({ id: '_meta', name: 'X' })
    expect(file.items).toHaveLength(2)
  })

  test('round-trips through the content parser and the store serializer', () => {
    const file = fileOf({ name: 'Teensy', author: 'Ann', ids: teensyIds })
    const parsed = parseScript(JSON.parse(serializeScript(file)))
    expect(parsed).toEqual(file)
  })
})

describe('draftOf', () => {
  test('reopens a saved script with its author, every id, and the homebrew records it carries', () => {
    const baker: Homebrew = { id: 'baker', name: 'Baker', team: 'outsider', ability: 'You bake.' }
    const script: CustomScript = {
      kind: 'custom',
      name: 'Home',
      items: [{ id: '_meta', name: 'Home', author: 'Bob' }, 'imp', baker, 'chef'],
    }
    const saved: SavedScript = { id: 's1' as SavedScriptId, script, updatedAt: 1 }
    expect(draftOf(saved)).toEqual({ id: 's1', name: 'Home', author: 'Bob', ids: ['imp', 'baker', 'chef'], homebrew: [baker] })
  })
})

describe('homebrew characters in a draft', () => {
  const baker: Homebrew = { id: 'bakerq1', name: 'Baker', team: 'outsider', ability: 'You bake.', reminders: ['Bread'], firstNight: 30.5 }
  const alchemist: Homebrew = { id: 'alchq2', name: 'Alchemist Two', team: 'townsfolk', ability: 'You brew.' }
  const draft = { name: 'Home', author: '', ids: [id('imp'), id('bakerq1'), id('chef'), id('alchq2'), id('drunk')] }

  test('save as full records after the official characters of their team, by name', () => {
    const file = fileOf(draft, [baker, alchemist])
    expect(file.items.slice(1)).toEqual(['chef', alchemist, 'drunk', baker, 'imp', 'bootlegger'])
  })

  test('the copy in the Storyteller\'s list replaces the one the script carried', () => {
    const file = fileOf({ ...draft, homebrew: [{ ...baker, ability: 'Old text.' }] }, [baker, alchemist])
    expect(file.items).toContainEqual(baker)
  })

  test('an id with no record anywhere stays as it came, like an official id this build does not know', () => {
    const file = fileOf(draft, [alchemist])
    expect(file.items.slice(1)).toEqual(['chef', alchemist, 'drunk', 'imp', 'bootlegger', 'bakerq1'])
    expect(unknownIds(file)).toEqual(['bakerq1'])
  })

  test('round-trip through the parser and the sheet', () => {
    const file = fileOf(draft, [baker, alchemist])
    expect(parseScript(JSON.parse(serializeScript(file)))).toEqual(file)
    expect(listed(file, 'fr').find((c) => c.id === 'bakerq1')).toMatchObject({ name: 'Baker', homebrew: true, reminders: ['Bread'], ordinals: { first: 30.5 } })
  })

  test('the composer offers them in the order the file will list them', () => {
    const records = recordsOf(undefined, [baker, alchemist])
    const roster = composeRoster('en', records)
    const selected = roster.filter((c) => draftIds(draft, records).includes(c.id)).map((c) => c.id)
    expect(selected).toEqual(fileOf(draft, [baker, alchemist]).items.slice(1).map((item) => (typeof item === 'string' ? item : item.id)))
    expect(orderIds([id('alchq2'), id('chef')], recordsOf(undefined, [alchemist]))).toEqual(['chef', 'alchq2'])
  })

  test('keeps the homebrew rules and what other apps read through an edit, dropping a blank rule', () => {
    const meta = { id: '_meta', name: 'Home', almanac: 'https://example.invalid/a', background: 'https://example.invalid/b', hideTitle: true, bootlegger: ['One rule.'] } as const
    const script: CustomScript = { kind: 'custom', name: 'Home', items: [meta, 'imp'] }
    const draft = draftOf({ id: 's1' as SavedScriptId, script, updatedAt: 1 })
    expect(draft.rules).toEqual(['One rule.'])
    expect(fileOf(draft).items[0]).toEqual(meta)
    expect(fileOf({ ...draft, rules: ['  ', ' Two. '] }).items[0]).toEqual({ ...meta, bootlegger: ['Two.'] })
    const { bootlegger: _gone, ...without } = meta
    expect(fileOf({ ...draft, rules: [''] }).items[0]).toEqual(without)
  })

  test('homebrew characters or rules bring the Bootlegger, once', () => {
    const records = recordsOf(undefined, [baker])
    expect(draftNeedsBootlegger(draft, records)).toBe(true)
    expect(draftIds({ ...draft, ids: [...draft.ids, id('bootlegger')] }, records).filter((x) => x === 'bootlegger')).toHaveLength(1)
    const official = { name: 'Plain', author: '', ids: [id('imp'), id('chef')] }
    expect(draftIds(official, records)).toEqual(official.ids)
    expect(draftIds({ ...official, rules: ['  '] }, records)).toEqual(official.ids)
    expect(draftIds({ ...official, rules: ['No whispering.'] }, records)).toEqual([...official.ids, 'bootlegger'])
  })

  test('keeps an imported logo through an edit', () => {
    const logo = 'https://example.invalid/logo.png'
    const script: CustomScript = { kind: 'custom', name: 'Home', items: [{ id: '_meta', name: 'Home', logo }, 'imp'] }
    const draft = draftOf({ id: 's1' as SavedScriptId, script, updatedAt: 1 })
    expect(draft.logo).toBe(logo)
    expect(fileOf(draft).items[0]).toEqual({ id: '_meta', name: 'Home', logo })
  })
})

describe('draftProblem', () => {
  test('a name first, then five characters', () => {
    expect(draftProblem(emptyDraft)).toBe('nameNeeded')
    expect(draftProblem({ name: 'X', author: '', ids: teensyIds.slice(0, minCharacters - 1) })).toBe('tooFew')
    expect(draftProblem({ name: 'X', author: '', ids: teensyIds.slice(0, minCharacters) })).toBeUndefined()
  })
})

test('toggleId adds an absent id and removes a present one', () => {
  expect(toggleId([], id('imp'))).toEqual(['imp'])
  expect(toggleId([id('imp'), id('chef')], id('imp'))).toEqual(['chef'])
})

test('orderIds puts Travellers after the Demons', () => {
  expect(orderIds([id('scapegoat'), id('imp'), id('chef')])).toEqual(['chef', 'imp', 'scapegoat'])
})

describe('importText', () => {
  test('a good file becomes a script, an official character written in full kept as its id', () => {
    const text = JSON.stringify([{ id: '_meta', name: 'Mine' }, { id: 'imp', name: 'Imp', team: 'demon', ability: '...' }, 'chef', 'Fortune_Teller', 'spy', 'butler'])
    const read = importText(text)
    expect('script' in read && read.script.items).toEqual([{ id: '_meta', name: 'Mine' }, 'imp', 'chef', 'fortuneteller', 'spy', 'butler'])
  })

  test('every problem is reported, and text that is not JSON says so', () => {
    expect(importText('{')).toEqual({ errors: ['not JSON'] })
    const read = importText(JSON.stringify([7, 'imp', { id: 'x', name: 'X' }]))
    expect('errors' in read && read.errors.length).toBe(3)
  })

  test('the file\'s own text pasted where a link goes reads as the file', async () => {
    const text = JSON.stringify([{ id: '_meta', name: 'Mine' }, 'imp', 'chef', 'spy', 'butler', 'monk'])
    expect(await importLink(`  ${text}\n`)).toEqual(importText(text))
    expect(await importLink('not a script')).toBe('none')
  })
})

test('fileName is the slug of the name', () => {
  expect(fileName('Sects & Violets')).toBe('sects-violets.json')
  expect(fileName('Élan nocturne')).toBe('elan-nocturne.json')
  expect(fileName('   ')).toBe('script.json')
})

describe('the picker search', () => {
  const fortuneTeller = { name: 'Voyante', englishName: 'Fortune Teller' }

  test('finds a character by its name or its English name, ignoring case and accents', () => {
    expect(matchesSearch({ name: 'Légionnaire', englishName: 'Legion' }, 'LEGIONN')).toBe(true)
    expect(matchesSearch(fortuneTeller, 'voy')).toBe(true)
    expect(matchesSearch(fortuneTeller, 'teller')).toBe(true)
    expect(matchesSearch(fortuneTeller, 'imp')).toBe(false)
  })

  test('every word must match, and an empty query matches everyone', () => {
    expect(matchesSearch(fortuneTeller, ' fortune  tel ')).toBe(true)
    expect(matchesSearch(fortuneTeller, 'fortune imp')).toBe(false)
    expect(matchesSearch(fortuneTeller, '   ')).toBe(true)
  })
})
