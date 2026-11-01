import { locales as registered, uiText } from './generated/locales'

// A locale is a folder under locales/, registered by tools/build-content.mjs.
export type Locale = (typeof registered)[number]
export const locales: readonly Locale[] = registered

// A plural holds the forms its language's rule selects for whole numbers, with `other` as the
// fallback: English and French use `one`, Polish also `few` and `many`.
type Plural = Readonly<Partial<Record<Intl.LDMLPluralRule, string>>> & { readonly other: string }
type Area = Readonly<Record<string, string | Plural>>
type Bundle = Readonly<Record<string, Area>>

export const bundles: Readonly<Record<Locale, Bundle>> = uiText

export type Values = Readonly<Record<string, string | number>>

// The translator a screen receives, already bound to its locale.
export type Translate = (key: string, values?: Values) => string

const fill = (s: string, values: Values) =>
  s.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m))

// Each language's own plural rule: French counts 0 as singular, English does not.
const pluralRules = Object.fromEntries(locales.map((l) => [l, new Intl.PluralRules(l)])) as Readonly<Record<Locale, Intl.PluralRules>>

// A key is `area.name`. A plural reads `count` from the values. A key missing in the locale
// falls back to English, and a key missing there too is returned as is so the gap is visible.
export const t = (locale: Locale, key: string, values: Values = {}): string => {
  const dot = key.indexOf('.')
  if (dot === -1) return key
  const area = key.slice(0, dot)
  const name = key.slice(dot + 1)
  const own = bundles[locale][area]?.[name]
  const entry = own ?? bundles.en[area]?.[name]
  if (entry === undefined) return key
  if (typeof entry === 'string') return fill(entry, values)
  // An English fallback takes the English rule.
  const rule = pluralRules[own === undefined ? 'en' : locale]
  return fill(entry[rule.select(Number(values.count ?? 0))] ?? entry.other, values)
}

// A game saves its default seat names as text, so one started in French keeps "Place 3" after a
// switch to Spanish. Any locale's default reads in the current one; a typed name stays as is.
// A default a locale has since reworded stays listed, so its older games still translate.
const retiredSeats = ['Stol {n}']
const defaultSeats = [...locales.map((l) => bundles[l].setup?.defaultSeat), ...retiredSeats].flatMap((template) => {
  if (typeof template !== 'string') return []
  const [before = '', after = ''] = template.split('{n}').map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return [new RegExp(`^${before}(\\d+)${after}$`)]
})

export const seatName = (locale: Locale, name: string): string => {
  for (const pattern of defaultSeats) {
    const n = pattern.exec(name)?.[1]
    if (n !== undefined) return t(locale, 'setup.defaultSeat', { n: Number(n) })
  }
  return name
}
