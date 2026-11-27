// References reserve board width only when there is room for both. On smaller screens
// the paper overlays the board, without shrinking the seating circle to an unusable strip.
import { useKeepAwake } from 'expo-keep-awake'
import type { ComponentType, ReactNode, RefObject } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Modal, StyleSheet, Text, View } from 'react-native'
import type { ViewInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { emptySeat, scriptName } from '../../content'
import type { EventId, SeatId } from '../../engine'
import type { Chapter } from '../../store/chronicle'
import { BoardInteractionProvider, useBoardInteraction } from '../../ui/BoardInteraction'
import { boardLayoutFor, referenceTabWidth } from './boardLayout'
import { Button } from '../../ui/Button'
import { EdgeButton } from '../../ui/EdgeButton'
import { Card } from './Card'
import { Confirm } from '../../ui/Confirm'
import { Empty } from '../../ui/Empty'
import { domElement, layerAbove } from '../../ui/focus'
import type { BoardPanels } from '../../ui/Panel'
import { PanelVisibilityContext } from '../../ui/Panel'
import { PageEnter, Screen } from '../../ui/Screen'
import { usePhone } from '../../ui/breakpoint'
import { hairline, motion, palette, radius, seatMetrics, shadows, space, tokenSize, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Token } from '../../ui/Token'
import { Velvet } from '../../ui/Velvet'
import { useLayoutViewport } from '../../ui/Viewport'
import { looseChoices } from './board'
import { BluffPicker, BoardBluffs } from './BoardBluffs'
import { evilLearnsTeam } from './nightReference'
import { BoardToolbar } from './BoardToolbar'
import { LooseCharacters } from './LooseCharacters'
import { PhasePlaque } from './PhasePlaque'
import { NoteEditor } from './NoteEditor'
import type { NoteTarget } from './NoteEditor'
import { ReminderPicker } from './ReminderPicker'
import { ReplayBar, replayBarHeight } from './ReplayBar'
import { ReferenceRail } from './ReferenceRail'
import type { ReferenceTab } from './ReferenceRail'
import { useReferenceDrawer } from './useReferenceDrawer'
import { boardGeometry, centrePanelWidth, tokenStripHeight, toolbarHeight, undoSize } from './boardGeometry'
import { ArrangeControls, hintRoom } from './ArrangeControls'
import { centreSpot, isFree, layoutPositions, toPlace } from './freeLayout'
import type { Point } from './freeLayout'
import { centreBoxes } from './ringLayout'
import type { RingGeometry } from './ringLayout'
import { edits } from './seat'
import { SeatRing } from './SeatRing'
import { ShowSheet, useCardNote } from './ShowSheet'
import { cardKeys, takes } from './show'
import { TokenStrip } from './TokenStrip'
import { useBoard } from './useBoard'
import { useEdits } from './useEdits'
import { EndGame } from './EndGame'
import { VictoryAnnouncement } from './VictoryAnnouncement'
import { GameOverActions, actionsRoom } from './GameOverActions'
import { fitsUnder } from './victory'

export interface BoardHistoryProps {
  readonly visible: boolean
  readonly chapters: readonly Chapter[]
  readonly onClose: () => void
}

export interface BoardScreenProps {
  readonly id: string // the game id the route was given
  readonly replay?: boolean
  readonly openSetup?: boolean // the board opens with its setup window up, as after discovery
  readonly deal?: boolean // the game was dealt just before it opened, so the ring deals it
  readonly panels: BoardPanels // each phase's node renders its own Panel into the slot
  readonly timer?: ReactNode
  readonly History: ComponentType<BoardHistoryProps> // the window History in More opens
}

// A ring holds at most twenty seats, so arranging a full one offers no add-seat markers.
const maxSeats = 20
// The result never runs wider than this, however much room the ring leaves.
const resultWidth = 560
// The vote controls' height with a two-line title, which a laid-out room must leave clear at its
// middle before they go there rather than dock at the foot.
const votePanelHeight = 200
// Undo, the toolbar, the plaque and the bluffs hold the four corners of a live board. Replay has
// no undo, so its corner keeps the ornament, and Exit replay stands where the toolbar was.
const replayOrnaments = ['topLeft'] as const
const noOrnaments = [] as const
// A landscape board this tall has room for the bluff tray's title; a phone on its side does not.
const tallBoard = 600
// Docked actions take the foot from the bluffs and the plaque, which stay measured where they
// were, so the ring does not move as the game ends.
const aside = { 'aria-hidden': true, pointerEvents: 'none' } as const
// While a card waits for its player, the controls that have nothing to do with the pick are dimmed
// and let a tap through to the velvet, where it cancels the pick as any tap off the seats does.
const resting = { pointerEvents: 'none' } as const
// A control measured again at the same size keeps the board's layout as it was.
const sameSize = (next: Size) => (previous: Size) => previous.width === next.width && previous.height === next.height ? previous : next

export const BoardScreen = (props: BoardScreenProps) => (
  <BoardInteractionProvider>
    <Board {...props} />
  </BoardInteractionProvider>
)

const Board = ({ id, replay = false, openSetup = false, deal = false, panels, timer, History }: BoardScreenProps) => {
  const b = useBoard(id, replay)
  const e = useEdits()
  const cardNote = useCardNote()
  const interaction = useBoardInteraction()
  const insets = useSafeAreaInsets()
  const window = useLayoutViewport()
  const phone = usePhone()
  const p = palette
  const t = b.t
  const [showOpen, setShowOpen] = useState(false)
  const [bluffsOpen, setBluffsOpen] = useState(false)
  const [bluffsWell, setBluffsWell] = useState<number>()
  const [looseOpen, setLooseOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [referenceTab, setReferenceTab] = useState<ReferenceTab | null>(null)
  const [phaseOpen, setPhaseOpen] = useState(openSetup)
  const [toolbarSize, setToolbarSize] = useState({ width: 260, height: 50 })
  const [exitSize, setExitSize] = useState({ width: 120, height: 44 })
  // A first guess at the tray, its title included where it shows, so the first fit is the last.
  const [bluffsSize, setBluffsSize] = useState({ width: 190, height: window.width > window.height && window.height < tallBoard ? 62 : 76 })
  const [clockHeight, setClockHeight] = useState(68)
  const lastReferenceTab = useRef<ReferenceTab>('characters')
  const tableView = useRef<ViewInstance>(null)
  useEffect(() => { if (referenceTab) lastReferenceTab.current = referenceTab }, [referenceTab])
  const openReference = useCallback(() => { setReferenceTab(lastReferenceTab.current); setPhaseOpen(false) }, [])
  const closeReference = useCallback(() => setReferenceTab(null), [])
  const changeReference = useCallback((tab: ReferenceTab | null) => { setReferenceTab(tab); setPhaseOpen(false) }, [])
  // The drawer keeps its sliding width to itself and reports only what it takes from the board,
  // which changes on screens wide enough to yield space; on a narrower one the board never redraws.
  const [reservedWidth, setReservedWidth] = useState(referenceTabWidth)
  const [confirmHome, setConfirmHome] = useState(false)
  const [endOpen, setEndOpen] = useState(false)
  const [reminderTarget, setReminderTarget] = useState<SeatId | undefined>(undefined)
  const [noteTarget, setNoteTarget] = useState<NoteTarget | undefined>(undefined)
  const [arranging, setArranging] = useState(false)
  // A seat picked up by a tap while arranging, waiting for the tap that says where it goes.
  const [chosenSeat, setChosenSeat] = useState<SeatId | undefined>(undefined)
  if (!arranging && chosenSeat !== undefined) setChosenSeat(undefined)
  const choosingSeats = !!interaction.pick || !!interaction.seatAction
  const { pick, cancelRequest } = interaction
  const naming = pick?.title
  const hasCenterPanel = !!interaction.centerPanel
  const [hadCenterPanel, setHadCenterPanel] = useState(hasCenterPanel)
  if (hadCenterPanel !== hasCenterPanel) {
    setHadCenterPanel(hasCenterPanel)
    if (hasCenterPanel) { setReferenceTab(null); setPhaseOpen(false) }
  }
  const phase = b.board?.clock.phase
  const nightNumber = b.board?.clock.night
  const phaseKey = b.lookingBack ? undefined : `${phase}:${nightNumber}`
  const [referencePhase, setReferencePhase] = useState(phaseKey)
  if (referencePhase !== phaseKey) {
    // Open the matching reference once when a new night begins.
    setReferencePhase(phaseKey)
    if (phase === 'night' && !b.lookingBack) {
      setReferenceTab(nightNumber === 1 ? 'first' : 'other')
      setPhaseOpen(false)
    }
  }
  useEffect(() => {
    const dismiss = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      if (layerAbove()) return
      if (pick) {
        cancelRequest()
        return
      }
      setReferenceTab(null)
      if (!choosingSeats) setPhaseOpen(false)
    }
    document.addEventListener('keydown', dismiss)
    return () => document.removeEventListener('keydown', dismiss)
  }, [choosingSeats, pick, cancelRequest])
  // Ctrl or Cmd with Z undoes. In a field the keys keep to its text, and under a window they do
  // nothing, so an edit never changes behind what is being read.
  const { undo } = b
  useEffect(() => {
    if (!undo) return
    const keys = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'z') return
      const target = event.target
      if (target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (layerAbove()) return
      event.preventDefault()
      undo()
    }
    document.addEventListener('keydown', keys)
    return () => document.removeEventListener('keydown', keys)
  }, [undo])
  // A pick on the ring, such as a nomination's nominee, ends on a click off the seats, so a touch
  // screen with no Escape can always let it go.
  useEffect(() => {
    if (!pick) return
    const cancelOutside = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-seat-context-target]')) return
      cancelRequest()
    }
    document.addEventListener('click', cancelOutside, true)
    return () => document.removeEventListener('click', cancelOutside, true)
  }, [pick, cancelRequest])
  // Arranging the seats ends on a click anywhere but its own controls and the seats, or Escape.
  // Either first puts down a seat that a tap picked up.
  const picked = chosenSeat !== undefined
  useEffect(() => {
    if (!arranging) return
    const stop = () => picked ? setChosenSeat(undefined) : setArranging(false)
    const cancelOutside = (event: MouseEvent) => {
      // Keep the controls mounted until their press has recorded its edit.
      if (event.target instanceof Element && event.target.closest('[id^="seat-insertion-"], #ring-turn, [data-seat-context-target]')) return
      stop()
    }
    // A dragged seat hears Escape first and goes back where it was.
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) stop()
    }
    document.addEventListener('click', cancelOutside, true)
    document.addEventListener('keydown', cancelOnEscape)
    return () => {
      document.removeEventListener('click', cancelOutside, true)
      document.removeEventListener('keydown', cancelOnEscape)
    }
  }, [arranging, picked])

  const availableWidth = window.width - insets.left - insets.right
  const availableHeight = Math.max(0, window.height - insets.top - insets.bottom - (b.lookingBack ? replayBarHeight : 0))
  const landscape = window.width > window.height
  const live = !b.lookingBack
  const seatCount = b.view?.seats.length ?? 0
  const stripCount = b.view ? b.view.loose.length + b.view.grants.length : 0
  const measures = useMemo(() => ({ width: availableWidth, height: availableHeight, landscape, live,
    reserved: reservedWidth, toolbar: live ? toolbarSize : exitSize, bluffs: bluffsSize, clockHeight, seats: seatCount, strip: stripCount }),
  [availableWidth, availableHeight, landscape, live, reservedWidth, toolbarSize, exitSize, bluffsSize, clockHeight, seatCount, stripCount])
  const opened = useMemo(() => boardGeometry(measures), [measures])
  // Where the seats are drawn: laid out as the room, or on the circle.
  const places = useMemo(() => b.view?.seats.map(seat => seat.place) ?? [], [b.view])
  const free = isFree(places)
  const placed = useCallback((at: RingGeometry) => free ? { ...at, positions: layoutPositions(at, places, seatMetrics) } : at, [free, places])
  // A finished game's actions go under the result where the middle holds them both. On a phone,
  // in thumb reach, or where the middle is too small, they dock at the foot, and a board on its
  // side then gives its foot up to them as a portrait one always does.
  const over = b.board?.clock.phase === 'over' && !b.lookingBack
  const winner = b.board?.clock.phase === 'over' ? b.board.result?.winner : undefined
  const actionsCentred = useMemo(() => over && !!winner && !phone
    && fitsUnder(centreBoxes(placed(opened.ring), seatMetrics, resultWidth), actionsRoom), [over, winner, phone, placed, opened])
  const actionsDocked = over && !actionsCentred
  const footDocked = actionsDocked && landscape
  const geometry = useMemo(() => footDocked ? boardGeometry({ ...measures, foot: true }) : opened, [footDocked, measures, opened])
  const ring = useMemo(() => placed(geometry.ring), [placed, geometry.ring])
  const resultBoxes = useMemo(() => centreBoxes(ring, seatMetrics, resultWidth), [ring])
  // A laid-out room may have a seat in its middle, so the vote goes where none is, or to the foot.
  const panelAt = useMemo(() => {
    if (!free) return undefined
    const width = centrePanelWidth(ring.band.width, ring.size)
    return centreSpot(centreBoxes(ring, seatMetrics, width), width, votePanelHeight)
  }, [free, ring])
  // The arrangement's controls make way for a laid-out room: in its middle where that is clear,
  // else docked at the foot over the bluffs and the plaque, which arranging does not need.
  const [turnSize, setTurnSize] = useState<Size>()
  const turnAt = useMemo(() => free && turnSize
    ? centreSpot(centreBoxes(ring, seatMetrics, ring.band.width), turnSize.width, turnSize.height + 2 * hintRoom) : undefined,
  [free, turnSize, ring])
  const turnDocked = free && turnSize !== undefined && turnAt === undefined
  const seatsRight = free ? Math.max(-Infinity, ...ring.positions.map(at => at.x + ring.size / 2)) : geometry.seatsRight
  const { append, appendAll, board: edited } = e
  const addReminder = useCallback((seat: SeatId) => setReminderTarget(seat), [])
  const removeReminder = useCallback((placedBy: EventId) => append(edits.removeToken(placedBy)), [append])
  const moveReminder = useCallback((placedBy: EventId, to: SeatId) => {
    const move = edited ? edits.moveToken(edited, placedBy, to) : []
    if (move.length > 0) appendAll(move)
  }, [edited, appendAll])
  const editNote = useCallback((placedBy: EventId) => setNoteTarget({ kind: 'placed', placedBy }), [])
  // The toolbar keeps the same handlers from render to render, so an edit leaves it alone.
  const openShow = useCallback(() => setShowOpen(true), [])
  const openBluffs = useCallback((well?: number) => { setBluffsWell(well); setBluffsOpen(true) }, [])
  const openLoose = useCallback(() => setLooseOpen(true), [])
  const openHistory = useCallback(() => setHistoryOpen(true), [])
  const openEnd = useCallback(() => setEndOpen(true), [])
  const askHome = useCallback(() => setConfirmHome(true), [])
  // One mode places new seats, turns the ring and moves single seats to where the players sat
  // down, after the draw or later, so the table can be laid out in one pass.
  const toggleArrange = useCallback(() => {
    setArranging(!arranging)
    if (!arranging) {
      cancelRequest()
      setPhaseOpen(false)
    }
  }, [arranging, cancelRequest])
  const stopArranging = useCallback(() => setArranging(false), [])
  const updateTurnSize = useCallback((size: Size) =>
    setTurnSize(previous => previous && previous.width === size.width && previous.height === size.height ? previous : size), [])

  // A locked phone mid-night is worse than a bright one. On the web the lock is refused while the
  // tab is hidden, and releasing a lock that never took would otherwise throw on unmount.
  useKeepAwake(undefined, { suppressDeactivateWarnings: true })

  if (b.missing) {
    return (
      <Screen title={t('common.appName')} onBack={b.goHome} backLabel={t('common.back')}>
        <Empty message={t('board.missing')} actionLabel={t('common.home')} onAction={b.goHome} />
      </Screen>
    )
  }
  const board = b.board
  const view = b.view
  if (!board || !view) {
    return (
      <Screen title={t('common.appName')} >
        <Text style={[type.text.body, { color: p.muted }]}>{t('common.loading')}</Text>
      </Screen>
    )
  }

  const { columnWidth, statusHeight, utilitiesHeight, utilitiesWidth, clockWidth, topBandHeight } = geometry
  const hasUtilities = stripCount > 0
  const panelDocked = !!interaction.centerPanel && (free ? panelAt === undefined : geometry.panelDocks)
  const dockWidth = Math.min(440, availableWidth - 2 * space.sm)

  const grantLabel = (from: string | undefined) => from ?? t('board.storyteller')
  const grantA11y = (characterId: string, from: string | undefined) =>
    from === undefined
      ? t('board.grantOwn', { character: e.name(characterId) })
      : t('board.grantFrom', { character: e.name(characterId), name: from })

  // In a laid-out room a seat added or moved into a gap sits between its new neighbours, unless
  // both are on the circle, where it takes its place on the circle too.
  const betweenPlaced = (gap: number) => [board.seats[gap - 1], board.seats[gap % seatCount]].some(seat => seat?.place)
  const addSeat = (at: number, spot: Point) => {
    if (seatCount >= maxSeats) return
    let nextNumber = seatCount + 1
    while (board.seats.some(seat => seat.name === t('setup.defaultSeat', { n: nextNumber }))) nextNumber++
    const add = edits.addSeat(t('setup.defaultSeat', { n: nextNumber }), at, emptySeat, 'good')
    e.appendAll(add.kind === 'addSeat' && betweenPlaced(at) ? [add, edits.placeSeat(add.seat, toPlace(spot, ring.band))] : [add])
  }
  const turnSeats = (direction: 'clockwise' | 'counterclockwise') => {
    const edit = edits.turnSeats(board.seats.map(seat => seat.id), direction)
    if (edit && live) e.appendAll(edits.keepSpots(board, [edit]))
  }
  // Onto another seat the two swap; into a gap the seat takes that place.
  const moveSeat = (seat: SeatId, to: SeatId | number, spot?: Point) => {
    const ids = board.seats.map(s => s.id)
    if (!live) return
    if (typeof to !== 'number') {
      const swap = edits.swapSeats(ids, seat, to)
      if (swap.length > 0) e.appendAll(edits.keepSpots(board, swap))
      return
    }
    const insert = edits.insertSeat(ids, seat, to)
    if (!insert) return
    const placed = betweenPlaced(to) && spot ? [edits.placeSeat(seat, toPlace(spot, ring.band))]
      : board.seats.find(s => s.id === seat)?.place ? [edits.placeSeat(seat)] : []
    e.appendAll([insert, ...placed])
  }
  const placeSeat = (seat: SeatId, at: Point) => { if (live) e.append(edits.placeSeat(seat, toPlace(at, ring.band))) }
  const backToCircle = () => {
    const back = edits.backToCircle(board)
    if (back.length > 0 && live) e.appendAll(back)
  }

  const phaseAction = live && !over
  const toolbar = <BoardToolbar t={t}
    picking={naming} onCancelPick={cancelRequest}
    pickRoom={availableWidth - 2 * space.md - space.sm - undoSize - toolbarSize.width}
    arranging={arranging} onArrange={toggleArrange}
    arrangeDisabled={seatCount >= maxSeats && (seatCount < 2 || hasCenterPanel)}
    onShow={openShow}
    onLoose={openLoose} looseDisabled={looseChoices(board.script).length === 0}
    onHistory={openHistory} historyDisabled={b.chapters.length === 0} onEnd={openEnd} onHome={askHome}
    />
  // A finished game leaves nothing to resume, so its Home leaves without asking.
  const actions = <GameOverActions t={t} onPlayAgain={b.playAgain} onReplay={b.enterReplay} onHome={b.goHome} />

  const table = (
    <View
      style={[
        styles.column,
        {
          paddingTop: insets.top,
          paddingLeft: insets.left,
          paddingRight: insets.right,
          paddingBottom: b.lookingBack ? 0 : insets.bottom,
        },
      ]}
    >
      <View style={{ width: columnWidth, height: availableHeight }}>
        <View style={{ height: topBandHeight }} />
        {hasUtilities ? <View pointerEvents="box-none" style={[styles.utilitiesOverlay, { width: utilitiesWidth, top: toolbarHeight }]}>
          <TokenStrip previousLabel={t('board.previousTokens')} nextLabel={t('board.nextTokens')}>
            {view.loose.map((c, i) => (
              <Token
                key={`${c}-${i}`}
                size={52}
                character={c}
                printName name={e.name(c)}
                accessibilityLabel={t('board.inPlay', { name: e.name(c) })}
                {...(live ? { onPress: openLoose } : {})}
              />
            ))}
            {view.grants.map((g) => (
              <View key={g.key} style={styles.grant} accessibilityLabel={grantA11y(g.character, g.from)}>
                <Token size={tokenSize.corner} character={g.character} printName name={e.name(g.character)} />
                <Text style={[type.text.label, styles.grantName, { color: p.text }]} numberOfLines={1}>
                  {grantLabel(g.from)}
                </Text>
              </View>
            ))}
          </TokenStrip>
        </View> : null}

        <View style={{ paddingTop: geometry.fitted ? 0 : utilitiesHeight }}>
          <View style={styles.ring}>
            <SeatRing seats={view.seats} band={geometry.band} geometry={ring} free={free} obstacles={geometry.obstacles} t={t} readOnly={b.lookingBack}
              {...(b.replay ? { lit: b.replay.steps[b.replay.at]!.seats } : {})}
              {...(turnAt ? { turnAt } : {})} turnDocked={turnDocked} onTurnSize={updateTurnSize}
              panelDocked={panelDocked} {...(panelAt ? { panelAt } : {})} deal={deal}
              {...(live ? { onAddReminder: addReminder, onRemoveReminder: removeReminder, onEditNote: editNote } : {})}
              {...(reminderTarget !== undefined ? { ringed: reminderTarget } : {})}
              {...(live && !arranging ? { onMoveReminder: moveReminder } : {})} {...(arranging && live && seatCount < maxSeats ? { onGap: addSeat } : {})}
              {...(arranging && live && !hasCenterPanel ? { onArrangeDone: stopArranging, ...(free ? { onBackToCircle: backToCircle } : {}),
                ...(seatCount > 1 ? { onTurn: turnSeats, onMoveSeat: moveSeat, onPlaceSeat: placeSeat,
                onChooseSeat: setChosenSeat, ...(chosenSeat !== undefined ? { chosenSeat } : {}) } : {}) } : {})} />
          </View>
          {winner ? <VictoryAnnouncement winner={winner} label={t(winner === 'good' ? 'board.goodWins' : 'board.evilWins')}
            boxes={resultBoxes} band={ring.band} left={(columnWidth - geometry.band.width) / 2}
            {...(actionsCentred ? { actions: { node: actions, room: actionsRoom } } : {})}
            top={geometry.fitted ? 0 : utilitiesHeight} /> : null}
        </View>

        <View pointerEvents="box-none" style={[styles.statusBand, { height: statusHeight, width: columnWidth }]}>
          <View onLayout={event => {
            const { width, height } = event.nativeEvent.layout
            setBluffsSize(sameSize({ width, height }))
          }} {...(actionsDocked ? aside : naming !== undefined ? resting : {})}
          style={actionsDocked ? styles.aside : naming !== undefined ? styles.resting : null}>
            {/* A small game deals no bluffs, but ones already saved stay where they can be seen. */}
            {evilLearnsTeam(board) || view.bluffs.length > 0
              ? <BoardBluffs bluffs={view.bluffs} boardWidth={availableWidth} clockWidth={clockWidth} canEdit={live} titled={!landscape || availableHeight >= tallBoard} onOpen={openBluffs} />
              : null}
          </View>
        </View>


      </View>
    </View>
  )

  return (
    <PageEnter>
      <View style={[styles.root, { backgroundColor: p.felt }]} accessibilityLabel={scriptName(board.script)}>
        <Velvet colour={b.boardColour} ornaments={live ? noOrnaments : replayOrnaments} />
        <View ref={tableView} style={[styles.root, styles.row]}>
          {table}
        </View>
        <View onLayout={event => setClockHeight(event.nativeEvent.layout.height)} {...(actionsDocked ? aside : naming !== undefined ? resting : {})}
          style={[styles.clockCorner, { right: insets.right + space.md, bottom: insets.bottom + space.md + (b.lookingBack ? replayBarHeight : 0) },
            actionsDocked ? styles.aside : naming !== undefined ? styles.resting : null]}>
          <PhasePlaque t={t} windowOpen={phaseAction && (phaseOpen || choosingSeats)}
            clock={{ width: clockWidth,
              // A result on the velvet says the game is over; an older ending without one needs saying here.
              phase: over && !winner ? b.phaseLabel
                : b.statusPhase === 'setup' ? t('board.setup') : t(b.statusPhase === 'day' ? 'board.day' : 'board.night', { n: board.clock.night }),
              timer: !b.lookingBack && board.clock.phase === 'day' ? timer : null,
              phaseIcon: b.statusPhase === 'setup' ? 'setup' : b.statusPhase === 'day' ? 'sun' : 'order',
              aliveLabel: t('board.aliveCount', { alive: board.seats.filter((seat) => seat.alive).length, total: seatCount }),
              ...(b.elapsedStartedAt !== undefined ? { startedAt: b.elapsedStartedAt } : { elapsedMs: b.elapsedMs ?? 0 }) }}
            onPhase={phaseAction && board.clock.phase !== 'night' ? () => {
              if (pick) cancelRequest()
              setPhaseOpen(!phaseOpen)
              setReferenceTab(null)
            } : undefined}
            diedTonight={b.view?.diedTonight.flatMap(id => b.view?.seats.filter(seat => seat.id === id)
              .map(seat => ({ name: seat.name, character: seat.characterName })) ?? [])}
            onStartDay={phaseAction && board.clock.phase === 'night' ? () => {
              cancelRequest()
              e.append({ kind: 'phase', to: 'day' })
              setReferenceTab(null)
              setPhaseOpen(false)
            } : undefined} />
        </View>
        {panelDocked && live ? <View pointerEvents="box-none" style={[styles.dockedPanel, {
          left: insets.left + (availableWidth - dockWidth) / 2, width: dockWidth, bottom: insets.bottom + space.xs }]}>
          {interaction.centerPanel}
        </View> : null}
        {arranging && live && !hasCenterPanel && turnDocked ? <ArrangeControls t={t} docked={{ height: statusHeight - space.xs }}
          onTurn={seatCount > 1 ? turnSeats : undefined} onDone={stopArranging} onBackToCircle={backToCircle}
          hint={seatCount > 1 ? chosenSeat !== undefined ? t('board.arrangeChosen', { name: board.seats.find(seat => seat.id === chosenSeat)?.name ?? '' })
            : t('board.arrangeHint') : undefined}
          style={[styles.dockedPanel, { left: insets.left + (availableWidth - dockWidth) / 2, width: dockWidth, bottom: insets.bottom + space.xs }]} /> : null}
        {actionsDocked ? <GameOverActions t={t} docked onPlayAgain={b.playAgain} onReplay={b.enterReplay} onHome={b.goHome}
          style={[styles.dockedPanel, styles.dockedActions, { left: insets.left, right: insets.right, bottom: insets.bottom + space.md }]} /> : null}
        {/* A finished game needs neither Show a card nor More: what it offers is under the result. */}
        {/* A pick named in the toolbar grows it over the velvet, so the ring keeps the room it
            had and no seat moves. */}
        {live && !over ? <View onLayout={event => {
          const { width, height } = event.nativeEvent.layout
          if (naming === undefined) setToolbarSize(sameSize({ width, height }))
        }} pointerEvents="box-none"
          style={[styles.floatingToolbar, { top: insets.top + space.md, right: insets.right + space.md }]}>{toolbar}</View> : null}
        {/* Alone in its corner, away from Show a card and More: nothing puts an undone action
            back, so a tap aimed at another control must never land here. */}
        {live ? <View style={[styles.floatingToolbar, styles.undo, { top: insets.top + space.md, left: insets.left + space.md }]}>
          <EdgeButton icon="undo" label={t('common.undo')} onPress={() => undo?.()} disabled={!undo || naming !== undefined} />
        </View> : null}
        {/* Mounted in replay too, hidden, so the drawer remembers its position for the board session. */}
        <ReferenceDrawer shown={live} tab={referenceTab} viewport={availableWidth} upright={!landscape} seatsRight={seatsRight} board={tableView}
          seatTapsAct={!choosingSeats && !arranging} resting={naming !== undefined}
          top={insets.top + toolbarHeight} right={insets.right} bottom={insets.bottom + space.sm}
          height={window.height - insets.top - insets.bottom - toolbarHeight - space.sm} bottomClearance={clockHeight + space.md}
          onTabChange={changeReference} onOpen={openReference} onClose={closeReference} onReserve={setReservedWidth} />
        {live ? <PanelVisibilityContext.Provider value={{ open: !pick && !interaction.centerPanel && (phaseOpen || choosingSeats), onClose: () => setPhaseOpen(false), closeLabel: t('common.close') }}>
          {panels[board.clock.phase]}
        </PanelVisibilityContext.Provider> : null}
        {b.lookingBack ? <>
          <View onLayout={event => {
            const { width, height } = event.nativeEvent.layout
            setExitSize(sameSize({ width, height }))
          }} style={[styles.replayControls, { top: insets.top + space.md, right: insets.right + space.md }]}>
            <Button label={t('history.exitReplay')} onPress={b.returnToPresent} variant="text" />
          </View>
          {b.replay ? <ReplayBar steps={b.replay.steps} at={b.replay.at} bottom={insets.bottom} /> : null}
        </> : null}

        <ReminderPicker target={reminderTarget} onClose={() => setReminderTarget(undefined)}
          onWriteNote={seat => { setReminderTarget(undefined); setNoteTarget({ kind: 'new', seat }) }} />
        <NoteEditor target={noteTarget} onClose={() => setNoteTarget(undefined)} />
        <ShowSheet visible={showOpen} onClose={() => setShowOpen(false)} onBluffs={openBluffs} />
        <BluffPicker board={board} bluffs={view.bluffs} canEdit={live} well={bluffsWell} visible={bluffsOpen} onClose={() => setBluffsOpen(false)} />
        <LooseCharacters board={board} disabled={b.lookingBack} visible={looseOpen} onClose={() => setLooseOpen(false)} />
        <History visible={historyOpen && live} chapters={b.chapters} onClose={() => setHistoryOpen(false)} />
        <EndGame visible={endOpen} t={t} window={window}
          onClose={() => setEndOpen(false)} onEnd={winner => {
            if (b.lookingBack || over) return
            e.append({ kind: 'endGame', winner })
            setEndOpen(false)
            setPhaseOpen(false)
            setReferenceTab(null)
            interaction.cancelRequest()
            interaction.setSeatAction(undefined)
          }} />
        <Confirm
          visible={confirmHome}
          title={t('board.goHomeTitle')}
          message={t('board.goHomeMessage')}
          confirmLabel={t('board.goHomeConfirm')}
          cancelLabel={t('common.cancel')}
          onConfirm={() => {
            setConfirmHome(false)
            b.goHome()
          }}
          onCancel={() => setConfirmHome(false)}
        />
        {interaction.card ? (
          // The tokens alone have no words, and a card's characters and a note's words change as
          // they are typed, so the dialog takes the card's name.
          <Modal visible animationType="none" onRequestClose={interaction.closeCard}
            aria-label={interaction.card.spec.kind === 'custom' ? t('board.customNote') : interaction.card.spec.words || t('board.cardTokenOnly')}>
            <Card spec={interaction.card.spec} editing={interaction.card.editing} takes={takes(interaction.card.spec.kind)}
              keys={cardKeys(board, interaction.card.spec.kind).map((g) => ({
                key: g.key,
                label: g.key === 'inPlay' ? t('board.inPlayGroup') : e.teamLabel(g.key),
                color: g.key === 'inPlay' ? p.ink : p.teamOnPaper[g.key],
                keys: g.ids.map((id) => ({ id, name: e.name(id) })),
              }))}
              {...(interaction.card.spec.kind === 'custom' && cardNote ? { note: cardNote } : {})}
              onDismiss={interaction.closeCard}
              labels={{
                close: t('common.close'), holdHint: t('board.cardHoldToClose'), change: t('board.cardChange'),
                show: t('board.showBluffsNow'), takeLast: t('board.cardTakeLast'), done: t('common.done'),
                takeOff: (name) => t('board.removeChip', { label: name }),
                placeholder: t('board.notePlaceholder'), message: t('board.noteMessage'), letters: t('board.noteLetters'),
                tokens: t('board.noteTokens'), keep: t('board.noteKeep'), yes: t('board.noteYes'), no: t('board.noteNo'),
              }} />
          </Modal>
        ) : null}
      </View>
    </PageEnter>
  )
}

