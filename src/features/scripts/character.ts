// A homebrew character being written (docs/app.md, Scripts): the form's draft, the record it
// saves as, and where on each night sheet it wakes. Pure, no React; the editor draws it.
import type { CharacterId, Homebrew, Locale, NightMarker, Team, Translate } from '../../content'
import { characters, demonNight, gameText, homebrewWake, nightSheet, stepBefore, wakeAfter } from '../../content'

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
  readonly firstNight: string | undefined // the step it wakes after, undefined when it does not wake
  readonly firstNightReminder: string
  readonly otherNight: string | undefined
  readonly otherNightReminder: string
  readonly setup: boolean
}

// The step a record wakes after, read the way the night sheets place it.
const wakeStep = (h: Homebrew | undefined, night: 'first' | 'other'): string | undefined => {
  const at = h ? homebrewWake(h, night) : undefined
  return at === undefined ? undefined : stepBefore(night, at)
}

export const draftOfCharacter = (h?: Homebrew): CharacterDraft => ({
  name: h?.name ?? '',
  team: h?.team ?? 'townsfolk',
  ability: h?.ability ?? '',
  image: h?.image,
  reminders: h?.reminders ?? [],
  firstNight: wakeStep(h, 'first'),
  firstNightReminder: h?.firstNightReminder ?? '',
  otherNight: wakeStep(h, 'other'),
  otherNightReminder: h?.otherNightReminder ?? '',
  setup: h?.setup === true,
})

// A draft kept by an older version holds a position rather than a step.
export const draftWake = (night: 'first' | 'other', kept: unknown): string | undefined =>
  typeof kept === 'string' ? kept : typeof kept === 'number' && kept > 0 ? stepBefore(night, kept) : undefined

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
  const first = draft.firstNight !== undefined ? wakeAfter('first', draft.firstNight) : undefined
  const other = draft.otherNight !== undefined ? wakeAfter('other', draft.otherNight) : undefined
  return {
    id,
    name: draft.name.trim().slice(0, limits.name),
    team: draft.team,
    ability: draft.ability.trim().slice(0, limits.ability),
    ...(draft.image !== undefined ? { image: draft.image } : {}),
    ...(first !== undefined ? { firstNight: first, firstNightAfter: draft.firstNight! } : {}),
    ...(first !== undefined && firstNightReminder !== '' ? { firstNightReminder } : {}),
    ...(other !== undefined ? { otherNight: other, otherNightAfter: draft.otherNight! } : {}),
    ...(other !== undefined && otherNightReminder !== '' ? { otherNightReminder } : {}),
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
// dusk, information and dawn markers, in order. A character wakes just after a step, so the
// sheets sort it between that step and the next.
export interface NightStep {
  readonly key: string // the step's id on the bundled sheet, which a character wakes after
  readonly ordinal: number
  readonly label: string
  readonly id?: CharacterId // a character step
  readonly team?: Team
  readonly marker?: NightMarker
  readonly edition?: string // a character step's, for the edition filter
}

const markerOf: Readonly<Record<string, NightMarker>> = { dusk: 'dusk', minioninfo: 'minionInfo', demoninfo: 'demonInfo', dawn: 'dawn' }

export const nightSteps = (night: 'first' | 'other', locale: Locale, markers: Readonly<Record<NightMarker, string>>): readonly NightStep[] => {
  const text = gameText(locale)
  return nightSheet(night).flatMap((key, ordinal): NightStep[] => {
    const marker = markerOf[key]
    if (marker) return [{ key, ordinal, label: markers[marker], marker }]
    const c = characters.get(key as CharacterId)
    return c ? [{ key, ordinal, label: text.role(c.id).name, id: c.id, team: c.team, edition: c.edition }] : []
  })
}

// The steps a script wakes: its characters and the markers, which every night has.
export const scriptSteps = (steps: readonly NightStep[], ids: ReadonlySet<string>): readonly NightStep[] =>
  steps.filter((step) => step.marker !== undefined || (step.id !== undefined && ids.has(step.id)))

// Where a character waking after `key` sorts among `steps`.
export const wakeOrdinal = (steps: readonly NightStep[], key: string): number =>
  (steps.find((step) => step.key === key)?.ordinal ?? 0) + 0.5

// The step shown just before a wake: the one it wakes after, or when a filter hides that, the
// last shown before it.
export const anchorOf = (shown: readonly NightStep[], wake: number): NightStep | undefined => {
  let found = shown[0]
  for (const step of shown) if (step.ordinal < wake) found = step
  return found
}

// The shown steps either side of a wake, as the Storyteller will read it on the sheet.
export const neighbours = (shown: readonly NightStep[], wake: number): { readonly before?: NightStep; readonly next?: NightStep } => {
  const before = anchorOf(shown, wake)
  const next = shown.find((step) => step.ordinal > wake)
  return { ...(before ? { before } : {}), ...(next ? { next } : {}) }
}

// One step earlier or later among the steps shown, from just after dusk to the very end, where
// the official order keeps the announcements made at dawn. A wake after a hidden step moves up
// to the shown step before it first.
export const moveBy = (shown: readonly NightStep[], wake: number, key: string, delta: -1 | 1): string => {
  const anchor = anchorOf(shown, wake)
  if (!anchor) return key
  if (delta === -1 && anchor.key !== key) return anchor.key
  const at = shown.indexOf(anchor)
  return shown[Math.max(0, Math.min(shown.length - 1, at + delta))]!.key
}

// The few moments most characters wake at, anchored on the fixed points of each night, so
// placing one is a single choice. Whatever makes a player drunk or poisoned wakes before the
// characters it can disable, and information comes after everything that could change it, but
// before the Chambermaid and Mathematician, who count what happened in the night. On the first
// night a character that changes or copies one wakes before the evil team learns itself, and one
// that poisons, protects or curses after. On the others, poisoning wakes at the start of the
// night, protection just before the Demon, and extra kills or reactions to deaths after it. A
// homebrew Demon wakes with the Demons, after the Imp. Any other place is chosen on the full
// order.
export type MomentKey = 'beforeEvil' | 'afterEvil' | 'start' | 'beforeDemon' | 'demon' | 'afterDemon' | 'information'

export interface NightMoment {
  readonly key: MomentKey
  readonly after: string // the step it wakes after
}

export const nightMoments = (steps: readonly NightStep[], night: 'first' | 'other', team: Team): readonly NightMoment[] => {
  const moment = (key: MomentKey, step: NightStep | undefined): NightMoment[] => (step ? [{ key, after: step.key }] : [])
  const at = (ordinal: number) => steps.find((c) => c.ordinal === ordinal)
  const counted = steps.findIndex((c) => c.id === 'chambermaid' || c.id === 'mathematician' || c.marker === 'dawn')
  const information = moment('information', steps[counted - 1])
  const dusk = steps.find((c) => c.marker === 'dusk')
  if (night === 'first') {
    return [...moment('beforeEvil', dusk), ...moment('afterEvil', steps.find((c) => c.marker === 'demonInfo')), ...information]
  }
  return [
    ...moment('start', dusk),
    ...(team === 'demon' ? moment('demon', steps.find((c) => c.id === 'imp')) : moment('beforeDemon', at(demonNight.first - 1))),
    ...moment('afterDemon', at(demonNight.last)),
    ...information,
  ]
}

// The moment a wake is, or nothing when it was placed elsewhere.
export const momentOf = (moments: readonly NightMoment[], key: string | undefined): NightMoment | undefined =>
  key === undefined ? undefined : moments.find((m) => m.after === key)
