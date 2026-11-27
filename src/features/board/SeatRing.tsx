// The circle of seats. The board fits the oval around its controls and supplies the band,
// token size and positions, so rendering and overlap checks use the same geometry. A
// tap opens the seat's nearby menu, or, while a panel has asked the ring for a seat, picks it; the
// interaction context decides which, so the ring knows nothing about votes or what a pick is
// for. By day a seat's menu nominates: it asks the ring for the nominee, marking the nominator, who
// may nominate themselves with a tap on their own seat. A Traveller's menu also calls for their exile. The deal
// is the ring's motion: a seat that goes from empty to dealt leaves the centre at corner size and
// lands on its place, one after another. A ring opened just after the deal counts every seat as empty before it, so a
// new game opens with the deal. A placed reminder can be dragged to another seat; the hook beside
// this file reads the gesture and the ring says which seat is under it. While the seats are being
// arranged a seat moves the same way, onto another seat to swap the two, into a gap to take
// that place or onto the velvet to stay where it was let go, so the tokens can be laid out as the
// players sit in the room; or by a tap on it and then a tap on where it goes.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import type { ViewInstance } from 'react-native'

import type { Translate } from '../../content'
import { asCharacterId, character } from '../../content'
import type { EventId, SeatId } from '../../engine'
import { Appear } from '../../ui/Appear'
import { Token } from '../../ui/Token'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import { domElement } from '../../ui/focus'
import { durationFor, useReducedMotion } from '../../ui/motion'
import { ReminderChip } from '../../ui/ReminderChip'
import { reminderSize } from '../../ui/reminderStack'
import { Seat } from '../../ui/Seat'
import type { SeatChip } from '../../ui/Seat'
import { motion, palette, ring, seatMetrics, shadows, space, tabular, tokenSize, touch, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Icon } from '../../ui/icons'
import type { SeatView } from './board'
import { sameSeat } from './board'
import { centrePanelWidth } from './boardGeometry'
import { ArrangeControls } from './ArrangeControls'
import { settle } from './freeLayout'
import type { Point } from './freeLayout'
import { countStartBetween, countStartOnRing, seatPositions, stackAngle } from './ring'
import { gapMarkerSize } from './ringLayout'
import type { BoardControlBounds, RingGeometry } from './ringLayout'
import { SeatContextMenu } from './SeatContextMenu'
import { believed } from './show'
import { useOpenCard } from './ShowSheet'
import { placeSeatMenu } from './seatMenu'
import { SeatActionDialog } from './SeatActionDialog'
import type { SeatDialogAction } from './SeatActionDialog'
import { CountStart } from './CountStart'
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
  readonly geometry: RingGeometry // its positions are where the seats are drawn, laid out or on the circle
  readonly free?: boolean // some seat is laid out off the circle
  readonly obstacles?: readonly BoardControlBounds[] // the corner controls a laid-out seat keeps clear of
  readonly readOnly?: boolean
  readonly lit?: readonly SeatId[] // replay: the seats the step on show changed
  readonly t: Translate
  readonly onAddReminder?: (seat: SeatId) => void
  readonly onRemoveReminder?: (placedBy: EventId) => void
  readonly onMoveReminder?: (placedBy: EventId, to: SeatId) => void
  readonly onEditNote?: (placedBy: EventId) => void
  readonly onGap?: (at: number, spot: Point) => void // the gap's index, and where a seat added there would sit clear
  readonly onTurn?: (direction: 'clockwise' | 'counterclockwise') => void
  readonly onArrangeDone?: () => void // the ring's centre holds Done, between the turning controls
  readonly onBackToCircle?: () => void // set while some seat is laid out off the circle
  readonly turnAt?: Point // where the arrangement's controls sit on a laid-out board, the ring's middle otherwise
  readonly turnDocked?: boolean // the board docks them at its foot, as a laid-out room leaves no clear middle
  readonly onTurnSize?: (size: Size) => void
  // Onto another seat, or into the gap before that index, with the spot clear between its new neighbours.
  readonly onMoveSeat?: (seat: SeatId, to: SeatId | number, spot?: Point) => void
  readonly onPlaceSeat?: (seat: SeatId, at: Point) => void // let go over the velvet, at a spot clear of the rest
  readonly chosenSeat?: SeatId // arranging: the seat a tap picked up, which the next tap moves
  readonly onChooseSeat?: (seat: SeatId | undefined) => void
  readonly panelDocked?: boolean // the board draws the centre panel at its foot instead
  readonly panelAt?: Point // where the centre panel sits on a laid-out board, clear of every seat
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
// The smallest a gap marker shrinks to on a crowded ring, still a target a finger can find.
const leastMarker = 20
// How far the seats either side of an aimed gap step apart, in token sizes.
const parting = 0.14
// A lifted seat over open velvet stays there when let go.
const velvet = 'velvet'
// Until the finger has come this far from the press, in token sizes, letting go puts a seat back,
// whatever it is over: on touch the seat is drawn above the finger, so a long press let go in
// place would otherwise move it up, and a slip of the mouse would lay the board out.
const homeReach = 0.3
type DropTarget = SeatId | number | typeof velvet

