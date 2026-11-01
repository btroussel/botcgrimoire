import { StyleSheet } from 'react-native'
import { border, hairline, layout, radius, space, touch, type } from '../theme'

// Fixed measures of the sheet's own parts, named once.
const bandHeight = type.display.band.lineHeight! + 2 * space.sm
export const rowIcon = 88
export const readRowIcon = 48
const rowMinHeight = 56
export const smallArt = 24
export const orderIcon = 36
export const referenceIcon = 36
const orderItemHeight = 36
const countCell = 44
const countLabel = 120


export const styles = StyleSheet.create({
  paper: { flex: 1 },
  grow: { flex: 1 },
  centred: { textAlign: 'center' },
  toolbar: { flexDirection: 'row', alignItems: 'center', minHeight: touch, paddingHorizontal: space.sm, gap: space.xs },
  content: { paddingBottom: space.xl, width: '100%', maxWidth: layout.contentMax, alignSelf: 'center' },
  head: { alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.xs },
  identity: { flexDirection: 'row', alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
  identityText: { flex: 1, minWidth: 0, gap: space.xxs },
  // react-native-web draws its own focus outline on the input; the faint rule under it says the
  // text is editable and turns brass on focus instead.
  nameField: { alignSelf: 'stretch', minWidth: 0, minHeight: touch, padding: 0, borderBottomWidth: border, outlineWidth: 0 },
  // The band paints the full width so rows scroll under it while it sticks; the rule stops at the gutter.
  // It sticks within its team's block, so it leaves with that team's last row. React Native's
  // types lack sticky, which only the web draws.
  band: { height: bandHeight, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.lg, position: 'sticky', top: 0, zIndex: 1 } as object,
  editableBand: { minHeight: touch },
  bandAdd: { marginLeft: -space.sm, marginRight: space.xs },
  emptyTeam: { alignItems: 'center', paddingBottom: space.lg },
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
  iconHit: { width: rowIcon, height: rowIcon, flexShrink: 0, alignItems: 'center', justifyContent: 'center', borderRadius: rowIcon / 2 },
  rowText: { flex: 1, gap: space.xxs, paddingTop: space.xxs },
  jinx: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingBottom: space.sm },
  jinxPair: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 0 },
  jinxHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  referenceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
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
