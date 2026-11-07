// One seat as the board draws it: the token, greyed once dead, the name under it, the ghost vote
// skull while a dead seat holds it, a reminder stack pointing toward the centre, and the plus on
// the token's rim.
// One rule: the piece is anchored on the token. Its box is the token's (size x size) and
// everything else hangs off it in absolute positions, so the board places a seat by its token's
// centre and never measures the rest. Identity markers arrive as ordinary chips; the feature
// chooses which character goes on the disc and which goes beside it.
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

import type { Alignment } from '../content'
import { AddBadge, ReminderChip } from './ReminderChip'
import { AvailableRing, BlockMark, GhostVoteMark, SelectedRing } from './SeatMarks'
import { Token } from './Token'
import { motion, palette, seatMetrics, seatNameStyle, space, tokenSize, touch } from './theme'

export interface SeatChip {
  readonly key: string
  readonly label: string // a reminder, note or identity label
  readonly character?: string // the source character's id; a note when omitted
  readonly alignment?: Alignment
  readonly onPress?: () => void
  readonly accessibilityLabel?: string
  readonly draggable?: boolean // tagged with data-chip, its key, for the board's drag
  readonly lifted?: boolean // being dragged: it stays in its place, faded, until it lands
}

export interface SeatProps {
  readonly size: number // the token's diameter, from the fitted ring layout
  readonly name: string
  readonly characterName?: string // localized name printed on the disc
  readonly character?: string // the character displayed on the disc; an empty seat when omitted
  readonly alignment?: Alignment // the tint; the team's own side when omitted
  readonly dead?: boolean
  readonly onBlock?: boolean
  readonly ghostVote?: boolean // a dead seat shows its skull while it holds the vote
  readonly selected?: boolean | undefined // the brass ring: a hand recorded, a seat picked
  readonly dropTarget?: boolean // the brass ring alone: a dragged reminder would land here
  readonly pickable?: boolean // unavailable seats fade; earlier selections stay marked and readable
  readonly quietPick?: boolean // voting keeps the board unchanged apart from recorded hands
  readonly chips?: readonly SeatChip[]
  readonly remindersLabel?: string
  readonly onRemindersExpanded?: (expanded: boolean) => void
  readonly onAddReminder?: () => void
  readonly addReminderLabel?: string
  readonly angle?: number // outward direction assigned by the ring, 0 right and 90 down
  readonly onPress?: () => void
  readonly accessibilityLabel?: string // the whole seat in words; the name when omitted
}

// The name's box: the token plus a little either side, centred under it.
const nameOverhang = seatMetrics.nameOverhang
// The two gaps in the printed rim markers: night leaves at nine and three o'clock, reminder
// counts across the top, the setup flower low on the right and the name along the bottom.
const plusCorners = [-140, -40].map(degrees => ({ x: Math.cos(degrees * Math.PI / 180), y: Math.sin(degrees * Math.PI / 180) }))

// A reminder is three fifths of its seat's token, never under the chip size, so a tablet's or a
// desktop's big tokens carry reminders whose words read, and never over the token itself, so on
// a crowded twenty-seat board the reminder never outgrows the seat it belongs to.
export const reminderSize = (token: number): number => Math.round(Math.min(token, Math.max(tokenSize.chip, token * 0.6)))

