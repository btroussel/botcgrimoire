import { StyleSheet } from 'react-native'
import { border, hairline, layout, radius, shadows, space, touch, type } from '../theme'

// Fixed measures of the sheet's own parts, named once.
const bandHeight = type.display.band.lineHeight! + 2 * space.sm
export const rowIcon = 88
export const readRowIcon = 48
const rowMinHeight = 56
export const smallArt = 24
export const orderIcon = 36
export const referenceIcon = readRowIcon
const orderItemHeight = 36
const countCell = 44
const countLabel = 120


export const styles = StyleSheet.create({
  paper: { flex: 1 },
  grow: { flex: 1 },
  centred: { textAlign: 'center' },
  // Above the scrolling paper, so the reason a blocked Save gives can open under the toolbar.
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: touch, paddingHorizontal: space.sm, gap: space.xs, zIndex: 1 },
  content: { paddingBottom: space.xl, width: '100%', maxWidth: layout.contentMax, alignSelf: 'center' },
  head: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.xs },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
  identityText: { flex: 1, minWidth: 0, gap: space.xxs },
  logoButton: { flexShrink: 0, borderRadius: radius.control },
  // The pencil on the logo's corner says the art is chosen here, as on the character editor's
  // token. That one is brass, the art being a step of its form; a logo is chosen rarely, so this
  // one is a parchment disc that does not draw the eye from the script.
  logoBadge: { position: 'absolute', right: -space.xs, bottom: -space.xs, width: 24, height: 24, borderRadius: 12, borderWidth: hairline, alignItems: 'center', justifyContent: 'center' },
  // The faint rule under the text says it is editable and turns brass on focus, in place of the
  // browser's ring. That ring has style auto, which ignores a zero width, so the style is set too.
  nameField: { alignSelf: 'stretch', minWidth: 0, minHeight: touch, padding: 0, borderBottomWidth: border, outlineStyle: 'solid', outlineWidth: 0 },
  // The band paints the full width so rows scroll under it while it sticks; the rule stops at the gutter.
  // It sticks within its team's block, so it leaves with that team's last row. React Native's
  // types lack sticky, which only the web draws.
  band: { height: bandHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, position: 'sticky', top: 0, zIndex: 1 } as object,
  editableBand: { minHeight: touch },
  bandAdd: { marginLeft: -space.sm, marginRight: space.xs },
  offered: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-around', marginHorizontal: space.lg, marginTop: space.sm, paddingTop: space.xs, borderTopWidth: hairline },
  // Narrower than a text button, so the three fit one line of a phone.
  offer: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: touch, paddingHorizontal: space.sm, borderRadius: radius.control },
  rule: { flex: 1, height: hairline, justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, height: border },
  bandLabel: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, paddingHorizontal: space.md },
  rows: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: space.sm },
  full: { width: '100%' },
  half: { width: '50%' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, minHeight: rowMinHeight, paddingVertical: space.sm, paddingHorizontal: space.sm },
  readRow: { paddingVertical: space.xs, paddingHorizontal: space.sm, gap: space.sm },
  readIconHit: { width: readRowIcon, height: readRowIcon },
  readRowBody: { paddingRight: 0 },
  rowBody: { flex: 1, flexDirection: 'row', alignItems: 'flex-start', gap: space.md, paddingRight: space.xs },
  rowAction: { gap: space.xxs, borderRadius: radius.tile },
  dimmed: { opacity: 0.45 },
  // The chosen row's check sits on the icon's upper right, inside its tap target, as the picker's does.
  check: { position: 'absolute', top: 2, right: 2, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    boxShadow: shadows.card },
  compactCheck: { top: -2, right: -4, width: 20, height: 20, borderRadius: 10 },
  iconHit: { width: rowIcon, height: rowIcon, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: rowIcon / 2 },
  rowText: { flex: 1, gap: space.xxs, paddingTop: space.xxs },
  below: { gap: space.xxs }, // the row text's gap, kept between the pieces hung under it
  jinx: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.sm },
  jinxPair: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 0 },
  jinxHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  referenceRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  referenceText: { gap: space.xxs },
  jinxList: { gap: space.xs },
  jinxIndent: { paddingLeft: space.xl }, // the jinxes step in under the Djinn that rules them
  footnote: { paddingHorizontal: space.lg, paddingTop: space.sm },
  section: { paddingHorizontal: space.lg, paddingTop: space.xl, gap: space.md },
  heading: { textTransform: 'uppercase', letterSpacing: 1 },
  table: { flexDirection: 'row', alignSelf: 'center', maxWidth: '100%', borderWidth: 1, borderRadius: radius.control, overflow: 'hidden' },
  tableLabels: { width: countLabel, flexShrink: 0 },
  tableRow: { flexDirection: 'row' },
  cell: { width: countCell, height: 36, flexShrink: 0, borderBottomWidth: 1, borderRightWidth: 1, alignItems: 'center', justifyContent: 'center' },
  labelCell: { width: countLabel, alignItems: 'flex-start', paddingHorizontal: space.sm },
  nights: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xl },
  order: { maxWidth: '100%', gap: space.md },
  orderName: { flexShrink: 1, minWidth: 0 },
  orderFlow: { gap: space.xs },
  orderItem: { flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: orderItemHeight },
})
