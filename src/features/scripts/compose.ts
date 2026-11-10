// A custom script being composed or imported (docs/app.md, Scripts): the draft the compose
// sheet edits, the official script file it saves as, and the read of a pasted or picked file.
// Saving writes the same shape an import produces, so a composed script is the object an
// imported one is and exporting either is `serializeScript`.
import type { CharacterId, CustomScript, CustomScriptItem, Homebrew, Locale, ScriptId, ScriptMeta } from '../../content'
import { asCharacterId, characters, parseScript, scriptHomebrew, scriptMeta } from '../../content'
import type { SavedScript, SavedScriptId } from '../../store'
import { linkedScriptText } from '../../store/scriptLink'
import type { Listed } from '../../store/scriptSheet'
import { everyCharacter, listed, listHomebrew, sheetTeams } from '../../store/scriptSheet'

// The `_meta` fields of an imported script that the composer does not edit, kept through an edit.
export type KeptMeta = Pick<ScriptMeta, 'almanac' | 'background' | 'hideTitle'>

export interface Draft {
  readonly id?: SavedScriptId // set when editing a saved script, so saving replaces it
  readonly name: string
  readonly author: string
  readonly logo?: string // an imported script's logo link, kept through an edit
  readonly kept?: KeptMeta
  readonly rules?: readonly string[] // the Bootlegger's homebrew rules as typed; a blank one is dropped on saving
  readonly ids: readonly CharacterId[]
  readonly homebrew?: readonly Homebrew[] // the script's own records, kept for characters not in the Storyteller's list
}

export const emptyDraft: Draft = { name: '', author: '', ids: [] }

// The schema prints ten rules at most, so the composer offers no more.
export const maxRules = 10

// The schema's `_meta.name` allows fifty characters, so a longer name makes a file other tools reject.
export const maxName = 50

export const logoOf = (script: CustomScript): string | undefined => scriptMeta(script)?.logo

// The draft a saved script opens as: every character it lists, the homebrew ones with the
// records the script carries, so saving it again keeps them.
export const draftOf = (saved: SavedScript): Draft => {
  const meta = scriptMeta(saved.script)
  const kept: KeptMeta = {
    ...(meta?.almanac ? { almanac: meta.almanac } : {}),
    ...(meta?.background ? { background: meta.background } : {}),
    ...(meta?.hideTitle !== undefined ? { hideTitle: meta.hideTitle } : {}),
  }
  return {
    id: saved.id,
    name: saved.script.name,
    author: meta?.author ?? '',
    ...(meta?.logo ? { logo: meta.logo } : {}),
    ...(Object.keys(kept).length > 0 ? { kept } : {}),
    ...(meta?.bootlegger ? { rules: meta.bootlegger } : {}),
    ids: saved.script.items.flatMap((item) => (typeof item === 'string' ? [asCharacterId(item)] : item.id === '_meta' ? [] : [asCharacterId(item.id)])),
    homebrew: scriptHomebrew(saved.script),
  }
}

// An edition as a draft: every character its sheet shows, Travellers included, so a copy of it
// reads as the same sheet.
export const editionDraft = (edition: ScriptId, name: string, locale: Locale): Draft =>
  ({ ...emptyDraft, name, ids: listed(edition, locale).map((c) => c.id) })

// A copy to edit: the source without its id, so saving makes a second script and leaves the
// source as it was. `named` is the copy's name pattern; the source's part of the name is cut,
// never the pattern's, so the whole fits the schema.
export const copyOf = (source: Draft, named: (name: string) => string): Draft => {
  const { id: _id, ...copy } = source
  const room = Math.max(maxName - [...named('')].length, 0)
  return { ...copy, name: named([...source.name.trim()].slice(0, room).join('').trimEnd()) }
}

// The homebrew records a draft can name: the script's own, then the Storyteller's list, which
// wins, since editing a character there is how its script copy is corrected.
export type Records = ReadonlyMap<string, Homebrew>

export const recordsOf = (carried: readonly Homebrew[] | undefined, own: readonly Homebrew[]): Records =>
  new Map([...(carried ?? []), ...own].map((h) => [h.id, h]))

// The file orders its characters the way the sheet prints them: by team, then as the content
// lists them, so two Storytellers composing the same script write the same file. Homebrew
// characters follow the official ones of their team, by name, and an id nothing here knows comes last.
const contentRank = new Map([...characters.keys()].map((id, i) => [id, i]))
export const orderIds = (ids: readonly CharacterId[], records: Records = new Map()): readonly CharacterId[] => {
  const team = (id: CharacterId) => {
    const known = characters.get(id)?.team ?? records.get(id)?.team
    return known ? sheetTeams.indexOf(known) : sheetTeams.length
  }
  const rank = (id: CharacterId) => contentRank.get(id) ?? Number.MAX_SAFE_INTEGER
  const name = (id: CharacterId) => records.get(id)?.name ?? id
  return [...new Set(ids)].sort((a, b) => team(a) - team(b) || rank(a) - rank(b) || name(a).localeCompare(name(b)))
}

// Everything the composer offers, in the order the saved file will list it.
export const composeRoster = (locale: Locale, records: Records): readonly Listed[] => {
  const all = [
    ...everyCharacter(locale),
    ...[...records.values()].filter((h) => !characters.has(asCharacterId(h.id))).map(listHomebrew),
  ]
  const byId = new Map(all.map((c) => [c.id, c]))
  return orderIds(all.map((c) => c.id), records).flatMap((id) => byId.get(id) ?? [])
}

