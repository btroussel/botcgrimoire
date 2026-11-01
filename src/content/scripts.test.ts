import { characters } from './index'
import type { CharacterId } from './types'
import { impliesBootlegger, parseScript, scriptAuthor, scriptCards, scriptCharacters, scriptFile, scriptHomebrew, scriptRules } from './scripts'

const meta = { id: '_meta', name: 'Test night', author: 'Us' }

const errorsOf = (json: unknown): readonly string[] => {
  const parsed = parseScript(json)
  return 'errors' in parsed ? parsed.errors : []
}

describe('parseScript', () => {
  test('official ids, in any spelling, and a named _meta make a script', () => {
    const parsed = parseScript([meta, 'imp', 'Fortune_Teller', { id: 'poisoner' }])
    expect(parsed).toEqual({ kind: 'custom', name: 'Test night', items: [meta, 'imp', 'fortuneteller', 'poisoner'] })
    if ('errors' in parsed) return
    expect(scriptCharacters(parsed)).toEqual(['imp', 'fortuneteller', 'poisoner'])
  })

  test('a web logo on _meta is kept, anything else is dropped', () => {
    const logo = 'https://example.invalid/logo.png'
    expect(parseScript([{ ...meta, logo }, 'imp'])).toEqual({ kind: 'custom', name: 'Test night', items: [{ ...meta, logo }, 'imp'] })
    expect(parseScript([{ ...meta, logo: 'javascript:alert(1)' }, 'imp'])).toEqual({ kind: 'custom', name: 'Test night', items: [meta, 'imp'] })
  })

  test('an official character written out in full is kept as its id', () => {
    const parsed = parseScript([
      meta,
      { id: 'imp', name: 'Imp', team: 'demon', ability: 'Each night*, choose a player: they die.', image: 'https://example.invalid/imp.png' },
    ])
    expect(parsed).toEqual({ kind: 'custom', name: 'Test night', items: [meta, 'imp'] })
  })

  test('a homebrew character keeps the schema\'s fields and drops an empty list', () => {
    const parsed = parseScript([
      meta,
      'imp',
      {
        id: 'Lamp_Lighter', name: 'Lamplighter', team: 'townsfolk', ability: 'You know things.', image: 'data:image/png;base64,AA',
        firstNight: 3, firstNightReminder: 'Show a finger.', otherNight: 0, reminders: ['Lit', 'Lit'], remindersGlobal: ['Dark'],
        setup: true, flavor: 'Light.', jinxes: [{ id: 'imp', reason: 'x' }], special: [],
      },
    ])
    expect(parsed).toEqual({
      kind: 'custom',
      name: 'Test night',
      items: [meta, 'imp', {
        id: 'lamplighter', name: 'Lamplighter', team: 'townsfolk', ability: 'You know things.', image: 'data:image/png;base64,AA',
        firstNight: 2, firstNightReminder: 'Show a finger.', otherNight: 0, reminders: ['Lit', 'Lit'], remindersGlobal: ['Dark'],
        setup: true, flavor: 'Light.', jinxes: [{ id: 'imp', reason: 'x' }],
      }],
    })
  })

  test('a homebrew character keeps its jinxes and other apps\' features as the schema writes them', () => {
    const parsed = parseScript([meta, {
      id: 'lamp', name: 'Lamp', team: 'outsider', ability: 'x', edition: 'mine',
      jinxes: [{ id: 'Scarlet_Woman', reason: 'The Lamp stays lit.' }, { id: 'imp' }, { id: 'spy', reason: ' ' }],
      special: [{ type: 'vote', name: 'multiplier', value: 3 }, { type: 'signal', name: 'card', value: 'Lit', time: 'night', extra: 1 }, { name: 'x' }],
    }])
    expect(parsed).toEqual({ kind: 'custom', name: 'Test night', items: [meta, {
      id: 'lamp', name: 'Lamp', team: 'outsider', ability: 'x', edition: 'mine',
      jinxes: [{ id: 'scarletwoman', reason: 'The Lamp stays lit.' }],
      special: [{ type: 'vote', name: 'multiplier', value: 3 }, { type: 'signal', name: 'card', value: 'Lit', time: 'night' }],
    }] })
  })

  test('a homebrew character\'s card signal is the one special feature read, as a card to show', () => {
    const parsed = parseScript([meta, 'imp', {
      id: 'Lamp', name: 'Lamp', team: 'outsider', ability: 'x',
      special: [{ type: 'vote', name: 'multiplier', value: 3 }, { type: 'signal', name: 'card', value: ' You are lit ' },
        { type: 'signal', name: 'card', value: 2 }, { type: 'signal', name: 'card', value: ' ' }],
    }, { id: 'wick', name: 'Wick', team: 'townsfolk', ability: 'x', special: [{ type: 'signal', name: 'grimoire' }] }])
    if ('errors' in parsed) throw new Error(parsed.errors.join())
    expect(scriptCards(parsed)).toEqual([{ character: 'lamp', text: 'You are lit' }])
    expect(scriptCards('tb')).toEqual([])
  })

  test('_meta keeps the Bootlegger\'s rules and the links and flags other apps use', () => {
    const full = {
      ...meta, logo: 'https://example.invalid/logo.png', almanac: 'https://example.invalid/almanac', background: 'https://example.invalid/bg.jpg',
      hideTitle: true, bootlegger: [' The Lamp may wake twice. ', '', 7, 'Nobody may whisper.'],
    }
    const parsed = parseScript([full, 'imp'])
    if ('errors' in parsed) throw new Error(parsed.errors.join())
    expect(parsed.items[0]).toEqual({ ...full, bootlegger: ['The Lamp may wake twice.', 'Nobody may whisper.'] })
    expect(scriptRules(parsed)).toEqual(['The Lamp may wake twice.', 'Nobody may whisper.'])
    expect(scriptRules('tb')).toEqual([])
    expect(parseScript([{ ...meta, almanac: 'file:///x', hideTitle: 'yes', bootlegger: 'one' }, 'imp'])).toEqual({ kind: 'custom', name: 'Test night', items: [meta, 'imp'] })
  })

  test('a homebrew field of the wrong type is dropped rather than refusing the file', () => {
    const parsed = parseScript([meta, { id: 'lamp', name: 'Lamp', team: 'outsider', ability: 'x', firstNight: 'early', reminders: [1], image: 7, setup: 'yes' }])
    expect(parsed).toEqual({ kind: 'custom', name: 'Test night', items: [meta, { id: 'lamp', name: 'Lamp', team: 'outsider', ability: 'x' }] })
  })

  test('an id the content does not know stays, for the version that knows it', () => {
    expect(parseScript([meta, 'imp', 'Night_Owl', { id: 'later' }])).toEqual({
      kind: 'custom', name: 'Test night', items: [meta, 'imp', 'nightowl', 'later'],
    })
    expect(errorsOf([meta, 'imp', '__'])).toEqual(['item 3: not a character id or an object with one'])
  })

  test('a Traveller from a file of before 2025 is spelt traveler', () => {
    const parsed = parseScript([meta, { id: 'drifter', name: 'Drifter', team: 'traveler', ability: 'You drift.' }])
    expect(parsed).toEqual({ kind: 'custom', name: 'Test night', items: [meta, { id: 'drifter', name: 'Drifter', team: 'traveller', ability: 'You drift.' }] })
  })

  test('a homebrew character missing a field is an error naming it', () => {
    expect(errorsOf([meta, { id: 'lamplighter', name: 'Lamplighter', team: 'townsfolk' }])).toEqual([
      'item 2: a homebrew character "lamplighter" needs id, name, team and ability',
    ])
    expect(errorsOf([meta, { id: 'lamplighter', name: 'Lamplighter', team: 'villager', ability: 'x' }])).toHaveLength(1)
  })

  test('an id with nothing the schema allows cannot name a homebrew character', () => {
    expect(errorsOf([meta, { id: '__', name: 'x', team: 'townsfolk', ability: 'x' }])).toEqual([
      'item 2: a homebrew character "__" needs id, name, team and ability',
    ])
  })

  test('the script must be an array with one named _meta', () => {
    expect(errorsOf({ id: '_meta', name: 'x' })).toEqual(['a script is a JSON array'])
    expect(errorsOf(['imp', 'poisoner'])).toEqual(['no _meta item names the script'])
    expect(errorsOf([{ id: '_meta' }, 'imp'])).toEqual(['item 1: _meta has no name', 'no _meta item names the script'])
    expect(errorsOf([meta, meta, 'imp'])).toEqual(['item 2: a second _meta'])
  })

  test('an item that is neither an id nor an object with one is an error', () => {
    expect(errorsOf([meta, 7, { name: 'x' }])).toEqual([
      'item 2: not a character id or an object with one',
      'item 3: not a character id or an object with one',
    ])
  })
})

