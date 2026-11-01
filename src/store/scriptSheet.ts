// A script laid out for the printed player sheet (docs/app.md, Scripts): the listed characters
// by team in the fixed order, the jinxes between pairs both on the sheet, the distribution table
// from the engine's base counts, and the two night orders from the engine's sheet order, every
// listed character in play or not. Pure, no React. It lives here because three features draw the
// sheet, setup, the board's edge and the scripts screen, and a feature may not import another; the
// shapes it returns are the ScriptSheet piece's props, spelled out again since this layer may
// not import ui/.
import type { CharacterId, CustomScript, Homebrew, HomebrewJinx, Locale, NightMarker, Script, Team, Translate } from '../content'
import { asCharacterId, characters, gameText, homebrewCharacter, impliesBootlegger, isCustom, jinxes, scriptCharacters, scriptHomebrew, teams } from '../content'
import { baseCounts, sheetOrder } from '../engine'

// The teams a player sheet shows, in the printed order. A script's Fabled and Loric are its own
// rules, so they print after its Travellers (docs/ui.md).
export const sheetTeams: readonly Team[] = teams

// A character as the sheet lists it, in the UI locale. A homebrew character comes from the
// script file, or the Storyteller's own list while composing, in its author's words.
export interface Listed {
  readonly id: CharacterId
  readonly team: Team
  readonly name: string
  readonly ability: string
  readonly englishName: string
  readonly homebrew: boolean
  readonly reminders: readonly string[] // one entry per token that ships, translated
  readonly ordinals: { readonly first?: number; readonly other?: number }
  readonly jinxes?: readonly HomebrewJinx[] // a homebrew character's own, in its author's words
}

export interface SheetRow {
  readonly id: string
  readonly team: Team
  readonly name: string
  readonly ability: string
  readonly skipsFirstNight?: boolean
}

export interface SheetTeam {
  readonly team: Team
  readonly label: string
  readonly count?: { readonly have: number; readonly of: number; readonly label: string }
  readonly rows: readonly SheetRow[]
}

export interface SheetJinx {
  readonly a: string
  readonly b: string
  readonly reason: string
}

export interface SheetCountTable {
  readonly players: readonly number[]
  readonly rows: readonly { readonly label: string; readonly by: readonly number[] }[]
}

export type SheetNightItem =
  | { readonly kind: 'character'; readonly id: string; readonly team: Team; readonly name: string }
  | { readonly kind: 'marker'; readonly marker: NightMarker; readonly label: string }

export interface SheetNightOrders {
  readonly first: readonly SheetNightItem[]
  readonly other: readonly SheetNightItem[]
}

const listKnown = (id: CharacterId, locale: Locale): Listed | undefined => {
  const c = characters.get(id)
  if (!c) return undefined
  const text = gameText(locale)
  const role = text.role(id)
  return {
    id,
    team: c.team,
    name: role.name,
    ability: role.ability,
    englishName: c.name,
    homebrew: false,
    reminders: c.reminders.flatMap((r) => Array.from({ length: r.count }, () => text.reminder(r.name))),
    ordinals: c.ordinals,
  }
}

// A homebrew record as the sheet lists it: its own words in every locale, since its author wrote
// it in one, and its own tokens and night positions.
export const listHomebrew = (h: Homebrew): Listed => {
  const c = homebrewCharacter(h)
  return {
    id: c.id,
    team: c.team,
    name: c.name,
    ability: c.ability,
    englishName: c.name,
    homebrew: true,
    reminders: c.reminders.flatMap((r) => Array.from({ length: r.count }, () => r.name)),
    ordinals: c.ordinals,
    ...(h.jinxes ? { jinxes: h.jinxes } : {}),
  }
}

const listCustom = (script: CustomScript, locale: Locale): readonly Listed[] => [
  ...script.items.flatMap((item): Listed[] => {
    if (typeof item === 'string' || item.id === '_meta') {
      const known = typeof item === 'string' ? listKnown(asCharacterId(item), locale) : undefined
      return known ? [known] : []
    }
    const known = listKnown(asCharacterId(item.id), locale)
    if (known) return [known]
    return 'team' in item && item.team ? [listHomebrew(item)] : []
  }),
  ...(impliesBootlegger(script) ? [listKnown(asCharacterId('bootlegger'), locale)!] : []),
]

