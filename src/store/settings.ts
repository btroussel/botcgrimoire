// Device preferences are independent of saved games (docs/store.md).
import type { BoardColour, Locale } from '../content'
import { boardColours, locales } from '../content'

export interface Settings {
  readonly locale: Locale
  readonly boardColour: BoardColour
}

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

// The export and the first browser render must match: English, or the language of a page that
// has one. The device's locale is applied after mount.
export const defaultSettings = (page?: Locale): Settings => ({ locale: page ?? 'en', boardColour: 'burgundy' })

export const withDefaults = (partial: Partial<Settings> | undefined, page?: Locale): Settings => ({
  // A translated entry page seeds a first visit; the root follows the browser. Saved choices win.
  locale: locales.find((l) => l === partial?.locale) ?? (page === 'en' ? undefined : page) ?? browserLocale(),
  // Older settings have no colour; unknown values must never become missing image sources.
  boardColour: boardColours.find((colour) => colour === partial?.boardColour) ?? 'burgundy',
})