interface ReferenceDrawerProps {
  readonly shown: boolean
  readonly tab: ReferenceTab | null
  readonly viewport: number // the board's width inside the safe insets
  readonly upright: boolean // a window no wider than it is tall, which docks the drawer sooner
  readonly board: RefObject<ViewInstance | null> // the table: seats, ring and bluffs, under the drawer
  readonly seatTapsAct: boolean // a seat tap only opens its menu: no vote, pick or arrangement is running
  readonly resting: boolean // a named pick is waiting, so the tabs and paper are dimmed
  readonly seatsRight: number // the right edge of the rightmost token, in board coordinates
  readonly top: number
  readonly right: number
  readonly bottom: number
  readonly height: number
  readonly bottomClearance: number
  readonly onTabChange: (tab: ReferenceTab | null) => void
  readonly onOpen: () => void
  readonly onClose: () => void
  readonly onReserve: (width: number) => void // the width the board gives up to the drawer
}

// The reference and its drawer. The width changes on every frame of a slide or a drag, so it
// stays here, and the board hears only the width it gives up: below the docking minimum's width
// that never changes, so the ring and the corners are left alone while the paper moves.
const ReferenceDrawer = memo(function ReferenceDrawer({ shown, tab, viewport, upright, seatsRight, board, seatTapsAct, resting: dimmed, top, right, bottom, height,
  bottomClearance, onTabChange, onOpen, onClose, onReserve }: ReferenceDrawerProps) {
  const drawer = useReferenceDrawer(tab !== null, viewport, upright, onOpen, onClose, onReserve)
  const { referenceWidth } = boardLayoutFor(viewport, drawer.width, upright)
  const overlapsSeats = seatsRight > viewport - referenceWidth
  // While the paper covers seats, a tap on the board closes it. A plain tap on a seat, the reason
  // to reach past the paper, also opens that seat's menu, so it is not spent on the drawer. Any
  // other tap only closes it: a reminder, a gap, a panel's button or a seat while a vote, a pick,
  // the arrangement or another seat's menu is open would record an edit, and a tap meant to put
  // the paper away must not. The click is heard on the way down, since a pressable stops its
  // bubbling, and the drawer closes after its dispatch, so the seat cannot move under the finger
  // first. A pan, a pinch or a dragged reminder ends far from where it began and leaves it open.
  const closing = shown && tab !== null && !drawer.dragging && overlapsSeats
  useEffect(() => {
    if (!closing) return
    let pending: ReturnType<typeof setTimeout> | undefined
    let down = { x: 0, y: 0 }
    const press = (event: PointerEvent) => { down = { x: event.clientX, y: event.clientY } }
    const close = (event: MouseEvent) => {
      const table = domElement(board.current)
      const target = event.target as Element
      if (!table?.contains(target)) return
      // A keyboard or assistive click has no pointer, so it is never a drag.
      if (event.detail > 0 && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 10) return
      // An open seat menu is a window of its own, so its rows act as ever.
      const acts = !!target.closest('[data-layer]') || (seatTapsAct && !!target.closest('[data-seat-context-target]')
        && !target.closest('[data-chip]') && !table.querySelector('[role="group"][data-layer]'))
      if (!acts) { event.stopPropagation(); event.preventDefault() }
      pending = setTimeout(onClose, 0)
    }
    document.addEventListener('pointerdown', press, true)
    document.addEventListener('click', close, true)
    return () => {
      document.removeEventListener('pointerdown', press, true)
      document.removeEventListener('click', close, true)
      clearTimeout(pending)
    }
  }, [closing, seatTapsAct, board, onClose])
  if (!shown) return null
  return <>
    <View {...(dimmed ? resting : {})} style={[styles.referenceRail, { top, right, zIndex: 5, bottom }, dimmed ? styles.resting : null]}>
      <ReferenceRail tab={tab} width={referenceWidth} bottomClearance={bottomClearance}
        height={height} maximumWidth={drawer.maximum}
        dragging={drawer.dragging} dragHandlers={drawer.handlers} onResizeKey={drawer.keyboard}
        onTabChange={onTabChange} />
    </View>
  </>
})

