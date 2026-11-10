import { fieldCount } from './fieldCount'

describe('fieldCount', () => {
  it('shows only in the last fifth of the limit, and marks the limit', () => {
    expect(fieldCount(0, 250)).toBe('hidden')
    expect(fieldCount(199, 250)).toBe('hidden')
    expect(fieldCount(200, 250)).toBe('near')
    expect(fieldCount(249, 250)).toBe('near')
    expect(fieldCount(250, 250)).toBe('full')
    expect(fieldCount(23, 30)).toBe('hidden')
    expect(fieldCount(24, 30)).toBe('near')
  })
})
