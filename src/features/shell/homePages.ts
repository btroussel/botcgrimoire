// Each language has its own copy of Home at its own address, because search engines read the
// exported page. English keeps the root; the live app then applies the saved preference.
import type { Locale } from '../../content'
import { homePath } from '../../ui/homePath'
import { locales } from '../../content'

export const site = 'https://botcgrimoire.com'

// The path segment of every Home but the root, one exported page each.
export const languageHomes: readonly string[] = locales.filter((l) => l !== 'en').map((l) => homePath(l).slice(1))

// The language whose Home this path is, if it is one.
export const homeOf = (pathname: string): Locale | undefined => locales.find((l) => homePath(l) === pathname)

// Search engines take an ISO language and an optional country, never a wider region: Spain's
// Spanish names its country, the Latin American translation answers every other Spanish reader,
// and Bokmål is listed as Norwegian.
const searchLanguages: Partial<Record<Locale, string>> = { es: 'es-ES', 'es-419': 'es', 'nb-NO': 'no' }
export const searchLanguage = (locale: Locale): string => searchLanguages[locale] ?? locale
