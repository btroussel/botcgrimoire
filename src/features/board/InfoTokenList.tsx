// Compact parchment choices, with the artwork beside each translated message, or above it on a
// phone under 360 points, where beside it leaves a French word such as personnages too little room.
// The feature decides whether picking a card opens it or asks for its content.
import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import Svg, { Image as SvgImage, Path } from 'react-native-svg'

import type { CharacterImage } from '../../content/generated/art'
import { characterArt } from '../../content/generated/art'
import type { CardKind } from '../../ui/BoardInteraction'
import { Token } from '../../ui/Token'
import { focusStyle, isFocused } from '../../ui/Button'
import { useFocusVisible } from '../../ui/focus'
import { Icon } from '../../ui/icons'
import { PaperTexture } from '../../ui/PaperTexture'
import type { Palette } from '../../ui/theme'
import { hairline, palette, radius, shadows, space, type } from '../../ui/theme'
import { useViewport } from '../../ui/Viewport'

export interface InfoTokenItem {
  readonly kind: CardKind
  readonly key?: string // set where several items share a kind, as homebrew cards do
  readonly label: string // the token's words, short, sentence case
  readonly characters?: readonly string[] // current characters used in a composed preview
}

export interface InfoTokenListProps {
  readonly items: readonly InfoTokenItem[]
  readonly onPick: (item: InfoTokenItem) => void
}

// Most previews use the art alone; bluffs show the same character tokens as the board.
type PreviewMark = { readonly art: CharacterImage | undefined } | { readonly glyph: 'identity' | 'player' | 'selection' | 'bluffs' | 'note' }

const previewMark: Readonly<Record<CardKind, PreviewMark>> = {
  youAre: { glyph: 'identity' },
  thisPlayerIs: { glyph: 'player' },
  tokenOnly: { art: characterArt.townsfolk?.good },
  selectedYou: { glyph: 'selection' },
  thisIsTheDemon: { art: characterArt.demon?.evil },
  theseAreYourMinions: { art: characterArt.minion?.evil },
  notInPlay: { glyph: 'bluffs' },
  custom: { glyph: 'note' },
}

const Preview = ({ item, p, stacked }: { readonly item: InfoTokenItem; readonly p: Palette; readonly stacked: boolean }) => {
  const mark = previewMark[item.kind]
  const art = 'art' in mark ? mark.art : undefined
  const glyph = 'glyph' in mark ? mark.glyph : undefined
  // A homebrew character's own card shows that character.
  const own = item.kind === 'custom' ? item.characters?.[0] : undefined
  return (
    <View accessible={false} style={[styles.preview, stacked && styles.stackedPreview]}>
      {own !== undefined ? (
        <Token character={own} size={50} />
      ) : art !== undefined ? (
        <Image source={art} style={styles.previewArt} resizeMode="contain" accessible={false} />
      ) : glyph === 'identity' || glyph === 'player' ? (
        <View style={styles.masks}>
          {(['good', 'evil'] as const).map((side, i) => {
            const mask = characterArt[side]?.single
            return mask ? <Image key={side} source={mask} style={[styles.mask, i === 0 ? styles.goodMask : styles.evilMask]} resizeMode="contain" accessible={false} /> : null
          })}
          {glyph === 'player' ? (
            <View style={[styles.playerBadge, { backgroundColor: p.parchment }]}>
              <PaperTexture radius={9} />
              <Icon name="players" color={p.ink} size={16} />
            </View>
          ) : null}
        </View>
      ) : glyph === 'selection' ? (
        <Svg width={64} height={56} viewBox="0 0 64 56" aria-hidden>
          <SvgImage href={characterArt.townsfolk?.good?.uri} x={-7} y={5} width={43} height={43} />
          <SvgImage href={characterArt.good?.single?.uri} x={37} y={1} width={29} height={29} />
          <SvgImage href={characterArt.evil?.single?.uri} x={42} y={23} width={29} height={29} />
          <Path d="M27 26.5H38V22L45 28L38 34V29.5H27Z" fill={p.ink} stroke={p.parchment} strokeWidth={1.2} strokeLinejoin="round" />
        </Svg>
      ) : glyph === 'bluffs' ? (
        <View style={styles.bluffs}>
          {(item.characters?.length ? item.characters.slice(0, 3) : ['washerwoman', 'slayer', 'monk']).map((id, i) => (
            <Token
              key={`${i}-${id}`}
              character={id}
              size={30}
              style={{ position: 'absolute', left: i * 15, top: i === 1 ? 0 : 20 }}
            />
          ))}
        </View>
      ) : (
        <View style={styles.symbol}>
          <Icon name="edit" color={p.ink} size={28} />
        </View>
      )}
    </View>
  )
}

const Row = ({ item, p, stacked, onPick }: { readonly item: InfoTokenItem; readonly p: Palette; readonly stacked: boolean; readonly onPick: (item: InfoTokenItem) => void }) => {
  const focusVisible = useFocusVisible()
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={item.label}
      onPress={() => onPick(item)}
      style={(state) => [
        styles.row,
        stacked && styles.stacked,
        { backgroundColor: p.parchment, borderColor: p.parchmentShade, boxShadow: state.pressed ? 'none' : shadows.card, opacity: state.pressed ? 0.85 : 1 },
        focusStyle(p, isFocused(state) && focusVisible, 'paper'),
      ]}
    >
      <PaperTexture radius={radius.chipLabel} />
      <Preview item={item} p={p} stacked={stacked} />
      <View style={[styles.lines, stacked && styles.stackedLines]}>
        <Text style={[type.text.label, styles.label, { color: p.ink }]}>
          {item.label}
        </Text>
      </View>
    </Pressable>
  )
}

export const InfoTokenList = ({ items, onPick }: InfoTokenListProps) => {
  const p = palette
  const stacked = useViewport().width < 360

  return (
        <View style={styles.grid}>
          {items.map((item) => (
            <View key={item.key ?? item.kind} style={styles.half}>
              <Row item={item} p={p} stacked={stacked} onPick={onPick} />
            </View>
          ))}
        </View>
  )
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  half: { width: '50%', padding: space.xs },
  row: {
    flex: 1,
    minHeight: 64,
    flexDirection: 'row',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    alignItems: 'center',
    justifyContent: 'flex-start',
    borderWidth: hairline,
    borderRadius: radius.chipLabel,
    gap: space.xs,
  },
  stacked: { flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' },
  lines: { flex: 1, minWidth: 0, justifyContent: 'center', gap: space.xxs },
  stackedLines: { flex: 0, alignSelf: 'stretch' },
  // The bluffs' fanned tokens reach below the art's box.
  stackedPreview: { marginBottom: space.md },
  label: { textAlign: 'left' },
  preview: { width: 40, height: 40, flexShrink: 0, alignItems: 'center', justifyContent: 'center', transform: [{ scale: 0.7 }] },
  previewArt: { width: 50, height: 50 },
  symbol: { alignItems: 'center', justifyContent: 'center' },
  masks: { width: 50, height: 42 },
  mask: { position: 'absolute', width: 36, height: 36 },
  goodMask: { left: 0, top: 0 },
  evilMask: { right: 0, bottom: 0 },
  playerBadge: { position: 'absolute', right: 0, bottom: -2, borderRadius: 9, padding: 1 },
  bluffs: { width: 60, height: 50 },
})
