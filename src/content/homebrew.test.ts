import type { Homebrew } from './index'
import { asCharacterId, character, gameText, homebrewArt, homebrewVersion, homebrewWake, registerHomebrew, subscribeHomebrew, wakeJustAfter } from './index'

const lamp: Homebrew = {
  id: 'lampx1',
  name: 'Lamplighter',
  team: 'minion',
  ability: 'Each night, choose a player.',
  image: 'data:image/webp;base64,AA',
  firstNight: 20.5,
  firstNightReminder: 'The Lamplighter points.',
  otherNight: 0,
  otherNightReminder: 'Never read.',
  reminders: ['Lit', 'Lit'],
  remindersGlobal: ['Dark'],
  setup: true,
}

afterEach(() => registerHomebrew([]))

describe('a registered homebrew character', () => {
  test('reads through the bundled lookup, with its tokens counted and only its waking nights', () => {
    registerHomebrew([lamp])
    expect(character(asCharacterId('lampx1'))).toEqual({
      id: 'lampx1', team: 'minion', edition: 'homebrew', name: 'Lamplighter', ability: 'Each night, choose a player.',
      firstNightReminder: 'The Lamplighter points.', setupFlag: true, ordinals: { first: 20.5 },
      reminders: [{ name: 'Lit', count: 2, global: false }, { name: 'Dark', count: 1, global: true }],
    })
  })

  test('wakes after its step wherever the sheet has moved it, and at its number once the sheet has no such step', () => {
    const poisoner = character(asCharacterId('poisoner')).ordinals.first!
    registerHomebrew([{ ...lamp, firstNight: 3.5, firstNightAfter: 'poisoner' }])
    expect(character(asCharacterId('lampx1')).ordinals).toEqual({ first: poisoner + 0.5 })
    registerHomebrew([{ ...lamp, firstNight: 3.5, firstNightAfter: 'retired' }])
    expect(character(asCharacterId('lampx1')).ordinals).toEqual({ first: 3.5 })
  })

  test('keeps its place among the homebrew characters after the same step, read from the fraction a sync leaves alone', () => {
    const poisoner = character(asCharacterId('poisoner')).ordinals.first!
    // Saved when the Poisoner was the third step, read on a sheet where it is later.
    expect(homebrewWake({ ...lamp, firstNight: 3.25, firstNightAfter: 'poisoner' }, 'first')).toBe(poisoner + 0.25)
    expect(homebrewWake({ ...lamp, firstNight: 3.75, firstNightAfter: 'poisoner' }, 'first')).toBe(poisoner + 0.75)
    // Another tool's whole number names a step's own slot, and sits mid-gap as before.
    expect(homebrewWake({ ...lamp, firstNight: 3, firstNightAfter: 'poisoner' }, 'first')).toBe(poisoner + 0.5)
  })

  test('placed just after a step or another homebrew character, it wakes halfway to whatever wakes next', () => {
    const poisoner = character(asCharacterId('poisoner')).ordinals.first!
    const at = (firstNight: number, id = 'x'): Homebrew => ({ ...lamp, id, firstNight, firstNightAfter: 'poisoner' })
    expect(wakeJustAfter('first', 'poisoner', [])).toBe(poisoner + 0.5)
    expect(wakeJustAfter('first', 'poisoner', [at(poisoner + 0.5)])).toBe(poisoner + 0.25)
    expect(wakeJustAfter('first', 'x', [at(poisoner + 0.5)])).toBe(poisoner + 0.75)
    expect(wakeJustAfter('first', 'x', [at(poisoner + 0.5), at(poisoner + 0.75, 'y')])).toBe(poisoner + 0.625)
    // One after another step is not in the way, and an id nobody has places nothing.
    expect(wakeJustAfter('first', 'poisoner', [{ ...lamp, firstNight: 0.5, firstNightAfter: 'dusk' }])).toBe(poisoner + 0.5)
    expect(wakeJustAfter('first', 'gone', [at(poisoner + 0.5)])).toBeUndefined()
  })

  test('speaks its author\'s words in every locale', () => {
    registerHomebrew([lamp])
    for (const locale of ['en', 'fr'] as const) {
      expect(gameText(locale).role(asCharacterId('lampx1'))).toEqual({
        name: 'Lamplighter', ability: 'Each night, choose a player.', firstNight: 'The Lamplighter points.', otherNight: 'Never read.',
      })
    }
  })

  test('never shadows a bundled character, and an unknown id keeps its fallback', () => {
    registerHomebrew([{ ...lamp, id: 'imp', name: 'Fake Imp' }])
    expect(character(asCharacterId('imp')).name).toBe('Imp')
    expect(gameText('en').role(asCharacterId('imp')).name).toBe('Imp')
    expect(character(asCharacterId('nobody'))).toMatchObject({ name: 'nobody', edition: 'unknown' })
  })

  test('the later record of an id wins, and only a change notifies', () => {
    const heard: number[] = []
    const stop = subscribeHomebrew(() => heard.push(homebrewVersion()))
    const list = [lamp, { ...lamp, name: 'Second' }]
    registerHomebrew(list)
    registerHomebrew([...list])
    expect(character(asCharacterId('lampx1')).name).toBe('Second')
    expect(heard).toHaveLength(1)
    registerHomebrew([lamp])
    expect(heard).toHaveLength(2)
    stop()
  })
})

describe('homebrew art', () => {
  test('a single embedded image serves both sides', () => {
    expect(homebrewArt(lamp)).toEqual({ single: { uri: 'data:image/webp;base64,AA' } })
  })

  test('a web address is kept in the record but never drawn', () => {
    expect(homebrewArt({ ...lamp, image: 'https://example.invalid/lamp.png' })).toBeUndefined()
    expect(homebrewArt({ id: 'plain', name: 'Plain', team: 'townsfolk', ability: 'None.' })).toBeUndefined()
  })

  test('the schema\'s set is the usual side then the flipped one, or unaligned, good and evil for a Traveller', () => {
    const [a, b, c] = ['data:image/png;base64,A', 'data:image/png;base64,B', 'data:image/png;base64,C']
    expect(homebrewArt({ ...lamp, image: [a!, b!] })).toEqual({ evil: { uri: a }, good: { uri: b } })
    expect(homebrewArt({ ...lamp, team: 'townsfolk', image: [a!, b!] })).toEqual({ good: { uri: a }, evil: { uri: b } })
    expect(homebrewArt({ ...lamp, team: 'traveller', image: [a!, b!, c!] })).toEqual({ single: { uri: a }, good: { uri: b }, evil: { uri: c } })
  })
})
