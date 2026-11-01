import type { StyleProp, ViewStyle } from 'react-native'
import { ScrollView, Text, View } from 'react-native'
import type { NightMarker } from '../../content'
import { genericArt } from '../../content/generated/art'
import type { ArtSource } from '../Art'
import { AbilityText } from '../AbilityText'
import { Art } from '../Art'
import { CharacterIcon } from '../CharacterIcon'
import type { Palette } from '../theme'
import { tabular, type } from '../theme'
import { orderIcon, referenceIcon, styles } from './styles'
import type { NightOrderItem, ScriptSheetCountTable, ScriptSheetTeam } from './types'

// The markers' art under the upstream file names, which are the ids on the night sheet. The board's
// reference and the character editor's order column draw the same discs.
export const nightMarkerArt: Readonly<Record<NightMarker, number | undefined>> = {
  dusk: genericArt['dusk'],
  dawn: genericArt['dawn'],
  minionInfo: genericArt['minioninfo'],
  demonInfo: genericArt['demoninfo'],
}

// Art that is not a character, at its own aspect ratio: a night marker or the script's logo.
// A plain image, because react-native-web's Image paints a CSS background and browsers leave
// backgrounds off the printed page by default.
export const SheetArt = ({ source, width, height }: { readonly source: ArtSource | undefined; readonly width: number; readonly height: number; }) => (
  <View style={[{ width, height }]} accessible={false}>
    {source !== undefined ? <Art source={source} /> : null}
  </View>
)

interface CountTableProps {
  readonly table: ScriptSheetCountTable
  readonly columns: readonly number[]
  readonly heading: string
  readonly p: Palette
}

export const CountTable = ({ table, columns, heading, p }: CountTableProps) => {
  const indices = columns.map((n) => table.players.indexOf(n)).filter((i) => i >= 0)
  const cell = (header = false): StyleProp<ViewStyle> => [
    styles.cell,
    { borderColor: p.parchmentShade, backgroundColor: header ? p.paperInset : 'transparent' },
  ]
  return (
    <View id="script-sheet-counts" style={styles.section}>
      <table className="script-count-table" style={{ display: 'none' }}>
        <thead>
          <tr><th scope="col">{heading}</th>{indices.map((i) => <th key={i} scope="col">{table.players[i]}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row) => (
            <tr key={row.label} className={`script-count-${row.team}`}>
              <th scope="row">{row.label}</th>
              {indices.map((i) => <td key={i}>{row.by[i] ?? 0}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <View id="script-sheet-counts-screen" style={[styles.table, { borderColor: p.parchmentShade }]}>
        <View style={styles.tableLabels}>
          <View style={[styles.cell, styles.labelCell, { backgroundColor: p.paperInset, borderColor: p.parchmentShade }]}>
            <Text style={[type.text.label, { color: p.ink }]}>{heading}</Text>
          </View>
          {table.rows.map((r) => (
            <View key={r.label} style={[styles.cell, styles.labelCell, { borderColor: p.parchmentShade }]}>
              <Text style={[type.text.small, { color: p.ink }]} numberOfLines={1}>{r.label}</Text>
            </View>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator style={styles.grow}>
          <View>
            <View style={styles.tableRow}>
              {indices.map((i) => {
                const n = table.players[i]!
                return <View key={n} style={cell(true)}><Text style={[type.text.label, tabular, { color: p.ink }]}>{String(n)}</Text></View>
              })}
            </View>
            {table.rows.map((r) => (
              <View key={r.label} style={styles.tableRow}>
                {indices.map((i) => {
                  const n = table.players[i]!
                  return <View key={n} style={cell()}><Text style={[type.text.small, tabular, { color: p.ink }]}>{String(r.by[i] ?? 0)}</Text></View>
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </View>
  )
}

// ---------------------------------------------------------------------------------------------
// A night order as a flowing line: each step its icon and name, the four markers their art and
// word, in the order the Storyteller wakes them.

export const NightOrder = ({ heading, items, p }: { readonly heading: string; readonly items: readonly NightOrderItem[]; readonly p: Palette }) => (
  <View style={styles.order}>
    <Text style={[type.display.title, { color: p.ink }]}>{heading}</Text>
    <View style={styles.orderFlow}>
      {items.map((item, i) =>
        item.kind === 'character' ? (
          <View key={`${item.id}-${i}`} style={styles.orderItem}>
            <CharacterIcon id={item.id} team={item.team} size={orderIcon}  />
            <Text style={[type.text.small, styles.orderName, { color: p.ink }]}>{item.name}</Text>
          </View>
        ) : (
          <View key={`${item.marker}-${i}`} style={styles.orderItem}>
            <SheetArt source={nightMarkerArt[item.marker]} width={orderIcon} height={orderIcon}  />
            <Text style={[type.text.strong, styles.orderName, { color: p.ink }]}>{item.label}</Text>
          </View>
        ),
      )}
    </View>
  </View>
)

// ---------------------------------------------------------------------------------------------
// A team as the printed reference page lists it: Travellers, Fabled and Loric are a few lines,
// not worth a page of their own after the Demons.

export const ReferenceTeam = ({ group, color, p }: { readonly group: ScriptSheetTeam; readonly color: string; readonly p: Palette }) => (
  <View id={`script-sheet-reference-${group.team}`} style={styles.section}>
    <Text role="heading" style={[type.text.strong, styles.heading, { color }]}>{group.label}</Text>
    {group.rows.map((row) => (
      <View key={row.id} style={styles.referenceRow}>
        <CharacterIcon id={row.id} team={row.team} size={referenceIcon} />
        <View style={styles.grow}>
          <Text id={`script-sheet-refname-${row.id}`} style={[type.text.strong, { color }]}>{row.name}</Text>
          <Text style={[type.text.small, { color: p.ink }]}><AbilityText text={row.ability} /></Text>
        </View>
      </View>
    ))}
  </View>
)
