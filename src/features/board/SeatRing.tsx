// The circle of seats. The board fits the oval around its controls and supplies the band,
// token size and positions, so rendering and overlap checks use the same geometry. A
// tap opens the seat's nearby menu, or, while a panel has asked the ring for a seat, picks it; the
// interaction context decides which, so the ring knows nothing about votes or what a pick is
// for. By day, while a seat's menu is open, a tap on another seat records that nomination, as
// often as the Storyteller allows it. The deal is the ring's motion: a seat
// that goes from empty to dealt leaves the centre at corner size and lands on its place, one
// after another. A ring opened just after the deal counts every seat as empty before it, so a
// new game opens with the deal. A placed reminder can be dragged to another seat; the hook beside
// this file reads the gesture and the ring says which seat is under it.
import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, View } from 'react-native'
import type { ViewInstance } from 'react-native'

import type { Translate } from '../../content'
import type { EventId, SeatId } from '../../engine'
import { Appear } from '../../ui/Appear'
import { EdgeButton } from '../../ui/EdgeButton'
import { Token } from '../../ui/Token'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import { domElement } from '../../ui/focus'
import { useReducedMotion } from '../../ui/motion'
import { ReminderChip } from '../../ui/ReminderChip'
import { reminderSize, Seat } from '../../ui/Seat'
import type { SeatChip } from '../../ui/Seat'
import { hairline, motion, palette, radius, shadows, space, tokenSize, touch } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Icon } from '../../ui/icons'
import type { SeatView } from './board'
import { sameSeat } from './board'
import { centrePanelWidth } from './boardGeometry'
import { seatPositions } from './ring'
import type { RingGeometry } from './ringLayout'
import { SeatContextMenu } from './SeatContextMenu'
import { placeSeatMenu } from './seatMenu'
import { SeatActionDialog } from './SeatActionDialog'
import type { SeatDialogAction } from './SeatActionDialog'
import { VotingArc } from './VotingArc'
import { edits } from './seat'
import { useEdits } from './useEdits'
import { useReminderDrag } from './useReminderDrag'

interface Tracked {
  readonly empty: ReadonlyMap<string, boolean> // by seat id, as of the last change
  readonly ranks: ReadonlyMap<string, number> // the seats dealt at that change, in ring order
  readonly arrived: ReadonlySet<string> // the seats added at that change
}

export interface SeatRingProps {

  readonly seats: readonly SeatView[]
  readonly band: Size // the ring's band, inside the flank insets
  readonly geometry: RingGeometry
  readonly readOnly?: boolean
  readonly t: Translate
  readonly onAddReminder?: (seat: SeatId) => void
  readonly onRemoveReminder?: (placedBy: EventId) => void
  readonly onMoveReminder?: (placedBy: EventId, to: SeatId) => void
  readonly onEditNote?: (placedBy: EventId) => void
  readonly onGap?: (at: number) => void
  readonly onTurn?: (direction: 'clockwise' | 'counterclockwise') => void
  readonly onArrangeDone?: () => void // the ring's centre holds Done, between the turning controls
  readonly panelDocked?: boolean // the board draws the centre panel at its foot instead
  readonly deal?: boolean // the game was dealt just before the ring opened
}

// A lifted reminder is drawn a little larger, raised off the board.
const liftScale = 1.15

