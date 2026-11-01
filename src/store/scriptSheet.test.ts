import type { CustomScript, Team } from '../content'
import { asCharacterId, character, nightMarkers, t } from '../content'
import type { SheetNightItem } from './scriptSheet'
import {
  artIds,
  composeTarget,
  countTable,
  everyCharacter,
  fullTarget,
  jinxesAmong,
  listed,
  listHomebrew,
  nightOrders,
  sheetGroups,
  sheetTeams,
  teamCounts,
  teensyvilleTarget,
  unknownIds,
  unknownNotice,
} from './scriptSheet'

const id = asCharacterId

const teamWords: Record<Team, string> = {
  townsfolk: 'Townsfolk',
  outsider: 'Outsiders',
  minion: 'Minions',
  demon: 'Demons',
  traveller: 'Travellers',
  fabled: 'Fabled',
  loric: 'Loric',
}

const teensy: CustomScript = {
  kind: 'custom',
  name: 'Teensy',
  items: [
    { id: '_meta', name: 'Teensy' },
    'washerwoman',
    'librarian',
    'chef',
    'empath',
    'fortuneteller',
    'undertaker',
    'butler',
    'drunk',
    'poisoner',
    'spy',
    'imp',
  ],
}

// The sheet's data as both the scripts screen and the board's edge read it.
describe('listed', () => {
  test('an edition lists every character printed under its name, Travellers included, no Fabled', () => {
    const tb = listed('tb', 'en')
    expect(tb.length).toBe(27)
    expect(tb.map((c) => c.id)).toContain('scapegoat')
    expect(tb.every((c) => sheetTeams.includes(c.team))).toBe(true)
  })

  test('a custom script keeps the file order and speaks the locale', () => {
    const en = listed(teensy, 'en')
    expect(en.map((c) => c.id)).toEqual(teensy.items.slice(1))
    const fr = listed(teensy, 'fr')
    expect(fr[0]?.name).not.toBe(en[0]?.name)
    expect(fr[0]?.englishName).toBe('Washerwoman')
  })

  test('a homebrew item is listed from the file at the text floor', () => {
    const script: CustomScript = {
      kind: 'custom',
      name: 'Home',
      items: [{ id: '_meta', name: 'Home' }, 'imp', { id: 'baker', name: 'Baker', team: 'outsider', ability: 'You bake.' }],
    }
    const baker = listed(script, 'en')[1]
    expect(baker).toMatchObject({ id: 'baker', team: 'outsider', name: 'Baker', ability: 'You bake.', homebrew: true, reminders: [], ordinals: {} })
  })

  test('the art to warm gives a homebrew character, with none bundled, its team\'s icon', () => {
    const script: CustomScript = { kind: 'custom', name: 'Home', items: [{ id: '_meta', name: 'Home' }, 'imp', { id: 'baker', name: 'Baker', team: 'outsider', ability: 'You bake.' }] }
    expect(artIds(script, 'en')).toEqual(['imp', 'outsider', 'bootlegger'])
  })

  test('an id this build does not know is left off the sheet and named apart', () => {
    const later: CustomScript = { ...teensy, items: [...teensy.items, 'nightowl', { id: 'baker', name: 'Baker', team: 'outsider', ability: 'x' }] }
    expect(listed(later, 'en').map((c) => c.id)).toEqual([...teensy.items.slice(1), 'baker', 'bootlegger'])
    expect(unknownIds(later)).toEqual(['nightowl'])
    expect(unknownIds(teensy)).toEqual([])
    expect(unknownIds('tb')).toEqual([])
    const en = (key: string, values?: Parameters<typeof t>[2]) => t('en', key, values)
    expect(unknownNotice(later, en)).toBe('This version of the app does not know nightowl yet. The script keeps it, and an update will show it.')
    expect(unknownNotice(teensy, en)).toBeUndefined()
  })

  test('a script\'s Fabled and Loric print in their own bands after the Travellers', () => {
    const ruled: CustomScript = { ...teensy, items: [...teensy.items, 'stormcatcher', 'gunslinger', 'djinn'] }
    expect(sheetGroups(listed(ruled, 'en'), teamWords).map((g) => g.team)).toEqual(['townsfolk', 'outsider', 'minion', 'demon', 'traveller', 'fabled', 'loric'])
    expect(sheetGroups(listed(teensy, 'en'), teamWords).map((g) => g.team)).toEqual(['townsfolk', 'outsider', 'minion', 'demon'])
  })

  test('reminders come one per token that ships', () => {
    const washerwoman = listed(teensy, 'en').find((c) => c.id === 'washerwoman')
    expect(washerwoman?.reminders).toEqual(['Townsfolk', 'Wrong'])
  })
})

