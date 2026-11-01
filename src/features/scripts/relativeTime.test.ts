import { t } from '../../content'
import { relativeTime } from './relativeTime'

const en = (key: string, values?: Parameters<typeof t>[2]) => t('en', key, values)
const now = Date.UTC(2026, 8, 5, 21, 0, 0)

describe('relative time', () => {
  test('steps from just now through minutes, hours and days', () => {
    expect(relativeTime(now - 20_000, now, en, 'en')).toBe('Just now')
    expect(relativeTime(now - 60_000, now, en, 'en')).toBe('1 minute ago')
    expect(relativeTime(now - 25 * 60_000, now, en, 'en')).toBe('25 minutes ago')
    expect(relativeTime(now - 3_600_000, now, en, 'en')).toBe('1 hour ago')
    expect(relativeTime(now - 26 * 3_600_000, now, en, 'en')).toBe('Yesterday')
    expect(relativeTime(now - 3 * 86_400_000, now, en, 'en')).toBe('3 days ago')
  })

  test('past a week it is the date, with the year only when it differs', () => {
    expect(relativeTime(now - 10 * 86_400_000, now, en, 'en')).toMatch(/Aug/)
    expect(relativeTime(now - 10 * 86_400_000, now, en, 'en')).not.toMatch(/2026/)
    expect(relativeTime(now - 400 * 86_400_000, now, en, 'en')).toMatch(/2025/)
  })

  test('a clock that went backwards reads as just now', () => {
    expect(relativeTime(now + 5_000, now, en, 'en')).toBe('Just now')
  })
})