export const SeatRing = memo(function SeatRing({ seats, band: viewport, geometry, t, onAddReminder, onRemoveReminder, onMoveReminder, onEditNote, onGap, onTurn, onArrangeDone,
  readOnly = false, panelDocked = false, deal = false }: SeatRingProps) {
  const interaction = useBoardInteraction()
  const e = useEdits()
  const [expandedSeat, setExpandedSeat] = useState<string | undefined>(undefined)
  const [contextSeat, setContextSeat] = useState<string | undefined>(undefined)
  // The last seat dialog stays mounted after it closes, so it can leave like every other window.
  const [dialog, setDialog] = useState<SeatDialogAction>()
  const [dialogOpen, setDialogOpen] = useState(false)
  const pick = readOnly ? undefined : interaction.pick
  const action = readOnly || pick ? undefined : interaction.seatAction
  const { size, band, positions } = geometry
  const bandView = useRef<ViewInstance>(null)
  const chipSize = reminderSize(size)
  const canDrag = !!onMoveReminder && !readOnly && !pick && !action
  const { lifted, root, ghost, handlers: dragHandlers } = useReminderDrag(canDrag, (clientX, clientY, touch) => {
    const origin = domElement(bandView.current)?.getBoundingClientRect()
    const x = clientX - (origin?.left ?? 0)
    // On touch the reminder rides above the finger, so the finger never hides it or its target.
    const y = clientY - (origin?.top ?? 0) - (touch ? chipSize : 0)
    // The nearest seat whose disc, with a little margin, is under it.
    let seat: SeatId | undefined
    let nearest = size * 0.6
    seats.forEach((s, i) => {
      const at = positions[i]
      const distance = at ? Math.hypot(at.x - x, at.y - y) : Infinity
      if (distance <= nearest) { nearest = distance; seat = s.id }
    })
    return { x, y, ...(seat !== undefined ? { seat } : {}) }
  }, (from, chip, to) => {
    const placedBy = seats.find(s => s.id === from)?.chips.find(c => c.key === chip)?.placedBy
    if (placedBy !== undefined) onMoveReminder?.(placedBy, to)
  })
  const liftedChip = lifted && seats.find(s => s.id === lifted.seat)?.chips.find(c => c.key === lifted.chip)
  const ghostSize = Math.round(chipSize * liftScale)
  const ghostSlot = { width: ghostSize + 2 * space.xs, height: Math.max(touch, ghostSize + 2 * space.xs) }
  // Lifting a reminder closes the seat menu, as any other change of mode does.
  const contextScope = `${e.board?.clock.phase}:${e.board?.clock.night}:${dialogOpen}:${!!interaction.card}:${!!pick}:${!!action}:${!!onGap}:${!!onArrangeDone}:${!!lifted}`
  const [previousScope, setPreviousScope] = useState(contextScope)
  if (previousScope !== contextScope) {
    setPreviousScope(contextScope)
    setContextSeat(undefined)
  }

  // Which seats were empty at the last change: a seat that was and is not now has just been
  // dealt, and its rank among those dealt together sets its place in the stagger. Kept as state
  // derived from the seats, so the ranks stand until the next change and a re-render mid-flight
  // leaves the motion alone.
  const emptyNow = new Map(seats.map((s) => [s.id, s.character === '']))
  const [tracked, setTracked] = useState<Tracked>(() => ({
    empty: deal ? new Map(seats.map((s) => [s.id, true])) : emptyNow, ranks: new Map(), arrived: new Set() }))
  const changed = seats.length !== tracked.empty.size || seats.some((s) => tracked.empty.get(s.id) !== emptyNow.get(s.id))
  if (changed) {
    const ranks = new Map<string, number>()
    for (const s of seats) if (tracked.empty.get(s.id) === true && emptyNow.get(s.id) === false) ranks.set(s.id, ranks.size)
    setTracked({ empty: emptyNow, ranks, arrived: new Set(seats.filter((s) => !tracked.empty.has(s.id)).map((s) => s.id)) })
  }
  // A big table shares a fixed spread, so twenty seats land about as soon as twelve.
  const stagger = Math.min(motion.duration.dealStagger, motion.duration.dealSpread / Math.max(1, tracked.ranks.size - 1))

  const centre = { x: band.width / 2, y: band.height / 2 }
  const contextIndex = !pick && !action && !onGap && !onArrangeDone ? seats.findIndex(seat => seat.id === contextSeat) : -1
  const contextPlayer = seats[contextIndex]
  const contextAt = positions[contextIndex]
  const isNominationTarget = (seatId: string) => !readOnly && !pick && !action
    && !!interaction.nominate && !!contextPlayer && contextPlayer.id !== seatId
  const closeContext = () => setContextSeat(undefined)
  const openSeatAction = (section: 'character' | 'remove') => {
    if (!contextPlayer) return
    closeContext()
    setDialog({ seatId: contextPlayer.id, kind: section })
    setDialogOpen(true)
  }
  const tapSeat = (seatId: string, allowed: boolean) => {
    if (pick) { closeContext(); interaction.pickSeat(seatId) }
    else if (action) { closeContext(); if (allowed) action.onTap(seatId) }
    else if (contextPlayer && interaction.nominate && isNominationTarget(seatId)) {
      interaction.nominate(contextPlayer.id, seatId)
      closeContext()
    } else setContextSeat(contextSeat === seatId ? undefined : seatId)
  }
  // Each seat is handed the same functions on every render, reading the ring's latest state
  // when called, so a seat whose own values are unchanged is left alone.
  const latest = useRef({ tapSeat, onAddReminder, onRemoveReminder, onEditNote })
  useLayoutEffect(() => { latest.current = { tapSeat, onAddReminder, onRemoveReminder, onEditNote } })
  const handlers = useMemo<SeatHandlers>(() => ({
    tap: (seatId, allowed) => latest.current.tapSeat(seatId, allowed),
    openMenu: seatId => setContextSeat(seatId),
    addReminder: seatId => latest.current.onAddReminder?.(seatId),
    removeReminder: placedBy => latest.current.onRemoveReminder?.(placedBy),
    editNote: placedBy => latest.current.onEditNote?.(placedBy),
    expand: (seatId, open) => setExpandedSeat(open ? seatId : undefined),
  }), [])
  const contextWidth = Math.min(168, band.width - 16)
  const positionOf = (id: string | undefined) => positions[seats.findIndex(seat => seat.id === id)]
  const vote = interaction.voteArc
  const nomineeAt = positionOf(vote?.nominee)
  // Odd positions in a double-sized ring fall between the existing seats.
  const gaps = onGap ? (seats.length === 0 ? seatPositions(band, geometry.rx, geometry.ry, 1)
    : seatPositions(band, geometry.rx, geometry.ry, seats.length * 2).filter((_, index) => index % 2 === 1)) : []

  return (
    <div ref={root} {...dragHandlers} style={{ width: viewport.width, height: viewport.height, overflow: band.height > viewport.height || band.width > viewport.width ? 'auto' : 'visible',
      ...(lifted && !lifted.touch ? { cursor: 'grabbing' } : {}) }}>
      <View ref={bandView} style={[styles.band, { width: band.width, height: band.height }]}>
        {vote && nomineeAt ? <VotingArc band={band} rx={geometry.rx} ry={geometry.ry} tokenSize={size} seatCount={seats.length}
          nominee={nomineeAt} reached={positionOf(vote.reached)} label={vote.label} /> : null}
        {seats.map((seat, i) => {
          const at = positions[i]
          if (!at) return null
          // Fan the lower stacks apart on wide ovals, leaving room for the top seat's
          // reminder below its name. Flanks face the centre to clear the names above them.
          const reminderAngle = geometry.rx > geometry.ry && at.y - centre.y > geometry.ry / 2
            ? at.angle : Math.atan2(at.y - centre.y, at.x - centre.x) * 180 / Math.PI
          const nominationLabel = isNominationTarget(seat.id) ? t('board.nominatePlayer', { name: seat.name }) : undefined
          const inPick = pick !== undefined || action !== undefined
          const allowed = pick ? pick.allowed.includes(seat.id) : action?.allowed.includes(seat.id) ?? false
          const chosen = action?.marked.includes(seat.id) ?? false
          return <RingSeat key={seat.id} seat={seat} size={size} x={at.x} y={at.y} cx={centre.x} cy={centre.y}
            angle={reminderAngle} raised={expandedSeat === seat.id} rank={tracked.ranks.get(seat.id)}
            stagger={tracked.ranks.has(seat.id) ? stagger : 0} arrived={tracked.arrived.has(seat.id)} seatCount={seats.length} index={i}
            selected={inPick ? chosen : contextPlayer?.id === seat.id || undefined} pickable={inPick ? allowed : undefined} allowed={allowed}
            quietPick={!!vote && !pick} readOnly={readOnly} editChips={!readOnly && !inPick}
            canRemove={!!onRemoveReminder && !inPick && !readOnly} canAdd={!!onAddReminder && !inPick && !readOnly && !nominationLabel}
            canDrag={canDrag} lifted={lifted?.seat === seat.id ? lifted.chip : undefined}
            dropTarget={lifted?.target === seat.id} nominationLabel={nominationLabel} markedLabel={chosen ? action?.markedLabel : undefined} t={t} handlers={handlers} />
        })}
        {liftedChip ? <div ref={ghost} aria-hidden style={{ position: 'absolute', left: 0, top: 0, zIndex: 20, pointerEvents: 'none' }}>
          <Appear from={1 / liftScale} style={{ position: 'absolute', left: -ghostSlot.width / 2, top: -ghostSlot.height / 2, filter: `drop-shadow(${shadows.lifted})` }}>
            <ReminderChip size={ghostSize} label={liftedChip.label} {...(liftedChip.character !== undefined ? { character: liftedChip.character } : {})}
              {...(liftedChip.alignment ? { alignment: liftedChip.alignment } : {})} />
          </Appear>
        </div> : null}
        {gaps.map((at, index) => {
          const position = seats.length === 0 ? 0 : index + 1
          return <View key={`gap-${position}`} id={`seat-insertion-${position}`} style={[styles.place, { left: at.x - tokenSize.corner / 2, top: at.y - tokenSize.corner / 2 }]}>
            <Token size={tokenSize.corner} add onPress={() => onGap?.(position)} accessibilityLabel={t('board.addSeatAt', { n: position + 1 })} />
          </View>
        })}
        {onArrangeDone && !readOnly ? <View id="ring-turn" style={[styles.centerPanel, { left: centre.x, top: centre.y }]}>
          <Appear style={styles.turn}>
            {onTurn ? <EdgeButton icon="turnLeft" label={t('board.turnCounterclockwise')} onPress={() => onTurn('counterclockwise')} /> : null}
            <EdgeButton icon="check" label={t('common.done')} onPress={onArrangeDone} />
            {onTurn ? <EdgeButton icon="turnRight" label={t('board.turnClockwise')} onPress={() => onTurn('clockwise')} /> : null}
          </Appear>
        </View> : null}
        {interaction.centerPanel && !readOnly && !panelDocked ? <View pointerEvents="box-none" style={[styles.centerPanel, {
          left: centre.x, top: centre.y, width: centrePanelWidth(band.width, size),
        }]}>{interaction.centerPanel}</View> : null}
        {contextPlayer && contextAt && !readOnly ? <SeatContextMenu key={contextPlayer.id} seatId={contextPlayer.id} name={contextPlayer.name} width={contextWidth} t={t}
          alignment={contextPlayer.alignment} dead={contextPlayer.dead} ghostVote={contextPlayer.ghostVote} anchor={contextAt}
          place={(menu, room) => placeSeatMenu({ at: contextAt, size, centre, room, menu, others: positions.filter((_, i) => i !== contextIndex && i < seats.length) })}
          onClose={closeContext} onCharacter={() => openSeatAction('character')}
          {...(onAddReminder ? { onReminder: () => { closeContext(); onAddReminder(contextPlayer.id) } } : {})}
          onEmpty={() => openSeatAction('remove')}
          onRename={name => e.append(edits.renameSeat(contextPlayer.id, name))}
          onLife={() => e.append(contextPlayer.dead ? edits.revive(contextPlayer.id) : edits.kill(contextPlayer.id))}
          onGhostVote={() => { if (contextPlayer.dead) e.append(edits.setGhostVote(contextPlayer.id, !contextPlayer.ghostVote)) }}
          onAlignment={() => e.append(edits.setAlignment(contextPlayer.id, contextPlayer.alignment === 'good' ? 'evil' : 'good'))}
          {...(interaction.nominate ? { onNominateSelf: () => { interaction.nominate?.(contextPlayer.id, contextPlayer.id); closeContext() } } : {})} /> : null}
      </View>
    {dialog && !readOnly ? <SeatActionDialog action={dialog} visible={dialogOpen} onClose={() => setDialogOpen(false)} /> : null}
    </div>
  )
})

