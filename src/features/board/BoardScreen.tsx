// References reserve board width only when there is room for both. On smaller screens
// the paper overlays the board, without shrinking the seating circle to an unusable strip.
import { useKeepAwake } from 'expo-keep-awake'
import type { ReactNode, RefObject } from 'react'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import type { ViewInstance } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { emptySeat, scriptName } from '../../content'
import type { Translate } from '../../content'
import type { EventId, SeatId } from '../../engine'
import { BoardInteractionProvider, useBoardInteraction } from '../../ui/BoardInteraction'
import { boardLayoutFor, referenceTabWidth } from './boardLayout'
import { Button, IconButton } from '../../ui/Button'
import { Card } from './Card'
import { Confirm } from '../../ui/Confirm'
import { Empty } from '../../ui/Empty'
import { domElement, layerAbove } from '../../ui/focus'
import type { BoardPanels } from '../../ui/Panel'
import { PanelVisibilityContext } from '../../ui/Panel'
import { PaperTexture } from '../../ui/PaperTexture'
import { PageEnter, Screen } from '../../ui/Screen'
import { usePresence } from '../../ui/motion'
import { hairline, layout, palette, radius, scrim, seatMetrics, shadows, space, tokenSize, type } from '../../ui/theme'
import type { Size } from '../../ui/theme'
import { Token } from '../../ui/Token'
import { Velvet } from '../../ui/Velvet'
import { useLayoutViewport } from '../../ui/Viewport'
import { looseChoices } from './board'
import { BoardBluffs } from './BoardBluffs'
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
import { boardGeometry, tokenStripHeight, toolbarHeight } from './boardGeometry'
import { centreBoxes } from './ringLayout'
import { edits } from './seat'
import { SeatRing } from './SeatRing'
import { ShowSheet } from './ShowSheet'
import { TokenStrip } from './TokenStrip'
import { useBoard } from './useBoard'
import { useEdits } from './useEdits'
import { VictoryAnnouncement } from './VictoryAnnouncement'

export interface BoardScreenProps {
  readonly id: string // the game id the route was given
  readonly replay?: boolean
  readonly openSetup?: boolean // the board opens with its setup window up, as after discovery
  readonly deal?: boolean // the game was dealt just before it opened, so the ring deals it
  readonly panels: BoardPanels // each phase's node renders its own Panel into the slot
  readonly timer?: ReactNode
}

// A ring holds at most twenty seats, so arranging a full one offers no insertion markers.
const maxSeats = 20
// The result never runs wider than this, however much room the ring leaves.
const resultWidth = 560
// The toolbar, the plaque and the bluffs hold the other three corners.
const boardOrnaments = ['topLeft'] as const
// A control measured again at the same size keeps the board's layout as it was.
const sameSize = (next: Size) => (previous: Size) => previous.width === next.width && previous.height === next.height ? previous : next

export const BoardScreen = (props: BoardScreenProps) => (
  <BoardInteractionProvider>
    <Board {...props} />
  </BoardInteractionProvider>
)