describe('sheetGroups', () => {
  test('read mode groups by team in the fixed order and drops empty teams', () => {
    const groups = sheetGroups(listed(teensy, 'en'), teamWords)
    expect(groups.map((g) => g.team)).toEqual(['townsfolk', 'outsider', 'minion', 'demon'])
    expect(groups[0]?.rows.map((r) => r.id)).toEqual(['washerwoman', 'librarian', 'chef', 'empath', 'fortuneteller', 'undertaker'])
    expect(groups[0]?.count).toBeUndefined()
  })

  test('compose keeps every team and carries the count against its target', () => {
    const list = listed(teensy, 'en')
    const counts = teamCounts(list)
    const target = composeTarget(counts)
    const groups = sheetGroups(list, teamWords, {
      of: (team) => (target[team] > 0 ? { have: counts[team] ?? 0, of: target[team] } : undefined),
      label: (c) => `${c.have} of ${c.of}`,
    })
    expect(groups.map((g) => g.team)).toEqual(sheetTeams)
    expect(groups[0]?.count).toEqual({ have: 6, of: 6, label: '6 of 6' })
    expect(groups[4]?.count).toBeUndefined()
  })

  test('a row marks the footnote only for a character that skips the first night', () => {
    const rows = sheetGroups(listed(teensy, 'en'), teamWords).flatMap((g) => g.rows)
    expect(rows.find((r) => r.id === 'undertaker')?.skipsFirstNight).toBe(true)
    expect(rows.find((r) => r.id === 'washerwoman')?.skipsFirstNight).toBeUndefined()
    expect(rows.find((r) => r.id === 'imp')?.skipsFirstNight).toBe(true)
  })
})

describe('composeTarget', () => {
  test('the full script until the counts are exactly Teensyville', () => {
    expect(composeTarget({})).toBe(fullTarget)
    expect(composeTarget({ townsfolk: 5, outsider: 2, minion: 2, demon: 1 })).toBe(fullTarget)
    expect(composeTarget({ townsfolk: 6, outsider: 2, minion: 2, demon: 1 })).toBe(teensyvilleTarget)
    expect(composeTarget({ townsfolk: 6, outsider: 2, minion: 2, demon: 1, traveller: 3 })).toBe(teensyvilleTarget)
    expect(composeTarget({ townsfolk: 7, outsider: 2, minion: 2, demon: 1 })).toBe(fullTarget)
  })
})

describe('jinxes', () => {
  test('a jinx appears once both characters are on the list', () => {
    const list = everyCharacter('en')
    const pair = list.filter((c) => c.id === 'spy' || c.id === 'ogre')
    expect(jinxesAmong(pair, 'en')).toHaveLength(1)
    expect(jinxesAmong(pair.slice(0, 1), 'en')).toHaveLength(0)
    expect(jinxesAmong(list, 'en').length).toBeGreaterThan(100)
  })

  test('a homebrew character\'s own jinxes join the official ones, each pair once', () => {
    const lamp = { id: 'lamp', name: 'Lamp', team: 'townsfolk', ability: 'x',
      jinxes: [{ id: 'spy', reason: 'The Spy sees the Lamp lit.' }, { id: 'imp', reason: 'Not on the list.' }, { id: 'wick', reason: 'Lamp first.' }] } as const
    const wick = { id: 'wick', name: 'Wick', team: 'outsider', ability: 'x', jinxes: [{ id: 'lamp', reason: 'Wick second.' }] } as const
    const official = everyCharacter('en').filter((c) => c.id === 'spy' || c.id === 'ogre')
    expect(jinxesAmong([...official, listHomebrew(lamp), listHomebrew(wick)], 'en').map((j) => [j.a, j.b, j.reason])).toEqual([
      ...jinxesAmong(official, 'en').map((j) => [j.a, j.b, j.reason]),
      ['lamp', 'spy', 'The Spy sees the Lamp lit.'],
      ['lamp', 'wick', 'Lamp first.'],
    ])
  })

  test('a sheet retains every jinx reason as reference text', () => {
    const list = everyCharacter('en')
    const pair = list.filter((c) => c.id === 'vizier' || c.id === 'alsaahir')
    expect(jinxesAmong(pair, 'en')[0]?.reason).toBeTruthy()
  })
})

