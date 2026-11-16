import type { Homebrew, Team } from '../../content'
import { asCharacterId, character, homebrewArt, homebrewCharacter, nightMarkers, t, teams } from '../../content'
import {
  anchorOf, canAddReminder, characterOf, characterProblem, draftOfCharacter, draftWake, imageForTeam, imageOf, imagesOf, limits, momentOf, moveBy, neighbours,
  nightMoments, nightSteps, scriptSteps, shownImage, teamWords, wakeOrdinal,
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
      firstNight: 'poisoner', firstNightReminder: ' Wake the Baker. ', otherNight: undefined, otherNightReminder: 'Dropped.', setup: true,
    }
    const poisoner = character(asCharacterId('poisoner')).ordinals.first!
    expect(characterOf(draft, 'bakerab12')).toEqual({
      id: 'bakerab12', name: 'Baker', team: 'outsider', ability: 'You bake.', reminders: ['Bread', 'Crumbs'],
      firstNight: poisoner + 0.5, firstNightAfter: 'poisoner', firstNightReminder: 'Wake the Baker.', setup: true,
    })
  })

  test('opens on the step a record wakes after, and reads an older record or kept draft by its number', () => {
    const poisoner = character(asCharacterId('poisoner')).ordinals.first!
    const base: Homebrew = { id: 'lamp', name: 'Lamp', team: 'minion', ability: 'x' }
    expect(draftOfCharacter({ ...base, firstNight: 3, firstNightAfter: 'poisoner' }).firstNight).toBe('poisoner')
    expect(draftOfCharacter({ ...base, firstNight: poisoner + 0.5 }).firstNight).toBe('poisoner')
    expect(draftOfCharacter({ ...base, firstNight: poisoner + 0.5, firstNightAfter: 'nobodyyet' }).firstNight).toBe('poisoner')
    expect(draftWake('first', poisoner + 0.5)).toBe('poisoner')
    expect(draftWake('first', 'poisoner')).toBe('poisoner')
    expect(draftWake('first', 0)).toBeUndefined()
  })

  test('keeps the schema\'s lengths', () => {
    const draft = { ...draftOfCharacter(), name: 'n'.repeat(40), ability: 'a'.repeat(300), reminders: ['r'.repeat(40)] }
    const saved = characterOf(draft, 'x')
    expect(saved.name).toHaveLength(limits.name)
    expect(saved.ability).toHaveLength(limits.ability)
    expect(saved.reminders?.[0]).toHaveLength(limits.reminder)
  })

  test('offers reminder tokens up to the schema\'s twenty and keeps a record that carries more', () => {
    expect(canAddReminder(Array.from({ length: limits.reminders - 1 }, () => 'r'))).toBe(true)
    expect(canAddReminder(Array.from({ length: limits.reminders }, () => 'r'))).toBe(false)
    const many = Array.from({ length: 25 }, (_, i) => `r${i}`)
    expect(canAddReminder(many)).toBe(false)
    expect(characterOf({ ...draftOfCharacter(), name: 'Baker', ability: 'x', reminders: many }, 'x').reminders).toEqual(many)
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
  const step = (id: string) => first.find((c) => c.key === id)!
  const ordinal = (night: 'first' | 'other', id: string) => character(asCharacterId(id)).ordinals[night]!
  // The step a moment wakes after, and the one after that.
  const around = (steps: typeof first, key: string) => {
    const at = steps.findIndex((c) => c.key === key)
    return [steps[at]!, steps[at + 1]] as const
  }

  test('the official order runs from dusk through the dawn announcements with every waking character in it', () => {
    expect(first[0]).toMatchObject({ key: 'dusk', ordinal: nightMarkers.first.dusk, marker: 'dusk', label: 'Dusk' })
    expect(first.find((c) => c.marker === 'dawn')).toMatchObject({ key: 'dawn', ordinal: nightMarkers.first.dawn })
    expect(first.at(-1)?.ordinal).toBeGreaterThan(nightMarkers.first.dawn)
    expect(step('poisoner')).toMatchObject({ ordinal: ordinal('first', 'poisoner'), label: 'Poisoner', id: 'poisoner', edition: 'tb' })
    expect(first.every((c, i) => i === 0 || first[i - 1]!.ordinal < c.ordinal)).toBe(true)
  })

  test('placed after a step, it sorts between that step and the next, as the sheets read it', () => {
    const poisoner = step('poisoner')
    const next = first[first.indexOf(poisoner) + 1]!
    const record = characterOf({ ...draftOfCharacter(), name: 'Lamp', ability: 'x', firstNight: 'poisoner' }, 'lamp')
    const wake = homebrewCharacter(record).ordinals.first!
    expect(wake).toBe(wakeOrdinal(first, 'poisoner'))
    expect(poisoner.ordinal < wake && wake < next.ordinal).toBe(true)
    expect(anchorOf(first, wake)).toBe(poisoner)
    expect(neighbours(first, wake)).toEqual({ before: poisoner, next })
  })

  test('moves one step at a time, from just after dusk to the very end', () => {
    const at = (key: string) => wakeOrdinal(first, key)
    const i = first.indexOf(step('poisoner'))
    expect(moveBy(first, at('poisoner'), 'poisoner', 1)).toBe(first[i + 1]!.key)
    expect(moveBy(first, at('poisoner'), 'poisoner', -1)).toBe(first[i - 1]!.key)
    expect(moveBy(first, at('dusk'), 'dusk', -1)).toBe('dusk')
    const last = first.at(-1)!.key
    expect(moveBy(first, at(last), last, 1)).toBe(last)
  })

  test('moves among the steps shown when a filter hides others, and up to the shown step first', () => {
    const tb = first.filter((c) => c.marker !== undefined || c.edition === 'tb')
    const poisoner = step('poisoner')
    expect(moveBy(tb, wakeOrdinal(first, 'poisoner'), 'poisoner', 1)).toBe(tb[tb.indexOf(poisoner) + 1]!.key)
    // The Angel wakes just after dusk and is no Trouble Brewing character.
    expect(first[1]!.key).toBe('angel')
    expect(anchorOf(tb, wakeOrdinal(first, 'angel'))?.key).toBe('dusk')
    expect(moveBy(tb, wakeOrdinal(first, 'angel'), 'angel', -1)).toBe('dusk')
  })

  test('a script\'s order keeps its own characters and every marker', () => {
    const own = scriptSteps(other, new Set(['monk', 'imp', 'empath']))
    expect(own.map((c) => c.key)).toEqual(['dusk', 'monk', 'imp', 'empath', 'dawn'])
    const before = nightMoments(other, 'other', 'townsfolk').find((m) => m.key === 'beforeDemon')!
    expect(neighbours(own, wakeOrdinal(other, before.after))).toMatchObject({ before: { key: 'monk' }, next: { key: 'imp' } })
  })

  test('the first night wakes before the evil team, after it, or for information before the night is counted', () => {
    const moments = nightMoments(first, 'first', 'townsfolk')
    expect(moments.map((m) => m.key)).toEqual(['beforeEvil', 'afterEvil', 'information'])
    const [before, afterEvil, information] = moments.map((m) => around(first, m.after))
    expect(before![0].key).toBe('dusk')
    expect(before![1]!.ordinal).toBeLessThanOrEqual(ordinal('first', 'philosopher'))
    expect(afterEvil![0].marker).toBe('demonInfo')
    expect(afterEvil![1]!.ordinal).toBeLessThan(ordinal('first', 'poisoner'))
    expect(information![1]?.key).toBe('chambermaid')
    expect(information![0].ordinal).toBeGreaterThan(ordinal('first', 'washerwoman'))
    expect(information![0].ordinal).toBeLessThan(ordinal('first', 'mathematician'))
  })

  test('the other nights wake at the start, around the Demons, or for information before the night is counted', () => {
    const moments = nightMoments(other, 'other', 'townsfolk')
    expect(moments.map((m) => m.key)).toEqual(['start', 'beforeDemon', 'afterDemon', 'information'])
    const [start, before, afterDemon, information] = moments.map((m) => around(other, m.after))
    expect(start![0].key).toBe('dusk')
    expect(start![1]!.ordinal).toBeLessThan(ordinal('other', 'poisoner'))
    expect(before![0].ordinal).toBeGreaterThan(ordinal('other', 'monk'))
    expect(before![0].team).not.toBe('demon')
    expect(before![1]?.team).toBe('demon')
    for (const demon of ['imp', 'nodashii', 'vigormortis']) {
      expect(before![0].ordinal).toBeLessThan(ordinal('other', demon))
      expect(afterDemon![0].ordinal).toBeGreaterThanOrEqual(ordinal('other', demon))
    }
    expect(afterDemon![0].team).toBe('demon')
    expect(afterDemon![1]!.ordinal).toBeLessThanOrEqual(ordinal('other', 'assassin'))
    expect(information![1]?.key).toBe('chambermaid')
    expect(information![0].ordinal).toBeGreaterThan(ordinal('other', 'undertaker'))
  })

  test('a Demon wakes as the Demon, among the others, in place of before them', () => {
    const moments = nightMoments(other, 'other', 'demon')
    expect(moments.map((m) => m.key)).toEqual(['start', 'demon', 'afterDemon', 'information'])
    expect(moments[1]!.after).toBe('imp')
    expect(nightMoments(first, 'first', 'demon').map((m) => m.key)).toEqual(['beforeEvil', 'afterEvil', 'information'])
  })

  test('a wake reads as its moment only when it is after that very step', () => {
    const moments = nightMoments(first, 'first', 'townsfolk')
    expect(momentOf(moments, 'demoninfo')?.key).toBe('afterEvil')
    expect(momentOf(moments, 'king')).toBeUndefined()
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
