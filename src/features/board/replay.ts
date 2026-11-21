import type { CharacterId, Locale, Script, Values } from '../../content'
import { character, gameText } from '../../content'
import type { Event, SeatId } from '../../engine'
import { apply, emptyGrimoire } from '../../engine'
import { setupStart } from '../../store/replay'
import type { BoardView, SeatView } from './board'
import { boardView } from './board'

// One change a step made to the board, as a line of history text and its values.
export interface ReplayChange {
  readonly key: string
  readonly values: Values
}

// A place the replay stops: the cursor that shows it, the seats it changed and what changed.
export interface ReplayStep {
  readonly cursor: number
  readonly seats: readonly SeatId[]
  readonly changes: readonly ReplayChange[]
}

// A seat as the ring draws it, without the event ids its chips carry, so a reminder taken off
// and put back reads the same. A living player's ghost vote is not drawn.
const drawnSeat = (seat: SeatView) => ({
  ...seat,
  ghostVote: seat.dead && seat.ghostVote,
  chips: seat.chips.map(({ key: _key, placedBy, ...chip }) => ({ ...chip, identity: placedBy === undefined })),
})
const drawn = (view: BoardView) => ({
  seats: view.seats.map(drawnSeat),
  bluffs: view.bluffs, loose: view.loose,
  grants: view.grants.map(({ key: _key, ...grant }) => grant),
})

type DrawnSeat = ReturnType<typeof drawnSeat>
const chipName = (chip: DrawnSeat['chips'][number]) => JSON.stringify([chip.label, chip.character, chip.identity])
// What is in `a` and not in `b`, counting repeats, since a seat can carry the same reminder twice.
const without = <T>(a: readonly T[], b: readonly T[]): T[] => {
  const left = [...b]
  return a.filter(item => {
    const at = left.indexOf(item)
    if (at < 0) return true
    left.splice(at, 1)
    return false
  })
}

const seatChanges = (was: DrawnSeat | undefined, now: DrawnSeat | undefined): ReplayChange[] => {
  if (!was && now) return [now.character ? { key: 'history.addSeat', values: { name: now.name, character: now.characterName } } : { key: 'history.addSeatEmpty', values: { name: now.name } }]
  if (was && !now) return [{ key: 'history.removeSeat', values: { name: was.name } }]
  if (!was || !now) return []
  const name = now.name
  const changes: ReplayChange[] = []
  if (was.name !== now.name) changes.push({ key: 'history.renamed', values: { was: was.name, name } })
  if (was.character !== now.character && now.character) changes.push({ key: 'history.setCharacter', values: { name, character: now.characterName } })
  if (was.alignment !== now.alignment) changes.push({ key: now.alignment === 'good' ? 'history.setAlignmentGood' : 'history.setAlignmentEvil', values: { name } })
  if (was.dead !== now.dead) changes.push({ key: now.dead ? 'history.dies' : 'history.revive', values: { name } })
  else if (was.ghostVote !== now.ghostVote) changes.push({ key: now.ghostVote ? 'history.ghostVoteBack' : 'history.ghostVoteUsed', values: { name } })
  if (!was.onBlock !== !now.onBlock) changes.push({ key: now.onBlock ? 'history.onBlock' : 'history.offBlock', values: { name } })
  if (was.place?.x !== now.place?.x || was.place?.y !== now.place?.y) changes.push({ key: 'history.moves', values: { name } })
  const wasChips = was.chips.map(chipName)
  const nowChips = now.chips.map(chipName)
  for (const off of without(wasChips, nowChips)) {
    const chip = was.chips[wasChips.indexOf(off)]!
    changes.push({ key: 'history.reminderOff', values: { reminder: chip.label, name } })
  }
  for (const on of without(nowChips, wasChips)) {
    const chip = now.chips[nowChips.indexOf(on)]!
    changes.push(chip.identity ? { key: 'history.seatBelieves', values: { name, character: chip.label } } : { key: 'history.reminderOn', values: { reminder: chip.label, name } })
  }
  return changes
}