interface SeatHandlers {
  readonly tap: (seatId: SeatId, allowed: boolean) => void
  readonly openMenu: (seatId: SeatId) => void
  readonly addReminder: (seatId: SeatId) => void
  readonly removeReminder: (placedBy: EventId) => void
  readonly editNote: (placedBy: EventId) => void
  readonly expand: (seatId: SeatId, open: boolean) => void
}

interface RingSeatProps {
  readonly seat: SeatView
  readonly size: number
  readonly x: number // the token's centre
  readonly y: number
  readonly cx: number // the ring's centre, where a dealt token starts
  readonly cy: number
  readonly angle: number // the reminders' outward direction
  readonly raised: boolean // its reminder stack is open over its neighbours
  readonly rank: number | undefined
  readonly stagger: number
  readonly arrived: boolean
  readonly seatCount: number
  readonly index: number // its place round the ring
  readonly selected: boolean | undefined // a toggle only while the ring answers a pick or a vote
  readonly pickable: boolean | undefined // set while a panel asks the ring for seats
  readonly allowed: boolean
  readonly quietPick: boolean
  readonly readOnly: boolean
  readonly editChips: boolean // identity chips open the seat menu
  readonly canRemove: boolean // placed reminders come off on a tap, and placed notes open for editing
  readonly canDrag: boolean // placed reminders and notes can be dragged to another seat
  readonly lifted: string | undefined // the key of this seat's chip being dragged
  readonly dropTarget: boolean // a dragged reminder would land here
  readonly canAdd: boolean
  readonly nominationLabel: string | undefined // set while this seat can be nominated from the open menu
  readonly markedLabel: string | undefined // the recorded-hand badge
  readonly t: Translate
  readonly handlers: SeatHandlers
}

