// The one file ui pieces and screens read and no lower layer imports (docs/ui.md). The look in one
// line: a dark baize table lit from the middle, parchment tokens on it, and a sheet of paper
// beside it for everything the Storyteller reads. Felt is where things sit, paper is where
// things are read, brass is what you tap next, wax is what you cannot take back. Each value
// carries its reason; a piece reads these names and never a hex of its own.
import type { TextStyle, ViewStyle } from 'react-native'
import { Easing } from 'react-native'

import type { Team } from '../content'

// ---------------------------------------------------------------------------------------------
// Palette shared by every screen.

export type TeamColors = Readonly<Record<Team, string>>

export interface Palette {
  readonly felt: string // baize seen in a dim room: green so dark it reads as black until parchment sits on it
  readonly feltRaised: string // the same cloth a shade lighter, for rows and controls that sit on the felt without becoming cards
  readonly parchment: string // fallback beneath the vellum image, also the light ink on dark controls
  readonly parchmentShade: string // solid colour for fine rules, borders and grabbers, never a paper surface
  readonly paperInset: string // a translucent ink wash for fields and groups; the vellum stays visible
  readonly paperPressed: string // a stronger translucent wash for selection and pressing on paper
  readonly ink: string // text on paper, warm black, never pure
  readonly inkMuted: string // secondary text on paper, the official coffee darkened until 13 px passes on the vellum's darkest grain
  readonly text: string // text on felt: cream under candle light
  readonly muted: string // secondary text on felt, and every dashed circle and secondary border, since a border must be seen in a dim room
  readonly line: string // seams only: the hairline where two surfaces meet, never a border around a control
  readonly accent: string // brass, the one colour for the thing to tap next: a fitting on the table, not a neon
  readonly onAccent: string // every label and glyph drawn on accent; apart from ink because the night ink is lifted for dark paper and would not read on brass
  readonly danger: string // destructive actions such as deleting a game
  readonly onDanger: string // the label on wax
  readonly teamOnPaper: TeamColors // team words on paper
  readonly teamOnFelt: TeamColors // team words on felt: the same hues raised until each passes 4.5:1 on the felt
  readonly aliveOnPaper: string // life status stays separate from good and evil alignment
  readonly deadOnPaper: string
  readonly goodOnPaper: string
  readonly evilOnPaper: string
  readonly goodOnFelt: string
  readonly evilOnFelt: string
}

export const palette: Palette = {
  felt: '#121614',
  feltRaised: '#232b26',
  parchment: '#eadbbf',
  parchmentShade: '#d1bb87',
  paperInset: '#66533f10',
  paperPressed: '#66533f28',
  ink: '#2a2018',
  inkMuted: '#5c4a37',
  text: '#efe6d2',
  muted: '#a89f8c',
  line: '#2f3a33',
  accent: '#c9963a',
  onAccent: '#2a2018',
  danger: '#b03a2e',
  onDanger: '#efe6d2',
  // The colours as printed, fetched on 2026-09-05 from the script tool's stylesheet: one blue
  // for Townsfolk and Outsiders, one red for Minions and Demons, as the printed sheet sets them.
  // Felt needs its own raised hues, since the same ink cannot sit on paper and on felt. Fabled's
  // gold lives in the art; its text colour is coffee.
  teamOnPaper: {
    townsfolk: '#0064ac',
    outsider: '#0064ac',
    minion: '#760a0d',
    demon: '#760a0d',
    traveller: '#57184c',
    fabled: '#76614b',
    loric: '#516c28',
  },
  teamOnFelt: {
    townsfolk: '#5fa3e6',
    outsider: '#5fa3e6',
    minion: '#e0574b',
    demon: '#e0574b',
    traveller: '#b76aa8',
    fabled: '#c9a86c',
    loric: '#8fb04a',
  },
  aliveOnPaper: '#356735',
  deadOnPaper: '#963e35',
  goodOnPaper: '#0064ac',
  evilOnPaper: '#760a0d',
  goodOnFelt: '#5fa3e6',
  evilOnFelt: '#e0574b',
}

