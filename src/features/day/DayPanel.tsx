import { useCallback, useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { Translate } from '../../content'
import type { EventId, Nomination } from '../../engine'
import { asEventId, exileThreshold, nominationThresholds, onTheBlock, today } from '../../engine'
import { useStore } from '../../store'
import { useBoardInteraction } from '../../ui/BoardInteraction'
import { Button, IconButton, focusStyle, isFocused } from '../../ui/Button'
import { Panel } from '../../ui/Panel'
import { Icon } from '../../ui/icons'
import { useFocusVisible } from '../../ui/focus'
import { palette, radius, space, type } from '../../ui/theme'
import { DayTimerControls } from './DayTimer'
import { recordedVoteWeight, votingOrder } from './votes'
import { NominationControls } from './NominationControls'
import { cancelNomination, confirmNomination, endDay, resetNominationVotes } from './nominationEdits'

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
  const { cancelRequest, setSeatAction, setNominate, setExile, setCenterPanel, setCountStart } = interaction
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
  const ballotTitle = useCallback((n: Nomination) => n.exile ? t('day.exileOf', { of: name(n.of) })
    : t('day.nominationArrow', { by: name(n.by), of: name(n.of) }), [name, t])
  // The ring hands back its seats' ids as plain strings; each one names a seat on this board.
  const seatIn = useCallback((id: string) => board?.seats.find(seat => seat.id === id)?.id, [board])
  // Hands are recorded as soon as a nomination is open: a tap on any player toggles theirs. A dead
  // player with no ghost vote left still raises one, since an ability can let them vote again.
  // Each hand shows its place in the count, the number the Storyteller says out loud.
  useEffect(() => {
    if (!board || !current || replaying) {
      setSeatAction(undefined)
      return
    }
    const log = session?.game.log ?? []
    setSeatAction({
      allowed: board.seats.map(seat => seat.id),
      marked: votingOrder(board.seats.map(seat => seat.id), current.of, current.votes),
      markedLabel: place => t('day.voteNumber', { n: place }),
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
  // An exile leaves the execution's marker alone, so it opens with no marker edit.
  const exile = useCallback((traveller: string) => {
    if (!board || !session || replaying || board.clock.phase !== 'day') return
    const of = seatIn(traveller)
    if (!of) return
    append({ kind: 'nominate', by: 'storyteller', of, exile: true })
    setActiveId(asEventId(session.game.log.length))
    setExpanded(undefined)
  }, [board, session, replaying, append, seatIn])
  useEffect(() => {
    setExile(exile)
    return () => setExile(undefined)
  }, [exile, setExile])
  const controls = useMemo(() => {
    if (!board || !current || !session || replaying) return null
    return <NominationControls title={ballotTitle(current)} by={name(current.by)} of={name(current.of)} exile={!!current.exile} count={current.weight}
      thresholds={current.exile ? { execute: exileThreshold(board) } : nominationThresholds(board, current.opened)} t={t}
      onDone={() => { appendAll(confirmNomination(board, session.game.log, current, { mark: false })); closeVoting() }}
      canReset={current.votes.length > 0 || current.weight !== 0}
      onReset={() => appendAll(resetNominationVotes(session.game.log, current))}
      onMark={() => { appendAll(confirmNomination(board, session.game.log, current)); closeVoting() }}
      canMark={current.of !== 'storyteller' && board.seats.some(seat => seat.id === current.of)} />
  }, [board, current, session, replaying, ballotTitle, name, t, closeVoting, appendAll])
  useEffect(() => {
    setCenterPanel(controls)
    return () => setCenterPanel(null)
  }, [controls, setCenterPanel])
  useEffect(() => {
    setCountStart(current && controls ? { nominee: current.of, label: ballotTitle(current) } : undefined)
    return () => setCountStart(undefined)
  }, [current, controls, ballotTitle, setCountStart])
  if (activeId !== undefined && !current) closeVoting()
  if (!board) return null
  const title = t('board.day', { n: board.clock.night })
  const blocked = onTheBlock(board)
  // The skull sits on a seat, so its chip goes on that player's latest nomination.
  const blockRow = nominations.findLast(n => !n.exile && n.of === blocked)?.opened
  const next = board.clock.night + 1
  const startNight = (execute: boolean) => appendAll(endDay(board, { execute }))
  // With the skull on a player, the day ends in one of two ways and the panel names both.
  const footer = blocked ? <View style={styles.endDay}>
    <Button surface="paper" variant="primary" label={t('day.executeNight', { name: name(blocked), n: next })} disabled={replaying}
      onPress={() => startNight(true)} />
    <Button surface="paper" label={t('day.noExecutionNight', { n: next })} disabled={replaying} onPress={() => startNight(false)} />
  </View> : <Button surface="paper" variant="primary" label={t('day.manualNight')} disabled={replaying} onPress={() => startNight(false)} />
  return <Panel title={title} footer={footer}>
    <DayTimerControls />
    {nominations.map(n => <NominationRow key={n.opened} by={name(n.by)} of={name(n.of)} exile={!!n.exile} count={n.weight}
      voters={n.votes.map(name)} onBlock={n.opened === blockRow} expanded={expanded === n.opened} t={t}
      onToggle={() => setExpanded(expanded === n.opened ? undefined : n.opened)} onCancel={() => cancel(n)} />)}
  </Panel>
}

// A ledger line: the names, the count in a column on the right where the eye compares the day's
// votes, and the skull's own chip on the row that put a player on the block, so the list says
// what the board says. A tap on the row lists the hands.
const NominationRow = ({ by, of, exile, count, voters, onBlock, expanded, t, onToggle, onCancel }: {
  readonly by: string
  readonly of: string
  readonly exile: boolean
  readonly count: number
  readonly voters: readonly string[]
  readonly onBlock: boolean
  readonly expanded: boolean
  readonly t: Translate
  readonly onToggle: () => void
  readonly onCancel: () => void
}) => {
  const focusVisible = useFocusVisible()
  return <View style={styles.row}>
    <View style={styles.rowLine}>
      <Pressable accessibilityRole="button" aria-expanded={expanded}
        accessibilityLabel={[t(exile ? 'day.manualExile' : 'day.manualNomination', { by, of, count }), onBlock ? t('board.onBlock') : ''].filter(Boolean).join('. ')}
        onPress={onToggle}
        style={state => [styles.summary, (expanded || state.pressed) && styles.summaryOpen, focusStyle(palette, focusVisible && isFocused(state), 'paper')]}>
        <View style={styles.names}>
          <Text style={[type.text.strong, styles.ink]}>
            {exile ? t('day.exileOf', { of }) : <>{by}<Text style={styles.arrow}>{' → '}</Text>{of}</>}
          </Text>
          {onBlock ? <View style={styles.block}>
            <Icon name="skull" size={13} color={palette.parchment} />
            <Text style={[type.text.small, styles.blockLabel]}>{t('board.onBlock')}</Text>
          </View> : null}
        </View>
        <Text style={styles.tally}>
          <Text style={styles.count}>{count}</Text>
          {'\n'}
          <Text style={[type.text.small, styles.muted]}>{t('day.votesLabel', { count })}</Text>
        </Text>
      </Pressable>
      <IconButton surface="paper" icon="close" label={t(exile ? 'day.cancelExile' : 'day.cancelNomination', { by, of })} onPress={onCancel} />
    </View>
    {expanded ? <View style={styles.voters}>
      {voters.length ? voters.map((voter, i) => <Text key={i} style={[type.text.body, styles.ink, styles.voter]}>{voter}</Text>)
        : <Text style={[type.text.small, styles.muted]}>{t('day.noVoters')}</Text>}
    </View> : null}
  </View>
}

const styles = StyleSheet.create({
  row: { borderBottomWidth: 1, borderColor: palette.parchmentShade },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  summary: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm, paddingHorizontal: space.xs,
    borderRadius: radius.control },
  summaryOpen: { backgroundColor: palette.paperInset },
  names: { flex: 1, minWidth: 0, alignItems: 'flex-start', gap: space.xxs },
  arrow: { color: palette.inkMuted },
  block: { flexDirection: 'row', alignItems: 'center', gap: space.xxs, backgroundColor: palette.ink, borderRadius: 999,
    paddingLeft: space.xxs + 1, paddingRight: space.sm, paddingVertical: 1 },
  blockLabel: { color: palette.parchment, fontSize: 12, lineHeight: 16 },
  tally: { textAlign: 'right', fontSize: 12, lineHeight: 14 },
  count: { ...type.text.tally, fontSize: 24, lineHeight: 26, color: palette.ink },
  ink: { color: palette.ink },
  muted: { color: palette.inkMuted },
  voters: { paddingHorizontal: space.md, paddingBottom: space.md, flexDirection: 'row', flexWrap: 'wrap', rowGap: space.xs },
  voter: { width: '50%', minWidth: 0, paddingRight: space.sm },
  endDay: { gap: space.sm },
})
