// A reminder token: a purple disc with large source art and its name curved along the lower rim.
// Its fixed footprint lets the ring place reminders without measuring the text. Notes use
// the same disc, their text clipped to the few lines that fit the disc's slot, so a long note
// never covers a neighbour; its window holds the whole text. With labels hidden a note shows its
// initials.
import { memo, useState } from 'react'
import type { ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { StyleProp, ViewStyle } from 'react-native'

import type { Alignment } from '../content'
import { tokenArt } from '../content/generated/art'
import { Appear } from './Appear'
import { Art } from './Art'
import { focusStyle, isFocused } from './Button'
import { CharacterIcon } from './CharacterIcon'
import { useFocusVisible } from './focus'
import { Icon } from './icons'
import { PrintedName } from './Token'
import { TokenDisc } from './TokenDisc'
import { border, motion, palette, space, tokenSize, touch, type } from './theme'

export interface ReminderChipProps {
  readonly size?: number // larger discs for browsing; board reminders keep the default footprint
  readonly label: string // the reminder's name, or a note's text
  readonly character?: string // the source character's id; a note has none and shows its first letters
  readonly art?: ReactNode // the source art itself, for a character with no saved record yet
  readonly alignment?: Alignment // the source art's tint; the team's own side when omitted
  readonly showLabel?: boolean // true when omitted
  readonly disabled?: boolean // keep the control and token face mounted while a stack is collapsed
  readonly discHitArea?: boolean // board tokens respond only inside the visible disc
  readonly arrive?: boolean // placed on the board: it grows in on mount, where a picker's copy is simply there
  readonly onPress?: () => void
  readonly accessibilityLabel?: string
}

// The first two characters of a note, whatever the script.
const noteInitials = (text: string): string => Array.from(text.trim()).slice(0, 2).join('')

const Disc = ({ size, children }: { readonly size: number; readonly children: ReactNode }) => {
  const source = tokenArt.reminder_bg
  return (
    <TokenDisc size={size}>
      {source !== undefined ? <Art source={source} fit="cover" style={{ position: 'absolute', inset: 0 }} /> : null}

      <View style={styles.centre}>{children}</View>
    </TokenDisc>
  )
}

export const ReminderChip = ({
  size = tokenSize.chip,
  label,
  character,
  art,
  alignment,
  showLabel = true,
  disabled = false,
  discHitArea = false,
  arrive = false,
  onPress,
  accessibilityLabel,
}: ReminderChipProps) => {
  const p = palette
  const focusVisible = useFocusVisible()
  const inert = !onPress
  return (
    <Pressable
      accessibilityRole={inert ? undefined : 'button'}
      accessibilityLabel={accessibilityLabel ?? label}
      disabled={inert || disabled}
      onPress={onPress}
      style={(state) => [
        styles.slot,
        { width: size + 2 * space.xs, minHeight: Math.max(touch, size + 2 * space.xs) },
        discHitArea ? { width: size, minHeight: size, borderRadius: size / 2, pointerEvents: inert || disabled ? 'none' : 'auto' } : null,
        focusStyle(p, isFocused(state) && focusVisible),
        { opacity: state.pressed ? motion.pressedOpacity : 1 },
      ]}
    >
      <Placed arrive={arrive}>
        <View style={[styles.discBox, { width: size + 2 * space.xs, height: size }]}>
          <ReminderFace size={size} label={label} showLabel={showLabel} noteWidth={size + 2 * space.xs}
            {...(character !== undefined ? { character } : {})} {...(art !== undefined ? { art } : {})} {...(alignment ? { alignment } : {})} />
        </View>
      </Placed>
    </Pressable>
  )
}

const Placed = ({ arrive, children }: { readonly arrive: boolean; readonly children: ReactNode }) => arrive
  ? <Appear style={styles.placed} pointerEvents="none">{children}</Appear>
  : <View style={styles.placed} pointerEvents="none">{children}</View>

// Three lines of a note's text fit the disc's height.
const noteLines = 3

// The face depends only on these values, so a stack redrawn for its seat leaves each disc's
// art and printed name alone.
const ReminderFace = memo(function ReminderFace({ size, label, noteWidth, character, art, alignment, showLabel }: {
  readonly size: number
  readonly label: string
  readonly noteWidth: number
  readonly character?: string
  readonly art?: ReactNode
  readonly alignment?: Alignment
  readonly showLabel: boolean
}) {
  const p = palette
  return <>
    <Disc size={size}>
      {character !== undefined || art !== undefined ? (
        <View style={showLabel ? { transform: [{ translateY: -size * 0.07 }] } : undefined}>
          {art ?? <CharacterIcon id={character ?? ''} size={size * 0.58} {...(alignment ? { tint: alignment } : {})} />}
        </View>
      ) : null}
      {showLabel && (character !== undefined || art !== undefined) ? (
        <PrintedName name={label} size={size} fontSize={size / 6} color={p.text} />
      ) : null}
    </Disc>
    {character === undefined && art === undefined ? <View style={styles.centre}>
      <Text numberOfLines={noteLines} style={[type.text.label, styles.note, { color: p.text, width: noteWidth, fontSize: size * 10 / 48, lineHeight: size * 11 / 48 }]}>
        {showLabel ? label : noteInitials(label)}
      </Text>
    </View> : null}
  </>
})

export interface AddSlotProps {
  readonly size: number // the disc it stands in for
  readonly label: string // what a screen reader says; the plus has no text
  readonly onPress: () => void
}

// An empty place for the next token among reminder discs: the dashed circle the board uses for
// an empty seat, with a plus.
export const AddSlot = ({ size, label, onPress }: AddSlotProps) => {
  const focusVisible = useFocusVisible()
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress}
      style={(state) => [styles.slot, { width: size + 2 * space.xs, minHeight: Math.max(touch, size + 2 * space.xs), borderRadius: size / 2 + space.xs },
        focusStyle(palette, isFocused(state) && focusVisible, 'paper'), { opacity: state.pressed ? motion.pressedOpacity : 1 }]}>
      <View style={[styles.empty, { width: size, height: size, borderRadius: size / 2, borderColor: palette.inkMuted }]}>
        <Icon name="add" color={palette.inkMuted} />
      </View>
    </Pressable>
  )
}

