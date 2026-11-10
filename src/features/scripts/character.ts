// A homebrew character being written (docs/app.md, Scripts): the form's draft, the record it
// saves as, and where on each night sheet it wakes. Pure, no React; the editor draws it.
import type { CharacterId, Homebrew, Locale, NightMarker, Team, Translate } from '../../content'
import { characters, demonNight, gameText, nightMarkers } from '../../content'

// A team in the singular, as the editor's tiles and the list of characters name it.
export const teamWords = (t: Translate): Readonly<Record<Team, string>> => ({
  townsfolk: t('scripts.townsfolkOne'), outsider: t('scripts.outsiderOne'), minion: t('scripts.minionOne'),
  demon: t('scripts.demon'), traveller: t('scripts.travellerOne'), fabled: t('scripts.fabled'), loric: t('scripts.loric'),
})

// The schema's limits, so a saved file stays valid for every other tool. `reminders` counts tokens.
export const limits = { name: 30, ability: 250, reminder: 30, instruction: 500, reminders: 20 } as const

// The editor offers another reminder token only below the schema's count. A record that already
// carries more keeps them all: only adding stops.
export const canAddReminder = (reminders: readonly string[]): boolean => reminders.length < limits.reminders

export interface CharacterDraft {
  readonly name: string
  readonly team: Team
  readonly ability: string
  readonly image: Homebrew['image'] // undefined for the team icon
  readonly reminders: readonly string[] // one per token, as typed; blank ones are dropped on save
  readonly firstNight: number | undefined // undefined when it does not wake
  readonly firstNightReminder: string
  readonly otherNight: number | undefined
  readonly otherNightReminder: string
  readonly setup: boolean
}

export const draftOfCharacter = (h?: Homebrew): CharacterDraft => ({
  name: h?.name ?? '',
  team: h?.team ?? 'townsfolk',
  ability: h?.ability ?? '',
  image: h?.image,
  reminders: h?.reminders ?? [],
  firstNight: h?.firstNight !== undefined && h.firstNight > 0 ? h.firstNight : undefined,
  firstNightReminder: h?.firstNightReminder ?? '',
  otherNight: h?.otherNight !== undefined && h.otherNight > 0 ? h.otherNight : undefined,
  otherNightReminder: h?.otherNightReminder ?? '',
  setup: h?.setup === true,
})

export type CharacterProblem = 'characterNameNeeded' | 'abilityNeeded'

export const characterProblem = (draft: CharacterDraft): CharacterProblem | undefined =>
  draft.name.trim() === '' ? 'characterNameNeeded' : draft.ability.trim() === '' ? 'abilityNeeded' : undefined

// The record a draft saves as. Fields the form does not edit, such as flavor text, global
// reminders or jinxes from an imported file, survive from the record it started from. An
// instruction for a night the character does not wake on is dropped with the position.
export const characterOf = (draft: CharacterDraft, id: string, base?: Homebrew): Homebrew => {
  const reminders = draft.reminders.map((r) => r.trim().slice(0, limits.reminder)).filter((r) => r !== '')
  const firstNightReminder = draft.firstNightReminder.trim()
  const otherNightReminder = draft.otherNightReminder.trim()
  return {
    id,
    name: draft.name.trim().slice(0, limits.name),
    team: draft.team,
    ability: draft.ability.trim().slice(0, limits.ability),
    ...(draft.image !== undefined ? { image: draft.image } : {}),
    ...(draft.firstNight !== undefined ? { firstNight: draft.firstNight } : {}),
    ...(draft.firstNight !== undefined && firstNightReminder !== '' ? { firstNightReminder } : {}),
    ...(draft.otherNight !== undefined ? { otherNight: draft.otherNight } : {}),
    ...(draft.otherNight !== undefined && otherNightReminder !== '' ? { otherNightReminder } : {}),
    ...(reminders.length > 0 ? { reminders } : {}),
    ...(base?.remindersGlobal ? { remindersGlobal: base.remindersGlobal } : {}),
    ...(base?.flavor ? { flavor: base.flavor } : {}),
    ...(draft.setup ? { setup: true } : {}),
    ...(base?.jinxes ? { jinxes: base.jinxes } : {}),
    ...(base?.special ? { special: base.special } : {}),
    ...(base?.edition ? { edition: base.edition } : {}),
  }
}

// The image a draft shows: its own when embedded, else nothing and the team icon stands in.
export const shownImage = (image: Homebrew['image']): string | undefined => {
  const first = typeof image === 'string' ? image : image?.[0]
  return first !== undefined && first.startsWith('data:image/') ? first : undefined
}

// The two images the editor offers: the main one, drawn on the team's own side, and an optional
// one for when the character changes side. The schema lists the usual side then the flipped one,
// or for a Traveller unaligned, good and evil. The board draws every Traveller good or evil, so
// the main image fills both of its first places.
export interface DraftImages {
  readonly main?: string
  readonly flipped?: string
}

