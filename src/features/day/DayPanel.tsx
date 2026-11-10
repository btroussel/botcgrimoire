import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Translate } from '../../content'
import type { EventId, Nomination } from '../../engine'
import { asEventId, canNominate, nominationThresholds, onTheBlock, today } from '../../engine'
import { useStore } from '../../store'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import { Button, IconButton, focusStyle, isFocused } from '../../ui/Button'
import { Panel } from '../../ui/Panel'
import { Icon } from '../../ui/icons'
import { useFocusVisible } from '../../ui/focus'
import { palette, space, tabular, type } from '../../ui/theme'
import { DayTimerControls } from './DayTimer'
import { furthestHand, recordedVoteWeight } from './votes'
import { NominationControls } from './NominationControls'
import { cancelNomination, confirmNomination, nominationGhostVotes, resetNominationVotes } from './nominationEdits'

// The open ballot is screen state, not an edit, so it lives in the tab: a reload, such as the
// automatic update, reopens the controls on the same nomination instead of stranding its hands.
const openBallotKey = (game: string) => `botc-open-nomination:${game}`
const readOpenBallot = (game: string | undefined): EventId | undefined => {
  if (!game) return undefined
  try {
    const saved = sessionStorage.getItem(openBallotKey(game))
    return saved === null ? undefined : asEventId(Number(saved))
  } catch { return undefined }
}
const writeOpenBallot = (game: string, id: EventId | undefined) => {
  try {
    if (id === undefined) sessionStorage.removeItem(openBallotKey(game))
    else sessionStorage.setItem(openBallotKey(game), String(id))
  } catch { /* private windows can refuse storage; the controls then close on reload */ }
}

export const DayPanel = () => {
  const { board, session, append, appendAll, t } = useStore()
  const interaction = useBoardInteraction()
  const [expanded, setExpanded] = useState<EventId>()
  const [activeId, setActiveId] = useState<EventId | undefined>(() => readOpenBallot(session?.game.id))
  const gameId = session?.game.id
  useEffect(() => { if (gameId) writeOpenBallot(gameId, activeId) }, [gameId, activeId])
  const { cancelRequest, setSeatAction, setNominate, setCenterPanel, setVoteArc } = interaction
  useEffect(() => cancelRequest, [cancelRequest])
  const nominations = useMemo(() => board ? today(board)?.nominations ?? [] : [], [board])
  // Undoing Done or Mark gives the ballot back unconfirmed, so its controls reopen on it.
  const log = session?.game.log
  const [seen, setSeen] = useState(log)
  if (log !== seen) {
    setSeen(log)
    const undone = log && seen && log.length < seen.length ? seen.slice(log.length).find(e => e.kind === 'setVoteTotal') : undefined
    if (undone?.kind === 'setVoteTotal' && nominations.some(n => n.opened === undone.nomination)) setActiveId(undone.nomination)
  }
  const current = nominations.find(n => n.opened === activeId)
  const replaying = session?.lookingAt !== undefined
  const name = useCallback((id: string) => board?.seats.find(seat => seat.id === id)?.name ?? t('board.storyteller'), [board, t])
  // The ring hands back its seats' ids as plain strings; each one names a seat on this board.
  const seatIn = useCallback((id: string) => board?.seats.find(seat => seat.id === id)?.id, [board])
  // Hands are recorded as soon as a nomination is open: a tap on an eligible player toggles theirs.
  useEffect(() => {
    if (!board || !current || replaying) {
      setSeatAction(undefined)
      return
    }
    const log = session?.game.log ?? []
    const spentHere = nominationGhostVotes(log, current.opened)
    setSeatAction({
      allowed: board.seats.filter(seat => seat.alive || seat.ghostVote || spentHere.has(seat.id) || current.votes.includes(seat.id)).map(seat => seat.id),
      marked: current.votes,
      markedLabel: t('day.voted'),
      onTap: id => {
        const seat = seatIn(id)
        if (!seat) return
        append(current.votes.includes(seat)
          ? { kind: 'unvote', nomination: current.opened, seat, weight: recordedVoteWeight(log, current.opened, seat) ?? 1 }
          : { kind: 'vote', nomination: current.opened, seat, weight: 1, free: true })
      },
    })
    return () => setSeatAction(undefined)
  }, [board, current, replaying, session, append, t, seatIn, setSeatAction])
  const closeVoting = useCallback(() => setActiveId(undefined), [])
  const cancel = useCallback((nomination: Nomination) => {
    if (!session || replaying) return
    appendAll(cancelNomination(session.game.log, nomination))
    if (expanded === nomination.opened) setExpanded(undefined)
    if (current?.opened === nomination.opened) closeVoting()
  }, [session, replaying, appendAll, expanded, current, closeVoting])
  const nominate = useCallback((nominator: string, nominee: string) => {
    if (!board || !session || replaying || board.clock.phase !== 'day') return
    const day = today(board)
    if (!canNominate(day, nominator, nominee)) return
    const by = seatIn(nominator)
    const of = seatIn(nominee)
    if (!by || !of) return
    const initializeMarker = day?.markedForExecution === undefined
    appendAll([
      ...(initializeMarker ? [{ kind: 'markForExecution' as const, seat: onTheBlock(board) ?? null }] : []),
      { kind: 'nominate', by, of },
    ])
    setActiveId(asEventId(session.game.log.length + (initializeMarker ? 1 : 0)))
    setExpanded(undefined)
  }, [board, session, replaying, appendAll, seatIn])
  useEffect(() => {
    setNominate(nominate)
    return () => setNominate(undefined)
  }, [nominate, setNominate])
  const controls = useMemo(() => {
    if (!board || !current || !session || replaying) return null
    return <NominationControls by={name(current.by)} of={name(current.of)} count={current.weight}
      thresholds={nominationThresholds(board, current.opened)} t={t}
      onDone={() => { appendAll(confirmNomination(board, session.game.log, current, { mark: false })); closeVoting() }}
      canReset={current.votes.length > 0 || current.weight !== 0}
      onReset={() => appendAll(resetNominationVotes(session.game.log, current))}
      onMark={() => { appendAll(confirmNomination(board, session.game.log, current)); closeVoting() }}
      canMark={current.of !== 'storyteller' && board.seats.some(seat => seat.id === current.of)} />
  }, [board, current, session, replaying, name, t, closeVoting, appendAll])
  useEffect(() => {
    setCenterPanel(controls)
    return () => setCenterPanel(null)
  }, [controls, setCenterPanel])
  useEffect(() => {
    setVoteArc(board && current && controls ? { nominee: current.of,
      reached: furthestHand(board.seats.map(seat => seat.id), current.of, current.votes),
      label: t('day.nominationArrow', { by: name(current.by), of: name(current.of) }) } : undefined)
    return () => setVoteArc(undefined)
  }, [board, current, controls, name, t, setVoteArc])
  if (activeId !== undefined && !current) closeVoting()
  if (!board) return null
  const title = t('board.day', { n: board.clock.night })
  const highestTotal = Math.max(0, ...nominations.map(n => n.weight))
  return <Panel title={title}
    footer={<Button surface="paper" variant="primary" label={t('day.manualNight')} disabled={replaying}
      onPress={() => append({ kind: 'phase', to: 'night', night: board.clock.night + 1 })} />}>
    <DayTimerControls />
    {nominations.map((n, index) => <NominationRow key={n.opened} index={index} by={name(n.by)} of={name(n.of)} count={n.weight}
      voters={n.votes.map(name)} leading={highestTotal > 0 && n.weight === highestTotal} expanded={expanded === n.opened} t={t}
      onToggle={() => setExpanded(expanded === n.opened ? undefined : n.opened)} onCancel={() => cancel(n)} />)}
  </Panel>
}

