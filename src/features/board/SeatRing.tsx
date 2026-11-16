// The circle of seats. The board fits the oval around its controls and supplies the band,
// token size and positions, so rendering and overlap checks use the same geometry. A
// tap opens the seat's nearby menu, or, while a panel has asked the ring for a seat, picks it; the
// interaction context decides which, so the ring knows nothing about votes or what a pick is
// for. By day, while a seat's menu is open, a tap on a seat it may still nominate under the
// engine's once-a-day limits records that nomination. The deal is the ring's motion: a seat
// that goes from empty to dealt leaves the centre at corner size and lands on its place, one
// after another. A ring opened just after the deal counts every seat as empty before it, so a
// new game opens with the deal. A placed reminder can be dragged to another seat; the hook beside
// this file reads the gesture and the ring says which seat is under it. While the seats are being
// arranged a seat moves the same way, onto another seat to swap the two or into a gap to take
// that place, or by a tap on it and then a tap on where it goes.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { ViewInstance } from 'react-native'

import type { Translate } from '../../content'
import type { EventId, SeatId } from '../../engine'
import { canNominate, today } from '../../engine'
import { Appear } from '../../ui/Appear'
import { EdgeButton } from '../../ui/EdgeButton'
import { Token } from '../../ui/Token'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import { domElement } from '../../ui/focus'
import { durationFor, useReducedMotion } from '../../ui/motion'
import { ReminderChip } from '../../ui/ReminderChip'
import { reminderSize } from '../../ui/reminderStack'
import { Seat } from '../../ui/Seat'
import type { SeatChip } from '../../ui/Seat'
import { hairline, motion, palette, radius, shadows, space, tokenSize, touch, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Icon } from '../../ui/icons'
import type { SeatView } from './board'
import { sameSeat } from './board'
import { centrePanelWidth } from './boardGeometry'
import { seatPositions, stackAngle } from './ring'
import type { RingGeometry } from './ringLayout'
import { SeatContextMenu } from './SeatContextMenu'
import { placeSeatMenu } from './seatMenu'
import { SeatActionDialog } from './SeatActionDialog'
import type { SeatDialogAction } from './SeatActionDialog'
import { VotingArc } from './VotingArc'
import { edits, insertionMoves } from './seat'
import { useEdits } from './useEdits'
import { useBoardDrag } from './useBoardDrag'

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
  readonly onMoveSeat?: (seat: SeatId, to: SeatId | number) => void // onto another seat, or into the gap before that index
  readonly chosenSeat?: SeatId // arranging: the seat a tap picked up, which the next tap moves
  readonly onChooseSeat?: (seat: SeatId | undefined) => void
  readonly panelDocked?: boolean // the board draws the centre panel at its foot instead
  readonly deal?: boolean // the game was dealt just before the ring opened
}

// A lifted reminder is drawn a little larger, raised off the board. A lifted seat is drawn a
// little smaller, so the brass ring and badge of the seat it is over still show around it.
const liftScale = 1.15
const seatLiftScale = 0.9
// Where a lifted seat counts as over a seat or a gap, in token sizes from its centre. The nearer
// one, measured against its own reach, wins, so a crowded ring still leaves room for each gap.
const seatReach = 0.6
const gapReach = 0.4
// How far the seats either side of an aimed gap step apart, in token sizes.
const parting = 0.14

interface Landing {
  readonly seat: SeatId
  readonly x: number
  readonly y: number
}