export interface AddBadgeProps {
  readonly shown: boolean // a mouse points at the seat; keyboard focus also reveals it
  readonly onPress: () => void
  readonly accessibilityLabel: string // what a screen reader says; the plus has no text
  readonly style?: StyleProp<ViewStyle>
}

// The add badge: a small dark disc with a plus on a seat token's rim, where a reminder is placed.
// Dark with a light rim so it reads on both the parchment token and the velvet around it. Hidden
// at rest so seven of them do not crowd the board; touch reaches the same action from the seat menu.
export const AddBadge = ({ shown, onPress, accessibilityLabel, style }: AddBadgeProps) => {
  const p = palette
  const focusVisible = useFocusVisible()
  const [focused, setFocused] = useState(false)
  const visible = shown || focused
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={(state) => [
        styles.badgeSlot,
        focusStyle(p, isFocused(state) && focusVisible),
        { opacity: !visible ? 0 : state.pressed ? motion.pressedOpacity : 1, pointerEvents: visible ? 'auto' : 'none' },
        style,
      ]}
    >
      <View style={[styles.badge, { backgroundColor: p.ink, borderColor: p.muted }]} pointerEvents="none">
        <Icon name="add" color={p.text} size={badge - 2 * border - 4} />
      </View>
    </Pressable>
  )
}

const badge = 24

const styles = StyleSheet.create({
  slot: { alignItems: 'center', justifyContent: 'center' },
  // The chip appears with the mark motion when it is placed; the wrapper keeps the slot's centring.
  placed: { alignItems: 'center', justifyContent: 'center' },
  discBox: { alignItems: 'center', justifyContent: 'center' },
  centre: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  badgeSlot: { width: touch, height: touch, borderRadius: touch / 2, alignItems: 'center', justifyContent: 'center' },
  empty: { borderWidth: border, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  badge: { width: badge, height: badge, borderRadius: badge / 2, borderWidth: border, alignItems: 'center', justifyContent: 'center' },
  note: { textAlign: 'center', textShadowColor: palette.felt, textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
})
