// Words fitted to a box before they are laid out, measured on a canvas in the bundled faces.
import type { TextStyle } from 'react-native'

// Canvas widths run a little under the laid-out text's, so a fit keeps a margin.
export const slack = 1.05

let canvas: CanvasRenderingContext2D | null | undefined
export const widthAtOnePoint = (text: string, family: string): number => {
  canvas ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (!canvas) return text.length * 0.6
  canvas.font = `100px ${family}`
  return canvas.measureText(text).width / 100
}

// One size for names set side by side in cells of one width: the style's own, shrunk until the
// longest word among them fits, since a name broken mid-word reads as two.
export const wholeWords = (names: readonly string[], width: number, family: string, from: TextStyle): TextStyle => {
  const { fontSize = 0, lineHeight = 0 } = from
  const widest = Math.max(0, ...names.flatMap((name) => name.split(/\s+/)).map((word) => widthAtOnePoint(word, family))) * slack * fontSize
  return widest > width ? { fontSize: Math.floor(fontSize * width / widest), lineHeight: Math.ceil(lineHeight * width / widest) } : {}
}
