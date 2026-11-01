// What a script is: an edition, or a custom script in upstream's schema (assets/schema). Both
// resolve to an ordered list of character ids; the join says what each id means.
import type { CharacterId, Edition, Homebrew, HomebrewJinx, HomebrewSpecial, Team } from './types'
import { teams } from './types'
import { rawRoles } from './upstream'

// The three base editions, the only scripts a game may name by id. The experimental set,
// Fabled and Loric are content, not scripts.
export type ScriptId = 'tb' | 'bmr' | 'snv'

export const editions: readonly Edition[] = [
  { id: 'tb', name: 'Trouble Brewing', description: 'A little of everything: the edition to learn the game with.' },
  { id: 'bmr', name: 'Bad Moon Rising', description: 'Deaths pile up, and good takes risks to learn anything true.' },
  { id: 'snv', name: 'Sects & Violets', description: 'Madness and misinformation: nobody is sure of anything.' },
]

// Who wrote the editions, named where a custom script names its own author.
export const editionAuthor = 'The Pandemonium Institute'

// A script's `_meta`. The app shows the name, author and logo, and prints the Bootlegger's homebrew
// rules on the sheet. The almanac link, background and hidden title are for other apps; they are
// kept so a file read and written again loses nothing its author put there.
export interface ScriptMeta {
  readonly id: '_meta'
  readonly name?: string
  readonly author?: string
  readonly logo?: string
  readonly almanac?: string
  readonly background?: string
  readonly hideTitle?: boolean
  readonly bootlegger?: readonly string[]
}

// One item of a custom script file. `_meta` names the script, a bare string is a character id,
// and an object with a full record is a homebrew character. A bare object is an official
// character written out, which the parser reduces to its id but a saved game may still hold.
export type CustomScriptItem =
  | string
  | ScriptMeta
  | Homebrew
  | { readonly id: string }

export interface CustomScript {
  readonly kind: 'custom'
  readonly name: string
  readonly items: readonly CustomScriptItem[]
}

export type Script = ScriptId | CustomScript

export const isCustom = (script: Script): script is CustomScript => typeof script !== 'string'

// Script files in the wild spell some ids with punctuation; ours never do.
const normalizeId = (id: string): CharacterId => id.toLowerCase().replace(/[^a-z0-9]/g, '') as CharacterId

const knownIds = new Set(rawRoles.map((r) => r.id))

const isRecord = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x)

const isStrings = (x: unknown): x is readonly string[] => Array.isArray(x) && x.every((s) => typeof s === 'string')

// A file numbers night positions the way the official Script Tool reads them: the step at index i
// of upstream's night sheet is i + 1, so dusk is 1. Our sheets count from 0. Reading takes one off
// and writing adds it back, so a character placed after the Washerwoman here wakes after her
// there too. A file's position at or before dusk still wakes, just after it; 0 never wakes.
const fromFileNight = (n: number): number => (n > 0 ? Math.max(n - 1, 0.5) : n)
const toFileNight = (n: number | undefined): number | undefined => (n !== undefined && n > 0 ? n + 1 : n)

const text = (x: unknown): x is string => typeof x === 'string' && x !== ''
const number = (x: unknown): x is number => typeof x === 'number' && Number.isFinite(x)

// A jinx names the other character on the script; one with a blank reason says nothing.
const jinxList = (x: unknown): readonly HomebrewJinx[] =>
  Array.isArray(x) ? x.flatMap((j: unknown) => (isRecord(j) && text(j.id) && text(j.reason) && normalizeId(j.id) !== '' && j.reason.trim() !== ''
    ? [{ id: normalizeId(j.id), reason: j.reason }] : [])) : []

// Another app's integration features, such as a vote multiplier. The app never runs them; it keeps
// each well-formed one so the file still works there.
const specialList = (x: unknown): readonly HomebrewSpecial[] =>
  Array.isArray(x) ? x.flatMap((f: unknown) => (isRecord(f) && text(f.type) && text(f.name) ? [{
    type: f.type, name: f.name,
    ...(text(f.value) || number(f.value) ? { value: f.value } : {}),
    ...(text(f.time) ? { time: f.time } : {}),
    ...(text(f.global) ? { global: f.global } : {}),
  }] : [])) : []

