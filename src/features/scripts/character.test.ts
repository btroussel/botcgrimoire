import type { Homebrew, Team } from '../../content'
import { asCharacterId, character, homebrewArt, nightMarkers, t, teams } from '../../content'
import {
  after, anchorOf, characterOf, characterProblem, draftOfCharacter, imageForTeam, imageOf, imagesOf, limits, momentOf, moveBy, nightMoments, nightSteps,
  shownImage, teamWords,
} from './character'
import { fitWithin, hasTransparency, visibleBounds } from './image'

const markers = { dusk: 'Dusk', minionInfo: 'Minion info', demonInfo: 'Demon info', dawn: 'Dawn' }

describe('the character draft', () => {
  test('a new one is a nameless Townsfolk that never wakes', () => {
    const draft = draftOfCharacter()
    expect(draft).toMatchObject({ name: '', team: 'townsfolk', ability: '', reminders: [], firstNight: undefined, otherNight: undefined, setup: false })
    expect(characterProblem(draft)).toBe('characterNameNeeded')
    expect(characterProblem({ ...draft, name: 'Baker' })).toBe('abilityNeeded')
    expect(characterProblem({ ...draft, name: 'Baker', ability: 'You bake.' })).toBeUndefined()
  })

  test('saves trimmed, drops blank reminder tokens, and keeps only the instructions of nights it wakes on', () => {
    const draft = {
      ...draftOfCharacter(), name: ' Baker ', ability: ' You bake. ', team: 'outsider' as const, reminders: ['Bread', '', '  Crumbs ', ' '],
      firstNight: 12.5, firstNightReminder: ' Wake the Baker. ', otherNight: undefined, otherNightReminder: 'Dropped.', setup: true,
    }
    expect(characterOf(draft, 'bakerab12')).toEqual({
      id: 'bakerab12', name: 'Baker', team: 'outsider', ability: 'You bake.', reminders: ['Bread', 'Crumbs'],
      firstNight: 12.5, firstNightReminder: 'Wake the Baker.', setup: true,
    })
  })

  test('keeps the schema\'s lengths', () => {
    const draft = { ...draftOfCharacter(), name: 'n'.repeat(40), ability: 'a'.repeat(300), reminders: ['r'.repeat(40)] }
    const saved = characterOf(draft, 'x')
    expect(saved.name).toHaveLength(limits.name)
    expect(saved.ability).toHaveLength(limits.ability)
    expect(saved.reminders?.[0]).toHaveLength(limits.reminder)
  })

  test('editing a record keeps what the form does not show and drops a removed image', () => {
    const kept = { jinxes: [{ id: 'imp', reason: 'x' }], special: [{ type: 'vote', name: 'hidden' }], edition: 'mine' }
    const base: Homebrew = { id: 'lamp', name: 'Lamp', team: 'minion', ability: 'x', flavor: 'Light.', remindersGlobal: ['Dark'], image: 'data:image/png;base64,AA', otherNight: -1, ...kept }
    const draft = draftOfCharacter(base)
    expect(draft.otherNight).toBeUndefined()
    expect(characterOf(draft, 'lamp', base)).toEqual({ id: 'lamp', name: 'Lamp', team: 'minion', ability: 'x', flavor: 'Light.', remindersGlobal: ['Dark'], image: 'data:image/png;base64,AA', ...kept })
    expect(characterOf({ ...draft, image: undefined }, 'lamp', base).image).toBeUndefined()
  })

  test('shows only an embedded image', () => {
    expect(shownImage('data:image/png;base64,AA')).toBe('data:image/png;base64,AA')
    expect(shownImage(['data:image/png;base64,BB', 'x'])).toBe('data:image/png;base64,BB')
    expect(shownImage('https://example.invalid/a.png')).toBeUndefined()
    expect(shownImage(undefined)).toBeUndefined()
  })

  const [main, flipped] = ['data:image/png;base64,AA', 'data:image/png;base64,BB']

  test('writes the flipped image where the board draws it on the other side', () => {
    const record = (team: Team): Homebrew => ({ id: 'lamp', name: 'Lamp', team, ability: 'x', image: imageOf({ main, flipped }, team)! })
    expect(homebrewArt(record('townsfolk'))).toEqual({ good: { uri: main }, evil: { uri: flipped } })
    expect(homebrewArt(record('demon'))).toEqual({ evil: { uri: main }, good: { uri: flipped } })
    expect(homebrewArt(record('traveller'))).toMatchObject({ good: { uri: main }, evil: { uri: flipped } })
    expect(imageOf({ main }, 'townsfolk')).toBe(main)
    expect(imageOf({}, 'townsfolk')).toBeUndefined()
  })

  test('reads back the images it wrote, and an imported Traveller\'s good and evil ones', () => {
    for (const team of teams) expect(imagesOf(imageOf({ main, flipped }, team), team)).toEqual({ main, flipped })
    expect(imagesOf(main, 'traveller')).toEqual({ main })
    expect(imagesOf(['u', 'g', 'e'], 'traveller')).toEqual({ main: 'g', flipped: 'e' })
    expect(imagesOf(['', 'x'], 'townsfolk')).toEqual({})
    expect(imagesOf(undefined, 'townsfolk')).toEqual({})
  })

  test('a team change keeps the main image the main one', () => {
    const pair = imageOf({ main, flipped }, 'townsfolk')
    expect(imageForTeam(pair, 'townsfolk', 'minion')).toBe(pair)
    expect(imageForTeam(pair, 'townsfolk', 'traveller')).toEqual([main, main, flipped])
    expect(imageForTeam([main, main, flipped], 'traveller', 'outsider')).toEqual([main, flipped])
    expect(imageForTeam(main, 'townsfolk', 'traveller')).toBe(main)
  })

  test('names its team in the singular', () => {
    expect(teamWords((key) => t('en', key))).toEqual({
      townsfolk: 'Townsfolk', outsider: 'Outsider', minion: 'Minion', demon: 'Demon', traveller: 'Traveller', fabled: 'Fabled', loric: 'Loric',
    })
  })
})

