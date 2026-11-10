// The board bound to the store: the open game, its view for the ring and the corners, the clock's
// facts, and the edge's callbacks. The component reads this and draws; the store appends. What
// is transient (a dialog open, a sheet open) stays in the component.
import { useIsFocused, useRouter } from 'expo-router'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type { BoardColour, Translate } from '../../content'
import type { Grimoire } from '../../engine'
import type { GameId } from '../../store'
import { canRedo, canUndo, useStore } from '../../store'
import { homePath } from '../../ui/homePath'
import type { BoardView } from './board'
import { boardView } from './board'
import { elapsedClockStart, elapsedPlayTime, gameClock } from '../../store/gameTiming'
import { phaseLabel as phaseOf } from '../../store/gameSummary'
import { replayStart } from '../../store/replay'

export interface BoardBinding {
  readonly boardColour: BoardColour
  readonly t: Translate
  readonly missing: boolean // the store has no game under this id
  readonly board?: Grimoire // undefined while the game opens
  readonly view?: BoardView
  readonly phaseLabel: string // "Night 2", "Day 2", "Setup", "Game over"
  readonly statusPhase: 'setup' | 'day' | 'night' // retain the last played phase after ending
  readonly elapsedMs?: number
  readonly elapsedStartedAt?: number
  readonly lookingBack: boolean // every appending control is disabled while set
  readonly undo?: () => void // while the live game has an action after its opening table
  readonly redo?: () => void // once an action was undone, until the next edit
  readonly returnToPresent: () => void
  readonly enterReplay: () => void
  readonly goHome: () => void
}

export const useBoard = (raw: string, replay = false): BoardBinding => {
  // The route hands over a string; it is the game id the store minted.
  const id = raw as GameId
  const store = useStore()
  const router = useRouter()
  const [missing, setMissing] = useState(false)
  const session = store.session
  const open = session?.game.id === id
  const t = store.t
  const focused = useIsFocused()
  const lookingBack = replay || (open && session?.lookingAt !== undefined)
  const setPlaying = store.setPlaying
  useEffect(() => {
    if (!open || !focused || lookingBack) return
    setPlaying(id)
    return () => setPlaying(undefined)
  }, [id, open, focused, lookingBack, setPlaying])

  const lookAt = store.lookAt
  // The router applies a params change only after the next commit, so leaving a replay clears
  // the cursor while the address still says replay. Until the flag drops, the replay must not
  // start over.
  const leaving = useRef(false)
  useEffect(() => {
    if (!replay) leaving.current = false
    else if (!leaving.current && focused && open && session && session.lookingAt === undefined) lookAt(replayStart(session.game.log))
  }, [replay, focused, open, session, lookAt])

  // Only the route in front opens its game: a board left in the stack behind history, or behind
  // another game's board, would otherwise reopen its own game every time the front one did.
  useEffect(() => {
    if (open || !focused) return
    void store.open(id).then((found) => setMissing(!found))
    // The store's identity changes on every commit; only the id, the open flag and focus matter here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, open, focused])

  const board = open ? store.board : undefined
  const log = open ? session?.game.log : undefined
  const locale = store.settings.locale
  const cursor = session?.lookingAt
  const view = useMemo(() => (board && log ? boardView(board, log.slice(0, cursor), locale) : undefined), [board, log, locale, cursor])

  const clock = board?.clock
  const phaseLabel = useMemo(() => (clock ? phaseOf(clock, t) : ''), [clock, t])

  const goHome = useCallback(() => {
    store.close()
    router.replace(lookingBack ? '/history' : homePath(locale))
  }, [store, router, lookingBack, locale])
  const returnToPresent = useCallback(() => {
    leaving.current = replay
    router.setParams({ replay: '0' })
    store.returnToPresent()
  }, [router, store, replay])
  const enterReplay = useCallback(() => router.setParams({ replay: '1' }), [router])

  const visibleLog = open && session ? session.game.log.slice(0, session.lookingAt) : []
  const lastPhase = visibleLog.findLast(event => event.kind === 'phase' && event.to !== 'over')
  const statusPhase = clock?.phase === 'over'
    ? lastPhase?.kind === 'phase' && lastPhase.to !== 'over' ? lastPhase.to : 'setup'
    : clock?.phase ?? 'setup'
  const timing = gameClock(visibleLog)
  const stoppedAt = open && session?.lookingAt !== undefined ? visibleLog.at(-1)?.recordedAt : timing.endedAt
  const elapsedMs = open && session
    ? elapsedPlayTime(session.game, visibleLog, stoppedAt) : undefined
  const elapsedStartedAt = open && session && focused && !lookingBack
    ? elapsedClockStart(session.game, store.playStartedAt) : undefined

  return {
    boardColour: store.settings.boardColour,
    t,
    missing,
    ...(board ? { board } : {}),
    ...(view ? { view } : {}),
    phaseLabel,
    statusPhase,
    ...(elapsedMs !== undefined ? { elapsedMs } : {}),
    ...(elapsedStartedAt !== undefined ? { elapsedStartedAt } : {}),
    lookingBack,
    ...(open && session && canUndo(session) ? { undo: store.undo } : {}),
    ...(open && session && canRedo(session) ? { redo: store.redo } : {}),
    returnToPresent,
    enterReplay,
    goHome,
  }
}