// The optional fields of a homebrew record, kept when their type is right and dropped otherwise,
// so a file from another tool with one odd field still imports.
const homebrewExtras = (item: Record<string, unknown>): Partial<Homebrew> => {
  const { image, flavor, firstNight, firstNightReminder, otherNight, otherNightReminder, reminders, remindersGlobal, setup, edition } = item
  const jinxes = jinxList(item.jinxes)
  const special = specialList(item.special)
  return {
    ...(typeof image === 'string' || (isStrings(image) && image.length > 0) ? { image: image as NonNullable<Homebrew['image']> } : {}),
    ...(text(flavor) ? { flavor } : {}),
    ...(number(firstNight) ? { firstNight: fromFileNight(firstNight) } : {}),
    ...(text(firstNightReminder) ? { firstNightReminder } : {}),
    ...(number(otherNight) ? { otherNight: fromFileNight(otherNight) } : {}),
    ...(text(otherNightReminder) ? { otherNightReminder } : {}),
    ...(isStrings(reminders) && reminders.length > 0 ? { reminders } : {}),
    ...(isStrings(remindersGlobal) && remindersGlobal.length > 0 ? { remindersGlobal } : {}),
    ...(setup === true ? { setup } : {}),
    ...(jinxes.length > 0 ? { jinxes } : {}),
    ...(special.length > 0 ? { special } : {}),
    ...(text(edition) ? { edition } : {}),
  }
}

