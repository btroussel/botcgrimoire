// How the result sits in the ring's free centre: the box and type size that give the words the
// most room, on one line or two, so a portrait phone can stack GOOD over WINS.
import type { CentreBox } from './ringLayout'

// The words' frame in the result's own units: padding in points, the line and the two rules
// above and below it in ems.
export const resultFrame = { padX: 12, padY: 8, line: 1.1, rules: 0.5, largest: 64, smallest: 20 } as const

export interface ResultFit {
  readonly box: CentreBox
  readonly fontSize: number
}

// `oneLine` and `twoLines` are the words' width at a 1-point size set on one line and on their
// best two. The type never exceeds the largest size, and falls to the smallest when nothing fits.
export const fitResult = (boxes: readonly CentreBox[], oneLine: number, twoLines: number): ResultFit | undefined => {
  const { padX, padY, line, rules, largest, smallest } = resultFrame
  let best: ResultFit | undefined
  for (const box of boxes) {
    for (const [width, lines] of [[oneLine, 1], [twoLines, 2]] as const) {
      const fontSize = Math.min(largest, (box.width - 2 * padX) / width, (box.height - 2 * padY) / (lines * line + rules))
      if (!best || fontSize > best.fontSize) best = { box, fontSize }
    }
  }
  return best && { box: best.box, fontSize: Math.max(smallest, Math.floor(best.fontSize)) }
}

// The widest line when the words break once, at the break that keeps it narrowest.
export const twoLineWidth = (words: readonly string[], measure: (text: string) => number) => {
  if (words.length < 2) return measure(words.join(' '))
  let narrowest = Infinity
  for (let cut = 1; cut < words.length; cut++) {
    narrowest = Math.min(narrowest, Math.max(measure(words.slice(0, cut).join(' ')), measure(words.slice(cut).join(' '))))
  }
  return narrowest
}