// Every character a script lists, in the script's order, Travellers included: for an edition
// that is every character printed under its name, for a custom script the file's items, its
// Fabled and Loric with them and an implied Bootlegger last.
export const listed = (script: Script, locale: Locale): readonly Listed[] => {
  if (isCustom(script)) return listCustom(script, locale)
  return [...characters.values()]
    .filter((c) => c.edition === script)
    .flatMap((c) => {
      const known = listKnown(c.id, locale)
      return known ? [known] : []
    })
}

// The bundled art a script's characters draw, for warming before it is needed. A homebrew
// character has none of its own, so its team's generic icon, keyed by the team's name, stands in.
export const artIds = (script: Script, locale: Locale): readonly CharacterId[] =>
  listed(script, locale).map((c) => (c.homebrew ? asCharacterId(c.team) : c.id))

// Keep upstream's ability-based script order within each team. Sorting translated names would
// make the draft disagree with the saved sheet and move characters when the locale changes.
export const everyCharacter = (locale: Locale): readonly Listed[] => {
  const all = [...characters.keys()].flatMap((id) => {
    const known = listKnown(id, locale)
    return known ? [known] : []
  })
  const rank = (t: Team) => sheetTeams.indexOf(t)
  return all.sort((a, b) => rank(a.team) - rank(b.team))
}

// The ability text carries its own asterisk where upstream prints one; this only lights the footnote.
const toRow = (c: Listed): SheetRow => ({
  id: c.id,
  team: c.team,
  name: c.name,
  ability: c.ability,
  ...(c.ordinals.first === undefined && c.ordinals.other !== undefined ? { skipsFirstNight: true } : {}),
})

export type TeamLabels = Readonly<Record<Team, string>>

// Each team's heading in the UI locale, for the sheet, the reference and every picker alike.
export const teamLabels = (t: Translate): TeamLabels => ({
  townsfolk: t('scripts.townsfolk'),
  outsider: t('scripts.outsiders'),
  minion: t('scripts.minions'),
  demon: t('scripts.demons'),
  traveller: t('scripts.travellers'),
  fabled: t('scripts.fabled'),
  loric: t('scripts.loric'),
})

// The sheet's own headings in the UI locale. The Teensyville line shows only under a sheet the
// feature recognises as one.
export const sheetLabels = (t: Translate) => ({
  counts: t('scripts.counts'),
  firstNight: t('scripts.firstNight'),
  otherNights: t('scripts.otherNights'),
  footnote: t('scripts.footnote'),
  jinxes: t('scripts.jinxes'),
  rules: t('scripts.rules'),
  teensyville: t('scripts.teensyville'),
})

export interface TeamCount {
  readonly have: number
  readonly of: number
}

// The sheet's teams in the fixed order. Read mode drops a team with nothing on it; compose keeps
// every team so the bands show what is still to fill, with the count against its target.
export const sheetGroups = (
  list: readonly Listed[],
  labels: TeamLabels,
  counts?: { readonly of: (team: Team) => TeamCount | undefined; readonly label: (count: TeamCount) => string },
): readonly SheetTeam[] =>
  sheetTeams.flatMap((team): SheetTeam[] => {
    const rows = list.filter((c) => c.team === team).map(toRow)
    if (!counts) return rows.length === 0 ? [] : [{ team, label: labels[team], rows }]
    const count = counts.of(team)
    return [{ team, label: labels[team], rows, ...(count ? { count: { ...count, label: counts.label(count) } } : {}) }]
  })

export const teamCounts = (list: readonly Listed[]): Readonly<Partial<Record<Team, number>>> => {
  const out: Partial<Record<Team, number>> = {}
  list.forEach((c) => {
    out[c.team] = (out[c.team] ?? 0) + 1
  })
  return out
}

// What a composed script is built towards: the full script's thirteen, four, four and four, and
// Teensyville's six, two, two and one only once the script is exactly that shape (docs/content.md:
// the format is recognised by size, since the schema has no flag, and read mode applies the same
// test). An empty or half-built script reads against the full target, so the composer is not
// greeted with the small one. Travellers have no target.
export const fullTarget: Readonly<Record<Team, number>> = { townsfolk: 13, outsider: 4, minion: 4, demon: 4, traveller: 0, fabled: 0, loric: 0 }
export const teensyvilleTarget: Readonly<Record<Team, number>> = { townsfolk: 6, outsider: 2, minion: 2, demon: 1, traveller: 0, fabled: 0, loric: 0 }