describe('where a homebrew character wakes', () => {
  const first = nightSteps('first', 'en', markers)
  const other = nightSteps('other', 'en', markers)
  const step = (id: string) => first.find((c) => c.id === id)!

  test('the official order runs from dusk through the dawn announcements with every waking character in it', () => {
    expect(first[0]).toMatchObject({ ordinal: nightMarkers.first.dusk, marker: 'dusk', label: 'Dusk' })
    expect(first.find((c) => c.marker === 'dawn')?.ordinal).toBe(nightMarkers.first.dawn)
    expect(first.at(-1)?.ordinal).toBeGreaterThan(nightMarkers.first.dawn)
    expect(step('poisoner')).toMatchObject({ ordinal: character(asCharacterId('poisoner')).ordinals.first, label: 'Poisoner', edition: 'tb' })
    expect(first.every((c, i) => i === 0 || first[i - 1]!.ordinal < c.ordinal)).toBe(true)
  })

  test('placed after a step, it sorts between that step and the next', () => {
    const poisoner = step('poisoner')
    const next = first[first.indexOf(poisoner) + 1]!
    expect(poisoner.ordinal < after(poisoner) && after(poisoner) < next.ordinal).toBe(true)
    expect(anchorOf(first, after(poisoner))).toBe(poisoner)
    expect(anchorOf(first, poisoner.ordinal + 0.9)).toBe(poisoner)
  })

  test('moves one step at a time, from just after dusk to the very end', () => {
    const poisoner = step('poisoner')
    const i = first.indexOf(poisoner)
    expect(moveBy(first, after(poisoner), 1)).toBe(after(first[i + 1]!))
    expect(moveBy(first, after(poisoner), -1)).toBe(after(first[i - 1]!))
    expect(moveBy(first, after(first[0]!), -1)).toBe(after(first[0]!))
    const last = first.at(-1)!
    expect(moveBy(first, after(last), 1)).toBe(after(last))
  })

  test('moves among the steps shown when a filter hides others', () => {
    const tb = first.filter((c) => c.marker !== undefined || c.edition === 'tb')
    const poisoner = step('poisoner')
    const nextShown = tb[tb.indexOf(poisoner) + 1]!
    expect(moveBy(tb, after(poisoner), 1)).toBe(after(nextShown))
  })

  test('the first night wakes before the evil team, after it, or for information just before dawn', () => {
    const at = (position: number) => anchorOf(first, position)
    const moments = nightMoments(first, 'first', 'townsfolk')
    expect(moments.map((m) => m.key)).toEqual(['beforeEvil', 'afterEvil', 'information'])
    const [before, afterEvil, information] = moments.map((m) => m.position)
    expect(before!).toBeLessThan(nightMarkers.first.minionInfo)
    expect(before!).toBeLessThan(character(asCharacterId('philosopher')).ordinals.first!)
    expect(at(afterEvil!)?.marker).toBe('demonInfo')
    expect(afterEvil!).toBeLessThan(character(asCharacterId('poisoner')).ordinals.first!)
    expect(first[first.indexOf(at(information!)!) + 1]?.marker).toBe('dawn')
    expect(information!).toBeGreaterThan(character(asCharacterId('washerwoman')).ordinals.first!)
  })

  test('the other nights wake around the Demons, whose run the Monk wakes before and the Assassin after', () => {
    const at = (position: number) => anchorOf(other, position)
    const moments = nightMoments(other, 'other', 'townsfolk')
    expect(moments.map((m) => m.key)).toEqual(['beforeDemon', 'afterDemon', 'information'])
    const [before, afterDemon, information] = moments.map((m) => m.position)
    const ordinal = (id: string) => character(asCharacterId(id)).ordinals.other!
    expect(before!).toBeGreaterThan(ordinal('monk'))
    expect(other[other.indexOf(at(before!)!) + 1]?.team).toBe('demon')
    expect(at(before!)?.team).not.toBe('demon')
    for (const demon of ['imp', 'nodashii', 'vigormortis']) {
      expect(before!).toBeLessThan(ordinal(demon))
      expect(afterDemon!).toBeGreaterThan(ordinal(demon))
    }
    expect(at(afterDemon!)?.team).toBe('demon')
    expect(afterDemon!).toBeLessThan(ordinal('assassin'))
    expect(other[other.indexOf(at(information!)!) + 1]?.marker).toBe('dawn')
    expect(information!).toBeGreaterThan(ordinal('undertaker'))
  })

  test('a Demon wakes as the Demon, among the others, in place of before them', () => {
    const moments = nightMoments(other, 'other', 'demon')
    expect(moments.map((m) => m.key)).toEqual(['demon', 'afterDemon', 'information'])
    expect(anchorOf(other, moments[0]!.position)?.id).toBe('imp')
    expect(nightMoments(first, 'first', 'demon').map((m) => m.key)).toEqual(['beforeEvil', 'afterEvil', 'information'])
  })

  test('a position reads as its moment only when it is exactly that moment', () => {
    const moments = nightMoments(first, 'first', 'townsfolk')
    expect(momentOf(moments, moments[1]!.position)?.key).toBe('afterEvil')
    expect(momentOf(moments, moments[1]!.position + 1)).toBeUndefined()
    expect(momentOf(moments, undefined)).toBeUndefined()
  })
})

describe('the icon made from an image', () => {
  // A 4 by 3 image with two visible pixels, at (1, 0) and (2, 2).
  const alpha = [0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 255, 0]

  test('crops to the pixels that are not fully transparent', () => {
    expect(visibleBounds((i) => alpha[i]!, 4, 3)).toEqual({ x: 1, y: 0, width: 2, height: 3 })
    expect(visibleBounds(() => 0, 4, 3)).toBeUndefined()
  })

  test('a photo has no transparency to crop to', () => {
    expect(hasTransparency((i) => alpha[i]!, 12)).toBe(true)
    expect(hasTransparency(() => 255, 12)).toBe(false)
  })

  test('fits the icon size without enlarging a small image', () => {
    expect(fitWithin(1000, 500, 288)).toEqual({ width: 288, height: 144 })
    expect(fitWithin(100, 50, 288)).toEqual({ width: 100, height: 50 })
  })
})