export const SeatRing = memo(function SeatRing({ seats, band: viewport, geometry, t, onAddReminder, onRemoveReminder, onMoveReminder, onEditNote, onGap, onTurn, onArrangeDone,
  onMoveSeat, chosenSeat, onChooseSeat, readOnly = false, panelDocked = false, deal = false }: SeatRingProps) {
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
  const arranging = !!onMoveSeat && !readOnly && !pick && !action
  const reduced = useReducedMotion()
  const indexOf = (id: SeatId | undefined) => seats.findIndex(seat => seat.id === id)
  // Odd positions in a double-sized ring fall between the existing seats: gap n is before seat n,
  // and the last one sits between the last seat and the first.
  const gapPoints = useMemo(() => !onArrangeDone ? []
    : seats.length === 0 ? seatPositions(band, geometry.rx, geometry.ry, 1).map(at => ({ at, position: 0 }))
      : seatPositions(band, geometry.rx, geometry.ry, seats.length * 2).flatMap((at, i) => i % 2 === 1 ? [{ at, position: (i + 1) / 2 }] : []),
  [onArrangeDone, seats.length, band, geometry.rx, geometry.ry])
  const opensGap = (seat: SeatId, gap: number) => insertionMoves(seats.length, indexOf(seat), gap)
  // Where a dropped seat was let go, so it lands from there rather than from its old place.
  const landing = useRef<Landing | undefined>(undefined)
  const { lifted, root, ghost, handlers: dragHandlers } = useBoardDrag<SeatId | number>(pressed => {
    const seat = pressed.closest('[data-seat-context-target]')?.getAttribute('data-seat-context-target') as SeatId | null | undefined
    if (!seat) return undefined
    if (arranging) return { seat }
    const chip = canDrag ? pressed.closest('[data-chip]')?.getAttribute('data-chip') : undefined
    return chip ? { seat, chip } : undefined
  }, (clientX, clientY, touch, grab) => {
    const origin = domElement(bandView.current)?.getBoundingClientRect()
    const x = clientX - (origin?.left ?? 0)
    // On touch the piece rides above the finger, so the finger never hides it or its target.
    const y = clientY - (origin?.top ?? 0) - (touch ? grab.chip === undefined ? size * seatReach : chipSize : 0)
    let target: SeatId | number | undefined
    let best = 1
    const consider = (to: SeatId | number, at: { readonly x: number; readonly y: number } | undefined, reach: number) => {
      const score = at ? Math.hypot(at.x - x, at.y - y) / (size * reach) : Infinity
      if (score <= best) { best = score; target = to }
    }
    seats.forEach((s, i) => { if (s.id !== grab.seat) consider(s.id, positions[i], seatReach) })
    if (grab.chip === undefined) for (const gap of gapPoints) if (opensGap(grab.seat, gap.position)) consider(gap.position, gap.at, gapReach)
    return { x, y, ...(target !== undefined ? { target } : {}) }
  }, (grab, to, at) => {
    if (grab.chip === undefined) {
      landing.current = { seat: grab.seat, x: at.x, y: at.y }
      onMoveSeat?.(grab.seat, to)
      return
    }
    const placedBy = seats.find(s => s.id === grab.seat)?.chips.find(c => c.key === grab.chip)?.placedBy
    if (placedBy !== undefined && typeof to === 'string') onMoveReminder?.(placedBy, to)
  }, canDrag || arranging)
  const liftedSeat = lifted && lifted.grab.chip === undefined ? lifted.grab.seat : undefined
  // A seat lifted by a drag takes over from one picked up by a tap.
  useEffect(() => {
    if (liftedSeat === undefined) return
    landing.current = undefined
    onChooseSeat?.(undefined)
  }, [liftedSeat, onChooseSeat])
  const mover = seats.find(seat => seat.id === (liftedSeat ?? (arranging ? chosenSeat : undefined)))
  const moverIndex = indexOf(mover?.id)
  const aimedGap = liftedSeat !== undefined && typeof lifted?.target === 'number' ? gapPoints.find(gap => gap.position === lifted.target) : undefined
  // The seats either side of an aimed gap step apart, so the place the seat will take opens up.
  const partingOf = (i: number) => {
    const at = positions[i]
    if (!aimedGap || reduced || !at || (i !== aimedGap.position - 1 && i !== aimedGap.position % seats.length)) return undefined
    const dx = at.x - aimedGap.at.x
    const dy = at.y - aimedGap.at.y
    const k = size * parting / Math.max(1, Math.hypot(dx, dy))
    return `translate(${Math.round(dx * k)}px, ${Math.round(dy * k)}px)`
  }
  const liftedChip = lifted?.grab.chip !== undefined && seats.find(s => s.id === lifted.grab.seat)?.chips.find(c => c.key === lifted.grab.chip)
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
  const day = e.board ? today(e.board) : undefined
  const isNominationTarget = (seatId: string) => !readOnly && !pick && !action
    && !!interaction.nominate && !!contextPlayer && contextPlayer.id !== seatId && canNominate(day, contextPlayer.id, seatId)
  const closeContext = () => setContextSeat(undefined)
  const openSeatAction = (section: 'character' | 'remove') => {
    if (!contextPlayer) return
    closeContext()
    setDialog({ seatId: contextPlayer.id, kind: section })
    setDialogOpen(true)
  }
  const tapSeat = (seatId: SeatId, allowed: boolean) => {
    if (arranging) {
      // The first tap picks a seat up, a second on it puts it down, and one on another seat swaps the two.
      if (!mover) onChooseSeat?.(seatId)
      else if (mover.id === seatId) onChooseSeat?.(undefined)
      else { onMoveSeat?.(mover.id, seatId); onChooseSeat?.(undefined) }
    } else if (pick) { closeContext(); interaction.pickSeat(seatId) }
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
    landing: seatId => {
      const at = landing.current
      if (at?.seat !== seatId) return undefined
      landing.current = undefined
      return at
    },
  }), [])
  const contextWidth = Math.min(168, band.width - 16)
  const positionOf = (id: string | undefined) => positions[seats.findIndex(seat => seat.id === id)]
  const vote = interaction.voteArc
  const nomineeAt = positionOf(vote?.nominee)
  const tapGap = (position: number) => {
    if (!mover) { onGap?.(position); return }
    onMoveSeat?.(mover.id, position)
    onChooseSeat?.(undefined)
  }
  const ghostSeat = Math.round(size * seatLiftScale)

  return (
    <div ref={root} {...dragHandlers} style={{ width: viewport.width, height: viewport.height, overflow: band.height > viewport.height || band.width > viewport.width ? 'auto' : 'visible',
      ...(lifted && !lifted.touch ? { cursor: 'grabbing' } : {}) }}>
      <View ref={bandView} style={[styles.band, { width: band.width, height: band.height }]}>
        {vote && nomineeAt ? <VotingArc band={band} rx={geometry.rx} ry={geometry.ry} tokenSize={size} seatCount={seats.length}
          nominee={nomineeAt} reached={positionOf(vote.reached)} label={vote.label} /> : null}
        {seats.map((seat, i) => {
          const at = positions[i]
          if (!at) return null
          const reminderAngle = stackAngle(at, centre, geometry.rx, geometry.ry, { size, chip: chipSize })
          const nominationLabel = isNominationTarget(seat.id) ? t('board.nominatePlayer', { name: seat.name }) : undefined
          const inPick = pick !== undefined || action !== undefined
          const allowed = pick ? pick.allowed.includes(seat.id) : action?.allowed.includes(seat.id) ?? false
          const chosen = action?.marked.includes(seat.id) ?? false
          // While a seat is picked up every other seat is a place it can go.
          const swapTarget = !!mover && mover.id !== seat.id
          const editable = !readOnly && !inPick && !arranging
          return <RingSeat key={seat.id} seat={seat} size={size} x={at.x} y={at.y} cx={centre.x} cy={centre.y}
            angle={reminderAngle} raised={expandedSeat === seat.id} rank={tracked.ranks.get(seat.id)}
            stagger={tracked.ranks.has(seat.id) ? stagger : 0} arrived={tracked.arrived.has(seat.id)} seatCount={seats.length} index={i}
            selected={inPick ? chosen : arranging ? liftedSeat === undefined && mover?.id === seat.id : contextPlayer?.id === seat.id || undefined}
            pickable={inPick ? allowed : swapTarget || undefined} allowed={allowed}
            quietPick={!!vote && !pick} readOnly={readOnly} editChips={editable}
            canRemove={!!onRemoveReminder && editable} canAdd={!!onAddReminder && editable && !nominationLabel}
            canDrag={canDrag} lifted={lifted?.grab.seat === seat.id ? lifted.grab.chip : undefined}
            seatLifted={liftedSeat === seat.id} parted={partingOf(i)}
            dropTarget={lifted?.target === seat.id} swapping={liftedSeat !== undefined && lifted?.target === seat.id}
            swapLabel={swapTarget ? t('board.swapWith', { name: mover.name }) : undefined}
            nominationLabel={nominationLabel} markedLabel={chosen ? action?.markedLabel : undefined} t={t} handlers={handlers} />
        })}
        {liftedChip ? <div ref={ghost} aria-hidden style={{ position: 'absolute', left: 0, top: 0, zIndex: 20, pointerEvents: 'none' }}>
          <Appear from={1 / liftScale} style={{ position: 'absolute', left: -ghostSlot.width / 2, top: -ghostSlot.height / 2, filter: `drop-shadow(${shadows.lifted})` }}>
            <ReminderChip size={ghostSize} label={liftedChip.label} {...(liftedChip.character !== undefined ? { character: liftedChip.character } : {})}
              {...(liftedChip.alignment ? { alignment: liftedChip.alignment } : {})} />
          </Appear>
        </div> : null}
        {liftedSeat !== undefined && mover ? <div ref={ghost} aria-hidden style={{ position: 'absolute', left: 0, top: 0, zIndex: 20, pointerEvents: 'none' }}>
          {/* The disc alone: its name would print over the name of the seat it is over. */}
          <Appear from={1 / seatLiftScale} style={{ position: 'absolute', left: -ghostSeat / 2, top: -ghostSeat / 2, filter: `drop-shadow(${shadows.lifted})` }}>
            <Token size={ghostSeat} printName dead={mover.dead}
              {...(mover.character === '' ? {} : { character: mover.character, name: mover.characterName, alignment: mover.alignment })} />
          </Appear>
        </div> : null}
        {/* With a seat picked up the gaps are the places it can go; otherwise, below a full ring, they add a seat. */}
        {gapPoints.map(({ at, position }) => {
          if (mover) {
            if (!opensGap(mover.id, position)) return null
            const aimed = aimedGap?.position === position
            // The aimed slot sits above the dragged disc, which is drawn right over it.
            return <View key={`gap-${position}`} id={`seat-insertion-${position}`} style={[styles.place, { left: at.x - tokenSize.corner / 2, top: at.y - tokenSize.corner / 2, zIndex: aimed ? 21 : 0 }]}>
              <Appear>
                <Token size={tokenSize.corner} emptyStyle={aimed ? styles.slotAimed : styles.slot} onPress={() => tapGap(position)}
                  accessibilityLabel={t('board.moveSeatTo', { name: mover.name, n: (moverIndex < position ? position - 1 : position) + 1 })} />
              </Appear>
            </View>
          }
          if (!onGap) return null
          return <View key={`gap-${position}`} id={`seat-insertion-${position}`} style={[styles.place, { left: at.x - tokenSize.corner / 2, top: at.y - tokenSize.corner / 2 }]}>
            <Token size={tokenSize.corner} add onPress={() => tapGap(position)} accessibilityLabel={t('board.addSeatAt', { n: position + 1 })} />
          </View>
        })}
        {onArrangeDone && !readOnly ? <View id="ring-turn" style={[styles.centerPanel, styles.turnPanel, { left: centre.x, top: centre.y }]}>
          <Appear style={styles.turn}>
            {onTurn ? <EdgeButton icon="turnLeft" label={t('board.turnCounterclockwise')} onPress={() => onTurn('counterclockwise')} /> : null}
            <EdgeButton icon="check" label={t('common.done')} onPress={onArrangeDone} />
            {onTurn ? <EdgeButton icon="turnRight" label={t('board.turnClockwise')} onPress={() => onTurn('clockwise')} /> : null}
          </Appear>
          {/* Hung below the capsule at its width, so it never reaches the seats' names beside it. */}
          {onMoveSeat && liftedSeat === undefined ? <Text style={[type.text.small, styles.hint]}>
            {mover ? t('board.arrangeChosen', { name: mover.name }) : t('board.arrangeHint')}
          </Text> : null}
        </View> : null}
        {interaction.centerPanel && !readOnly && !panelDocked ? <View pointerEvents="box-none" style={[styles.centerPanel, {
          left: centre.x, top: centre.y, width: centrePanelWidth(band.width, size),
        }]}>{interaction.centerPanel}</View> : null}
        {contextPlayer && contextAt && !readOnly ? <SeatContextMenu key={contextPlayer.id} seatId={contextPlayer.id} name={contextPlayer.name} width={contextWidth} t={t}
          alignment={contextPlayer.alignment} dead={contextPlayer.dead} ghostVote={contextPlayer.ghostVote} anchor={contextAt}
          place={(menu, room) => placeSeatMenu({ at: contextAt, size, centre, room, menu, others: positions.filter((_, i) => i !== contextIndex && i < seats.length) })}
          onClose={closeContext} onCharacter={() => openSeatAction('character')}
          {...(onAddReminder ? { onReminder: () => { closeContext(); onAddReminder(contextPlayer.id) } } : {})}
          nominateSelfDisabled={!canNominate(day, contextPlayer.id, contextPlayer.id)}
          onRemove={() => openSeatAction('remove')}
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
  readonly landing: (seatId: SeatId) => Landing | undefined // where a dropped seat was let go, once
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
  readonly dropTarget: boolean // a dragged reminder or seat would land here
  readonly seatLifted: boolean // this seat is being dragged: it stays in its place, faded, until it lands
  readonly parted: string | undefined // a transform stepping it aside from the gap a dragged seat is over
  readonly swapping: boolean // a dragged seat would trade places with this one
  readonly swapLabel: string | undefined // set while a picked-up seat could swap with this one
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
  quietPick, readOnly, editChips, canRemove, canDrag, lifted, dropTarget, seatLifted, parted, swapping, swapLabel, canAdd, nominationLabel, markedLabel, t, handlers }: RingSeatProps) {
  const reduced = useReducedMotion()
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
      stagger={stagger} arrived={arrived} seatCount={seatCount} index={index} landing={() => handlers.landing(seat.id)}>
      <div data-seat-context-target={seat.id} title={nominationLabel} style={{ opacity: seatLifted ? motion.dimOpacity : 1, transform: parted ?? 'none',
        transition: `transform ${durationFor(motion.duration.mark, reduced)}ms ${motion.css.ease}, opacity ${durationFor(motion.duration.mark, reduced, true)}ms` }}>
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
        accessibilityLabel={[label, seat.onBlock ? t('board.onBlock') : undefined, nominationLabel, swapLabel].filter(Boolean).join('. ')}
      />
      </div>
      {nominationLabel ? <Appear pointerEvents="none" style={styles.nominationBadge}>
        <View aria-hidden style={styles.nominationDisc}><Icon name="nominate" size={18} color={palette.onAccent} /></View>
      </Appear> : null}
      {swapping ? <Appear pointerEvents="none" style={styles.nominationBadge}>
        <View aria-hidden style={styles.nominationDisc}><Icon name="swap" size={18} color={palette.onAccent} /></View>
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
  readonly landing: () => Landing | undefined // a dropped seat glides in from where it was let go
  readonly children: ReactNode
}

// A seat's place on the band, and its motion. Dealt, it flies from the centre at corner size to
// its place at full size, after its rank's share of the stagger. Added, it grows in; and when a
// seat is added, removed or the ring turns, the seats glide from where they were to their new
// places. A resize or a measured control moves the seats at once, so only a change of seat count
// or of a seat's place glides, and a token still in the deal has its start moved to the new centre.
// Each run is WAAPI on the compositor, started before the first paint, and a re-render
// mid-flight leaves it alone. Under reduced motion the token is simply there.
const Dealt = ({ size, x, y, cx, cy, rank, stagger, arrived, seatCount, index, landing, children, raised }: DealtProps) => {
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
      const dropped = landing()
      const from = dropped ? { x: dropped.x, y: dropped.y, scale: seatLiftScale } : { x: before.x, y: before.y, scale: before.size / size }
      element()?.animate([{ transform: `translate(${from.x - x}px, ${from.y - y}px) scale(${from.scale})` }, { transform: 'none' }],
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
  turnPanel: { alignItems: 'center' },
  hint: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: space.sm, textAlign: 'center', color: palette.text,
    textShadowColor: palette.felt, textShadowRadius: 3, textShadowOffset: { width: 0, height: 1 } },
  // A gap a picked-up seat can go into: the dashed brass of a place on offer, and nothing in it.
  // The one a dragged seat is over fills with brass.
  slot: { borderColor: palette.accent, borderStyle: 'dashed' },
  slotAimed: { borderColor: palette.accent, borderStyle: 'dashed', backgroundColor: `${palette.accent}59` },
  // The toolbar's ink capsule, so the turning controls read as the board's own.
  turn: { flexDirection: 'row', alignItems: 'center', padding: space.xxs, borderRadius: radius.control,
    backgroundColor: palette.ink, borderWidth: hairline, borderColor: palette.inkMuted, boxShadow: shadows.lifted },
})
