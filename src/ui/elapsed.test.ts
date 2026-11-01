import { formatElapsed, untilNextSecond } from './elapsed'

describe('formatElapsed', () => {
  it('shows minutes and seconds, adding hours at sixty minutes', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(999)).toBe('0:00')
    expect(formatElapsed(59_000)).toBe('0:59')
    expect(formatElapsed(60_000)).toBe('1:00')
    expect(formatElapsed(42 * 60_000 + 10_000)).toBe('42:10')
    expect(formatElapsed(3_599_999)).toBe('59:59')
    expect(formatElapsed(3_600_000)).toBe('1:00:00')
    expect(formatElapsed(72 * 60_000 + 40_000)).toBe('1:12:40')
    expect(formatElapsed(10 * 3_600_000)).toBe('10:00:00')
  })

  it('never goes negative', () => {
    expect(formatElapsed(-5 * 60_000)).toBe('0:00')
  })
})

describe('untilNextSecond', () => {
  it('waits to the boundary of the elapsed time', () => {
    expect(untilNextSecond(0)).toBe(1_000)
    expect(untilNextSecond(42 * 60_000 + 10_250)).toBe(750)
    expect(untilNextSecond(-250)).toBe(250)
  })
})
