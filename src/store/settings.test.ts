import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoardColour, Locale } from '../content'
import { boardColours } from '../content'

import { defaultSettings, withDefaults } from './settings'

afterEach(() => vi.unstubAllGlobals())

describe('settings at startup', () => {
  it('renders the same defaults regardless of the export machine or browser language', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(defaultSettings()).toEqual({ locale: 'en', boardColour: 'burgundy' })
    vi.stubGlobal('navigator', { language: 'en-US' })
    expect(defaultSettings()).toEqual({ locale: 'en', boardColour: 'burgundy' })
  })

  it('renders a language\'s own page in that language from the first render', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    expect(defaultSettings('fr')).toEqual({ locale: 'fr', boardColour: 'burgundy' })
  })

  it('uses a translated Home only when no supported locale was saved', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(withDefaults(undefined, 'de').locale).toBe('de')
    expect(withDefaults({ locale: 'xx' as Locale }, 'de').locale).toBe('de')
    expect(withDefaults({ locale: 'en' }, 'de').locale).toBe('en')
    expect(withDefaults({ locale: 'fr' }, 'en').locale).toBe('fr')
    expect(withDefaults(undefined, 'en').locale).toBe('fr')
  })

  it('uses the browser language after loading when no locale was saved', () => {
    vi.stubGlobal('navigator', { language: 'fr-CA' })
    expect(withDefaults(undefined)).toEqual({ locale: 'fr', boardColour: 'burgundy' })
    expect(withDefaults({})).toEqual({ locale: 'fr', boardColour: 'burgundy' })
    vi.stubGlobal('navigator', { language: 'ja-JP' })
    expect(withDefaults(undefined).locale).toBe('en')
  })

  it.each([
    ['de-AT', 'de'], ['es-ES', 'es'], ['es', 'es'], ['es-MX', 'es-419'], ['es-419', 'es-419'], ['pl-PL', 'pl'],
    ['sv-FI', 'sv'], ['fi', 'fi'], ['hu-HU', 'hu'], ['nb-NO', 'nb-NO'], ['no', 'nb-NO'], ['nn-NO', 'nb-NO'], ['EN-gb', 'en'],
  ])('reads the browser language %s as %s', (language, locale) => {
    vi.stubGlobal('navigator', { language })
    expect(withDefaults(undefined).locale).toBe(locale)
  })

  it('treats a saved locale the app no longer bundles as unset', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(withDefaults({ locale: 'xx' as Locale }).locale).toBe('fr')
  })

  it('keeps a saved locale in preference to the browser defaults', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(withDefaults({ locale: 'en' })).toEqual({ locale: 'en', boardColour: 'burgundy' })
  })

  it('drops obsolete preferences while retaining the saved locale and board colour', () => {
    const saved = { locale: 'fr', boardColour: 'plum', obsoletePreference: true } as const
    expect(withDefaults(saved)).toEqual({ locale: 'fr', boardColour: 'plum' })
  })
})

it.each(boardColours)('restores the saved %s velvet', (boardColour) => {
  expect(withDefaults({ boardColour }).boardColour).toBe(boardColour)
})

it('uses burgundy for an unsupported saved colour', () => {
  expect(withDefaults({ boardColour: 'unknown' as BoardColour }).boardColour).toBe('burgundy')
})
