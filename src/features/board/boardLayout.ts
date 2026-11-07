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

// The narrowest board that still gives up width to a drawer. A tablet held upright and a phone
// on its side keep a ring this wide beside the compact drawer, so the drawer never cuts their
// seats in half; a phone held upright is narrower and the drawer covers its ring instead.
const boardMinimum = 520

// Reserve space continuously until the board reaches its readable minimum. Extra paper
// then overlays it, rather than switching abruptly between docked and floating layouts.
export const boardLayoutFor = (viewport: number, width: number) => {
  const referenceWidth = Math.max(0, Math.min(width, referenceMaximumWidth(viewport)))
  const dockable = Math.max(0, viewport - referenceTabWidth - boardMinimum)
  return { referenceWidth, reservedWidth: referenceTabWidth + Math.min(referenceWidth, dockable) }
}