export const toggleId = (ids: readonly CharacterId[], id: CharacterId): readonly CharacterId[] =>
  ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]

// The official schema asks for five items at least; five characters is the smallest script that
// seats a table, and the _meta item comes on top.
export const minCharacters = 5

export type DraftProblem = 'nameNeeded' | 'tooFew'

export const draftProblem = (draft: Draft): DraftProblem | undefined =>
  draft.name.trim() === '' ? 'nameNeeded' : draft.ids.length < minCharacters ? 'tooFew' : undefined

const bootlegger = asCharacterId('bootlegger')

const rulesOf = (draft: Draft): readonly string[] => (draft.rules ?? []).map((rule) => rule.trim()).filter((rule) => rule !== '')

// Whether a draft's homebrew characters or rules put the Bootlegger on it, as the official tool
// does: the sheet shows it with no remove control, and the file lists it.
export const draftNeedsBootlegger = (draft: Draft, records: Records): boolean =>
  rulesOf(draft).length > 0 || draft.ids.some((id) => records.has(id) && !characters.has(id))

// The characters a draft shows and saves: its own, and the Bootlegger it implies.
export const draftIds = (draft: Draft, records: Records): readonly CharacterId[] =>
  draftNeedsBootlegger(draft, records) && !draft.ids.includes(bootlegger) ? [...draft.ids, bootlegger] : draft.ids

// A homebrew character is written out in full, so the file needs nothing else to be read. An id
// this build does not know stays as it came, for the app that knows it.
export const fileOf = (draft: Draft, own: readonly Homebrew[] = []): CustomScript => {
  const name = draft.name.trim()
  const author = draft.author.trim()
  const rules = rulesOf(draft)
  const records = recordsOf(draft.homebrew, own)
  return {
    kind: 'custom',
    name,
    items: [
      {
        id: '_meta', name, ...(author === '' ? {} : { author }), ...(draft.logo ? { logo: draft.logo } : {}),
        ...draft.kept, ...(rules.length > 0 ? { bootlegger: rules } : {}),
      },
      ...orderIds(draftIds(draft, records), records).flatMap((id): CustomScriptItem[] => {
        const record = records.get(id)
        return record ? [record] : [id]
      }),
    ],
  }
}

// A pasted or picked file: JSON first, then the content's check against the schema. Every
// problem comes back, so a file with three misspelt ids is fixed in one pass.
export type Imported = { readonly script: CustomScript } | { readonly errors: readonly string[] }

export const importText = (text: string): Imported => {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return { errors: ['not JSON'] }
  }
  const parsed = parseScript(json)
  return 'errors' in parsed ? { errors: parsed.errors } : { script: parsed }
}

// A shared link, read like a picked file once it gives up the file, or the file's own text pasted
// from a chat. A link with no script in it and one cut short in a chat app are told apart, since
// the second is worth asking for again.
export const importLink = async (link: string): Promise<Imported | 'none' | 'broken'> => {
  if (link.trim().startsWith('[')) return importText(link.trim())
  let text: string | undefined
  try {
    text = await linkedScriptText(link)
  } catch {
    return 'broken'
  }
  return text === undefined ? 'none' : importText(text)
}

// Case and accents fold away, so "legionnaire" finds the Légionnaire.
const folded = (text: string): string => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

// The picker's search: the name in the UI locale or in English, since players often learn
// the English names first. Every word of the query has to appear.
export const matchesSearch = (character: { readonly name: string; readonly englishName: string }, query: string): boolean => {
  const words = folded(query).split(/\s+/).filter(word => word !== '')
  const names = `${folded(character.name)} ${folded(character.englishName)}`
  return words.every(word => names.includes(word))
}

// People building a script often look for an effect ("poison", "drunk"), so the search also
// reads abilities: the name matches first, then the rest whose name or ability holds every word,
// each in roster order. One or two letters narrow by name only, rather than flooding the list.
export interface CharacterSearch<T> {
  readonly shown: readonly T[]
  readonly named: number // how many of `shown`, from the start, match by name
}

export const searchCharacters = <T extends { readonly name: string; readonly englishName: string; readonly ability: string }>(
  roster: readonly T[], query: string,
): CharacterSearch<T> => {
  const named = roster.filter(c => matchesSearch(c, query))
  if (folded(query).trim().length < 3) return { shown: named, named: named.length }
  const words = folded(query).split(/\s+/).filter(word => word !== '')
  const byName = new Set(named)
  const byAbility = roster.filter(c => {
    if (byName.has(c)) return false
    const text = `${folded(c.name)} ${folded(c.englishName)} ${folded(c.ability)}`
    return words.every(word => text.includes(word))
  })
  return { shown: [...named, ...byAbility], named: named.length }
}

// What Enter adds: the one name match, else the one result, so typing a name and Enter still
// adds it when its ability tier brings others along.
export const searchPick = <T>({ shown, named }: CharacterSearch<T>): T | undefined =>
  named === 1 || shown.length === 1 ? shown[0] : undefined

// The download's name: the script's name as a file system likes it.
export const fileName = (name: string): string => {
  const slug = folded(name)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slug === '' ? 'script' : slug}.json`
}
