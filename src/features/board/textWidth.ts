// Words fitted to a box before they are laid out, measured on a canvas in the bundled faces.

// Canvas widths run a little under the laid-out text's, so a fit keeps a margin.
export const slack = 1.05

let canvas: CanvasRenderingContext2D | null | undefined
export const widthAtOnePoint = (text: string, family: string): number => {
  canvas ??= typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  if (!canvas) return text.length * 0.6
  canvas.font = `100px ${family}`
  return canvas.measureText(text).width / 100
}
