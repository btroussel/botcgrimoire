import { bundles, locales, seatName, t } from './i18n'
import { characters, gameText, jinxes, nightMarkers } from './index'
import enJson from '../../assets/data/raw/translations/game/en.json'
import { rawRoles, rawJinxes, rawTranslations, type RawTranslation } from './upstream'

// Spacing and case aside, a localized information step keeps the upstream text after its opening
// clause. Only that clause loses the player count, which Swedish puts at its end, not its start.
const plain = (text: string) => text.replace(/\s+/g, ' ').trim().toLowerCase()
const afterOpening = (text: string) => plain(text).replace(/^[^.:]*[.:] /, '')

test.each(locales)('%s night markers retain upstream instructions without the information steps’ player-count lead-in', locale => {
  const source = locale === 'en' ? (enJson as RawTranslation) : rawTranslations[locale]
  for (const phase of ['first', 'other'] as const) {
    for (const id of Object.keys(nightMarkers[phase])) {
      const key = id.toLowerCase()
      const instruction = gameText(locale).nightMarker(id, phase)
      expect(instruction).not.toBe('')
      const original = source?.roles[key]?.[phase] ?? (enJson as RawTranslation).roles[key]?.[phase] ?? ''
      if (phase === 'first' && (key === 'minioninfo' || key === 'demoninfo')) {
        expect(afterOpening(instruction), `${locale} ${key}`).toBe(afterOpening(original))
        expect(plain(instruction).length).toBeLessThan(plain(original).length)
      } else expect(instruction).toBe(original)
    }
  }
})

test('all bundled characters and jinxes remain available as reference', () => {
  expect(characters.size).toBe(rawRoles.length)
  expect(jinxes.length).toBe(rawJinxes.reduce((n, row) => n + row.jinx.length, 0))
})

describe('locales', () => {
  const entriesOf = (locale: (typeof locales)[number]) =>
    Object.entries(bundles[locale]).flatMap(([area, entries]) => Object.entries(entries).map(([name, entry]) => [`${area}.${name}`, entry] as const))
  const keysOf = (locale: (typeof locales)[number]) => new Set(entriesOf(locale).map(([key]) => key))
  const en = keysOf('en')

  test.each(locales.filter((l) => l !== 'en'))('%s has exactly the keys en has', (locale) => {
    const have = keysOf(locale)
    expect({ missing: [...en.difference(have)], extra: [...have.difference(en)] }).toEqual({ missing: [], extra: [] })
  })

  test('a plural follows its language: French counts 0 as one, English does not', () => {
    expect(t('fr', 'day.votesLabel', { count: 0 })).toBe('vote')
    expect(t('en', 'day.votesLabel', { count: 0 })).toBe('votes')
    expect(t('en', 'day.votesToExecute', { count: 1 })).toBe('1 vote to execute')
    expect(t('fr', 'day.votesToTieExecute', { count: 2, execute: 3 })).toBe('2 votes pour égaliser, 3 pour exécuter')
  })

  // Whole numbers only: a count is never a fraction, and French or Spanish 'many' starts at a million.
  test.each(locales)('%s plurals hold exactly the forms its language selects', (locale) => {
    const rule = new Intl.PluralRules(locale)
    const forms = new Set(['other', ...Array.from({ length: 1001 }, (_, n) => rule.select(n))])
    for (const [area, entries] of Object.entries(bundles[locale])) {
      for (const [name, entry] of Object.entries(entries)) {
        if (typeof entry === 'string') continue
        expect(Object.keys(entry).sort(), `${area}.${name}`).toEqual([...forms].sort())
      }
    }
  })

  test('Polish picks few and many by the last digits', () => {
    expect(t('pl', 'common.players', { count: 1 })).toMatch(/^1 /)
    expect(t('pl', 'common.players', { count: 3 })).toBe(t('pl', 'common.players', { count: 22 }).replace('22', '3'))
    expect(t('pl', 'common.players', { count: 5 })).toBe(t('pl', 'common.players', { count: 12 }).replace('12', '5'))
    expect(t('pl', 'common.players', { count: 3 })).not.toBe(t('pl', 'common.players', { count: 5 }).replace('5', '3'))
  })

  test('a default seat name from any locale reads in the current one, a typed name stays', () => {
    expect(seatName('es-419', 'Place 1')).toBe('Asiento 1')
    expect(seatName('en', '12. hely')).toBe('Seat 12')
    expect(seatName('hu', 'Seat 3')).toBe('3. hely')
    expect(seatName('en', 'Stol 4')).toBe('Seat 4')
    for (const from of locales) for (const to of locales) {
      expect(seatName(to, t(from, 'setup.defaultSeat', { n: 7 })), `${from} to ${to}`).toBe(t(to, 'setup.defaultSeat', { n: 7 }))
    }
    expect(seatName('fr', 'Seat')).toBe('Seat')
    expect(seatName('fr', 'Seat 1 bis')).toBe('Seat 1 bis')
    expect(seatName('fr', 'Ann')).toBe('Ann')
  })

  test.each(locales)('%s has no em or en dash in a UI string', (locale) => {
    expect(entriesOf(locale).filter(([, entry]) => /[–—]/.test(JSON.stringify(entry))).map(([key]) => key)).toEqual([])
  })
})