const Board = ({ id, replay = false, openSetup = false, deal = false, panels, timer }: BoardScreenProps) => {
  const b = useBoard(id, replay)
  const e = useEdits()
  const interaction = useBoardInteraction()
  const insets = useSafeAreaInsets()
  const window = useLayoutViewport()
  const p = palette
  const t = b.t
  const [showOpen, setShowOpen] = useState(false)
  const [looseOpen, setLooseOpen] = useState(false)
  const [referenceTab, setReferenceTab] = useState<ReferenceTab | null>(null)
  const [phaseOpen, setPhaseOpen] = useState(openSetup)
  const [toolbarSize, setToolbarSize] = useState({ width: 260, height: 50 })
  // A first guess at the tray, its title included when upright, so the first fit is the last.
  const [bluffsSize, setBluffsSize] = useState({ width: 190, height: window.width > window.height ? 62 : 76 })
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
  const choosingSeats = !!interaction.pick || !!interaction.seatAction
  const { pick, cancelRequest } = interaction
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
  // Arranging the seats ends on a click anywhere but its own controls, or Escape.
  useEffect(() => {
    if (!arranging) return
    const stop = () => setArranging(false)
    const cancelOutside = (event: MouseEvent) => {
      // Keep the controls mounted until their press has recorded its edit.
      if (event.target instanceof Element && event.target.closest('[id^="seat-insertion-"], #ring-turn')) return
      stop()
    }
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') stop()
    }
    document.addEventListener('click', cancelOutside, true)
    document.addEventListener('keydown', cancelOnEscape)
    return () => {
      document.removeEventListener('click', cancelOutside, true)
      document.removeEventListener('keydown', cancelOnEscape)
    }
  }, [arranging])

  const availableWidth = window.width - insets.left - insets.right
  const availableHeight = Math.max(0, window.height - insets.top - insets.bottom - (b.lookingBack ? replayBarHeight : 0))
  const landscape = window.width > window.height
  const live = !b.lookingBack
  const seatCount = b.view?.seats.length ?? 0
  const stripCount = b.view ? b.view.loose.length + b.view.grants.length : 0
  const geometry = useMemo(() => boardGeometry({ width: availableWidth, height: availableHeight, landscape, live,
    reserved: reservedWidth, toolbar: toolbarSize, bluffs: bluffsSize, clockHeight, seats: seatCount, strip: stripCount }),
  [availableWidth, availableHeight, landscape, live, reservedWidth, toolbarSize, bluffsSize, clockHeight, seatCount, stripCount])
  const resultBoxes = useMemo(() => centreBoxes(geometry.ring, seatMetrics, resultWidth), [geometry.ring])
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
  const openLoose = useCallback(() => setLooseOpen(true), [])
  const openEnd = useCallback(() => setEndOpen(true), [])
  // A finished game has nothing left to resume, so Home leaves without asking.
  const over = b.board?.clock.phase === 'over' && !b.lookingBack
  const { goHome } = b
  const askHome = useCallback(() => over ? goHome() : setConfirmHome(true), [over, goHome])
  // One mode places new seats and turns the ring to where the players sat down, after the draw
  // or later, so the table can be laid out in one pass.
  const toggleArrange = useCallback(() => {
    setArranging(!arranging)
    if (!arranging) {
      cancelRequest()
      setPhaseOpen(false)
    }
  }, [arranging, cancelRequest])
  const stopArranging = useCallback(() => setArranging(false), [])

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

  const winner = board.clock.phase === 'over' ? board.result?.winner : undefined
  const { columnWidth, statusHeight, utilitiesHeight, utilitiesWidth, clockWidth, topBandHeight } = geometry
  const hasUtilities = stripCount > 0
  const panelDocked = !!interaction.centerPanel && geometry.panelDocks
  const dockWidth = Math.min(440, availableWidth - 2 * space.sm)

  const grantLabel = (from: string | undefined) => from ?? t('board.storyteller')
  const grantA11y = (characterId: string, from: string | undefined) =>
    from === undefined
      ? t('board.grantOwn', { character: e.name(characterId) })
      : t('board.grantFrom', { character: e.name(characterId), name: from })

  const addSeat = (at: number) => {
    if (seatCount >= maxSeats) return
    let nextNumber = seatCount + 1
    while (board.seats.some(seat => seat.name === t('setup.defaultSeat', { n: nextNumber }))) nextNumber++
    e.append(edits.addSeat(t('setup.defaultSeat', { n: nextNumber }), at, emptySeat, 'good'))
  }
  const turnSeats = (direction: 'clockwise' | 'counterclockwise') => {
    const edit = edits.turnSeats(board.seats.map(seat => seat.id), direction)
    if (edit && live) e.append(edit)
  }

  const phaseAction = live && !over
  const toolbar = <BoardToolbar t={t}
    arranging={arranging} onArrange={toggleArrange}
    arrangeDisabled={seatCount >= maxSeats && (seatCount < 2 || hasCenterPanel)}
    onShow={openShow}
    onLoose={openLoose} looseDisabled={looseChoices(board.script).length === 0}
    onEnd={openEnd} endDisabled={over}
    onReplay={over ? b.enterReplay : undefined} onHome={askHome}
    />

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
            <SeatRing seats={view.seats} band={geometry.band} geometry={geometry.ring} t={t} readOnly={b.lookingBack} panelDocked={panelDocked} deal={deal} {...(live ? { onAddReminder: addReminder, onRemoveReminder: removeReminder, onEditNote: editNote } : {})}
              {...(live && !arranging ? { onMoveReminder: moveReminder } : {})} {...(arranging && live && seatCount < maxSeats ? { onGap: addSeat } : {})}
              {...(arranging && live && !hasCenterPanel ? { onArrangeDone: stopArranging, ...(seatCount > 1 ? { onTurn: turnSeats } : {}) } : {})} />
          </View>
          {winner ? <VictoryAnnouncement winner={winner} label={t(winner === 'good' ? 'board.goodWins' : 'board.evilWins')}
            boxes={resultBoxes} band={geometry.ring.band} left={(columnWidth - geometry.band.width) / 2}
            top={geometry.fitted ? 0 : utilitiesHeight} /> : null}
        </View>

        <View pointerEvents="box-none" style={[styles.statusBand, { height: statusHeight, width: columnWidth }]}>
          <View onLayout={event => {
            const { width, height } = event.nativeEvent.layout
            setBluffsSize(sameSize({ width, height }))
          }}>
            {/* A small game deals no bluffs, but ones already saved stay where they can be seen. */}
            {evilLearnsTeam(board) || view.bluffs.length > 0
              ? <BoardBluffs board={board} bluffs={view.bluffs} boardWidth={availableWidth} clockWidth={clockWidth} canEdit={live} titled={!landscape} />
              : null}
          </View>
        </View>


      </View>
    </View>
  )

  return (
    <PageEnter>
      <View style={[styles.root, { backgroundColor: p.felt }]} accessibilityLabel={scriptName(board.script)}>
        {/* The toolbar, the plaque and the bluffs hold three corners, in replay too. */}
        <Velvet colour={b.boardColour} ornaments={boardOrnaments} />
        <View ref={tableView} style={[styles.root, styles.row]}>
          {table}
        </View>
        <View onLayout={event => setClockHeight(event.nativeEvent.layout.height)}
          style={[styles.clockCorner, { right: insets.right + space.md, bottom: insets.bottom + space.md + (b.lookingBack ? replayBarHeight : 0) }]}>
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
        {live ? <View onLayout={event => {
          const { width, height } = event.nativeEvent.layout
          setToolbarSize(sameSize({ width, height }))
        }}
          style={[styles.floatingToolbar, { top: insets.top + space.md, right: insets.right + space.md }]}>{toolbar}</View> : null}
        {/* Mounted in replay too, hidden, so the drawer remembers its position for the board session. */}
        <ReferenceDrawer shown={live} tab={referenceTab} viewport={availableWidth} upright={!landscape} seatsRight={geometry.seatsRight} board={tableView}
          top={insets.top + toolbarHeight} right={insets.right} bottom={insets.bottom + space.sm}
          height={window.height - insets.top - insets.bottom - toolbarHeight - space.sm} bottomClearance={clockHeight + space.md}
          onTabChange={changeReference} onOpen={openReference} onClose={closeReference} onReserve={setReservedWidth} />
        {live ? <PanelVisibilityContext.Provider value={{ open: !pick && !interaction.centerPanel && (phaseOpen || choosingSeats), onClose: () => setPhaseOpen(false), closeLabel: t('common.close') }}>
          {panels[board.clock.phase]}
        </PanelVisibilityContext.Provider> : null}
        {b.lookingBack ? <>
          <View style={[styles.replayControls, { top: insets.top + space.md, right: insets.right + space.md }]}>
            <Button label={t('history.exitReplay')} onPress={b.returnToPresent} variant="text" />
          </View>
          <ReplayBar bottom={insets.bottom} />
        </> : null}

        <ReminderPicker target={reminderTarget} onClose={() => setReminderTarget(undefined)}
          onWriteNote={seat => { setReminderTarget(undefined); setNoteTarget({ kind: 'new', seat }) }} />
        <NoteEditor target={noteTarget} onClose={() => setNoteTarget(undefined)} />
        <ShowSheet visible={showOpen} onClose={() => setShowOpen(false)} onReopen={openShow} />
        <LooseCharacters board={board} disabled={b.lookingBack} visible={looseOpen} onClose={() => setLooseOpen(false)} />
        <EndGameDialog visible={endOpen} t={t} width={Math.min(layout.dialogWidth, window.width - 2 * space.lg)}
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
          <Modal visible animationType="none" onRequestClose={interaction.closeCard}
            aria-label={interaction.card.words || interaction.card.characters?.map((c) => c.name).join(', ')}>
            <Card spec={interaction.card} onDismiss={interaction.closeCard} closeLabel={t('common.close')} />
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
const ReferenceDrawer = memo(function ReferenceDrawer({ shown, tab, viewport, upright, seatsRight, board, top, right, bottom, height, bottomClearance,
  onTabChange, onOpen, onClose, onReserve }: ReferenceDrawerProps) {
  const drawer = useReferenceDrawer(tab !== null, viewport, upright, onOpen, onClose, onReserve)
  const { referenceWidth } = boardLayoutFor(viewport, drawer.width, upright)
  const overlapsSeats = seatsRight > viewport - referenceWidth
  // While the paper covers seats, a tap on the board closes it once the tap has done its own
  // work, so a seat opens its menu on the first tap instead of the tap going to the drawer, and
  // the seat cannot move under the finger before it lands. A pan or a pinch makes no click. A
  // pressable stops its click from bubbling, so the click is heard on the way down and the
  // drawer closes after its dispatch.
  const closing = shown && tab !== null && !drawer.dragging && overlapsSeats
  useEffect(() => {
    if (!closing) return
    let pending: ReturnType<typeof setTimeout> | undefined
    const close = (event: MouseEvent) => {
      if (domElement(board.current)?.contains(event.target as Node)) pending = setTimeout(onClose, 0)
    }
    document.addEventListener('click', close, true)
    return () => { document.removeEventListener('click', close, true); clearTimeout(pending) }
  }, [closing, board, onClose])
  if (!shown) return null
  return <>
    <View style={[styles.referenceRail, { top, right, zIndex: 5, bottom }]}>
      <ReferenceRail tab={tab} width={referenceWidth} bottomClearance={bottomClearance}
        height={height} maximumWidth={drawer.maximum} onExpand={drawer.expand}
        dragging={drawer.dragging} dragHandlers={drawer.handlers} onResizeKey={drawer.keyboard}
        onTabChange={onTabChange} />
    </View>
  </>
})

// The result dialog arrives and leaves like every other floating window.
const EndGameDialog = ({ visible, width, t, onClose, onEnd }: {
  readonly visible: boolean
  readonly width: number
  readonly t: Translate
  readonly onClose: () => void
  readonly onEnd: (winner: 'good' | 'evil') => void
}) => {
  const { mounted, opacity, scale } = usePresence(visible)
  if (!mounted) return null
  return <Modal visible transparent animationType="none" onRequestClose={onClose} aria-label={t('board.endGame')}>
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: scrim.dialog, opacity }]}>
      <Pressable accessible={false} focusable={false} style={StyleSheet.absoluteFill} onPress={onClose} />
    </Animated.View>
    <View style={styles.endOverlay} pointerEvents={visible ? 'box-none' : 'none'}>
      <Animated.View style={[styles.endDialog, { width, opacity, transform: [{ scale }] }]}>
        <PaperTexture radius={radius.dialog} />
        <View style={styles.endHeading}>
          <Text accessibilityRole="header" style={[type.display.title, { color: palette.ink, flex: 1 }]}>{t('board.endGame')}</Text>
          <IconButton icon="close" label={t('common.close')} surface="paper" onPress={onClose} />
        </View>
        {(['good', 'evil'] as const).map(winner => <Button key={winner}
          label={t(winner === 'good' ? 'board.goodWins' : 'board.evilWins')}
          surface="paper" variant="primary" tone={winner} onPress={() => onEnd(winner)} />)}
      </Animated.View>
    </View>
  </Modal>
}

const styles = StyleSheet.create({
  endOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.lg },
  endDialog: { backgroundColor: palette.parchment, borderRadius: radius.dialog, padding: space.xl, gap: space.md,
    borderWidth: hairline, borderColor: palette.accent, boxShadow: shadows.sheet },
  endHeading: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  root: { flex: 1 },
  // Above the reference's outside-click catcher, so the first tap on a toolbar control acts.
  floatingToolbar: { position: 'absolute', zIndex: 6 },
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
  grant: { alignItems: 'center', width: tokenSize.corner + space.xl },
  grantName: { textAlign: 'center', width: tokenSize.corner + space.xl },
})