// The board view is rebuilt on every edit, so a seat compares its view by value: one seat's
// edit leaves the other tokens, their art and their printed names alone.
const sameRingSeat = (a: RingSeatProps, b: RingSeatProps) =>
  (Object.keys(a) as (keyof RingSeatProps)[]).every(key => key === 'seat' ? sameSeat(a.seat, b.seat) : a[key] === b[key])

const RingSeat = memo(function RingSeat({ seat, size, x, y, cx, cy, angle, raised, rank, stagger, arrived, seatCount, index, selected, pickable, allowed,
  quietPick, readOnly, editChips, canRemove, canDrag, lifted, dropTarget, canAdd, nominationLabel, markedLabel, t, handlers }: RingSeatProps) {
  const empty = seat.character === ''
  const chips: readonly SeatChip[] = seat.chips.map((c) => ({
    key: c.key,
    label: c.label,
    ...(c.character !== undefined ? { character: c.character } : {}),
    ...(c.alignment ? { alignment: c.alignment } : {}),
    ...(canDrag && c.placedBy !== undefined ? { draggable: true } : {}),
    ...(lifted === c.key ? { lifted: true } : {}),
    ...(c.placedBy !== undefined
      ? canRemove ? c.character === undefined ? {
          onPress: () => handlers.editNote(c.placedBy!),
          accessibilityLabel: t('board.editNote', { note: c.label }),
        } : {
          onPress: () => handlers.removeReminder(c.placedBy!),
          accessibilityLabel: t('board.removeChip', { label: c.label }),
        } : {}
      : editChips ? { onPress: () => handlers.openMenu(seat.id) } : {}),
  }))
  const label = empty
    ? t('board.seatEmpty', { name: seat.name })
    : seat.dead
      ? t(seat.ghostVote ? 'board.seatA11yDeadUnspent' : 'board.seatA11yDeadSpent', { name: seat.name, character: seat.characterName })
      : t('board.seatA11y', {
          name: seat.name,
          character: seat.characterName,
        })
  return (
    <Dealt raised={raised} size={size} x={x} y={y} cx={cx} cy={cy} {...(rank !== undefined ? { rank } : {})}
      stagger={stagger} arrived={arrived} seatCount={seatCount} index={index}>
      <div data-seat-context-target={seat.id} title={nominationLabel}>
      <Seat

        size={size}
        name={seat.name}
        {...(empty ? {} : { character: seat.character, characterName: seat.characterName, alignment: seat.alignment })}
        dead={seat.dead}
        onBlock={seat.onBlock === true}
        ghostVote={seat.ghostVote}
        selected={selected}
        dropTarget={dropTarget}
        {...(pickable !== undefined ? { pickable } : {})}
        quietPick={quietPick}
        chips={chips}
        remindersLabel={t('board.inspectReminders', { name: seat.name, count: chips.length })}
        onRemindersExpanded={(open) => handlers.expand(seat.id, open)}
        {...(canAdd ? { onAddReminder: () => handlers.addReminder(seat.id), addReminderLabel: t('board.addSeatReminder', { name: seat.name }) } : {})}
        angle={angle}
        {...(!readOnly ? { onPress: () => handlers.tap(seat.id, allowed) } : {})}
        accessibilityLabel={[label, seat.onBlock ? t('board.onBlock') : undefined, nominationLabel].filter(Boolean).join('. ')}
      />
      </div>
      {nominationLabel ? <Appear pointerEvents="none" style={styles.nominationBadge}>
        <View aria-hidden style={styles.nominationDisc}><Icon name="nominate" size={18} color={palette.onAccent} /></View>
      </Appear> : null}
      {markedLabel ? <Appear pointerEvents="none" style={styles.votedBadge}>
        <View accessibilityLabel={markedLabel} style={styles.votedDisc}><Icon name="check" size={16} color={palette.onAccent} /></View>
      </Appear> : null}
    </Dealt>
  )
}, sameRingSeat)