// The scrims behind a sheet and behind the one dialog.
export const scrim = { sheet: 'rgba(0,0,0,0.35)', dialog: 'rgba(0,0,0,0.5)' } as const

// ---------------------------------------------------------------------------------------------
// Type. Two bundled faces. Grenze for display only: a serif with blackletter bones, the game's
// world, and nothing smaller than 24 except the name printed on a token. Atkinson Hyperlegible,
// drawn for low vision, for everything read. Each weight is its own family name, the way
// expo-google-fonts registers them, so a style names the family and sets no fontWeight: a
// browser given both would fake a second bold on top of the real one.

export const font = {
  display: {
    medium: 'Grenze_500Medium, Georgia, serif',
    semibold: 'Grenze_600SemiBold, Georgia, serif',
    bold: 'Grenze_700Bold, Georgia, serif',
  },
  body: {
    regular: 'AtkinsonHyperlegible_400Regular, system-ui, sans-serif',
    bold: 'AtkinsonHyperlegible_700Bold, system-ui, sans-serif',
  },
} as const

// Wherever a count is shown: tallies, the count table, the elapsed time, ledger numbering.
export const tabular: TextStyle = { fontVariant: ['tabular-nums'] }

// The seat name's line height is also a board measure (the name under a token), so it is named.
const seatNameLine = 16

const style = (fontFamily: string, fontSize: number, lineHeight: number, rest: TextStyle = {}): TextStyle => ({
  fontFamily,
  fontSize,
  lineHeight,
  ...rest,
})

export const type = {
  display: {
    // The card's words, uppercase there.
    hero: style(font.display.semibold, 40, 44, { letterSpacing: 0.5 }),
    // Screen titles, sheet titles, the phase counter in the clock corner.
    title: style(font.display.semibold, 24, 28),
    // Team bands on the script sheet and phase bands in the log: one rule device wherever it appears.
    band: style(font.display.medium, 24, 28, { letterSpacing: 1.5, textTransform: 'uppercase' }),
  },
  text: {
    // Rows, fields, descriptions.
    body: style(font.body.regular, 16, 22),
    // Character names, button labels, row titles.
    strong: style(font.body.bold, 16, 22),
    // Meta text, timestamps, footnotes, the count table.
    small: style(font.body.regular, 13, 18),
    // Ordinary labels; token print has its own smaller scale inside the disc.
    label: style(font.body.bold, 12, 14),
    // The player's name under a seat, read from arm's length across a dim table: the board's
    // most read words, so a size above the labels around it.
    seatName: style(font.body.bold, 14, seatNameLine),
    // The vote tally against its threshold.
    tally: style(font.body.bold, 28, 32, tabular),
  },
} as const

// The name on the arc of a token at `show` size and above: 22 px on a 200 token. The one Grenze
// use under 24, allowed because it is the token's own print, not text set in the interface.
// A small seat on a phone keeps a floor, a larger share of its disc, so a short name such as
// IMP or SPY still reads; a long one is fitted to the arc either way.
export const printedName = (tokenDiameter: number): TextStyle => {
  const fontSize = Math.round(Math.max(tokenDiameter * 0.11, Math.min(9, tokenDiameter * 0.16)))
  return { fontFamily: font.display.bold, fontSize, letterSpacing: fontSize * 0.08, textTransform: 'uppercase' }
}

// ---------------------------------------------------------------------------------------------
// Spacing, radii, lines, shadow, touch.