// The changes between two drawn boards, seat by seat round the ring, then off the ring.
const changesBetween = (was: ReturnType<typeof drawn>, now: ReturnType<typeof drawn>, locale: Locale): { seats: SeatId[]; changes: ReplayChange[] } => {
  const text = gameText(locale)
  const named = (ids: readonly CharacterId[]) => ids.map(id => text.role(id).name)
  const before = new Map(was.seats.map(seat => [seat.id, seat]))
  const after = new Map(now.seats.map(seat => [seat.id, seat]))
  const seats: SeatId[] = []
  const changes: ReplayChange[] = []
  for (const id of new Set([...now.seats.map(seat => seat.id), ...was.seats.map(seat => seat.id)])) {
    const a = before.get(id)
    const b = after.get(id)
    // A seat is lit only for a change worth a line: the day's marks going at nightfall are not.
    const own = JSON.stringify(a) === JSON.stringify(b) ? [] : seatChanges(a, b)
    if (b && own.length > 0) seats.push(id)
    changes.push(...own)
  }
  // A seat moved round the circle is the one whose removal leaves both orders the same.
  const order = (list: readonly DrawnSeat[], skip: SeatId) => list.filter(seat => seat.id !== skip && before.has(seat.id) && after.has(seat.id)).map(seat => seat.id).join()
  if (order(was.seats, '' as SeatId) !== order(now.seats, '' as SeatId)) {
    for (const seat of now.seats) if (before.has(seat.id) && order(was.seats, seat.id) === order(now.seats, seat.id)) {
      if (!seats.includes(seat.id)) seats.push(seat.id)
      changes.push({ key: 'history.moves', values: { name: seat.name } })
    }
  }
  // Pair a new nominee with a new nominator, as a day records one nomination at a time.
  const nominees = now.seats.filter(seat => seat.nominee && !before.get(seat.id)?.nominee)
  const nominators = now.seats.filter(seat => seat.nominator && !before.get(seat.id)?.nominator)
  const by = nominees.length === 1 && nominators.length === 1 ? nominators[0] : undefined
  for (const seat of [...nominators, ...nominees]) if (!seats.includes(seat.id)) seats.push(seat.id)
  for (const of of nominees) changes.push(by ? { key: 'day.nominationArrow', values: { by: by.name, of: of.name } } : { key: 'history.nominated', values: { name: of.name } })
  if (JSON.stringify(was.bluffs) !== JSON.stringify(now.bluffs) && now.bluffs.length > 0)
    changes.push({ key: 'history.bluffsSet', values: { characters: named(now.bluffs).join(', ') } })
  for (const id of without(now.loose, was.loose)) changes.push({ key: 'history.looseIn', values: { character: text.role(id).name } })
  for (const id of without(was.loose, now.loose)) changes.push({ key: 'history.looseOut', values: { character: text.role(id).name } })
  const grants = (list: typeof was.grants) => list.map(grant => grant.character as CharacterId)
  for (const id of without(grants(now.grants), grants(was.grants))) changes.push({ key: 'history.grantIn', values: { character: text.role(id).name } })
  for (const id of without(grants(was.grants), grants(now.grants))) changes.push({ key: 'history.grantOut', values: { character: text.role(id).name } })
  return { seats, changes }
}

// The steps of a replay: where the board the ring draws changes, compared without event ids
// or the elapsed clock. One pass over the log: the bluffs are followed as the events go by, the
// way bluffsOf reads them back, rather than by rescanning every prefix.
export const replaySteps = (log: readonly Event[], script: Script, locale: Locale): readonly ReplayStep[] => {
  const start = setupStart(log)
  let board = emptyGrimoire(script)
  let chosen: readonly CharacterId[] | undefined
  // Older games saved the selection as a showing to the Demon.
  const shown = new Map<SeatId, readonly CharacterId[]>()
  const viewOf = () => {
    const demon = board.seats.find(seat => character(seat.character).team === 'demon')
    const view = drawn(boardView(board, [], locale, chosen ?? (demon ? shown.get(demon.id) : undefined) ?? []))
    return { phase: board.clock.phase, night: board.clock.night, view, drawn: JSON.stringify(view) }
  }
  let last = viewOf()
  const steps: ReplayStep[] = []
  for (const [index, event] of log.entries()) {
    board = apply(board, event)
    if (event.kind === 'setBluffs') chosen = event.characters
    else if (event.kind === 'info' && event.to.length === 1 && event.told.kind === 'characters') shown.set(event.to[0]!, event.told.characters)
    if (index + 1 < start) continue
    // One action is one step, as it is one undo, so a moved reminder is never seen off the board.
    // A phase keeps its own stop, since the timeline's labels sit on it.
    const continuing = event.batch !== undefined && log[index + 1]?.batch === event.batch
    if (index + 1 > start && continuing && event.kind !== 'phase' && event.kind !== 'endGame') continue
    const now = viewOf()
    const changed = now.phase !== last.phase || now.night !== last.night || now.drawn !== last.drawn
    if (index + 1 > start && (changed || event.kind === 'phase')) steps.push({ cursor: index + 1, ...changesBetween(last.view, now.view, locale) })
    last = now
  }
  return [{ cursor: start, seats: [], changes: [] }, ...steps]
}

// The step a cursor shows: the last one at or before it.
export const stepAt = (steps: readonly ReplayStep[], cursor: number): number => Math.max(0, steps.findLastIndex(step => step.cursor <= cursor))