describe('the Bootlegger', () => {
  const lamp = { id: 'lamp', name: 'Lamp', team: 'townsfolk', ability: 'x' } as const
  const script = (...items: readonly unknown[]) => ({ kind: 'custom', name: 'X', items: [{ id: '_meta', name: 'X' }, 'imp', ...items] }) as never

  test('comes with homebrew characters or rules, once, at the end', () => {
    expect(scriptCharacters(script(lamp))).toEqual(['imp', 'lamp', 'bootlegger'])
    expect(scriptCharacters({ kind: 'custom', name: 'X', items: [{ id: '_meta', name: 'X', bootlegger: ['A rule.'] }, 'imp'] })).toEqual(['imp', 'bootlegger'])
    expect(scriptCharacters(script('bootlegger', lamp))).toEqual(['imp', 'bootlegger', 'lamp'])
    expect(scriptCharacters(script('chef'))).toEqual(['imp', 'chef'])
    expect(impliesBootlegger('tb')).toBe(false)
  })
})

describe('reading a custom script', () => {
  const script = { kind: 'custom', name: 'Home', items: [
    { id: '_meta', name: 'Home', author: '  Ann ' }, 'imp', { id: 'thief' },
    { id: 'baker', name: 'Baker', team: 'outsider', ability: 'You bake.' },
  ] } as const

  test('its homebrew records are the objects with a team', () => {
    expect(scriptHomebrew(script).map((h) => h.id)).toEqual(['baker'])
    expect(scriptHomebrew('tb')).toEqual([])
  })

  test('its author is trimmed, and a blank one or an edition has none', () => {
    expect(scriptAuthor(script)).toBe('Ann')
    expect(scriptAuthor({ ...script, items: [{ id: '_meta', name: 'Home', author: ' ' }] })).toBeUndefined()
    expect(scriptAuthor('tb')).toBeUndefined()
  })
})

describe('night positions in a file', () => {
  const washerwoman = characters.get('washerwoman' as CharacterId)!.ordinals.first!
  const after = (firstNight: number, otherNight = 0) =>
    parseScript([meta, { id: 'lamp', name: 'Lamp', team: 'townsfolk', ability: 'x', firstNight, otherNight }])

  // The Script Tool numbers the official step at index i of the night sheet i + 1, so the
  // Washerwoman there is one more than here.
  test('are read the way the official Script Tool counts them, and written back the same', () => {
    const parsed = after(washerwoman + 1.5)
    if ('errors' in parsed) throw new Error(parsed.errors.join())
    expect(parsed.items[1]).toMatchObject({ firstNight: washerwoman + 0.5, otherNight: 0 })
    expect(scriptFile(parsed)[1]).toMatchObject({ firstNight: washerwoman + 1.5, otherNight: 0 })
    expect(parsed.items).toEqual((parseScript(scriptFile(parsed)) as typeof parsed).items)
  })

  test('a position at or before dusk still wakes, just after it', () => {
    expect(after(1)).toMatchObject({ items: [meta, { firstNight: 0.5 }] })
    expect(after(0.5)).toMatchObject({ items: [meta, { firstNight: 0.5 }] })
  })
})
