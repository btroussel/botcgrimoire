// A locale's UI strings and translated edition names, read from the files the app bundles, so a
// check can run in every language without its own copy of the labels.
import { readdirSync, readFileSync } from 'node:fs'

const localesDir = new URL('../../src/content/locales/', import.meta.url)
const json = url => JSON.parse(readFileSync(url, 'utf8'))

const uiLocales = readdirSync(localesDir).sort()

export const stringsIn = locale => Object.fromEntries(readdirSync(new URL(`${locale}/`, localesDir))
  .map(file => [file.replace('.json', ''), json(new URL(`${locale}/${file}`, localesDir))]))

// Upstream names a translation file with `_` where the tag has `-`; English has none bundled.
export const editionName = (locale, id, english) => {
  const file = new URL(`../../assets/data/raw/translations/game/${locale.replace('-', '_')}.json`, import.meta.url)
  return (locale === 'en' ? undefined : json(file).editions?.[id]?.name) ?? english
}

// The language whose labels have the most characters, the likeliest to overflow, so a check of
// how words fit runs once rather than in every language.
export const longestIn = labels => uiLocales.reduce((longest, locale) =>
  labels(locale).join('').length > labels(longest).join('').length ? locale : longest)
