import type { Homebrew } from './index'
import { asCharacterId, character, gameText, homebrewArt, homebrewVersion, registerHomebrew, subscribeHomebrew } from './index'

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
