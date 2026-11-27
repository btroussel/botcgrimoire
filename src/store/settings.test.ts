import { afterEach, describe, expect, it, vi } from 'vitest'

import type { BoardColour, Locale } from '../content'
import { boardColours } from '../content'

import type { KeptNote } from './settings'
import { defaultSettings, forgetNote, keepNote, keptLimit, noteLength, withDefaults } from './settings'

afterEach(() => vi.unstubAllGlobals())

describe('settings at startup', () => {
  it('renders the same defaults regardless of the export machine or browser language', () => {
    vi.stubGlobal('navigator', { language: 'fr-FR' })
    expect(defaultSettings()).toEqual({ locale: 'en', boardColour: 'burgundy', notes: [] })
    vi.stubGlobal('navigator', { language: 'en-US' })
    expect(defaultSettings()).toEqual({ locale: 'en', boardColour: 'burgundy', notes: [] })
  })

  it('renders a language\'s own page in that language from the first render', () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    expect(defaultSettings('fr')).toEqual({ locale: 'fr', boardColour: 'burgundy', notes: [] })
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
    expect(withDefaults(undefined)).toEqual({ locale: 'fr', boardColour: 'burgundy', notes: [] })
    expect(withDefaults({})).toEqual({ locale: 'fr', boardColour: 'burgundy', notes: [] })
    vi.stubGlobal('navigator', { language: 'it-IT' })
    expect(withDefaults(undefined).locale).toBe('en')
  })

  it.each([
    ['de-AT', 'de'], ['es-ES', 'es'], ['es', 'es'], ['es-MX', 'es-419'], ['es-419', 'es-419'], ['pl-PL', 'pl'],
    ['sv-FI', 'sv'], ['fi', 'fi'], ['hu-HU', 'hu'], ['nb-NO', 'nb-NO'], ['no', 'nb-NO'], ['nn-NO', 'nb-NO'], ['EN-gb', 'en'],
    ['ca-ES', 'ca'], ['ja-JP', 'ja'], ['ko-KR', 'ko'], ['ru-RU', 'ru'], ['th-TH', 'th'], ['zh-CN', 'zh-Hans'], ['zh-Hans-SG', 'zh-Hans'],
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
    expect(withDefaults({ locale: 'en' })).toEqual({ locale: 'en', boardColour: 'burgundy', notes: [] })
  })

  it('drops obsolete preferences while retaining the saved locale and board colour', () => {
    const saved = { locale: 'fr', boardColour: 'plum', obsoletePreference: true } as const
    expect(withDefaults(saved)).toEqual({ locale: 'fr', boardColour: 'plum', notes: [] })
  })
})

it.each(boardColours)('restores the saved %s velvet', (boardColour) => {
  expect(withDefaults({ boardColour }).boardColour).toBe(boardColour)
})

it('uses burgundy for an unsupported saved colour', () => {
  expect(withDefaults({ boardColour: 'unknown' as BoardColour }).boardColour).toBe('burgundy')
})

describe('kept notes', () => {
  it('reads older settings without the list as none kept', () => {
    expect(withDefaults({ locale: 'en' }).notes).toEqual([])
  })

  it('drops what is malformed and keeps the rest in order', () => {
    const notes = [
      { words: 'Yes', characters: ['imp'] }, null, 'Wake', { words: 7 }, { words: '   ' }, { words: '', characters: ['chef'] },
      { words: 'x'.repeat(noteLength + 1) }, { words: ' Sleep ', characters: [] }, { words: 'Yes', characters: ['imp'] },
    ]
    expect(withDefaults({ notes } as unknown as Partial<{ notes: readonly KeptNote[] }>).notes).toEqual([
      { words: 'Yes', characters: ['imp'] }, { words: '', characters: ['chef'] }, { words: 'Sleep' },
    ])
    expect(withDefaults({ notes: 'many' } as unknown as Partial<{ notes: readonly KeptNote[] }>).notes).toEqual([])
  })

  it('keeps the latest first, once, and drops the oldest past the bound', () => {
    const many = Array.from({ length: keptLimit }, (_, i) => ({ words: `Note ${i}` }))
    const kept = keepNote(many, { words: 'Note 3' })
    expect(kept[0]).toEqual({ words: 'Note 3' })
    expect(kept).toHaveLength(keptLimit)
    const more = keepNote(kept, { words: 'New', characters: ['imp'] })
    expect(more).toHaveLength(keptLimit)
    expect(more[0]).toEqual({ words: 'New', characters: ['imp'] })
    expect(more).not.toContainEqual({ words: `Note ${keptLimit - 1}` })
  })

  it('refuses a note longer than the field, which would not read back', () => {
    expect(keepNote([], { words: 'x'.repeat(noteLength + 1) })).toEqual([])
    expect(keepNote([], { words: 'x'.repeat(noteLength) })).toHaveLength(1)
  })

  it('tells a note by its words and its token together', () => {
    const notes = keepNote(keepNote([], { words: 'Yes' }), { words: 'Yes', characters: ['imp'] })
    expect(notes).toHaveLength(2)
    expect(forgetNote(notes, { words: 'Yes' })).toEqual([{ words: 'Yes', characters: ['imp'] }])
  })
})
