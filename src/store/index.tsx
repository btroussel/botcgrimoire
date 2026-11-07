// The React binding (docs/store.md): one context with the session, the derived board, the
// cursor's operations, the list of saved games, the custom scripts and characters, the settings,
// and the translator bound to the locale.
// No store library, nothing that is not the session or a view of it; the one channel between
// windows only says which game was written.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

import type { Homebrew, Locale, Script, Translate, Values } from '../content'
import { registerHomebrew, t as translate } from '../content'
import type { Grimoire, Payload } from '../engine'
import type { SavedScript, SavedScriptId } from './customScripts'
import * as db from './db'
import type { SavedCharacter } from './homebrew'
import { registryOf } from './homebrew'
import type { DayTimerAction } from './dayTimer'
import type { Draw } from './draw'
import { gameClock, recordPlayTime } from './gameTiming'
import type { ContentMismatch, GameId, SavedGame } from './saved'
import { contentMismatch, newGame } from './saved'
import * as cursor from './session'
import type { Session } from './session'
import type { Settings } from './settings'
import { defaultSettings, withDefaults } from './settings'

export type { SavedScript, SavedScriptId } from './customScripts'
export { mintScriptId, serializeScript } from './customScripts'
export { getDraft, putDraft } from './db'
export type { Draw, DrawToken } from './draw'
export type { SavedCharacter } from './homebrew'
export { mintCharacterId } from './homebrew'
export type { GameId, SavedGame } from './saved'
export { boardOf, inLocale } from './session'

export interface Store {
  readonly ready: boolean
  readonly games: readonly SavedGame[]
  readonly scripts: readonly SavedScript[] // the custom scripts on this device, newest edit first
  readonly saveScript: (script: SavedScript) => Promise<void> // replaces the one with the same id
  readonly removeScript: (id: SavedScriptId) => Promise<void>
  readonly characters: readonly SavedCharacter[] // the Storyteller's own homebrew, newest edit first
  readonly saveCharacter: (character: Homebrew) => Promise<void> // also updates the saved scripts carrying it
  readonly removeCharacter: (id: string) => Promise<void>
  readonly settings: Settings
  readonly setSettings: (patch: Partial<Settings>) => void
  readonly session?: Session
  readonly board?: Grimoire
  readonly contentMismatch?: ContentMismatch // the open game was played on other content
  readonly open: (id: GameId) => Promise<boolean>
  readonly close: () => void
  readonly setPlaying: (id: GameId | undefined) => void
  readonly playStartedAt?: number // the current active interval, never persisted without an end
  readonly create: (script: Script) => Promise<GameId>
  readonly remove: (id: GameId) => Promise<void>
  readonly importGame: (text: string) => Promise<GameId>
  readonly append: (payload: Payload) => void
  readonly appendAll: (payloads: readonly Payload[]) => void // one commit
  readonly undo: () => void
  readonly redo: () => void
  readonly lookAt: (n: number) => void
  readonly returnToPresent: () => void
  readonly updateDayTimer: (action: DayTimerAction) => void
  readonly setDraw: (draw: Draw | undefined) => void // the bag set aside for the players to draw
  readonly t: Translate
}

const StoreContext = createContext<Store | undefined>(undefined)

