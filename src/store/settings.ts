// Device preferences are independent of saved games (docs/store.md).
import type { BoardColour, Locale } from '../content'
import { boardColours, locales } from '../content'

// A note the Storyteller kept to show again: its words, and the character token under them.
export interface KeptNote {
  readonly words: string
  readonly character?: string
}

export interface Settings {
  readonly locale: Locale
  readonly boardColour: BoardColour
  readonly notes: readonly KeptNote[] // most recently kept first
}

// The longest note a card takes, and how many kept notes the device holds. A few dozen is more
// than a game's worth of messages, and the oldest goes first.
export const noteLength = 250
export const keptLimit = 30

// The bundled locale for a browser language tag: the exact tag, else the same language. Spanish
// from anywhere but Spain reads the Latin American translation, and Norwegian reads Bokmål.
const matchLocale = (tag: string): Locale | undefined => {
  const lower = tag.toLowerCase()
  const exact = locales.find((l) => l.toLowerCase() === lower)
  if (exact) return exact
  const [language = '', region] = lower.split('-')
  if (language === 'es' && region && region !== 'es' && locales.includes('es-419')) return 'es-419'
  const base = ['no', 'nb', 'nn'].includes(language) ? 'nb' : language
  return locales.find((l) => l.toLowerCase().split('-')[0] === base)
}

// The browser's language when it is one we have, English otherwise.
const browserLocale = (): Locale => matchLocale(typeof navigator !== 'undefined' ? navigator.language : 'en') ?? 'en'

export const sameNote = (a: KeptNote, b: KeptNote): boolean => a.words === b.words && a.character === b.character

// Kept first, once, and the list cut to its bound.
export const keepNote = (notes: readonly KeptNote[], note: KeptNote): readonly KeptNote[] =>
  [note, ...notes.filter((n) => !sameNote(n, note))].slice(0, keptLimit)

export const forgetNote = (notes: readonly KeptNote[], note: KeptNote): readonly KeptNote[] =>
  notes.filter((n) => !sameNote(n, note))

// The kept notes as stored. A setting is not a record worth refusing a launch over, so anything
// malformed is dropped rather than thrown, and older settings without the list read as empty.
const readNotes = (raw: unknown): readonly KeptNote[] => {
  if (!Array.isArray(raw)) return []
  const notes = raw.flatMap((n: unknown): KeptNote[] => {
    if (typeof n !== 'object' || n === null) return []
    const { words, character } = n as Record<string, unknown>
    if (typeof words !== 'string' || words.length > noteLength) return []
    const token = typeof character === 'string' && character !== '' ? character : undefined
    if (words.trim() === '' && token === undefined) return []
    return [{ words: words.trim(), ...(token !== undefined ? { character: token } : {}) }]
  })
  return notes.filter((n, i) => notes.findIndex((m) => sameNote(m, n)) === i).slice(0, keptLimit)
}

// The export and the first browser render must match: English, or the language of a page that
// has one. The device's locale is applied after mount.
export const defaultSettings = (page?: Locale): Settings => ({ locale: page ?? 'en', boardColour: 'burgundy', notes: [] })

export const withDefaults = (partial: Partial<Settings> | undefined, page?: Locale): Settings => ({
  // A translated entry page seeds a first visit; the root follows the browser. Saved choices win.
  locale: locales.find((l) => l === partial?.locale) ?? (page === 'en' ? undefined : page) ?? browserLocale(),
  // Older settings have no colour; unknown values must never become missing image sources.
  boardColour: boardColours.find((colour) => colour === partial?.boardColour) ?? 'burgundy',
  notes: readNotes(partial?.notes),
})