const webLink = (x: unknown): string | undefined => (typeof x === 'string' && /^https?:\/\//i.test(x) ? x : undefined)

// The `_meta` fields the app keeps. The links stay links: the sheet shows the logo when the
// network reaches it, printing included, and nothing fetches the others.
const metaOf = (item: Record<string, unknown>, name: string): ScriptMeta => {
  const logo = webLink(item.logo)
  const almanac = webLink(item.almanac)
  const background = webLink(item.background)
  const rules = Array.isArray(item.bootlegger)
    ? item.bootlegger.flatMap((rule: unknown) => (typeof rule === 'string' && rule.trim() !== '' ? [rule.trim()] : []))
    : []
  return {
    id: '_meta',
    name,
    ...(typeof item.author === 'string' ? { author: item.author } : {}),
    ...(logo ? { logo } : {}),
    ...(almanac ? { almanac } : {}),
    ...(background ? { background } : {}),
    ...(typeof item.hideTitle === 'boolean' ? { hideTitle: item.hideTitle } : {}),
    ...(rules.length > 0 ? { bootlegger: rules } : {}),
  }
}

// The structural check on a parsed script file, the essentials of assets/schema/script.schema.json
// by hand: an array, one `_meta` with a name, and every other item either a character id or a
// homebrew character with its four required fields. Every problem is reported, not just the
// first, so a broken file is fixed in one pass. An official character written out in full, as the
// script tool does, is kept as its bare id so our record runs it rather than the file's copy; only
// an id the content does not know is homebrew. A bare id the content does not know stays too: it
// is usually a character released after this build's data, and shows once the app updates.
export const parseScript = (json: unknown): CustomScript | { readonly errors: readonly string[] } => {
  if (!Array.isArray(json)) return { errors: ['a script is a JSON array'] }
  const errors: string[] = []
  const items: CustomScriptItem[] = []
  let name: string | undefined
  json.forEach((item: unknown, i) => {
    const where = `item ${i + 1}`
    if (typeof item === 'string') {
      const id = normalizeId(item)
      if (id === '') errors.push(`${where}: not a character id or an object with one`)
      else items.push(id)
      return
    }
    if (!isRecord(item) || typeof item.id !== 'string') {
      errors.push(`${where}: not a character id or an object with one`)
      return
    }
    if (item.id === '_meta') {
      if (typeof item.name !== 'string' || item.name === '') errors.push(`${where}: _meta has no name`)
      else if (name !== undefined) errors.push(`${where}: a second _meta`)
      else {
        name = item.name
        items.push(metaOf(item, name))
      }
      return
    }
    const id = normalizeId(item.id)
    if (knownIds.has(id) || (id !== '' && Object.keys(item).length === 1)) {
      items.push(id)
      return
    }
    const { name: hbName, ability } = item
    // Travellers were spelt "traveler" until 2025, and older files still say so.
    const team = item.team === 'traveler' ? 'traveller' : item.team
    if (id === '' || typeof hbName !== 'string' || typeof ability !== 'string' || !teams.some((t) => t === team))
      errors.push(`${where}: a homebrew character "${item.id}" needs id, name, team and ability`)
    else items.push({ id, name: hbName, team: team as Team, ability, ...homebrewExtras(item) })
  })
  if (name === undefined) errors.push('no _meta item names the script')
  if (errors.length > 0 || name === undefined) return { errors }
  return { kind: 'custom', name, items }
}

// The file a script saves and shares as: its items, with night positions counted the way a file
// counts them, so reading the file back gives the same script.
export const scriptFile = (script: CustomScript): readonly CustomScriptItem[] =>
  script.items.map((item) => {
    if (typeof item === 'string' || item.id === '_meta' || !('team' in item)) return item
    const firstNight = toFileNight(item.firstNight)
    const otherNight = toFileNight(item.otherNight)
    return { ...item, ...(firstNight !== undefined ? { firstNight } : {}), ...(otherNight !== undefined ? { otherNight } : {}) }
  })

// The homebrew records a script carries, in its order. Older saves may hold a partial record,
// so only one with a team counts.
export const scriptHomebrew = (script: Script): readonly Homebrew[] =>
  isCustom(script)
    ? script.items.flatMap((item) => (typeof item !== 'string' && item.id !== '_meta' && 'team' in item && item.team ? [item] : []))
    : []

// A custom script's `_meta`, nothing for an edition.
export const scriptMeta = (script: Script): ScriptMeta | undefined =>
  isCustom(script) ? script.items.find((item): item is ScriptMeta => typeof item !== 'string' && item.id === '_meta') : undefined

// The author a custom script's `_meta` names, trimmed; nothing for an edition or a blank one.
export const scriptAuthor = (script: Script): string | undefined => {
  const author = scriptMeta(script)?.author?.trim() ?? ''
  return author === '' ? undefined : author
}

// The homebrew rules a script prints for the Bootlegger, in its author's words.
export const scriptRules = (script: Script): readonly string[] => scriptMeta(script)?.bootlegger ?? []

export const scriptName = (script: Script): string =>
  isCustom(script) ? script.name : (editions.find((e) => e.id === script)?.name ?? script)

// A script with homebrew characters or rules has the Bootlegger in play, as the official tool
// insists, so a file that leaves it out still lists it.
export const impliesBootlegger = (script: Script): boolean =>
  isCustom(script) && !script.items.some((item) => (typeof item === 'string' ? item : item.id) === 'bootlegger')
  && (scriptHomebrew(script).length > 0 || scriptRules(script).length > 0)

// The characters a script lists, in the script's order: for a custom script its items, Fabled
// and Loric included, then an implied Bootlegger; for an edition the characters it puts in the
// bag, its Travellers left to the ones filed under it.
export const scriptCharacters = (script: Script): readonly CharacterId[] => {
  if (isCustom(script)) {
    return [
      ...script.items
        .map((item) => (typeof item === 'string' ? item : item.id))
        .filter((id) => id !== '_meta')
        .map(normalizeId),
      ...(impliesBootlegger(script) ? ['bootlegger' as CharacterId] : []),
    ]
  }
  return rawRoles.filter((r) => r.edition === script && r.team !== 'traveller').map((r) => r.id as CharacterId)
}
