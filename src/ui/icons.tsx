// The interface's glyphs: line icons at 24 with a 1.75 stroke, drawn here so no icon library
// ships and every glyph shares one weight. A piece picks the colour (text on felt, ink on
// paper, onAccent on brass); the icon is the shape and nothing else.
import { memo } from 'react'
import Svg, { Circle, Path } from 'react-native-svg'

export type IconName =
  | 'back'
  | 'more'
  | 'close'
  | 'home'
  | 'add'
  | 'minus'
  | 'search'
  | 'check'
  | 'settings'
  | 'chevronRight'
  | 'chevronDown'
  | 'chevronUp'
  | 'history'
  | 'addSeat'
  | 'turnLeft'
  | 'turnRight'
  | 'show'
  | 'script'
  | 'order'
  | 'share'
  | 'link'
  | 'scan'
  | 'print'
  | 'trash'
  | 'shuffle'
  | 'play'
  | 'pause'
  | 'reset'
  | 'edit'
  | 'character'
  | 'skull'
  | 'vote'
  | 'nominate'
  | 'players'
  | 'player'
  | 'sun'
  | 'setup'
  | 'info'

// Each glyph is one or more path strings in a 24 x 24 box; `circle` marks a lens or a disc.
const glyphs: Readonly<Record<IconName, { readonly d: readonly string[]; readonly circle?: readonly [number, number, number] }>> = {
  back: { d: ['M15 5 8 12l7 7'] },
  // Ringed dots: a bare round cap is under two pixels wide and vanishes on a dim board.
  more: { d: ['M4 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M11 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0', 'M18 12a1 1 0 1 0 2 0a1 1 0 1 0-2 0'] },
  close: { d: ['M6 6l12 12', 'M18 6 6 18'] },
  home: { d: ['M4 11 12 4l8 7', 'M6 10v10h12V10'] },
  add: { d: ['M12 5v14', 'M5 12h14'] },
  minus: { d: ['M5 12h14'] },
  shuffle: { d: ['M3 6h3l12 12h3', 'M17 14l4 4-4 4', 'M3 18h3l4-4', 'M14 10l4-4h3', 'M17 2l4 4-4 4'] },
  play: { d: ['M8 4l12 8-12 8z'] },
  pause: { d: ['M7 4h3v16H7z', 'M14 4h3v16h-3z'] },
  reset: { d: ['M3 10a9 9 0 1 1 1 7', 'M3 4v6h6'] },
  edit: { d: ['M14 5l5 5', 'M4 20l1-6L16 3a2 2 0 0 1 3 0l2 2a2 2 0 0 1 0 3L10 19z'] },
  character: { d: ['M4 4c5 2 11 2 16 0v7c0 5-4 9-8 11-4-2-8-6-8-11Z', 'M7 10h2', 'M15 10h2', 'M8 14c2 3 6 3 8 0'] },
  skull: { d: ['M8 21v-4H5v-6a7 7 0 0 1 14 0v6h-3v4Z', 'M8 10h1v2H8Z', 'M15 10h1v2h-1Z', 'M11 15h2', 'M11 18v3', 'M14 18v3'] },
  vote: { circle: [12, 12, 9], d: ['M8 12l3 3 5-6'] },
  nominate: { circle: [9, 7, 3], d: ['M3 21v-3a6 6 0 0 1 12 0v3', 'M16 7h6', 'M19 4l3 3-3 3'] },
  players: { d: ['M8 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7', 'M2 21v-2a6 6 0 0 1 12 0v2', 'M16 4a3.5 3.5 0 0 1 0 7', 'M17 14a5 5 0 0 1 5 5v2'] },
  player: { circle: [12, 7, 3.5], d: ['M5 21v-2a7 7 0 0 1 14 0v2'] },
  setup: { d: ['M9 6a3 3 0 1 0 6 0a3 3 0 1 0-6 0', 'M3 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0', 'M15 17a3 3 0 1 0 6 0a3 3 0 1 0-6 0'] },
  info: { circle: [12, 12, 9], d: ['M12 11v5', 'M12 8h.01'] },
  sun: { circle: [12, 12, 4], d: ['M12 2v2', 'M12 20v2', 'M2 12h2', 'M20 12h2', 'M5 5l1.5 1.5', 'M17.5 17.5 19 19', 'M5 19l1.5-1.5', 'M17.5 6.5 19 5'] },
  search: { d: ['M15.5 15.5 20 20'], circle: [10.5, 10.5, 6] },
  check: { d: ['M5 12.5l4.5 4.5L19 7'] },
  settings: { d: ['M9.5 3h5l.6 2.5 1.4.8 2.5-.7 2.5 4.3-1.9 1.8v1.6l1.9 1.8-2.5 4.3-2.5-.7-1.4.8-.6 2.5h-5l-.6-2.5-1.4-.8-2.5.7L2.5 15l1.9-1.8v-1.6L2.5 9.8 5 5.5l2.5.7 1.4-.8z'], circle: [12, 12, 3] },
  chevronRight: { d: ['M9 5l7 7-7 7'] },
  chevronDown: { d: ['M5 9l7 7 7-7'] },
  chevronUp: { d: ['M5 15l7-7 7 7'] },
  history: { d: ['M3 10a9 9 0 1 1 1 7', 'M3 4v6h6', 'M12 7v6l4 2'] },
  // A seat ring with a plus for the gap.
  addSeat: { d: ['M12 15v6', 'M9 18h6', 'M5.5 15a7.5 7.5 0 1 1 13 0'] },
  // Most of a circle with its arrowhead: the ring turning one place either way.
  turnLeft: { d: ['M4 12a8 8 0 1 0 2.6-5.9', 'M4 3v4h4'] },
  turnRight: { d: ['M20 12a8 8 0 1 1-2.6-5.9', 'M20 3v4h-4'] },
  // An eye: the card turned to a player.
  show: { d: ['M2.5 12c2.5-4.5 5.7-6.5 9.5-6.5s7 2 9.5 6.5c-2.5 4.5-5.7 6.5-9.5 6.5S5 16.5 2.5 12z'], circle: [12, 12, 2.75] },
  // A scroll, the printed sheet.
  script: { d: ['M7 4h11a2 2 0 0 1 2 2v1H9', 'M7 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9', 'M9 12h6', 'M9 16h6'] },
  // A deep crescent with two clear tips stays recognisable at toolbar size.
  order: { d: ['M17.5 3.5a9 9 0 1 0 0 17A9.5 9.5 0 0 1 17.5 3.5Z'] },
  share: { d: ['M12 15V4', 'M8 8l4-4 4 4', 'M5 12v8h14v-8'] },
  link: { d: ['M10.5 13.5a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1 1', 'M13.5 10.5a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1-1'] },
  scan: { d: ['M4 9V5a1 1 0 0 1 1-1h4', 'M15 4h4a1 1 0 0 1 1 1v4', 'M20 15v4a1 1 0 0 1-1 1h-4', 'M9 20H5a1 1 0 0 1-1-1v-4', 'M7 12h10'] },
  print: { d: ['M7 8V3h10v5', 'M5 8h14a1 1 0 0 1 1 1v7h-3', 'M4 16V9a1 1 0 0 1 1-1', 'M7 14h10v7H7z'] },
  trash: { d: ['M4 7h16', 'M9 7V4h6v3', 'M6 7l1 14h10l1-14', 'M10 11v6', 'M14 11v6'] },
}

export interface IconProps {
  readonly name: IconName
  readonly color: string
  readonly size?: number
}

// react-native-svg redraws an unchanged icon at real cost, and most icons never change.
export const Icon = memo(function Icon({ name, color, size = 24 }: IconProps) {
  const g = glyphs[name]
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      {g.d.map((d) => (
        <Path key={d} d={d} stroke={color} strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {g.circle ? <Circle cx={g.circle[0]} cy={g.circle[1]} r={g.circle[2]} stroke={color} strokeWidth={1.75} /> : null}
    </Svg>
  )
})
