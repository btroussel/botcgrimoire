// Where the board puts its circle: the column the reference leaves, the bands held for the
// status row and the loose tokens, and the ring fitted around the corner controls. Fitting the
// ring tries every token size at every margin step, so the board computes this only when one
// of these measures changes, never on a tap or an edit that leaves them alone.
import { layout, seatMetrics, space } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { fitRing, fitRingAroundControls } from './ringLayout'

// The loose and granted tokens' strip, a fixed slot per token.
export const tokenStripHeight = 64
export const tokenStripSlotWidth = 60
// The toolbar's band across the top of the board.
export const toolbarHeight = 68

// The centre panel fills the gap between the flanking tokens, within these bounds. A ring too
// narrow for the minimum docks the panel at the board's foot, so it never covers a voter.
const centrePanel = { minimum: 200, maximum: 232, margin: 40 }
const centreGap = (bandWidth: number, tokenSize: number) => bandWidth - 2 * tokenSize - centrePanel.margin
export const centrePanelWidth = (bandWidth: number, tokenSize: number) =>
  Math.max(centrePanel.minimum, Math.min(centrePanel.maximum, centreGap(bandWidth, tokenSize)))
const centrePanelFits = (bandWidth: number, tokenSize: number) => centreGap(bandWidth, tokenSize) >= centrePanel.minimum

export interface BoardMeasures {
  readonly width: number // inside the safe insets
  readonly height: number // inside the safe insets, above the replay bar
  readonly landscape: boolean
  readonly live: boolean // false in replay, where no reference, toolbar or phase control stands over the ring
  readonly reserved: number // the width the reference drawer takes from the board
  readonly toolbar: Size
  readonly bluffs: Size
  readonly clockHeight: number
  readonly seats: number
  readonly strip: number // loose characters and Storyteller grants
}

export const boardGeometry = ({ width, height, landscape, live, reserved, toolbar, bluffs, clockHeight, seats, strip }: BoardMeasures) => {
  const columnWidth = Math.max(0, width - (live ? reserved : 0))
  const statusHeight = Math.max(layout.statusBand, space.md + Math.max(clockHeight, bluffs.height))
  const utilitiesHeight = columnWidth < 500 && strip > 0 ? tokenStripHeight + space.md : 0
  const utilitiesWidth = Math.min(strip * tokenStripSlotWidth + 2,
    utilitiesHeight > 0 ? columnWidth - 2 * space.md : Math.min(320, Math.max(220, columnWidth * 0.4)))
  // The plaque anchors to the full board corner, below the tabs, so the tabs take nothing from it.
  // The narrow width still holds "20 / 20 en vie" and its chevron on one line.
  const clockWidth = width < 380 ? 132 : 148
  // The ring rises beside the toolbar and loose tokens wherever no seat reaches them. Portrait
  // keeps its status band whole, since voting controls dock over it there.
  const aroundControls = live
    ? fitRingAroundControls({ width: columnWidth, height: height - (landscape ? 0 : statusHeight) }, seats, seatMetrics, {
      top: [
        { left: width - space.md - toolbar.width, top: space.md, ...toolbar },
        ...(strip > 0 ? [{ left: columnWidth - space.md - utilitiesWidth, top: toolbarHeight,
          width: utilitiesWidth, height: tokenStripHeight }] : []),
      ],
      bottom: landscape ? [
        { left: space.md, top: height - space.md - bluffs.height, ...bluffs },
        { left: width - space.md - clockWidth, top: height - space.md - clockHeight,
          width: clockWidth, height: clockHeight },
      ] : [],
    }) : undefined
  const band = aroundControls?.band ?? { width: columnWidth,
    height: Math.max(0, height - toolbarHeight - statusHeight - utilitiesHeight) }
  const ring = aroundControls?.geometry ?? fitRing(band, seats, seatMetrics)
  return {
    columnWidth,
    statusHeight,
    utilitiesHeight,
    utilitiesWidth,
    clockWidth,
    fitted: aroundControls !== undefined, // the ring shares the corners with the controls
    topBandHeight: aroundControls?.top ?? toolbarHeight,
    band,
    ring,
    // Portrait boards reserve the status band, so a docked panel there covers no seat.
    panelDocks: !(landscape && aroundControls) && !centrePanelFits(band.width, ring.size),
    // The drawer can extend into unused board space without covering a token.
    seatsRight: Math.max(-Infinity, ...ring.positions.map(at => at.x + ring.size / 2)),
  }
}
