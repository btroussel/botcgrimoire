import { fitResult, resultFrame, twoLineWidth } from './victory'

describe('the result in the ring\'s centre', () => {
  const wide = { left: 0, top: 100, width: 400, height: 60 }
  const tall = { left: 100, top: 0, width: 200, height: 400 }

  test('takes the box that gives the words the largest type', () => {
    // One line of 5 ems: the wide box allows (400 - 24) / 5, the tall one stacks two lines of 3 ems.
    const fit = fitResult([wide, tall], 5, 3)!
    expect(fit.box).toBe(tall)
    expect(fit.fontSize).toBe(Math.floor((200 - 2 * resultFrame.padX) / 3))
  })

  test('never grows past the largest size or falls below the smallest', () => {
    expect(fitResult([{ left: 0, top: 0, width: 2000, height: 2000 }], 5, 3)!.fontSize).toBe(resultFrame.largest)
    expect(fitResult([{ left: 0, top: 0, width: 40, height: 20 }], 5, 3)!.fontSize).toBe(resultFrame.smallest)
    expect(fitResult([], 5, 3)).toBeUndefined()
  })

  test('breaks the words where the longer line is shortest', () => {
    const measure = (text: string) => text.length
    expect(twoLineWidth(['LES', 'MAUVAIS', 'GAGNENT'], measure)).toBe('LES MAUVAIS'.length)
    expect(twoLineWidth(['GOOD', 'WINS'], measure)).toBe(4)
    expect(twoLineWidth(['OVER'], measure)).toBe(4)
  })
})