const NominationRow = ({ index, by, of, count, voters, leading, expanded, t, onToggle, onCancel }: {
  readonly index: number
  readonly by: string
  readonly of: string
  readonly count: number
  readonly voters: readonly string[]
  readonly leading: boolean
  readonly expanded: boolean
  readonly t: Translate
  readonly onToggle: () => void
  readonly onCancel: () => void
}) => {
  const focusVisible = useFocusVisible()
  return <View style={[styles.row, leading && styles.leading]}>
    <View style={styles.rowLine}>
      <Pressable accessibilityRole="button" aria-expanded={expanded}
        accessibilityLabel={[t('day.manualNomination', { by, of, count }), leading ? t('day.mostVotes') : ''].filter(Boolean).join('. ')}
        onPress={onToggle}
        style={state => [styles.summary, (expanded || state.pressed) && styles.summaryOpen, focusStyle(palette, focusVisible && isFocused(state), 'paper')]}>
        <Text style={[type.text.small, tabular, styles.index]}>{index + 1}.</Text>
        <View style={styles.names}>
          <Text style={[type.text.strong, styles.ink]}>{by} → {of}</Text>
          <Text style={[leading ? type.text.strong : type.text.small, tabular, leading ? styles.ink : styles.muted]}>
            {count} {t('day.votesLabel', { count })}
          </Text>
        </View>
        <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={16} color={palette.inkMuted} />
      </Pressable>
      <IconButton surface="paper" icon="close" label={t('day.cancelNomination', { by, of })} onPress={onCancel} />
    </View>
    {expanded ? <View style={styles.voters}>
      {voters.length ? voters.map((voter, i) => <Text key={i} style={[type.text.body, styles.ink, styles.voter]}>{voter}</Text>)
        : <Text style={[type.text.small, styles.muted]}>{t('day.noVoters')}</Text>}
    </View> : null}
  </View>
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderColor: palette.parchmentShade, borderLeftWidth: 3, borderLeftColor: 'transparent', paddingLeft: space.xs },
  leading: { borderLeftColor: palette.accent, backgroundColor: palette.paperPressed },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  summary: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: space.md },
  summaryOpen: { backgroundColor: palette.paperInset },
  index: { color: palette.inkMuted },
  names: { flex: 1, minWidth: 0 },
  ink: { color: palette.ink },
  muted: { color: palette.inkMuted },
  voters: { paddingHorizontal: space.md, paddingBottom: space.md, flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xs },
  voter: { width: '50%', minWidth: 0, paddingRight: space.sm },
})