export const isTeensyville = (counts: Readonly<Partial<Record<Team, number>>>): boolean =>
  (['townsfolk', 'outsider', 'minion', 'demon'] as const).every(team => (counts[team] ?? 0) === teensyvilleTarget[team])

export const composeTarget = (counts: Readonly<Partial<Record<Team, number>>>): Readonly<Record<Team, number>> => {
  return isTeensyville(counts) ? teensyvilleTarget : fullTarget
}

// The jinxes between pairs both on the list, once each: the official ones in the words of the
// locale, then the ones homebrew characters carry, in their author's. A pair two records both
// name reads once, from the first.
export const jinxesAmong = (list: readonly Listed[], locale: Locale): readonly SheetJinx[] => {
  const ids = new Set<string>(list.map((c) => c.id))
  const text = gameText(locale)
  const official = jinxes.filter((j) => ids.has(j.a) && ids.has(j.b)).map((j) => ({ a: j.a, b: j.b, reason: text.jinx(j.a, j.b) }))
  const seen = new Set(official.map((j) => [j.a, j.b].sort().join(' ')))
  const own = list.flatMap((c) => (c.jinxes ?? []).flatMap((j): SheetJinx[] => {
    const pair = [c.id, j.id].sort().join(' ')
    if (j.id === c.id || !ids.has(j.id) || seen.has(pair)) return []
    seen.add(pair)
    return [{ a: c.id, b: j.id, reason: j.reason }]
  }))
  return [...official, ...own]
}

// The ids a script lists that this build neither bundles nor carries a record for, most often
// characters released after the bundled data. The script keeps them and the sheet names them, so
// they appear once the app updates.
export const unknownIds = (script: Script): readonly string[] => {
  const carried = new Set(scriptHomebrew(script).map((h) => h.id))
  return scriptCharacters(script).filter((id) => !characters.has(id) && !carried.has(id))
}

// The line a sheet prints under its characters to name those ids, or nothing when there are none.
export const unknownNotice = (script: Script, t: Translate): string | undefined => {
  const unknown = unknownIds(script)
  return unknown.length > 0 ? t('scripts.unknownCharacters', { count: unknown.length, ids: unknown.join(', ') }) : undefined
}

// The base table, five to fifteen players, one row per team word the feature passes.
const tablePlayers: readonly number[] = Array.from({ length: 11 }, (_, i) => i + 5)

export interface CountRowLabels {
  readonly townsfolk: string
  readonly outsiders: string
  readonly minions: string
  readonly demon: string
}

export const countTable = (labels: CountRowLabels): SheetCountTable => ({
  players: tablePlayers,
  rows: [
    { label: labels.townsfolk, by: tablePlayers.map((n) => baseCounts(n)?.townsfolk ?? 0) },
    { label: labels.outsiders, by: tablePlayers.map((n) => baseCounts(n)?.outsiders ?? 0) },
    { label: labels.minions, by: tablePlayers.map((n) => baseCounts(n)?.minions ?? 0) },
    { label: labels.demon, by: tablePlayers.map((n) => baseCounts(n)?.demon ?? 0) },
  ],
})

// The two night orders from the engine's sheet order, named from the list where it has the
// character and from the content otherwise.
export const nightOrders = (script: Script, list: readonly Listed[], locale: Locale, markerLabel: (m: NightMarker) => string): SheetNightOrders => {
  const named = new Map(list.map((c) => [c.id, c]))
  const text = gameText(locale)
  const order = (night: 'first' | 'other'): readonly SheetNightItem[] =>
    sheetOrder(script, night).map((step): SheetNightItem => {
      if (step.kind === 'marker') return { kind: 'marker', marker: step.marker, label: markerLabel(step.marker) }
      const c = named.get(step.character)
      return { kind: 'character', id: step.character, team: c?.team ?? characters.get(step.character)?.team ?? 'townsfolk', name: c?.name ?? text.role(step.character).name }
    })
  return { first: order('first'), other: order('other') }
}