const noObstacles: readonly BoardControlBounds[] = []
const noSeats: readonly SeatId[] = []

interface Landing {
  readonly seat: SeatId
  readonly x: number
  readonly y: number
}

export const SeatRing = memo(function SeatRing({ seats, band: viewport, geometry, free = false, obstacles = noObstacles, t, onAddReminder, onRemoveReminder, onMoveReminder,
  onEditNote, onGap, onTurn, onArrangeDone, onBackToCircle, turnAt, turnDocked = false, onTurnSize, onMoveSeat, onPlaceSeat, chosenSeat, onChooseSeat,
  readOnly = false, lit = noSeats, panelDocked = false, panelAt, deal = false }: SeatRingProps) {
  const interaction = useBoardInteraction()
  const e = useEdits()
  const { openSeat } = useOpenCard()
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
  // and the last one sits between the last seat and the first. A marker stays halfway between its
  // seats and shrinks where its full size would cover a token.
  // On a laid-out board a gap sits halfway between its two seats wherever they are.
  const gapPoints = useMemo(() => !onArrangeDone ? []
    : (seats.length === 0 ? seatPositions(band, geometry.rx, geometry.ry, 1).map(at => ({ at, position: 0 }))
      : free && seats.length > 1 ? positions.slice(0, seats.length).map((at, i) => {
        const next = positions[(i + 1) % seats.length]!
        return { at: { x: (at.x + next.x) / 2, y: (at.y + next.y) / 2 }, position: i + 1 }
      })
      : seatPositions(band, geometry.rx, geometry.ry, seats.length * 2).flatMap((at, i) => i % 2 === 1 ? [{ at, position: (i + 1) / 2 }] : []))
      .map(({ at, position }) => ({ at, position, size: gapMarkerSize(at, geometry, tokenSize.corner, ring.gap + ring.width, leastMarker) })),
  [onArrangeDone, seats.length, band, geometry, free, positions])
  // A spot for a seat near `at`, clear of every other seat and the corner controls.
  const clearSpot = (at: Point, moving: SeatId | undefined) =>
    settle(at, positions.filter((_, i) => seats[i] && seats[i].id !== moving), band, size, seatMetrics, obstacles)
  const opensGap = (seat: SeatId, gap: number) => insertionMoves(seats.length, indexOf(seat), gap)
  // Where a seat moved or added into a gap would sit clear of the rest.
  const gapSpot = (position: number, moving: SeatId | undefined) => {
    const gap = gapPoints.find(g => g.position === position)
    return gap ? clearSpot(gap.at, moving) : undefined
  }
  // Where a dropped seat was let go, so it lands from there rather than from its old place.
  const landing = useRef<Landing | undefined>(undefined)
  const { lifted, root, ghost, handlers: dragHandlers } = useBoardDrag<DropTarget>(pressed => {
    const seat = pressed.closest('[data-seat-context-target]')?.getAttribute('data-seat-context-target') as SeatId | null | undefined
    if (!seat) return undefined
    if (arranging) return { seat }
    const chip = canDrag ? pressed.closest('[data-chip]')?.getAttribute('data-chip') : undefined
    return chip ? { seat, chip } : undefined
  }, (clientX, clientY, touch, grab, travel) => {
    const origin = domElement(bandView.current)?.getBoundingClientRect()
    const x = clientX - (origin?.left ?? 0)
    // On touch the piece rides above the finger, so the finger never hides it or its target.
    const y = clientY - (origin?.top ?? 0) - (touch ? grab.chip === undefined ? size * seatReach : chipSize : 0)
    let target: DropTarget | undefined
    if (grab.chip === undefined && travel < size * homeReach) return { x, y }
    let best = 1
    const consider = (to: DropTarget, at: { readonly x: number; readonly y: number } | undefined, reach: number) => {
      const score = at ? Math.hypot(at.x - x, at.y - y) / (size * reach) : Infinity
      if (score <= best) { best = score; target = to }
    }
    seats.forEach((s, i) => { if (s.id !== grab.seat) consider(s.id, positions[i], seatReach) })
    if (grab.chip === undefined) for (const gap of gapPoints) if (opensGap(grab.seat, gap.position)) consider(gap.position, gap.at, gapReach)
    // Anywhere else on the board a seat stays where it is let go; off the board it goes back.
    if (target === undefined && grab.chip === undefined && onPlaceSeat && x >= 0 && y >= 0 && x <= band.width && y <= band.height) target = velvet
    return { x, y, ...(target !== undefined ? { target } : {}) }
  }, (grab, to, at) => {
    if (grab.chip === undefined) {
      landing.current = { seat: grab.seat, x: at.x, y: at.y }
      if (to === velvet) onPlaceSeat?.(grab.seat, clearSpot(at, grab.seat))
      else if (typeof to === 'number') onMoveSeat?.(grab.seat, to, gapSpot(to, grab.seat))
      else onMoveSeat?.(grab.seat, to)
      return
    }
    const placedBy = seats.find(s => s.id === grab.seat)?.chips.find(c => c.key === grab.chip)?.placedBy
    if (placedBy !== undefined && typeof to === 'string' && to !== velvet) onMoveReminder?.(placedBy, to)
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
    else setContextSeat(contextSeat === seatId ? undefined : seatId)
  }
  // Each seat is handed the same functions on every render, reading the ring's latest state
  // when called, so a seat whose own values are unchanged is left alone.
  const nominate = interaction.nominate
  const latest = useRef({ tapSeat, onAddReminder, onRemoveReminder, onEditNote, nominate })
  useLayoutEffect(() => { latest.current = { tapSeat, onAddReminder, onRemoveReminder, onEditNote, nominate } })
  // The nominee is picked on the ring. The nomination is recorded through the day's latest
  // handler, since an undo during the pick changes the log it numbers the vote from.
  const startNomination = (by: SeatId) => {
    closeContext()
    interaction.requestSeats({
      allowed: seats.map(seat => seat.id),
      chosen: by,
      label: (seat, name) => seat === by ? t('board.nominateSelf') : t('board.nominatePlayer', { name }),
      onDone: of => latest.current.nominate?.(by, of),
    })
  }
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
  const vote = interaction.countStart
  const tapGap = (position: number) => {
    const spot = gapSpot(position, mover?.id)
    if (!mover) { if (spot) onGap?.(position, spot); return }
    onMoveSeat?.(mover.id, position, spot)
    onChooseSeat?.(undefined)
  }
  const nomineeIndex = vote ? seats.findIndex(seat => seat.id === vote.nominee) : -1
  const nextSeat = positions[(nomineeIndex + 1) % seats.length]
  const countStart = nomineeIndex < 0 ? undefined : free
    ? seats.length > 1 && positions[nomineeIndex] && nextSeat ? countStartBetween(positions[nomineeIndex], nextSeat) : undefined
    : countStartOnRing(band, geometry.rx, geometry.ry, seats.length, nomineeIndex)
  const panel = panelAt ?? centre
  const ghostSeat = Math.round(size * seatLiftScale)

  return (
    <div ref={root} {...dragHandlers} style={{ width: viewport.width, height: viewport.height, overflow: band.height > viewport.height || band.width > viewport.width ? 'auto' : 'visible',
      ...(lifted && !lifted.touch ? { cursor: 'grabbing' } : {}) }}>
      <View ref={bandView} style={[styles.band, { width: band.width, height: band.height }]}>
        {vote && countStart ? <CountStart band={band} at={countStart} size={size} label={vote.label} /> : null}
        {seats.map((seat, i) => {
          const at = positions[i]
          if (!at) return null
          // A laid-out seat's reminders face the middle of the room, which its angle points away from.
          const reminderAngle = free ? at.angle : stackAngle(at, centre, geometry.rx, geometry.ry, { size, chip: chipSize })
          const inPick = pick !== undefined || action !== undefined
          const allowed = pick ? pick.allowed.includes(seat.id) : action?.allowed.includes(seat.id) ?? false
          const place = (action?.marked.indexOf(seat.id) ?? -1) + 1
          const chosen = place > 0 || pick?.chosen === seat.id
          // While a seat is picked up every other seat is a place it can go.
          const swapTarget = !!mover && mover.id !== seat.id
          const editable = !readOnly && !inPick && !arranging
          return <RingSeat key={seat.id} seat={seat} size={size} x={at.x} y={at.y} cx={centre.x} cy={centre.y}
            angle={reminderAngle} raised={expandedSeat === seat.id} rank={tracked.ranks.get(seat.id)}
            stagger={tracked.ranks.has(seat.id) ? stagger : 0} arrived={tracked.arrived.has(seat.id)} seatCount={seats.length} index={i}
            placed={seat.place ? `${seat.place.x},${seat.place.y}` : ''}
            selected={inPick ? chosen : arranging ? liftedSeat === undefined && mover?.id === seat.id : contextPlayer?.id === seat.id || undefined}
            pickable={inPick ? allowed : swapTarget || undefined} allowed={allowed}
            quietPick={!!vote && !pick} readOnly={readOnly} editChips={editable}
            canRemove={!!onRemoveReminder && editable} canAdd={!!onAddReminder && editable}
            canDrag={canDrag} lifted={lifted?.grab.seat === seat.id ? lifted.grab.chip : undefined}
            seatLifted={liftedSeat === seat.id} parted={partingOf(i)}
            dropTarget={lifted?.target === seat.id || lit.includes(seat.id)} swapping={liftedSeat !== undefined && lifted?.target === seat.id}
            swapLabel={swapTarget ? t('board.swapWith', { name: mover.name }) : undefined}
            pickLabel={pick?.label && allowed ? pick.label(seat.id, seat.name) : undefined}
            marked={place > 0 ? place : undefined} markedLabel={place > 0 ? action?.markedLabel(place) : undefined}
            t={t} handlers={handlers} />
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
        {gapPoints.map(({ at, position, size: marker }) => {
          if (mover) {
            if (!opensGap(mover.id, position)) return null
            const aimed = aimedGap?.position === position
            // The aimed slot gives way to the dragged disc over it; the seats stepping apart mark the place.
            return <View key={`gap-${position}`} id={`seat-insertion-${position}`} style={[styles.place, { left: at.x - marker / 2, top: at.y - marker / 2, opacity: aimed ? 0 : 1 }]}>
              <Appear>
                <Token size={marker} emptyStyle={styles.slot} onPress={() => tapGap(position)}
                  accessibilityLabel={t('board.moveSeatTo', { name: mover.name, n: (moverIndex < position ? position - 1 : position) + 1 })} />
              </Appear>
            </View>
          }
          if (!onGap) return null
          return <View key={`gap-${position}`} id={`seat-insertion-${position}`} style={[styles.place, { left: at.x - marker / 2, top: at.y - marker / 2 }]}>
            <Token size={marker} add onPress={() => tapGap(position)} accessibilityLabel={t('board.addSeatAt', { n: position + 1 })} />
          </View>
        })}
        {onArrangeDone && !readOnly && !turnDocked ? <ArrangeControls t={t} onTurn={onTurn} onDone={onArrangeDone} onBackToCircle={onBackToCircle}
          hint={onMoveSeat && liftedSeat === undefined ? mover ? t('board.arrangeChosen', { name: mover.name }) : t('board.arrangeHint') : undefined}
          {...(onTurnSize ? { onSize: onTurnSize } : {})}
          style={[styles.centerPanel, styles.turnPanel, { left: (turnAt ?? centre).x, top: (turnAt ?? centre).y }]} /> : null}
        {interaction.centerPanel && !readOnly && !panelDocked ? <View pointerEvents="box-none" style={[styles.centerPanel, {
          left: panel.x, top: panel.y, width: centrePanelWidth(band.width, size),
        }]}>{interaction.centerPanel}</View> : null}
        {contextPlayer && contextAt && !readOnly ? <SeatContextMenu key={contextPlayer.id} seatId={contextPlayer.id} name={contextPlayer.name} width={contextWidth} t={t}
          alignment={contextPlayer.alignment} dead={contextPlayer.dead} ghostVote={contextPlayer.ghostVote} anchor={contextAt}
          place={(menu, room) => placeSeatMenu({ at: contextAt, size, centre, room, menu, others: positions.filter((_, i) => i !== contextIndex && i < seats.length) })}
          onClose={closeContext} onCharacter={() => openSeatAction('character')}
          {...(e.board && believed(e.board, contextPlayer.id) !== undefined
            ? { onShowCard: kind => { closeContext(); openSeat(kind, contextPlayer.id) } } : {})}
          {...(onAddReminder ? { onReminder: () => { closeContext(); onAddReminder(contextPlayer.id) } } : {})}
          onRemove={() => openSeatAction('remove')}
          onRename={name => e.append(edits.renameSeat(contextPlayer.id, name))}
          onLife={() => e.append(contextPlayer.dead ? edits.revive(contextPlayer.id) : edits.kill(contextPlayer.id))}
          onGhostVote={() => { if (contextPlayer.dead) e.append(edits.setGhostVote(contextPlayer.id, !contextPlayer.ghostVote)) }}
          onAlignment={() => e.append(edits.setAlignment(contextPlayer.id, contextPlayer.alignment === 'good' ? 'evil' : 'good'))}
          {...(interaction.nominate ? { onNominate: () => startNomination(contextPlayer.id) } : {})}
          {...(interaction.exile && character(asCharacterId(contextPlayer.character)).team === 'traveller'
            ? { onCallExile: () => { interaction.exile?.(contextPlayer.id); closeContext() } } : {})} /> : null}
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
  readonly placed: string // where it was laid out, '' on the circle, so a new place glides
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
  readonly pickLabel: string | undefined // what a tap on this seat does during a pick that says so
  readonly marked: number | undefined // a recorded hand's place in the count, shown on its badge
  readonly markedLabel: string | undefined // and read with the seat's own name
  readonly t: Translate
  readonly handlers: SeatHandlers
}

// The board view is rebuilt on every edit, so a seat compares its view by value: one seat's
// edit leaves the other tokens, their art and their printed names alone.
const sameRingSeat = (a: RingSeatProps, b: RingSeatProps) =>
  (Object.keys(a) as (keyof RingSeatProps)[]).every(key => key === 'seat' ? sameSeat(a.seat, b.seat) : a[key] === b[key])

const RingSeat = memo(function RingSeat({ seat, size, x, y, cx, cy, angle, raised, rank, stagger, arrived, seatCount, index, placed, selected, pickable, allowed,
  quietPick, readOnly, editChips, canRemove, canDrag, lifted, dropTarget, seatLifted, parted, swapping, swapLabel, canAdd, pickLabel, marked, markedLabel, t, handlers }: RingSeatProps) {
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
      stagger={stagger} arrived={arrived} seatCount={seatCount} index={index} placed={placed} landing={() => handlers.landing(seat.id)}>
      <div data-seat-context-target={seat.id} title={pickLabel} style={{ opacity: seatLifted ? motion.dimOpacity : 1, transform: parted ?? 'none',
        transition: `transform ${durationFor(motion.duration.mark, reduced)}ms ${motion.css.ease}, opacity ${durationFor(motion.duration.mark, reduced, true)}ms` }}>
      <Seat

        size={size}
        name={seat.name}
        {...(empty ? {} : { character: seat.character, characterName: seat.characterName, alignment: seat.alignment })}
        dead={seat.dead}
        onBlock={seat.onBlock === true}
        ghostVote={seat.ghostVote}
        nominator={seat.nominator === true}
        nominee={seat.nominee === true}
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
        accessibilityLabel={[label, seat.onBlock ? t('board.onBlock') : undefined, seat.nominator ? t('board.nominatorToday') : undefined,
          seat.nominee ? t('board.nomineeToday') : undefined, pickLabel, swapLabel, markedLabel].filter(Boolean).join('. ')}
      />
      </div>
      {swapping ? <Appear pointerEvents="none" style={styles.swapBadge}>
        <View aria-hidden style={styles.swapDisc}><Icon name="swap" size={18} color={palette.onAccent} /></View>
      </Appear> : null}
      {marked !== undefined ? <Appear pointerEvents="none" style={styles.votedBadge}>
        <View aria-hidden style={styles.votedDisc}><Text style={[type.text.strong, tabular, styles.votedNumber]}>{marked}</Text></View>
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
  readonly placed: string
  readonly landing: () => Landing | undefined // a dropped seat glides in from where it was let go
  readonly children: ReactNode
}

// A seat's place on the band, and its motion. Dealt, it flies from the centre at corner size to
// its place at full size, after its rank's share of the stagger. Added, it grows in; and when a
// seat is added, removed, laid out or put back on the circle, or the ring turns, the seats glide
// from where they were to their new places. A resize or a measured control moves the seats at
// once, so only a change of seat count, of a seat's place in the order or of where it was laid out
// glides, and a token still in the deal has its start moved to the new centre.
// Each run is WAAPI on the compositor, started before the first paint, and a re-render
// mid-flight leaves it alone. Under reduced motion the token is simply there.
const Dealt = ({ size, x, y, cx, cy, rank, stagger, arrived, seatCount, index, placed, landing, children, raised }: DealtProps) => {
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
  const last = useRef({ x, y, size, seatCount, index, placed })
  useLayoutEffect(() => {
    const before = last.current
    last.current = { x, y, size, seatCount, index, placed }
    const deal = dealing.current
    // Under a point, as recording a layout's share can shift a token by a fraction of one.
    const moved = Math.hypot(before.x - x, before.y - y) >= 1 || before.size !== size
    if (deal?.playState === 'running' && deal.effect instanceof KeyframeEffect) deal.effect.setKeyframes(fromCentre())
    else if ((before.seatCount !== seatCount || before.index !== index || before.placed !== placed) && moved) {
      const dropped = landing()
      const from = dropped ? { x: dropped.x, y: dropped.y, scale: seatLiftScale } : { x: before.x, y: before.y, scale: before.size / size }
      element()?.animate([{ transform: `translate(${from.x - x}px, ${from.y - y}px) scale(${from.scale})` }, { transform: 'none' }],
        { duration: motion.duration.deal, easing: motion.css.ease })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y, cx, cy, size, seatCount, index, placed])
  return (
    <View ref={place} style={[styles.place, { zIndex: raised ? 2 : 0, left: x - size / 2, top: y - size / 2, width: size, height: size }]}>
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  swapBadge: { position: 'absolute', top: 0, right: 0 },
  swapDisc: { width: 28, height: 28, borderRadius: 14,
    backgroundColor: palette.accent, borderWidth: 2, borderColor: palette.ink, alignItems: 'center', justifyContent: 'center' },
  votedBadge: { position: 'absolute', top: 0, right: 0 },
  // An ink edge like the swap badge, so the number reads against parchment art and the brass ring.
  votedDisc: { minWidth: 26, height: 26, borderRadius: 13, paddingHorizontal: 3, backgroundColor: palette.accent, borderWidth: 2, borderColor: palette.ink,
    alignItems: 'center', justifyContent: 'center' },
  votedNumber: { fontSize: 14, lineHeight: 18, color: palette.onAccent, textAlign: 'center' },
  // Chips and names hang outside every seat's box, so nothing here clips.
  band: { overflow: 'visible' },
  place: { position: 'absolute' },
  centerPanel: { position: 'absolute', zIndex: 15, transform: [{ translateX: '-50%' }, { translateY: '-50%' }] },
  turnPanel: { alignItems: 'center' },
  // A gap a picked-up seat can go into: the dashed brass of a place on offer, and nothing in it.
  slot: { borderColor: palette.accent, borderStyle: 'dashed' },
})