describe('countTable', () => {
  test('five to fifteen players from the base counts', () => {
    const table = countTable({ townsfolk: 'T', outsiders: 'O', minions: 'M', demon: 'D' })
    expect(table.players).toEqual([5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])
    expect(table.rows.map((row) => row.team)).toEqual(['townsfolk', 'outsider', 'minion', 'demon'])
    expect(table.rows[0]?.by).toEqual([3, 3, 5, 5, 5, 7, 7, 7, 9, 9, 9])
    expect(table.rows[1]?.by).toEqual([0, 1, 0, 1, 2, 0, 1, 2, 0, 1, 2])
    expect(table.rows[2]?.by).toEqual([1, 1, 1, 1, 1, 2, 2, 2, 3, 3, 3])
  })
})

describe('nightOrders', () => {
  const label = (m: string) => m.toUpperCase()
  const ids = (items: readonly SheetNightItem[]) => items.map((i) => (i.kind === 'character' ? i.id : i.marker))

  test('the first night has its four markers in place and every listed waker in ordinal order', () => {
    const orders = nightOrders(teensy, listed(teensy, 'en'), 'en', label)
    const first = ids(orders.first)
    expect(first[0]).toBe('dusk')
    expect(first[first.length - 1]).toBe('dawn')
    expect(first.indexOf('minionInfo')).toBeLessThan(first.indexOf('demonInfo'))
    // The official first night: the two info steps, then the Poisoner, then the Townsfolk who learn.
    expect(first.indexOf('poisoner')).toBeGreaterThan(first.indexOf('demonInfo'))
    expect(first.indexOf('washerwoman')).toBeGreaterThan(first.indexOf('poisoner'))
    expect(first).not.toContain('undertaker')
    expect(first).not.toContain('drunk')
  })

  test('a homebrew character wakes where its own record puts it, with no registry behind it', () => {
    const poisoner = character(id('poisoner')).ordinals.first!
    const lamp = { id: 'lampx1', name: 'Lamp', team: 'minion', ability: 'x', firstNight: poisoner + 0.5 } as const
    const script: CustomScript = { ...teensy, items: [...teensy.items, lamp] }
    const first = ids(nightOrders(script, listed(script, 'en'), 'en', label).first)
    expect(first.indexOf('lampx1')).toBe(first.indexOf('poisoner') + 1)
    expect(ids(nightOrders(script, listed(script, 'en'), 'en', label).other)).not.toContain('lampx1')
  })

  test('other nights carry dusk and dawn only, the Imp before the Undertaker', () => {
    const other = ids(nightOrders(teensy, listed(teensy, 'en'), 'en', label).other)
    expect(other).not.toContain('minionInfo')
    expect(other[0]).toBe('dusk')
    expect(other.indexOf('poisoner')).toBeLessThan(other.indexOf('imp'))
    expect(other.indexOf('imp')).toBeLessThan(other.indexOf('undertaker'))
    expect(character(id('imp')).ordinals.other).toBeGreaterThan(nightMarkers.other.dusk)
  })

  test('a character listed twice wakes once, and the markers carry their words', () => {
    const twice: CustomScript = { ...teensy, items: [...teensy.items, 'poisoner'] }
    const orders = nightOrders(twice, listed(twice, 'en'), 'en', label)
    expect(ids(orders.first).filter((x) => x === 'poisoner')).toHaveLength(1)
    const dusk = orders.first[0]
    expect(dusk?.kind === 'marker' && dusk.label).toBe('DUSK')
  })
})

describe('everyCharacter and search', () => {
  test('every known character on the sheet\'s teams, in official ability order in both locales', () => {
    const all = everyCharacter('en')
    expect(all.filter((c) => c.team === 'fabled' || c.team === 'loric').map((c) => c.id)).toContain('bootlegger')
    expect(all.at(-1)?.team).toBe('loric')
    const teams = all.map((c) => sheetTeams.indexOf(c.team))
    expect([...teams].sort((a, b) => a - b)).toEqual(teams)
    const ids = (team: string) => all.filter((c) => c.team === team).map((c) => c.id)
    expect(ids('townsfolk').slice(0, 6)).toEqual(['steward', 'knight', 'chef', 'noble', 'investigator', 'washerwoman'])
    expect(ids('outsider').slice(0, 4)).toEqual(['hermit', 'butler', 'goon', 'ogre'])
    expect(ids('minion').slice(0, 4)).toEqual(['mezepheles', 'godfather', 'poisoner', 'devilsadvocate'])
    expect(ids('demon').slice(0, 4)).toEqual(['yaggababble', 'pukka', 'lilmonsta', 'nodashii'])
    expect(everyCharacter('fr').map((c) => c.id)).toEqual(all.map((c) => c.id))
  })
})