// `page` matches the exported HTML; only the initial entry can seed an unset preference.
export const StoreProvider = ({ children, page }: { readonly children: ReactNode; readonly page?: Locale | undefined }) => {
  const initialPage = useRef(page)
  const [ready, setReady] = useState(false)
  const [games, setGames] = useState<readonly SavedGame[]>([])
  const [scripts, setScripts] = useState<readonly SavedScript[]>([])
  const [characters, setCharacters] = useState<readonly SavedCharacter[]>([])
  const [settings, setSettingsState] = useState<Settings>(() => defaultSettings(page))
  const [session, setSession] = useState<Session | undefined>(undefined)
  // The session as of the last change, not the last render: an append made right after another
  // in the same tick, or right after `create`, builds on the log those left rather than the one
  // this render captured.
  const live = useRef<Session | undefined>(undefined)
  const [playingId, setPlaying] = useState<GameId>()
  const [playStartedAt, setPlayStartedAt] = useState<number>()
  const activePlay = useRef<{ id: GameId; start: number } | undefined>(undefined)
  // What the homebrew registry is built from, as of the last write rather than the last render.
  // Registering happens beside each state change, never during a render, so a screen reads the
  // records its new state needs and the art pieces subscribed to the registry hear of it.
  const held = useRef<{ games: readonly SavedGame[]; scripts: readonly SavedScript[]; characters: readonly SavedCharacter[] }>({ games: [], scripts: [], characters: [] })
  const register = useCallback(() => {
    const { games, scripts, characters } = held.current
    registerHomebrew(registryOf(games, scripts, characters, live.current?.game.script))
  }, [])
  const replace = useCallback((next: Session | undefined) => {
    const script = live.current?.game.script
    live.current = next
    if (next?.game.script !== script) register()
    setSession(next)
  }, [register])

  const refresh = useCallback(async () => {
    const [saved, custom, own] = await Promise.all([db.listGames(), db.listScripts(), db.listCharacters()])
    held.current = { games: saved, scripts: custom, characters: own }
    register()
    setGames(saved)
    setScripts(custom)
    setCharacters(own)
  }, [register])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const [saved] = await Promise.all([db.getSettings(), db.purgeDeleted(Date.now())])
        if (!alive) return
        const loaded = withDefaults(saved, initialPage.current)
        setSettingsState(loaded)
        // Keep the first language across later visits, including launches at the PWA root.
        if (loaded.locale !== saved?.locale) await db.putSettings(loaded)
        await refresh()
      } catch {
        // Storage refused, as in some private windows: keep the defaults and an empty list, so
        // screens waiting on `ready` still open instead of waiting forever.
      }
      if (alive) setReady(true)
    })()
    return () => {
      alive = false
    }
  }, [refresh])

  const setSettings = useCallback((patch: Partial<Settings>) => {
    setSettingsState((current) => {
      const next = { ...current, ...patch }
      void db.putSettings(next)
      return next
    })
  }, [])

  // Windows of the app on one device share the database, and each writes a game whole, so a
  // window still holding an older copy would put it back over newer edits at its next save, its
  // play-time checkpoint included (docs/store.md). Every write, delete and import tells the other
  // windows, and one holding that game takes the stored copy whenever any of it differs, timer,
  // bag and play time with the log, before it can write again. A write the database refuses as
  // stale takes the stored copy too, and replays its own edits onto it. `seen` is the copy this
  // window last read or wrote.
  const otherWindows = useRef<BroadcastChannel | undefined>(undefined)
  const seen = useRef<SavedGame | undefined>(undefined)
  const announce = useCallback((id: GameId) => otherWindows.current?.postMessage({ saved: id }), [])
  const adopt = useCallback((game: SavedGame) => {
    const current = live.current
    seen.current = game
    if (current?.game.id !== game.id || db.sameRecord(game, current.game)) return
    // A look back stays on its step while the log still reaches it.
    replace({ ...cursor.openSession(game), ...(current.lookingAt !== undefined && current.lookingAt <= game.log.length ? { lookingAt: current.lookingAt } : {}) })
    setGames((gs) => gs.map((g) => (g.id === game.id ? game : g)))
  }, [replace])
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const channel = new BroadcastChannel('botcgrimoire-saved-games')
    otherWindows.current = channel
    channel.onmessage = (event: MessageEvent<{ readonly saved?: GameId }>) => {
      const id = event.data?.saved
      if (id === undefined || live.current?.game.id !== id) return
      // A game deleted elsewhere stays on screen here, but its writes are refused from now on.
      void db.getGame(id).then((game) => { if (game) adopt(game) })
    }
    return () => {
      channel.close()
      otherWindows.current = undefined
    }
  }, [adopt])

  // Every change to the session is written whole and swapped into the games list in place:
  // re-reading the database here would hand every other saved game a new identity on each
  // appended event, and the home rows behind the board would reduce their logs again for nothing.
  // `refresh` is for the writes that change which games exist.
  // A write refused because another window wrote first takes that window's copy and makes this
  // window's own new edits again on top of it, so neither window's edits are lost.
  const recommit = useRef<(next: Session) => void>(() => {})
  const commit = useCallback(
    (next: Session) => {
      const active = activePlay.current
      if (active?.id === next.game.id) next = { ...next, game: recordPlayTime(next.game, active.start, Date.now()) }
      replace(next)
      const written = next.game
      const prior = seen.current?.id === written.id ? seen.current : undefined
      seen.current = written
      void db.putGameOver(written, prior).then((refused) => {
        if (refused === undefined) { announce(written.id); return }
        if (refused === null) return
        const replayed = prior ? cursor.replayOnto(refused, prior, written, Date.now()) : undefined
        adopt(refused)
        if (replayed && replayed.game.log.length > refused.log.length && live.current?.game.id === written.id) recommit.current(replayed)
      })
      setGames((gs) => gs.map((g) => (g.id === next.game.id ? next.game : g)).sort((a, b) => b.updatedAt - a.updatedAt))
    },
    [replace, announce, adopt],
  )
  useEffect(() => { recommit.current = commit }, [commit])

  const pause = useCallback(() => {
    if (activePlay.current && live.current) commit(live.current)
    activePlay.current = undefined
    setPlayStartedAt(undefined)
  }, [commit])

  const sessionId = session?.game.id
  const phase = session ? gameClock(session.game.log).state : undefined
  const lookingBack = session?.lookingAt !== undefined
  useEffect(() => {
    if (!sessionId || playingId !== sessionId || phase === 'over' || lookingBack) return
    const resume = () => {
      pause()
      if (document.visibilityState === 'visible') {
        const start = Date.now()
        activePlay.current = { id: sessionId, start }
        setPlayStartedAt(start)
      }
    }
    resume()
    // Checkpoints have an end time, never a persisted running clock. An abrupt exit
    // may lose the uncheckpointed tail; it cannot add hours while the app is closed.
    const timer = setInterval(() => {
      if (activePlay.current && live.current) commit(live.current)
    }, 30_000)
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('pagehide', pause)
    window.addEventListener('pageshow', resume)
    return () => {
      pause()
      clearInterval(timer)
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('pagehide', pause)
      window.removeEventListener('pageshow', resume)
    }
  }, [sessionId, playingId, phase, lookingBack, commit, pause])

  const open = useCallback(
    async (id: GameId) => {
      pause()
      const game = await db.getGame(id)
      if (!game) return false
      seen.current = game
      replace(cursor.openSession(game))
      return true
    },
    [replace, pause],
  )

  const close = useCallback(() => {
    pause()
    replace(undefined)
  }, [replace, pause])

  const create = useCallback(
    async (script: Script) => {
      pause()
      const game = newGame(script, Date.now())
      await db.putGame(game)
      seen.current = game
      await refresh()
      replace(cursor.openSession(game))
      return game.id
    },
    [replace, refresh, pause],
  )

  const remove = useCallback(
    async (id: GameId) => {
      await db.deleteGame(id)
      announce(id)
      if (live.current?.game.id === id) replace(undefined)
      await refresh()
    },
    [replace, refresh, announce],
  )

  const saveScript = useCallback(
    async (script: SavedScript) => {
      await db.putScript(script)
      await refresh()
    },
    [refresh],
  )
  const removeScript = useCallback(
    async (id: SavedScriptId) => {
      await db.deleteScript(id)
      await refresh()
    },
    [refresh],
  )

  // A saved script carries a copy of each character it uses, so it follows the edit; a game keeps
  // the copy it was created with.
  const saveCharacter = useCallback(
    async (character: Homebrew) => {
      await db.putCharacter({ character, updatedAt: Date.now() })
      await refresh()
    },
    [refresh],
  )
  const removeCharacter = useCallback(
    async (id: string) => {
      await db.deleteCharacter(id)
      await refresh()
    },
    [refresh],
  )

  const importGame = useCallback(
    async (text: string) => {
      const id = await db.importGame(text)
      announce(id)
      await refresh()
      return id
    },
    [refresh, announce],
  )

  const append = useCallback(
    (payload: Payload) => {
      if (live.current) commit(cursor.append(live.current, payload, Date.now()))
    },
    [commit],
  )
  const appendAll = useCallback(
    (payloads: readonly Payload[]) => {
      if (live.current) commit(cursor.appendAll(live.current, payloads, Date.now()))
    },
    [commit],
  )
  const undo = useCallback(() => {
    if (live.current) commit(cursor.undo(live.current, Date.now()))
  }, [commit])
  const redo = useCallback(() => {
    if (live.current) commit(cursor.redo(live.current, Date.now()))
  }, [commit])
  const lookAt = useCallback(
    (n: number) => {
      pause()
      if (live.current?.game.dayTimer) commit(cursor.updateDayTimer(live.current, 'pause', Date.now()))
      if (live.current) replace(cursor.lookAt(live.current, n))
    },
    [replace, pause, commit],
  )
  const updateDayTimer = useCallback((action: DayTimerAction) => {
    if (live.current) commit(cursor.updateDayTimer(live.current, action, Date.now()))
  }, [commit])
  const setDraw = useCallback((draw: Draw | undefined) => {
    if (live.current) commit(cursor.setDraw(live.current, draw))
  }, [commit])
  const returnToPresent = useCallback(() => {
    if (live.current) replace(cursor.returnToPresent(live.current))
  }, [replace])

  // Present for as long as the game is open and gone with it. The pin never changes while a
  // game is open, so this is one report per open, on the game's own content record.
  const game = session?.game
  const mismatch = useMemo(() => (game ? contentMismatch(game) : undefined), [game])
  const locale: Locale = settings.locale
  const t = useCallback((key: string, values?: Values) => translate(locale, key, values), [locale])
  const board = useMemo(() => (session ? cursor.inLocale(cursor.boardOf(session), locale) : undefined), [session, locale])

  const value = useMemo<Store>(
    () => ({
      ready,
      games,
      scripts,
      saveScript,
      removeScript,
      characters,
      saveCharacter,
      removeCharacter,
      settings,
      setSettings,
      ...(session ? { session } : {}),
      ...(board ? { board } : {}),
      ...(mismatch ? { contentMismatch: mismatch } : {}),
      open,
      close,
      setPlaying,
      ...(playStartedAt !== undefined ? { playStartedAt } : {}),
      create,
      remove,
      importGame,
      append,
      appendAll,
      undo,
      redo,
      lookAt,
      returnToPresent,
      updateDayTimer,
      setDraw,
      t,
    }),
    [
      ready,
      games,
      scripts,
      saveScript,
      removeScript,
      characters,
      saveCharacter,
      removeCharacter,
      settings,
      setSettings,
      session,
      playStartedAt,
      board,
      mismatch,
      open,
      close,
      create,
      remove,
      importGame,
      append,
      appendAll,
      undo,
      redo,
      lookAt,
      returnToPresent,
      updateDayTimer,
      setDraw,
      t,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export const useStore = (): Store => {
  const store = useContext(StoreContext)
  if (!store) throw new Error('useStore outside of StoreProvider')
  return store
}