export const Seat = ({
  size,
  name,
  character,
  characterName,
  alignment,
  dead,
  onBlock,
  ghostVote,
  selected,
  dropTarget = false,
  pickable,
  quietPick = false,
  chips = [],
  remindersLabel,
  onRemindersExpanded,
  onAddReminder,
  addReminderLabel,
  angle,
  onPress,
  accessibilityLabel,
}: SeatProps) => {
  const p = palette
  const nameTop = size + seatMetrics.nameGap
  const nameStyle = seatNameStyle(size)
  const nameLine = nameStyle.lineHeight ?? 0
  const nameWidth = size + 2 * nameOverhang

  const [expanded, setExpanded] = useState(false)
  // Only a mouse reveals the plus: a tap would leave it showing, and touch uses the seat menu.
  const [pointing, setPointing] = useState(false)
  const stackRef = useRef<HTMLDivElement>(null)
  const openStack = (open: boolean) => {
    setExpanded(open)
    onRemindersExpanded?.(open)
  }
  useEffect(() => {
    if (!expanded) return
    const dismiss = (event: PointerEvent) => {
      if (!stackRef.current?.contains(event.target as Node)) {
        setExpanded(false)
        onRemindersExpanded?.(false)
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [expanded, onRemindersExpanded])
  const chipSize = reminderSize(size)
  const chipSlot = { width: chipSize + 2 * space.xs, height: Math.max(touch, chipSize + 2 * space.xs) }
  const radians = ((angle ?? 270) * Math.PI) / 180
  const inward = { x: -Math.cos(radians), y: -Math.sin(radians) }
  // Only downward stacks need room for the name; diagonal stacks clear it to the side.
  const nameClearance = Math.max(0, inward.y - Math.abs(inward.x)) * (nameLine + space.xxs)
  const distance = size / 2 + chipSize / 2 + space.xxs + nameClearance
  // Every reminder follows the same inward axis.
  const step = expanded ? chipSize + space.xxs : chipSize / 2
  const points = chips.map((_, i) => ({
    x: inward.x * (distance + i * step),
    y: inward.y * (distance + i * step),
  }))
  const minX = Math.min(...points.map(point => point.x)) - chipSlot.width / 2
  const minY = Math.min(...points.map(point => point.y)) - chipSlot.height / 2
  const blockWidth = Math.max(...points.map(point => point.x)) + chipSlot.width / 2 - minX
  const blockHeight = Math.max(...points.map(point => point.y)) + chipSlot.height / 2 - minY
  // Clip only the hit target, leaving each disc's artwork and shadow untouched.
  const hitPath = points.map(point => {
    const x = point.x - minX
    const y = point.y - minY
    const r = chipSize / 2
    return `M ${x - r} ${y} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`
  }).join(' ')
  const first = points[0]
  const last = points.at(-1)
  // The plus stays on the rim, in whichever gap lies further from the stack, so it never moves
  // as reminders arrive and never drifts toward another seat. A tie keeps it on the left.
  const plusAt = plusCorners.reduce((best, corner) => corner.x * inward.x + corner.y * inward.y < best.x * inward.x + best.y * inward.y - 0.01 ? corner : best)
  const hoverLength = first && last ? Math.hypot(last.x - first.x, last.y - first.y) + chipSize : 0
  // A reminder prints its name on its lower rim, so on a stack running downward the nearer disc
  // sits on top and leaves the next one's name uncovered; otherwise the farther disc does.
  const layer = (i: number) => inward.y > 0.01 ? chips.length - i : i + 1
  // Only a mouse or keyboard reveals the plus, so a small token can take a smaller target, one
  // that never reaches its centre, where a click belongs to the seat.
  const plusHit = Math.min(touch, Math.round(size * 0.6))

  return (
    <View style={{ width: size, height: size }}
      onPointerEnter={event => { if (event.nativeEvent.pointerType === 'mouse') setPointing(true) }}
      onPointerLeave={() => setPointing(false)}>
      {pickable && !selected && !quietPick ? <AvailableRing size={size} /> : null}
      <Token
        size={size}
        printName
        {...(characterName ? { name: characterName } : {})}
        {...(character !== undefined ? { character } : {})}
        {...(alignment ? { alignment } : {})}
        {...(selected !== undefined ? { selected } : {})}
        dim={pickable === false && !selected && !quietPick}
        dead={dead ?? false}
        disabled={pickable === false}
        {...(onPress ? { onPress } : {})}
        accessibilityLabel={accessibilityLabel ?? name}
      />
      {dropTarget ? <SelectedRing size={size} /> : null}
      {onBlock ? <BlockMark size={size} /> : null}
      {dead && ghostVote ? <GhostVoteMark size={size} /> : null}
      <Text
        // react-native-web caps a Text at its parent's width, and the parent here is the token's box.
        // A diagonal stack's first disc reaches the end of a long name, so the name is drawn above
        // the seat's reminders and lets their taps through.
        style={[nameStyle, styles.name, { top: nameTop, left: -nameOverhang, width: nameWidth, maxWidth: nameWidth, zIndex: chips.length + 2, color: pickable === false && !selected && !quietPick ? p.muted : p.text }]}
        numberOfLines={1}
      >
        {name}
      </Text>
      {chips.length > 0 ? (
        <div ref={stackRef}
          onMouseLeave={() => openStack(false)}
          onKeyDown={event => { if (event.key === 'Escape') openStack(false) }}
          style={{ position: 'absolute', left: size / 2 + minX, top: size / 2 + minY, width: blockWidth, height: blockHeight, pointerEvents: 'none' }}>
          {/* A narrow corridor keeps the stack open while crossing the gaps between discs. */}
          {expanded && first && last ? <div aria-hidden="true" style={{ position: 'absolute',
            left: (first.x + last.x) / 2 - minX - hoverLength / 2,
            top: (first.y + last.y) / 2 - minY - chipSize / 2,
            width: hoverLength, height: chipSize, borderRadius: chipSize / 2,
            transform: `rotate(${Math.atan2(inward.y, inward.x)}rad)`, pointerEvents: 'auto' }} /> : null}
          {chips.map((chip, i) => {
            const point = points[i]!
            return <div key={chip.key} {...(chip.draggable ? { 'data-chip': chip.key } : {})} style={{ position: 'absolute', left: point.x - minX - chipSlot.width / 2, top: point.y - minY - chipSlot.height / 2, width: chipSlot.width, height: chipSlot.height,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: layer(i), pointerEvents: 'none', opacity: chip.lifted ? motion.dimOpacity : 1 }}>
              {/* A note's text fills its disc, so under another disc of a folded stack it shows
                  its initials rather than fragments. */}
              <ReminderChip size={chipSize} label={chip.label} discHitArea arrive disabled={chips.length > 1 && !expanded}
                showLabel={chip.character !== undefined || expanded || layer(i) === chips.length}
                {...(chip.character !== undefined ? { character: chip.character } : {})}
                {...(chip.alignment ? { alignment: chip.alignment } : {})}
                {...(chip.onPress ? { onPress: chip.onPress } : {})}
                {...(chip.accessibilityLabel ? { accessibilityLabel: chip.accessibilityLabel } : {})} />
            </div>
          })}
          {chips.length > 1 ? <button type="button"
            aria-label={remindersLabel ?? name} aria-expanded={expanded}
            onMouseEnter={() => openStack(true)}
            onClick={() => openStack(true)}
            style={{ position: 'absolute', left: 0, top: 0, padding: 0, ...(expanded ? { width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)', pointerEvents: 'none' } : { width: blockWidth, height: blockHeight, clipPath: `path('${hitPath}')`, background: 'transparent', pointerEvents: 'auto' }), border: 0, cursor: 'pointer', zIndex: chips.length + 1 }} /> : null}
        </div>
      ) : null}
      {onAddReminder ? <AddBadge shown={pointing} onPress={onAddReminder} accessibilityLabel={addReminderLabel ?? name}
        style={{ position: 'absolute', left: size / 2 * (1 + plusAt.x) - plusHit / 2, top: size / 2 * (1 + plusAt.y) - plusHit / 2,
          width: plusHit, height: plusHit, borderRadius: plusHit / 2 }} /> : null}
    </View>
  )
}

const styles = StyleSheet.create({
  name: { position: 'absolute', textAlign: 'center', pointerEvents: 'none',
    textShadowColor: palette.felt, textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
})