// A four-point grid with a two for the hairline gaps inside a token cluster.
export const space = { xxs: 2, xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const

// Translucent corner compartments let every velvet colour show through the same brass trim.
export const boardBlock: ViewStyle = {
  backgroundColor: '#10091760', borderColor: '#ae8a4e8c', borderWidth: 1, borderRadius: 7,
  boxShadow: 'inset 0 0 0 2px #10081338, 0 2px 7px #0003',
}
export const boardWell: ViewStyle = {
  borderStyle: 'solid', borderWidth: 1, borderColor: '#b997645c', backgroundColor: '#0d07102b',
  boxShadow: 'inset 0 1px 4px #0005',
}

// The vote dock: a near-black card edged in dull brass, its buttons a dark fitting, so the one
// brass button, Mark, is the only bright thing in it.
export const voteDock = { surface: '#171310', edge: '#776343', fitting: '#302c29' } as const

// Quiet surfaces keep the chosen fabric visible behind navigation.
export const velvetPanel: ViewStyle = { backgroundColor: '#10091799', borderColor: '#ac874e65', borderWidth: 1 }

// A pointer over a quiet control lifts it with a wash, never a colour, so hover cannot be
// mistaken for a selection.
export const hoverWash = { felt: '#ffffff12', paper: '#66533f14' } as const

// The screen gutter: lg on a phone, xl from tablet width.
export const gutter = { phone: space.lg, tablet: space.xl } as const

// Tokens and chips are circles; the card and the board have no radius at all.
export const radius = {
  control: 12, // buttons, fields
  tile: 14, // rows, edition tiles
  dialog: 16, // Confirm
  sheet: 20, // a floating window: a sheet, a phase panel
  chipLabel: 4,
} as const

// One pixel, always, and only for seams in `line`. StyleSheet.hairlineWidth goes below a pixel
// on dense screens and vanishes in a dim room.
export const hairline = 1

// Sheet and phase panel headers share one dark surface.
export const headerSurface: ViewStyle = {
  backgroundColor: palette.ink, borderBottomColor: palette.parchmentShade, borderBottomWidth: hairline,
}

// Every drawn border that is not a seam: the dashed circle of an empty seat, the add badge, the
// secondary button's outline uses two pixels of `muted` to stay visible.
export const border = 2

// Every tappable thing, chips included, gets this hit area even when what it draws is smaller.
export const touch = 44

// Focus, visible with a keyboard and hidden for touch: a brass outline offset from the control.
export const focusRing = { width: 2, offset: 2 } as const

// The brass ring around a chosen disc: a selected token, a recorded hand, a tapped row's icon.
// Drawn outside the disc so the art under it stays whole.
export const ring = { width: 3, gap: 2 } as const

export interface Shadows {
  readonly ticket: string // the cut lower edge of paper controls and script cards
  readonly ticketPressed: string
  readonly card: string // a small paper card in the information picker
  readonly lifted: string // a piece without a cardboard edge raised off the board: the ghost vote skull, a popover
  readonly sheet: string // a floating window
}

// Paper tickets have a cut lower edge; information cards use a softer shadow.
// Values are CSS box shadows.
export const shadows: Shadows = {
  ticket: '0 3px 0 rgba(0,0,0,0.25)',
  ticketPressed: 'inset 0 2px 4px rgba(0,0,0,0.18)',
  card: '0 2px 4px rgba(42,32,24,0.18)',
  lifted: '0 2px 6px rgba(0,0,0,0.55)',
  sheet: '0 -6px 24px rgba(0,0,0,0.45)',
}

export const tokenMaterial = {
  edge: '#655342',
  edgeShade: '#302820',
  rim: 'inset 0 1px 1px rgba(255,250,223,0.45), inset 0 -1px 2px #24150877',
  // A reminder's dark disc sits on dark velvet; a pale inner ring, the colour of the cream print,
  // draws its edge so it never melts into the cloth.
  reminderRim: 'inset 0 0 0 1.5px #efe6d280, inset 0 0 0 3px #0000004d',
  // A dead token fades rather than turning fully grey: alignment is the tint, and the Storyteller
  // still needs to tell a dead good player from a dead evil one.
  dead: 'saturate(0.3) brightness(0.78)',
} as const

// A 2.5% cut edge keeps small reminders finer than character discs. The two soft shadows
// put the bottom of the cardboard against the velvet without changing the token's footprint.
export const tokenShadow = (size: number): string => {
  const depth = size * 0.025
  return [
    `0 ${depth * 0.25}px 0 ${tokenMaterial.edge}`,
    `0 ${depth * 0.5}px 0 ${tokenMaterial.edge}`,
    `0 ${depth * 0.75}px 0 ${tokenMaterial.edgeShade}`,
    `0 ${depth}px 0 ${tokenMaterial.edgeShade}`,
    `0 ${depth + 2}px 3px rgba(0,0,0,0.48)`,
    `2px ${depth + 6}px 12px rgba(0,0,0,0.48)`,
  ].join(', ')
}

// ---------------------------------------------------------------------------------------------
// Token sizes, named for where they are drawn. Large tokens and board seats print the name.
// `corner` is the board's small disc: a granted ability in the corner strip, a gap where a seat
// can be added, and a dealt token as it leaves the centre.
export const tokenSize = { board: 104, sheet: 96, chip: 48, show: 200, corner: 36 } as const

// The board's fixed measures. The board area is the screen minus the safe insets; the status
// band holds its foot and the ring fits around the corner controls. The outer margin holds half
// a token, the player's name and a gap; reminder chips face inward.
export const layout = {
  statusBand: 88,
  contentMax: 720, // sheet content and every non-board screen cap here and centre
  dialogWidth: 320,
} as const

export interface Size {
  readonly width: number
  readonly height: number
}

export const seatMetrics = {
  maximum: 136,
  minimum: 44,
  nameOverhang: space.sm,
  nameGap: space.xxs,
  nameHeight: seatNameLine,
  padding: space.md,
  gap: space.xs,
} as const

// ---------------------------------------------------------------------------------------------
// Breakpoints, by width and never by device: a phone turned sideways and a narrow window get the
// same answer. The hook over these is in breakpoint.ts.
export const breakpoint = { tablet: 768 } as const

// ---------------------------------------------------------------------------------------------
// Motion. Three moments earn real motion (the reveal, the deal, the win); the rest is small.
// Every duration becomes 0 under reduced motion except opacity fades, which become 120 ms; the
// hook that applies that is in motion.ts.
export const motion = {
  ease: Easing.bezier(0.2, 0.8, 0.2, 1),
  easeIn: Easing.bezier(0.4, 0, 1, 1),
  css: { ease: 'cubic-bezier(0.2, 0.8, 0.2, 1)', easeIn: 'cubic-bezier(0.4, 0, 1, 1)' },
  duration: {
    reveal: 420, // the token rises on the card; its words fade in over 200 ms from 240 ms in
    flipOut: 120, // the neutral back turns to its edge before the character mounts
    flipIn: 180,
    lift: 380, // a drawn token rises from the face-down bag to full size before it turns
    revealWords: 200,
    revealWordsDelay: 240,
    deal: 380, // each token leaves the centre and lands on its seat
    dealStagger: 45,
    dealSpread: 400, // a large table shortens the stagger so its last token leaves this soon after the first
    win: 900, // the dark glow behind the result opens; the words rise from 300 ms in over 500 ms
    winWords: 500,
    winWordsDelay: 300,
    sheetIn: 260, // a page step or a full-screen sheet rises into place
    drawer: 220, // the reference opens and closes on a tap
    mark: 160, // a chip placed, a mark set, gap markers armed: scale 0.8 to 1 with opacity
    markStagger: 100, // a second mark that follows the first, the ghost vote after the token greys
    tint: 220, // a token's art crossfades to its other side
    fade: 120, // what every fade becomes under reduced motion
  },
  pressedOpacity: 0.7, // a button press is opacity; a token presses by scale instead
  disabledOpacity: 0.4,
  dimOpacity: 0.45, // a token drawn for reference and not in play
} as const

// Script logos need room for the editions' wide lettering in every list.
export const scriptListLogo = { width: 112, height: 72, flexShrink: 0 } as const
