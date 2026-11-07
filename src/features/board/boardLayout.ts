export const referenceTabWidth = 40

export const referenceCompactWidth = (viewport: number) => viewport <= 480 ? 168 : 192
export const referenceMaximumWidth = (viewport: number) =>
  Math.max(0, Math.min(540, viewport <= 480 ? viewport - 8 : Math.floor(viewport * 0.6)))

// Dragging settles at the nearest of three fixed positions.
export const referenceSettledWidth = (width: number, maximum: number, compact: number) => {
  const minimum = Math.min(compact, maximum)
  if (width < minimum / 2) return 0
  return width < (minimum + maximum) / 2 ? minimum : maximum
}

// The narrowest board that still gives up width to a drawer. An upright window has height to
// spare, so its ring stays fitted at 520 points wide, and from 752 the whole compact drawer docks
// beside it rather than covering seats. A window on its side is short: its ring needs the width,
// and a big game there would scroll beside a docked drawer, so it keeps 760 points.
const boardMinimum = { upright: 520, onItsSide: 760 } as const

// Reserve space continuously until the board reaches its readable minimum. Extra paper
// then overlays it, rather than switching abruptly between docked and floating layouts.
export const boardLayoutFor = (viewport: number, width: number, upright: boolean) => {
  const referenceWidth = Math.max(0, Math.min(width, referenceMaximumWidth(viewport)))
  const dockable = Math.max(0, viewport - referenceTabWidth - boardMinimum[upright ? 'upright' : 'onItsSide'])
  return { referenceWidth, reservedWidth: referenceTabWidth + Math.min(referenceWidth, dockable) }
}
