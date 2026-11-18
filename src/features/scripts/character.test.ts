import type { Homebrew, Team } from '../../content'
import { asCharacterId, character, homebrewArt, homebrewCharacter, homebrewWake, nightMarkers, t, teams, wakeJustAfter } from '../../content'
import {
  anchorOf, canAddReminder, characterOf, characterProblem, draftOfCharacter, draftWake, imageForTeam, imageOf, imagesOf, limits, momentOf, momentPlace, moveBy,
  neighbours, nightMoments, nightSteps, placeOf, scriptSteps, shownImage, teamWords, wakeOrdinal, withHomebrew,
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

  test('jinxes with one character, and waits for the reason before saving', () => {
    const draft = { ...draftOfCharacter(), name: 'Lamp', ability: 'x' }
    expect(draft).toMatchObject({ jinxWith: undefined, jinxReason: '' })
    expect(characterOf(draft, 'lamp').jinxes).toBeUndefined()
    const jinxed = { ...draft, jinxWith: 'spy', jinxReason: ' The Spy sees the lamp. ' }
    expect(characterProblem({ ...jinxed, jinxReason: ' ' })).toBe('jinxReasonNeeded')
    expect(characterProblem(jinxed)).toBeUndefined()
    expect(characterOf(jinxed, 'lamp').jinxes).toEqual([{ id: 'spy', reason: 'The Spy sees the lamp.' }])
    expect(characterOf({ ...jinxed, jinxReason: 'r'.repeat(600) }, 'lamp').jinxes?.[0]?.reason).toHaveLength(limits.jinx)
    // A reason typed and then left with no character says nothing.
    expect(characterOf({ ...jinxed, jinxWith: undefined }, 'lamp').jinxes).toBeUndefined()
  })

  test('edits the first jinx of an imported record and keeps the others behind it', () => {
    const base: Homebrew = { id: 'lamp', name: 'Lamp', team: 'minion', ability: 'x', jinxes: [{ id: 'spy', reason: 'a' }, { id: 'imp', reason: 'b' }] }
    const draft = draftOfCharacter(base)
    expect(draft).toMatchObject({ jinxWith: 'spy', jinxReason: 'a' })
    expect(characterOf({ ...draft, jinxWith: 'baron' }, 'lamp', base).jinxes).toEqual([{ id: 'baron', reason: 'a' }, { id: 'imp', reason: 'b' }])
    expect(characterOf({ ...draft, jinxWith: 'imp', jinxReason: 'c' }, 'lamp', base).jinxes).toEqual([{ id: 'imp', reason: 'c' }])
    expect(characterOf({ ...draft, jinxWith: undefined }, 'lamp', base).jinxes).toEqual([{ id: 'imp', reason: 'b' }])
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

describe('a homebrew character placed after another on its script', () => {
  const first = nightSteps('first', 'en', markers)
  const record = (id: string, team: Team, firstNight: number): Homebrew =>
    ({ id, name: id, team, ability: 'x', firstNight, firstNightAfter: 'dusk' })
  // A script of nothing but homebrew, as the composer lists it: the Outsider before the Minions.
  // The Outsider and the first Minion were given the moment before the evil team at the same
  // place, so they tie and the Outsider wakes first; the second Minion was placed after the first.
  const owl = record('owl', 'outsider', 0.5)
  const hex = record('hex', 'minion', 0.5)
  const jinn = record('jinn', 'minion', 0.75)
  const script = [owl, hex, jinn]
  const ids = new Set(script.map((h) => h.id))
  const wake = (h: Homebrew) => homebrewWake(h, 'first')!
  const poisoner = first.find((c) => c.key === 'poisoner')!.ordinal

  test('the column holds the script\'s other homebrew characters at their places, but not the one being placed', () => {
    const order = withHomebrew(first, 'first', script, 'owl')
    expect(scriptSteps(order, ids).map((step) => step.key)).toEqual(['dusk', 'hex', 'jinn', 'minioninfo', 'demoninfo', 'dawn'])
    expect(order.find((step) => step.key === 'hex')).toMatchObject({ label: 'hex', id: 'hex', team: 'minion', homebrew: true, ordinal: 0.5 })
    expect(withHomebrew(first, 'first', [])).toBe(first)
  })

  test('an Outsider tapped onto a Minion wakes just after it, before whatever came next', () => {
    const afterJinn = characterOf({ ...draftOfCharacter(owl, script), firstNight: 'jinn' }, 'owl', owl, script)
    expect(afterJinn).toMatchObject({ firstNight: 0.875, firstNightAfter: 'dusk' })
    const afterHex = characterOf({ ...draftOfCharacter(owl, script), firstNight: 'hex' }, 'owl', owl, script)
    expect(wake(hex) < wake(afterHex) && wake(afterHex) < wake(jinn)).toBe(true)
    // Tapping a step puts it directly under the step, ahead of the homebrew characters there.
    const afterDusk = characterOf({ ...draftOfCharacter(owl, script), firstNight: 'dusk' }, 'owl', owl, [hex, jinn])
    expect(wake(afterDusk)).toBe(0.25)
    // The column and the saved record agree on the place.
    const order = withHomebrew(first, 'first', script, 'owl')
    expect(wakeOrdinal(order, 'hex')).toBe(wake(afterHex))
    expect(wakeJustAfter('first', 'hex', [hex, jinn])).toBe(wake(afterHex))
  })

  test('opens on the row it wakes under, and two saved at one place read in the script\'s order', () => {
    const between = { ...owl, firstNight: 0.625 }
    expect(draftOfCharacter(between, [between, hex, jinn]).firstNight).toBe('hex')
    expect(draftOfCharacter(owl, script).firstNight).toBe('dusk')
    const tied = { ...jinn, firstNight: 0.5 }
    expect(draftOfCharacter(tied, [owl, hex, tied]).firstNight).toBe('hex')
    expect(draftOfCharacter(hex, [owl, hex, tied]).firstNight).toBe('owl')
    // Without the script, only the sheet's steps are rows.
    expect(draftOfCharacter(between).firstNight).toBe('dusk')
  })

  test('keeps its place when saved without moving, even from the list where the others are not shown', () => {
    const between = { ...owl, firstNight: 0.625 }
    expect(characterOf(draftOfCharacter(between), 'owl', between).firstNight).toBe(0.625)
    expect(characterOf(draftOfCharacter(between, script), 'owl', between, script).firstNight).toBe(0.625)
    // An anchor the script no longer has leaves it where it was.
    expect(characterOf({ ...draftOfCharacter(between), firstNight: 'gone' }, 'owl', between).firstNight).toBe(0.625)
    // Moved from the list, it wakes after the step as it always has.
    expect(characterOf({ ...draftOfCharacter(between), firstNight: 'poisoner' }, 'owl', between))
      .toMatchObject({ firstNight: poisoner + 0.5, firstNightAfter: 'poisoner' })
  })

  test('the arrows walk through the homebrew rows like any step', () => {
    const order = scriptSteps(withHomebrew(first, 'first', script, 'owl'), ids)
    const at = wakeOrdinal(order, 'hex')
    expect(placeOf(order, at, 'hex')?.key).toBe('hex')
    expect(moveBy(order, at, 'hex', 1)).toBe('jinn')
    expect(moveBy(order, at, 'hex', -1)).toBe('dusk')
    expect(moveBy(order, wakeOrdinal(order, 'dusk'), 'dusk', 1)).toBe('hex')
  })

  test('waking after a homebrew character at a moment is that moment, and choosing a moment joins the others there last', () => {
    const order = withHomebrew(first, 'first', script, 'owl')
    const moments = nightMoments(first, 'first', 'outsider')
    expect(momentOf(moments, 'jinn', order)?.key).toBe('beforeEvil')
    expect(momentOf(moments, 'dusk', order)?.key).toBe('beforeEvil')
    expect(momentPlace(order, 'dusk')).toBe('jinn')
    expect(momentPlace(order, 'demoninfo')).toBe('demoninfo')
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
