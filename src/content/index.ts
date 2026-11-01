// Static reference data joined from the bundled upstream files.
import { homebrew, homebrewCharacter } from './homebrew'
import { expandReminders } from './reminders'
import type { Character, CharacterId, Jinx } from './types'
import { rawJinxes, rawNightsheet, rawRoles } from './upstream'

export type { Locale, Translate, Values } from './i18n'
export { locales, seatName, t } from './i18n'
export { gameText } from './gameText'
export { boardColours } from './appearance'
export type { BoardColour } from './appearance'
export { contentPin } from './upstream'
export * from './types'
export * from './scripts'
export type { HomebrewArt, HomebrewImage } from './homebrew'
export { homebrewArt, homebrewCharacter, homebrewVersion, registerHomebrew, subscribeHomebrew } from './homebrew'

export const asCharacterId = (id: string): CharacterId => id as CharacterId

// A named seat may wait for its character until the Storyteller deals or fills it.
export const emptySeat: CharacterId = asCharacterId('_empty')
export const isEmptySeat = (id: CharacterId): boolean => id === emptySeat


// Position in a night array is the ordinal, and absence means the character does not wake.
const ordinalIn = (list: readonly string[], id: string): number | undefined => {
  const at = list.indexOf(id)
  return at === -1 ? undefined : at
}

// The four steps that are not characters, at their position on each sheet.
export const nightMarkers = {
  first: {
    dusk: rawNightsheet.firstNight.indexOf('dusk'),
    minionInfo: rawNightsheet.firstNight.indexOf('minioninfo'),
    demonInfo: rawNightsheet.firstNight.indexOf('demoninfo'),
    dawn: rawNightsheet.firstNight.indexOf('dawn'),
  },
  other: {
    dusk: rawNightsheet.otherNight.indexOf('dusk'),
    dawn: rawNightsheet.otherNight.indexOf('dawn'),
  },
} as const
export type NightMarker = keyof typeof nightMarkers.first

const join = (raw: (typeof rawRoles)[number]): Character => {
  const first = ordinalIn(rawNightsheet.firstNight, raw.id)
  const other = ordinalIn(rawNightsheet.otherNight, raw.id)
  return {
    id: raw.id as CharacterId,
    team: raw.team,
    edition: raw.edition,
    name: raw.name,
    ability: raw.ability,
    ...(raw.firstNightReminder !== undefined ? { firstNightReminder: raw.firstNightReminder } : {}),
    ...(raw.otherNightReminder !== undefined ? { otherNightReminder: raw.otherNightReminder } : {}),
    setupFlag: raw.setup,
    ordinals: { ...(first !== undefined ? { first } : {}), ...(other !== undefined ? { other } : {}) },
    reminders: expandReminders(raw.reminders, raw.remindersGlobal ?? []),
  }
}

export const characters: ReadonlyMap<CharacterId, Character> = new Map(
  rawRoles.map((r) => [r.id as CharacterId, join(r)]),
)

// After the first night the Demons wake together, one run of the sheet around the Imp. A few
// wake elsewhere for reasons of their own, such as the Riot at the very end.
export const demonNight = ((): { readonly first: number; readonly last: number } => {
  const sheet = rawNightsheet.otherNight
  const isDemon = (at: number) => characters.get(sheet[at] as CharacterId)?.team === 'demon'
  let first = sheet.indexOf('imp')
  let last = first
  while (isDemon(first - 1)) first--
  while (isDemon(last + 1)) last++
  return { first, last }
})()

// A homebrew id reads the registered record. Preserve the id when an older saved game names a
// character neither the bundled content nor a script on this device knows.
export const character = (id: CharacterId): Character => {
  const known = characters.get(id)
  if (known) return known
  const h = homebrew(id)
  return h ? homebrewCharacter(h) : {
    id,
    team: 'townsfolk',
    edition: 'unknown',
    name: id,
    ability: '',
    setupFlag: false,
    ordinals: {},
    reminders: [],
  }
}

// A character that takes no seat and sits outside the ring: a Fabled or Loric, which is one of the
// game's rules, or Lil' Monsta, whom the Minions babysit.
export const isLoose = (id: CharacterId): boolean => {
  const team = character(id).team
  return id === 'lilmonsta' || team === 'fabled' || team === 'loric'
}

// The registered homebrew record behind an id, when the bundled content does not know it.
export const homebrewOf = (id: string) => (characters.has(id as CharacterId) ? undefined : homebrew(id))

export const jinxes: readonly Jinx[] = rawJinxes.flatMap((row) =>
  row.jinx.map((j) => ({
    a: row.id as CharacterId,
    b: j.id as CharacterId,
    reason: j.reason,
  })),
)