const styles = StyleSheet.create({
  root: { flex: 1 },
  // Above the reference, so the first tap on a toolbar control acts while the paper is out.
  floatingToolbar: { position: 'absolute', zIndex: 6 },
  // The toolbar's frame around one control.
  undo: { padding: space.xxs, borderRadius: radius.control, backgroundColor: palette.ink, borderWidth: hairline,
    borderColor: palette.inkMuted, boxShadow: shadows.lifted },
  referenceRail: { position: 'absolute' },
  row: { flexDirection: 'row' },
  column: { flex: 1, minWidth: 0 },
  ring: { alignItems: 'center' },
  replayControls: { position: 'absolute', flexDirection: 'row', alignItems: 'center', gap: space.sm, zIndex: 2 },
  // Loose characters and grants remain on the board; their picker lives in More.
  utilitiesOverlay: { position: 'absolute', right: space.md, height: tokenStripHeight, zIndex: 1, flexDirection: 'row', alignItems: 'center' },
  // The band along the foot holds the bluffs outside the ring; the geometry sets its height.
  statusBand: { position: 'absolute', left: 0, bottom: 0, flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-end', paddingHorizontal: space.md, paddingBottom: space.md, gap: space.sm },
  // The plaque holds the phase control, so it stays above an open reference like the toolbar.
  clockCorner: { position: 'absolute', zIndex: 6 },
  // Over the bluffs and clock while a vote runs; neither is needed until it ends.
  dockedPanel: { position: 'absolute', zIndex: 7 },
  dockedActions: { alignItems: 'center' },
  aside: { opacity: 0 },
  resting: { opacity: motion.disabledOpacity },
  grant: { alignItems: 'center', width: tokenSize.corner + space.xl },
  grantName: { textAlign: 'center', width: tokenSize.corner + space.xl },
})