interface DealtProps {
  readonly raised: boolean
  readonly size: number
  readonly x: number // the token's centre
  readonly y: number
  readonly cx: number // the ring's centre, where a dealt token starts
  readonly cy: number
  readonly rank?: number // set on the render where this seat was dealt: its place in the stagger
  readonly stagger: number // ms between one dealt token and the next
  readonly arrived: boolean // added to a ring already on screen
  readonly seatCount: number
  readonly index: number
  readonly children: ReactNode
}

// A seat's place on the band, and its motion. Dealt, it flies from the centre at corner size to
// its place at full size, after its rank's share of the stagger. Added, it grows in; and when a
// seat is added, removed or the ring turns, the seats glide from where they were to their new
// places. A resize or a measured control moves the seats at once, so only a change of seat count
// or of a seat's place glides, and a token still in the deal has its start moved to the new centre.
// Each run is WAAPI on the compositor, started before the first paint, and a re-render
// mid-flight leaves it alone. Under reduced motion the token is simply there.
const Dealt = ({ size, x, y, cx, cy, rank, stagger, arrived, seatCount, index, children, raised }: DealtProps) => {
  const reduced = useReducedMotion()
  const place = useRef<ViewInstance>(null)
  const dealing = useRef<Animation | undefined>(undefined)
  const element = () => {
    const node = domElement(place.current)
    return !reduced && typeof node?.animate === 'function' ? node : undefined
  }
  const fromCentre = () => [{ transform: `translate(${cx - x}px, ${cy - y}px) scale(${tokenSize.corner / size})` }, { transform: 'none' }]
  useLayoutEffect(() => {
    if (rank === undefined) return
    dealing.current = element()?.animate(fromCentre(),
      { duration: motion.duration.deal, delay: rank * stagger, easing: motion.css.ease, fill: 'backwards' })
    // Only a new deal starts a run: the ring re-fits while tokens are in flight.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rank])
  useLayoutEffect(() => {
    if (arrived) element()?.animate([{ opacity: 0, transform: 'scale(0.8)' }, { opacity: 1, transform: 'none' }],
      { duration: motion.duration.mark, easing: motion.css.ease })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const last = useRef({ x, y, size, seatCount, index })
  useLayoutEffect(() => {
    const before = last.current
    last.current = { x, y, size, seatCount, index }
    const deal = dealing.current
    if (deal?.playState === 'running' && deal.effect instanceof KeyframeEffect) deal.effect.setKeyframes(fromCentre())
    else if ((before.seatCount !== seatCount || before.index !== index) && (before.x !== x || before.y !== y || before.size !== size)) {
      element()?.animate([{ transform: `translate(${before.x - x}px, ${before.y - y}px) scale(${before.size / size})` }, { transform: 'none' }],
        { duration: motion.duration.deal, easing: motion.css.ease })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, cx, cy, size, seatCount, index])
  return (
    <View ref={place} style={[styles.place, { zIndex: raised ? 2 : 0, left: x - size / 2, top: y - size / 2, width: size, height: size }]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  nominationBadge: { position: 'absolute', top: 0, right: 0 },
  nominationDisc: { width: 28, height: 28, borderRadius: 14,
    backgroundColor: palette.accent, borderWidth: 2, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  votedBadge: { position: 'absolute', top: 0, right: 0 },
  // An ink edge like the nomination badge, so the check reads against parchment art and the brass ring.
  votedDisc: { width: 26, height: 26, borderRadius: 13, backgroundColor: palette.accent, borderWidth: 2, borderColor: palette.ink,
    alignItems: 'center', justifyContent: 'center' },
  // Chips and names hang outside every seat's box, so nothing here clips.
  band: { overflow: 'visible' },
  place: { position: 'absolute' },
  centerPanel: { position: 'absolute', zIndex: 15, transform: [{ translateX: '-50%' }, { translateY: '-50%' }] },
  // The toolbar's ink capsule, so the turning controls read as the board's own.
  turn: { flexDirection: 'row', alignItems: 'center', padding: space.xxs, borderRadius: radius.control,
    backgroundColor: palette.ink, borderWidth: hairline, borderColor: palette.inkMuted, boxShadow: shadows.lifted },
})