export const imagesOf = (image: Homebrew['image'], team: Team): DraftImages => {
  const [first, second, third] = (typeof image === 'string' ? [image] : (image ?? [])).map((uri) => uri || undefined)
  const main = team === 'traveller' ? (second ?? first) : first
  const flipped = team === 'traveller' ? third : second
  return main === undefined ? {} : { main, ...(flipped !== undefined ? { flipped } : {}) }
}

export const imageOf = ({ main, flipped }: DraftImages, team: Team): Homebrew['image'] =>
  main === undefined || flipped === undefined ? main : team === 'traveller' ? [main, main, flipped] : [main, flipped]

// A Traveller numbers its images differently, so moving to or from one rewrites the list. Other
// team changes keep it as it is: the main image stays the main one.
export const imageForTeam = (image: Homebrew['image'], from: Team, to: Team): Homebrew['image'] =>
  (from === 'traveller') === (to === 'traveller') ? image : imageOf(imagesOf(image, from), to)

// The official night order a homebrew character is placed in: every character step and the
// dusk, information and dawn markers, in order. Placing a character after a step gives it the
// position half way to the next one, so the sheets sort it between the two.
export interface NightStep {
  readonly ordinal: number
  readonly label: string
  readonly id?: CharacterId // a character step
  readonly team?: Team
  readonly marker?: NightMarker
  readonly edition?: string // a character step's, for the edition filter
}

export const nightSteps = (night: 'first' | 'other', locale: Locale, markers: Readonly<Record<NightMarker, string>>): readonly NightStep[] => {
  const text = gameText(locale)
  return [
    ...Object.entries(nightMarkers[night]).map(([marker, ordinal]): NightStep =>
      ({ ordinal, label: markers[marker as NightMarker], marker: marker as NightMarker })),
    ...[...characters.values()].flatMap((c): NightStep[] => {
      const ordinal = c.ordinals[night]
      return ordinal === undefined ? [] : [{ ordinal, label: text.role(c.id).name, id: c.id, team: c.team, edition: c.edition }]
    }),
  ].sort((a, b) => a.ordinal - b.ordinal)
}

export const after = (step: NightStep): number => step.ordinal + 0.5

// The step a position wakes after: the last one before it. A file from another tool numbers
// its positions its own way, so this is the nearest reading, and the number itself is kept
// until the Storyteller moves the character.
export const anchorOf = (steps: readonly NightStep[], position: number): NightStep | undefined => {
  let found = steps[0]
  for (const step of steps) if (step.ordinal < position) found = step
  return found
}

// One step earlier or later among the steps shown, from just after dusk to the very end, where
// the official order keeps the announcements made at dawn.
export const moveBy = (steps: readonly NightStep[], position: number, delta: -1 | 1): number => {
  const anchor = anchorOf(steps, position)
  const at = anchor ? steps.indexOf(anchor) : 0
  const next = steps[Math.max(0, Math.min(steps.length - 1, at + delta))]
  return next ? after(next) : position
}

// The few moments most characters wake at, anchored on the fixed points of each night, so
// placing one is a single choice. Whatever makes a player drunk or poisoned wakes before the
// characters it can disable, and information comes last so it reflects the whole night. On the
// first night a character that changes or copies one wakes before the evil team learns itself,
// and one that poisons, protects or curses after. On the others that one wakes before the
// Demon, and extra kills or reactions to deaths after it. A homebrew Demon wakes with the
// Demons, after the Imp, instead. Any other place is chosen on the full order.
export type MomentKey = 'beforeEvil' | 'afterEvil' | 'beforeDemon' | 'demon' | 'afterDemon' | 'information'

export interface NightMoment {
  readonly key: MomentKey
  readonly position: number
}

export const nightMoments = (steps: readonly NightStep[], night: 'first' | 'other', team: Team): readonly NightMoment[] => {
  const dawn = steps.findIndex((c) => c.marker === 'dawn')
  const moment = (key: MomentKey, step: NightStep | undefined): NightMoment[] => (step ? [{ key, position: after(step) }] : [])
  const at = (ordinal: number) => steps.find((c) => c.ordinal === ordinal)
  const information = moment('information', steps[dawn - 1])
  if (night === 'first') {
    return [
      ...moment('beforeEvil', steps.find((c) => c.marker === 'dusk')),
      ...moment('afterEvil', steps.find((c) => c.marker === 'demonInfo')),
      ...information,
    ]
  }
  return [
    ...(team === 'demon' ? moment('demon', steps.find((c) => c.id === 'imp')) : moment('beforeDemon', at(demonNight.first - 1))),
    ...moment('afterDemon', at(demonNight.last)),
    ...information,
  ]
}

// The moment a saved position is exactly, or nothing when it was placed elsewhere.
export const momentOf = (moments: readonly NightMoment[], position: number | undefined): NightMoment | undefined =>
  position === undefined ? undefined : moments.find((m) => m.position === position)
